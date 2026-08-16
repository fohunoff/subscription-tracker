# 🚀 Деплой приложения

Домен: **https://tracker.fohunoff.com**

Схема: Nginx отдаёт статику фронта и проксирует `/api/` на Node-бэкенд под PM2,
MongoDB — на том же хосте.

## Координаты на сервере

| Что | Где |
|---|---|
| Репозиторий | `/home/fohunoff/repos/subscription-tracker` |
| Код бэкенда | `/home/fohunoff/repos/subscription-tracker/server` |
| Статика фронта | `/var/www/fohunoff/data/www/tracker.fohunoff.ru` |
| Бэкенд слушает | `127.0.0.1:5000` (`PORT` в `server/.env`) |
| Процесс PM2 | `subscription-tracker-api` |
| MongoDB | база `subscription-tracker`, пользователь `fohunoff`, `authSource=admin` |

> ⚠️ **Путь к статике оканчивается на `.ru`, хотя домен — `.com`. Это не опечатка.**
> Папку намеренно не переименовывали при переезде; переименование лежит в отложенных
> задачах. Не «исправляйте» этот путь — Nginx смотрит именно туда.

## Где живёт конфигурация

| Что | Где задаётся | Примечание |
|---|---|---|
| Секреты бэкенда (`JWT_SECRET`, `MONGODB_URI`, `GOOGLE_CLIENT_ID`, `TELEGRAM_*`) | `server/.env` на сервере | В git не попадает, шаблон — `server/.env.example` |
| `PORT`, `NODE_ENV`, `FRONTEND_URL` | `server/.env` | `ecosystem.config.cjs` задаёт только `NODE_ENV` |
| Разрешённые CORS origin | `FRONTEND_URL` в `server/.env` | Несколько — через запятую |
| Адрес API для фронта | `VITE_API_URL` в `.env` в корне | Подставляется **на этапе сборки** |
| Процесс PM2 | `server/ecosystem.config.cjs` | Версионируется, секретов не содержит |

### VITE_API_URL — относительный путь, не абсолютный

В проде:

```
VITE_API_URL=/api
```

> ⚠️ Это осознанное решение, а не недоделка. Относительный путь означает, что бандл не
> привязан к домену: фронт стучится на тот же хост, с которого отдан, а Nginx проксирует
> `/api/` на бэкенд. Замена на полный URL (`https://tracker.fohunoff.com/api`) — шаг назад:
> она возвращает домен внутрь собранного бандла и делает следующий переезд снова болезненным.
> Не «улучшайте» это.

Локально при разработке фронт и бэкенд на разных портах, поэтому там абсолютный адрес
(`http://localhost:3001/api`) — см. `.env.example`. Порт локального бэкенда (3001)
намеренно отличается от продового (5000): и то и другое задаётся `PORT` в своём
`server/.env`.

### Fail-fast по секретам

`server/config.js` останавливает процесс при старте, если не заданы `JWT_SECRET` или
`GOOGLE_CLIENT_ID`. Fallback-ключа для JWT нет намеренно: иначе сервер при потерянной
переменной молча подписывал бы токены общеизвестным секретом.

## Деплой одной командой

```bash
cd /home/fohunoff/repos/subscription-tracker
./deploy.sh
```

Скрипт делает всё сам и в правильном порядке:

1. бэкап MongoDB и текущей статики (в `~/backups/subscription-tracker`, хранятся последние 7);
2. `git pull`;
3. `npm ci` — **только** если менялся соответствующий lock-файл;
4. сборка и публикация фронта — только если менялся фронтовый код;
5. `pm2 restart` — только если менялся серверный код;
6. health-check `/api/health` с повторами, **и при неудаче — автоматический откат**:
   код возвращается на предыдущий коммит, статика распаковывается из бэкапа,
   бэкенд перезапускается.

Ключи:

| Ключ | Зачем |
|---|---|
| `--dry-run` | показать план, ничего не делая |
| `--no-backup` | пропустить бэкап (быстрее, но откат статики станет невозможен) |
| `--migrate` | выполнить скрипты из `server/scripts/` после накатки |
| `--help` | справка |

