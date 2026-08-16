#!/usr/bin/env bash
#
# Деплой subscription-tracker на сервер. Запускается НА СЕРВЕРЕ из корня репозитория:
#
#   ./deploy.sh                 обычный деплой
#   ./deploy.sh --dry-run       показать план, ничего не делая
#   ./deploy.sh --no-backup     пропустить бэкап базы
#   ./deploy.sh --migrate       выполнить миграции из server/scripts после накатки
#   ./deploy.sh --help          справка
#
# Что делает:
#   1. бэкап MongoDB и текущей статики (для отката)
#   2. git pull
#   3. npm ci — только если менялся соответствующий lock-файл
#   4. сборка и публикация фронта — только если менялся фронтовый код
#   5. pm2 restart — только если менялся серверный код
#   6. health-check; при неудаче — автоматический откат кода и статики
#
set -euo pipefail

# ── Настройки ────────────────────────────────────────────────────────────────
# Каталог статики намеренно оканчивается на .ru, хотя домен .com: папку не
# переименовывали при переезде (см. DEPLOY.md и TODO.md). Nginx смотрит сюда.
STATIC_DIR="${STATIC_DIR:-/var/www/fohunoff/data/www/tracker.fohunoff.ru}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/subscription-tracker}"
PM2_APP="${PM2_APP:-subscription-tracker-api}"
KEEP_BACKUPS="${KEEP_BACKUPS:-7}"
HEALTH_RETRIES="${HEALTH_RETRIES:-10}"
HEALTH_DELAY="${HEALTH_DELAY:-2}"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$REPO_DIR/server"
ENV_FILE="$SERVER_DIR/.env"

DRY_RUN=false
DO_BACKUP=true
RUN_MIGRATIONS=false

# ── Вывод ────────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'
else
  C_RESET=''; C_BOLD=''; C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''
fi

step()  { printf '%s▶ %s%s\n' "$C_BLUE$C_BOLD" "$*" "$C_RESET"; }
ok()    { printf '%s  ✓ %s%s\n' "$C_GREEN" "$*" "$C_RESET"; }
info()  { printf '    %s\n' "$*"; }
warn()  { printf '%s  ! %s%s\n' "$C_YELLOW" "$*" "$C_RESET"; }
fail()  { printf '%s✗ %s%s\n' "$C_RED$C_BOLD" "$*" "$C_RESET" >&2; }

run() {
  if $DRY_RUN; then
    printf '    [dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

usage() {
  sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 0
}

# ── Аргументы ────────────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)   DRY_RUN=true ;;
    --no-backup) DO_BACKUP=false ;;
    --migrate)   RUN_MIGRATIONS=true ;;
    -h|--help)   usage ;;
    *) fail "Неизвестный аргумент: $1 (см. --help)"; exit 1 ;;
  esac
  shift
done

cd "$REPO_DIR"

# ── Проверки окружения ───────────────────────────────────────────────────────
step "Проверка окружения"

[ -d .git ] || { fail "$REPO_DIR — не git-репозиторий"; exit 1; }
[ -f "$ENV_FILE" ] || { fail "Не найден $ENV_FILE — сервер без него не стартует"; exit 1; }

for cmd in git npm node; do
  command -v "$cmd" >/dev/null 2>&1 || { fail "Не найдена команда: $cmd"; exit 1; }
done

if ! git diff --quiet || ! git diff --cached --quiet; then
  if $DRY_RUN; then
    warn "В рабочем дереве есть несохранённые изменения (в dry-run это не блокирует)"
  else
    fail "В рабочем дереве есть несохранённые изменения — деплой остановлен"
    info "Разберитесь с ними: git status"
    exit 1
  fi
fi

# PORT и MONGODB_URI читаем из server/.env, не печатая значения с паролем
PORT="$(grep -E '^\s*PORT\s*=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d ' "' || true)"
PORT="${PORT:-3001}"
MONGODB_URI="$(grep -E '^\s*MONGODB_URI\s*=' "$ENV_FILE" | tail -1 | cut -d= -f2- | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s/^"//; s/"$//' || true)"

ok "Репозиторий: $REPO_DIR"
ok "Статика:     $STATIC_DIR"
ok "Бэкенд:      127.0.0.1:$PORT (pm2: $PM2_APP)"
$DRY_RUN && warn "Режим dry-run: изменения не выполняются"

