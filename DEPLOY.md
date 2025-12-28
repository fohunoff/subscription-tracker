# 🚀 Деплой приложения на VPS

## Подготовка сервера

### 1. Подключение к серверу
```bash
ssh root@your-server-ip
```

### 2. Установка необходимых компонентов
```bash
# Обновление системы
apt update && apt upgrade -y

# Установка Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Установка PM2 для управления процессами
npm install -g pm2

# Установка Nginx
apt install nginx -y

# Установка MongoDB (или используйте MongoDB Atlas)
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update && apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod
```

## Деплой бэкенда

### 3. Загрузка кода на сервер
```bash
# Клонирование репозитория
git clone https://github.com/your-username/your-repo.git
cd your-repo/server

# Установка зависимостей
npm install --production
```

### 4. Настройка переменных окружения
```bash
# Создание .env файла
nano .env
```

```env
# server/.env
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://localhost:27017/subscription-tracker
GOOGLE_CLIENT_ID=your_google_client_id
JWT_SECRET=your_super_secret_jwt_key_here
FRONTEND_URL=https://yourdomain.com
```

### 5. Запуск бэкенда через PM2
```bash
# Создание ecosystem файла для PM2
nano ecosystem.config.js
```

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'subscription-tracker-api',
    script: 'index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
```

```bash
# Создание папки для логов
mkdir logs

# Запуск приложения
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## Деплой фронтенда

### 6. Сборка фронтенда
```bash
cd ../  # возврат в корень проекта

# Настройка переменных окружения для фронтенда
nano .env
```

```env
# .env (в корне проекта)
VITE_API_URL=https://yourdomain.com/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

```bash
# Сборка проекта
npm install
npm run build
```

### 7. Настройка Nginx
```bash
# Создание конфигурации Nginx
nano /etc/nginx/sites-available/subscription-tracker
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Фронтенд
    location / {
        root /var/www/subscription-tracker;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # Заголовки для SPA
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    
    # API проксирование на бэкенд
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Статические файлы с кэшированием
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /var/www/subscription-tracker;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Создание директории для фронтенда
mkdir -p /var/www/subscription-tracker

# Копирование собранных файлов
cp -r dist/* /var/www/subscription-tracker/

# Установка правильных прав
chown -R www-data:www-data /var/www/subscription-tracker
chmod -R 755 /var/www/subscription-tracker

# Активация сайта
ln -s /etc/nginx/sites-available/subscription-tracker /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

## SSL сертификат (Let's Encrypt)

### 8. Установка SSL
```bash
# Установка Certbot
apt install certbot python3-certbot-nginx -y

# Получение SSL сертификата
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Автоматическое обновление
crontab -e
# Добавить строку:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## Мониторинг и логи

### 9. Проверка статуса
```bash
# Статус бэкенда
pm2 status
pm2 logs subscription-tracker-api

# Статус Nginx
systemctl status nginx

# Статус MongoDB
systemctl status mongod

# Логи Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## Обновление приложения

### 10. Скрипт для автоматического обновления
```bash
# Создание скрипта deploy.sh
nano deploy.sh
```

```bash
#!/bin/bash
echo "🚀 Начинаем деплой..."

# Переход в директорию проекта
cd /path/to/your/repo

# Получение последних изменений
git pull origin main

# Обновление бэкенда
cd server
npm install --production
pm2 restart subscription-tracker-api

# Обновление фронтенда
cd ../
npm install
npm run build
cp -r dist/* /var/www/subscription-tracker/

echo "✅ Деплой завершен!"
```

```bash
chmod +x deploy.sh
```

## Резервное копирование

### 11. Автоматический бэкап MongoDB
```bash
# Создание скрипта backup.sh
nano backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"
DB_NAME="subscription-tracker"

mkdir -p $BACKUP_DIR
mongodump --db $DB_NAME --out $BACKUP_DIR/backup_$DATE

# Удаление старых бэкапов (старше 7 дней)
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} \;
```

```bash
chmod +x backup.sh

# Добавление в crontab для ежедневного бэкапа
crontab -e
# Добавить: 0 2 * * * /path/to/backup.sh
```

## Мониторинг производительности

### 12. Установка мониторинга
```bash
# PM2 мониторинг
pm2 install pm2-server-monit

# Простой мониторинг ресурсов
apt install htop iotop -y
```

## Безопасность

### 13. Базовая настройка безопасности
```bash
# Настройка firewall
ufw enable
ufw allow ssh
ufw allow 80
ufw allow 443

# Отключение root логина по SSH
nano /etc/ssh/sshd_config
# Изменить: PermitRootLogin no
systemctl restart ssh

# Обновление системы
apt update && apt upgrade -y && apt autoremove -y
```

---

## 📋 Чек-лист развертывания

- [ ] Сервер подготовлен (Node.js, PM2, Nginx)
- [ ] MongoDB установлен/настроен
- [ ] Бэкенд развернут и запущен через PM2
- [ ] Фронтенд собран и размещен
- [ ] Nginx настроен с проксированием API
- [ ] SSL сертификат установлен
- [ ] Переменные окружения настроены
- [ ] Домен указывает на сервер
- [ ] Мониторинг настроен
- [ ] Бэкапы автоматизированы

## 🆘 Проблемы и решения

**API недоступен:**
```bash
pm2 logs subscription-tracker-api
curl http://localhost:3001/api/health
```

**Фронтенд не загружается:**
```bash
nginx -t
systemctl status nginx
cat /var/log/nginx/error.log
```

**База данных недоступна:**
```bash
systemctl status mongod
mongo --eval "db.runCommand({connectionStatus : 1})"
```