Настройки переопределяются переменными окружения: `STATIC_DIR`, `BACKUP_DIR`,
`PM2_APP`, `KEEP_BACKUPS`, `HEALTH_RETRIES`, `HEALTH_DELAY`.

> ⚠️ **Откат не затрагивает базу.** Если деплой выполнялся с `--migrate` и проблема
> в данных, восстанавливать нужно вручную — скрипт печатает готовую команду
> `mongorestore` с путём к свежему бэкапу.

> Скрипт отказывается работать при незакоммиченных изменениях в рабочем дереве:
> иначе откат через `git reset --hard` затёр бы их без предупреждения.

## Ручная процедура (запасной вариант)

Если скрипт по какой-то причине неприменим — сборка выполняется **на сервере**:

```bash
cd /home/fohunoff/repos/subscription-tracker
git pull origin main
npm ci                            # если менялся package-lock.json; см. ниже про ci и install
npm run build
sudo cp -r dist/* /var/www/fohunoff/data/www/tracker.fohunoff.ru/
sudo chown -R fohunoff:fohunoff /var/www/fohunoff/data/www/tracker.fohunoff.ru
```

`VITE_*` вшиваются в бандл при сборке — после правки корневого `.env` обязательно
пересобрать, перезапуск Nginx ничего не изменит.

Ассеты собираются с хешем в имени (`vite.config.js`), поэтому старые файлы в целевой папке
не мешают новым; периодически её можно чистить перед копированием.

### Бэкенд вручную

```bash
cd /home/fohunoff/repos/subscription-tracker/server
git pull origin main
npm ci --omit=dev                 # не пропускать, см. предупреждение ниже
pm2 restart subscription-tracker-api --update-env
pm2 logs subscription-tracker-api
```

> ⚠️ **Установку зависимостей пропускать нельзя, если в коммите менялся lock-файл.**
> Отказ будет не мягким: Node не найдёт пакет при импорте, процесс упадёт с
> `ERR_MODULE_NOT_FOUND`, PM2 будет перезапускать его по кругу, а Nginx — отдавать
> **502 на все запросы к `/api/`**. Фронт при этом продолжает открываться (статика
> отдаётся отдельно), поэтому по внешнему виду сайта поломку легко не заметить.
>
> Так уже случилось при выкатке helmet и express-rate-limit: `git pull` + `pm2 restart`
> без установки зависимостей положили API примерно на минуту.
>
> Быстрый откат, если установка почему-то не проходит:
> `git revert --no-edit <коммит> && pm2 restart subscription-tracker-api --update-env`

### `npm ci` на сервере, `npm install` локально

| Где | Команда | Почему |
|---|---|---|
| Сервер | `npm ci --omit=dev` | Ставит строго по `package-lock.json` и **не меняет его**. Дерево остаётся чистым, `git pull` не упирается в изменённый lock |
| Локально | `npm install` | Обновляет `package-lock.json` при добавлении зависимостей — этот lock и коммитится |

`npm install --production` устарел, актуальный флаг — `--omit=dev`. Ровно из-за
`npm install` на сервере lock-файл однажды оказался изменённым и заблокировал
`git pull` с ошибкой «cannot pull with rebase: You have unstaged changes».
Лечится так: `git checkout -- server/package-lock.json`.

`deploy.sh` использует `npm ci` и запускает установку только при изменении lock-файла,
поэтому проблема не повторяется.

> ⚠️ **`server/package-lock.json` должен генерироваться npm той же мажорной версии,
> что стоит на сервере (сейчас npm 10, Node 22).** Пакет `mongodb` (внутри mongoose)
> объявляет опциональную peer-зависимость `gcp-metadata@^5.2.0`. npm 11 её игнорирует
> и не пишет в lock, а npm 10 требует — и падает с `EUSAGE: Missing: gcp-metadata@5.3.0
> from lock file`, то есть **`npm ci` на сервере перестаёт работать вовсе**.
>
> Если локально стоит npm 11, обновляйте lock так:
>
> ```bash
> cd server
> npx -y npm@10 install --package-lock-only
> ```
>
> Полученный lock принимают обе версии — это проверено. Признак проблемы: после
> обычного `npm install` из `server/package-lock.json` пропадают записи
> `node_modules/mongoose/node_modules/{gcp-metadata,gaxios,https-proxy-agent,agent-base,debug}`.