PREVIOUS_COMMIT="$(git rev-parse HEAD)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
STATIC_BACKUP="$BACKUP_DIR/static_$TIMESTAMP.tar.gz"

# ── Бэкапы ───────────────────────────────────────────────────────────────────
if $DO_BACKUP; then
  step "Бэкап"
  run mkdir -p "$BACKUP_DIR"

  if command -v mongodump >/dev/null 2>&1 && [ -n "$MONGODB_URI" ]; then
    if $DRY_RUN; then
      info "[dry-run] mongodump --uri <из server/.env> --out $BACKUP_DIR/mongo_$TIMESTAMP"
    elif mongodump --uri "$MONGODB_URI" --out "$BACKUP_DIR/mongo_$TIMESTAMP" >/dev/null 2>&1; then
      ok "База: $BACKUP_DIR/mongo_$TIMESTAMP"
    else
      # Бэкап важен, но не должен блокировать деплой без миграций
      warn "mongodump завершился с ошибкой — база не забэкаплена"
      if $RUN_MIGRATIONS; then
        fail "С --migrate деплой без бэкапа небезопасен, останавливаюсь"
        exit 1
      fi
    fi
  else
    warn "mongodump не найден или MONGODB_URI пуст — база не бэкапится"
  fi

  if [ -d "$STATIC_DIR" ]; then
    run tar -czf "$STATIC_BACKUP" -C "$STATIC_DIR" .
    ok "Статика: $STATIC_BACKUP"
  fi

  # Ротация: оставляем KEEP_BACKUPS последних.
  # Без xargs -r — это GNU-расширение, скрипт должен работать и вне Linux.
  rotate_backups() {
    local pattern="$1"
    # ls возвращает ненулевой код, когда бэкапов ещё нет; с pipefail это уронило бы
    # весь скрипт, поэтому гасим код возврата явно.
    # shellcheck disable=SC2012  # ls тут нужен ради сортировки по времени
    { ls -1dt $pattern 2>/dev/null || true; } | tail -n +$((KEEP_BACKUPS + 1)) | while IFS= read -r old; do
      [ -e "$old" ] && rm -rf "$old"
    done
  }

  if ! $DRY_RUN; then
    rotate_backups "$BACKUP_DIR/mongo_*"
    rotate_backups "$BACKUP_DIR/static_*.tar.gz"
  fi
else
  warn "Бэкап пропущен (--no-backup)"
fi

# ── Обновление кода ──────────────────────────────────────────────────────────
step "Обновление кода"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
run git pull --ff-only origin "$BRANCH"

NEW_COMMIT="$(git rev-parse HEAD)"
if [ "$PREVIOUS_COMMIT" = "$NEW_COMMIT" ] && ! $DRY_RUN; then
  ok "Обновлений нет — уже на $(git rev-parse --short HEAD)"
  info "Продолжаю: пересборка и рестарт всё равно выполнятся"
else
  ok "$(git rev-parse --short "$PREVIOUS_COMMIT") → $(git rev-parse --short "$NEW_COMMIT")"
fi

# Что изменилось между старым и новым коммитом
changed() {
  [ "$PREVIOUS_COMMIT" = "$NEW_COMMIT" ] && return 0   # нет диффа — считаем, что нужно всё
  git diff --name-only "$PREVIOUS_COMMIT" "$NEW_COMMIT" -- "$@" | grep -q .
}

SERVER_CHANGED=true
FRONTEND_CHANGED=true
if [ "$PREVIOUS_COMMIT" != "$NEW_COMMIT" ]; then
  changed server/ && SERVER_CHANGED=true || SERVER_CHANGED=false
  changed src/ index.html vite.config.js tailwind.config.js postcss.config.js package.json package-lock.json \
    && FRONTEND_CHANGED=true || FRONTEND_CHANGED=false
fi

# ── Зависимости и сборка фронта ──────────────────────────────────────────────
if $FRONTEND_CHANGED; then
  step "Фронтенд"

  if changed package-lock.json package.json; then
    info "Изменился lock-файл — ставлю зависимости"
    run npm ci
  else
    info "Зависимости не менялись — пропускаю npm ci"
  fi

  run npm run build
  ok "Сборка готова"

  run sudo mkdir -p "$STATIC_DIR"
  run sudo cp -r dist/. "$STATIC_DIR/"
  run sudo chown -R "$(id -un):$(id -gn)" "$STATIC_DIR"
  ok "Статика опубликована"
