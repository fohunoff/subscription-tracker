# Subscription Tracker Backend

Backend сервис для приложения отслеживания подписок.

## Установка MongoDB

How to Install MongoDB on Ubuntu 24.04: Step-by-Step Guide
https://www.cherryservers.com/blog/install-mongodb-ubuntu-2404

## Настройка переменных окружения

Создайте файл `.env` в директории `server/` на основе `.env.example`:

```bash
cp .env.example .env
```

### Обязательные переменные:
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID
- `JWT_SECRET` - Секретный ключ для JWT токенов
- `MONGODB_URI` - Строка подключения к MongoDB

### Опциональные переменные для Telegram уведомлений:
- `TELEGRAM_BOT_TOKEN` - Токен вашего Telegram бота
- `TELEGRAM_BOT_USERNAME` - Username бота (без @)

## Как создать Telegram бота

1. Откройте Telegram и найдите [@BotFather](https://t.me/BotFather)
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота:
   - Введите имя бота (например: "Subscription Tracker Notifier")
   - Введите username бота (должен заканчиваться на "bot", например: "subscription_tracker_bot")
4. BotFather выдаст вам токен (например: `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`)
5. Добавьте токен в `.env`:
   ```
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
   TELEGRAM_BOT_USERNAME=subscription_tracker_bot
   ```

## Запуск сервера

```bash
# Development
npm run dev

# Production
npm start
```

После запуска сервер будет доступен на `http://localhost:5000` (или на порту из `.env`)

Telegram бот автоматически запустится вместе с сервером, если указан `TELEGRAM_BOT_TOKEN`.