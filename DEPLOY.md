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
(`http://localhost:3001/api`) — см. `.env.example`.

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
npm install --production          # не пропускать, см. предупреждение ниже
pm2 restart subscription-tracker-api --update-env
pm2 logs subscription-tracker-api
```

> ⚠️ **`npm install --production` пропускать нельзя, если в коммите менялись
> зависимости.** Отказ будет не мягким: Node не найдёт пакет при импорте, процесс
> упадёт с `ERR_MODULE_NOT_FOUND`, PM2 будет перезапускать его по кругу, а Nginx —
> отдавать **502 на все запросы к `/api/`**. Фронт при этом продолжает открываться
> (статика отдаётся отдельно), поэтому по внешнему виду сайта поломку легко не заметить.
>
> Так уже случилось при выкатке helmet и express-rate-limit: `git pull` + `pm2 restart`
> без установки зависимостей положили API примерно на минуту.
>
> Дешевле всего выполнять `npm install --production` при каждом деплое бэкенда —
> если зависимости не менялись, команда отработает вхолостую за секунду.
>
> Быстрый откат, если установка почему-то не проходит:
> `git revert --no-edit <коммит> && pm2 restart subscription-tracker-api --update-env`

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

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"
mkdir -p $BACKUP_DIR
mongodump --uri "mongodb://fohunoff:<пароль>@127.0.0.1:27017/subscription-tracker?authSource=admin" \
  --out $BACKUP_DIR/backup_$DATE
find $BACKUP_DIR -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;
```

```bash
crontab -e
# 0 2 * * * /home/fohunoff/repos/subscription-tracker/backup.sh
```