else
  step "Фронтенд"
  info "Фронтовый код не менялся — пропускаю сборку"
fi

# ── Бэкенд ───────────────────────────────────────────────────────────────────
restart_backend() {
  # Пропуск npm ci при изменившихся зависимостях роняет процесс целиком
  # (ERR_MODULE_NOT_FOUND → 502 на весь /api/), поэтому ставим до рестарта.
  ( cd "$SERVER_DIR" && run npm ci --omit=dev )
  run pm2 restart "$PM2_APP" --update-env
}

if $SERVER_CHANGED; then
  step "Бэкенд"

  if command -v pm2 >/dev/null 2>&1; then
    if changed server/package-lock.json server/package.json; then
      info "Изменились зависимости сервера — npm ci"
      ( cd "$SERVER_DIR" && run npm ci --omit=dev )
    else
      info "Зависимости сервера не менялись"
    fi

    if $RUN_MIGRATIONS; then
      for script in "$SERVER_DIR"/scripts/*.js; do
        [ -e "$script" ] || continue
        info "Миграция: $(basename "$script")"
        ( cd "$SERVER_DIR" && run node "$script" )
      done
    fi

    run pm2 restart "$PM2_APP" --update-env
    ok "Процесс перезапущен"
  else
    warn "pm2 не найден — рестарт пропущен"
  fi
else
  step "Бэкенд"
  info "Серверный код не менялся — рестарт не требуется"
fi

# ── Health-check ─────────────────────────────────────────────────────────────
health_ok() {
  curl -fsS -m 5 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1
}

step "Проверка работоспособности"

if $DRY_RUN; then
  info "[dry-run] curl http://127.0.0.1:$PORT/api/health"
elif ! command -v curl >/dev/null 2>&1; then
  warn "curl не найден — проверка пропущена"
else
  HEALTHY=false
  for attempt in $(seq 1 "$HEALTH_RETRIES"); do
    if health_ok; then
      HEALTHY=true
      ok "API отвечает (попытка $attempt)"
      break
    fi
    sleep "$HEALTH_DELAY"
  done

  if ! $HEALTHY; then
    fail "API не отвечает после $HEALTH_RETRIES попыток — откатываюсь"

    # Откат кода
    git reset --hard "$PREVIOUS_COMMIT"
    info "Код возвращён на $(git rev-parse --short "$PREVIOUS_COMMIT")"

    # Откат статики: она уже перезаписана новой сборкой
    if [ -f "$STATIC_BACKUP" ]; then
      sudo rm -rf "${STATIC_DIR:?}/"*
      sudo tar -xzf "$STATIC_BACKUP" -C "$STATIC_DIR"
      sudo chown -R "$(id -un):$(id -gn)" "$STATIC_DIR"
      info "Статика восстановлена из $STATIC_BACKUP"
    else
      warn "Бэкапа статики нет — фронт остался от неудачного деплоя"
    fi

    restart_backend || true

    if health_ok; then
      fail "Откат выполнен, приложение работает на прежней версии"
    else
      fail "Откат выполнен, но API всё ещё не отвечает — смотрите: pm2 logs $PM2_APP"
    fi

    # База: миграции автоматически не откатываются
    if $RUN_MIGRATIONS && $DO_BACKUP; then
      warn "Выполнялись миграции. Если проблема в данных, восстановите базу вручную:"
      warn "  mongorestore --uri <MONGODB_URI> --drop $BACKUP_DIR/mongo_$TIMESTAMP"
    fi

    exit 1
  fi
fi

# ── Итог ─────────────────────────────────────────────────────────────────────
step "Готово"
if ! $DRY_RUN; then
  ok "Версия: $(git rev-parse --short HEAD) ($(git log -1 --pretty=%s | cut -c1-60))"
fi
$DO_BACKUP && info "Бэкапы: $BACKUP_DIR (храним последние $KEEP_BACKUPS)"
info "Логи бэкенда: pm2 logs $PM2_APP"