Первый запуск:

```bash
cp .env.example .env
nano .env                 # заполнить реальными значениями
mkdir -p logs
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

> ⚠️ `--env production` обязателен: без него PM2 возьмёт блок `env` (development).
> Расширение файла — `.cjs`, потому что `server/package.json` объявляет `"type": "module"`.

Проверка: `curl http://127.0.0.1:5000/api/health` — ожидается `status: OK` и
`database.status: connected`.

## Nginx

> ℹ️ Ниже — **рекомендуемый** вид конфига, а не дословная копия текущего. В реальном
> `/etc/nginx/sites-available/` строки `listen 443 ssl` и пути к сертификатам добавлены
> certbot'ом, а правил кэширования (`index.html` без кэша, `/assets/` надолго) может
> не быть. Кэширование стоит применить: без него браузеры держат старый `index.html`
> и пользователи после деплоя видят прежнюю версию, пока не сделают жёсткое обновление.
> Проверьте заодно `server_name` — он должен быть `tracker.fohunoff.com`.

```nginx
server {
    listen 443 ssl;
    server_name tracker.fohunoff.com;

    root /var/www/fohunoff/data/www/tracker.fohunoff.ru;   # .ru в пути — намеренно, см. выше

    location / {
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # index.html не кэшируем, иначе пользователи застревают на старом бандле
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Ассеты с хешем в имени — можно кэшировать надолго
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
nginx -t && systemctl reload nginx
```

## Чек-лист при смене домена

Домен фигурирует в нескольких местах, и поломки от рассинхрона молчаливые:

- [ ] `FRONTEND_URL` в `server/.env` → новый домен. На время перехода можно перечислить старый и новый через запятую. Без этого браузер получит CORS-ошибку.
- [ ] Google Cloud Console → OAuth Client → **Authorized JavaScript origins**: добавить новый домен. Без этого перестанет работать вход.
- [ ] `server_name` в конфиге Nginx и SSL-сертификат (`certbot --nginx -d <домен>`).
- [ ] `pm2 restart subscription-tracker-api --update-env`, затем `pm2 logs` — при старте печатается список разрешённых origin.
- [ ] Убедиться, что **старый сервер погашен**: Telegram-бот работает через long polling, два живых инстанса с одним токеном конфликтуют за `getUpdates` и теряют уведомления.
- [ ] `VITE_API_URL` трогать **не нужно** — он относительный (`/api`) именно ради этого.

## Диагностика

```bash
pm2 status && pm2 logs subscription-tracker-api
curl http://127.0.0.1:5000/api/health
nginx -t && tail -f /var/log/nginx/error.log
systemctl status mongod
```

Быстрая внешняя проверка, что запущена актуальная версия (можно с любой машины):

```bash
curl -sI https://tracker.fohunoff.com/api/health | grep -iE "x-powered-by|x-content-type|x-frame"
# ожидается: nosniff и SAMEORIGIN, X-Powered-By отсутствует (его снимает helmet)

curl -s -o /dev/null -w "%{http_code}\n" -H "Origin: https://evil.example.com" \
  https://tracker.fohunoff.com/api/health
# ожидается: 403
```

| Симптом | Смотреть |
|---|---|
| **502 на весь `/api/`, фронт при этом открывается** | В `pm2 logs` — `ERR_MODULE_NOT_FOUND`: после `git pull` забыт `npm install --production` |
| Фронт грузится, запросы падают с CORS | `FRONTEND_URL` в `server/.env`; в логе PM2 будет `⚠️ CORS: origin ... не входит в FRONTEND_URL` |
| Кнопка входа Google не работает | Authorized JavaScript origins в Google Cloud Console |
| Запросы уходят на localhost | Фронт собран без `VITE_API_URL=/api` |
| Сервер не стартует, в логе `❌ Обязательная переменная окружения` | Не заполнен `server/.env` |
| PM2 стартовал в development | Забыт `--env production` |
| Telegram-уведомления приходят через раз | Жив второй инстанс бота с тем же токеном |
| 404 на новых страницах после деплоя фронта | Не выполнен `cp -r dist/*` либо права не выставлены (`chown`) |

## Резервное копирование MongoDB

Регулярные бэкапы делает `deploy.sh` перед каждым деплоем. Отдельный ночной бэкап
настраивается так:

> 🔴 **Пароль от базы не должен попадать в файл внутри репозитория.** Скрипт ниже
> читает `MONGODB_URI` из `server/.env` (он в `.gitignore`) и сам лежит **вне**
> репозитория — в домашнем каталоге. Файл с подставленным паролем, созданный внутри
> `~/repos/subscription-tracker`, уедет в публичный GitHub при первом же `git add -A`.

Создайте `/home/fohunoff/backup-mongo.sh` (вне репозитория):

```bash
#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/home/fohunoff/repos/subscription-tracker/server/.env"
BACKUP_DIR="/home/fohunoff/backups/mongodb"
KEEP_DAYS=7

# URI берём из server/.env, а не хардкодим — пароль остаётся в одном месте
MONGODB_URI="$(grep -E '^\s*MONGODB_URI\s*=' "$ENV_FILE" | tail -1 | cut -d= -f2- \
  | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s/^"//; s/"$//')"

DATE="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
mongodump --uri "$MONGODB_URI" --out "$BACKUP_DIR/backup_$DATE"

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +$KEEP_DAYS -exec rm -rf {} +
```

```bash
chmod +x /home/fohunoff/backup-mongo.sh
crontab -e
# 0 2 * * * /home/fohunoff/backup-mongo.sh >> /home/fohunoff/backups/backup.log 2>&1
```

### Восстановление из бэкапа

Бэкапы лежат в `~/backups/subscription-tracker/mongo_*` (сделанные деплоем) и
`~/backups/mongodb/backup_*` (ночные). Восстановление:

```bash
# посмотреть, что есть
ls -1t ~/backups/subscription-tracker/mongo_* ~/backups/mongodb/backup_* 2>/dev/null | head

# остановить бэкенд, чтобы он не писал во время восстановления
pm2 stop subscription-tracker-api

# --drop удаляет текущие коллекции перед восстановлением: данные, появившиеся
# после снятия бэкапа, будут потеряны
MONGODB_URI="$(grep -E '^\s*MONGODB_URI\s*=' server/.env | tail -1 | cut -d= -f2-)"
mongorestore --uri "$MONGODB_URI" --drop \
  ~/backups/subscription-tracker/mongo_20260816_120000/subscription-tracker

pm2 start subscription-tracker-api
curl http://127.0.0.1:5000/api/health
```

Путь заканчивается именем базы (`subscription-tracker`) — `mongorestore` ждёт каталог
с BSON-файлами конкретной базы, а не корень дампа.

## Порядок при миграциях

Миграции лежат в `server/scripts/`. Правильная последовательность — и её же соблюдает
`deploy.sh --migrate`:

1. **бэкап базы** (без него откат данных невозможен);
2. `git pull` и установка зависимостей;
3. **миграция** — `node scripts/<имя>.js` из каталога `server`;
4. рестарт бэкенда;
5. сборка и публикация фронта;
6. health-check.

Миграции пишутся идемпотентными: повторный запуск не должен ничего менять. Откат кода
миграцию не отменяет — если после отката данные несовместимы со старым кодом,
восстанавливайте базу из бэкапа (см. выше).

## server/.env не хранится в git

Файл существует только на сервере. При переклонировании репозитория его нужно создать
заново из `server/.env.example` и заполнить реальными значениями, иначе сервер не
стартует (fail-fast по `JWT_SECRET` и `GOOGLE_CLIENT_ID`). Держите копию значений в
менеджере паролей — восстановить их из репозитория невозможно by design.
