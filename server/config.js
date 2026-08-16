import process from 'process';
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Загружаем .env. Переменные, уже выставленные окружением (например, PM2),
// имеют приоритет — dotenv не перезаписывает существующие значения.
loadEnv({ path: join(__dirname, '.env') });

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Обязательная переменная окружения ${name} не задана`);
    console.error('💡 Задайте её в server/.env или в окружении процесса и перезапустите сервер');
    process.exit(1);
  }
  return value;
};

// FRONTEND_URL может содержать несколько origin через запятую:
// FRONTEND_URL=https://tracker.example.ru,https://www.tracker.example.ru
const parseOrigins = (value) =>
  value
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3001,

  // Секреты — без fallback-значений: неверный или отсутствующий JWT_SECRET
  // означал бы подпись токенов заранее известным ключом.
  jwtSecret: required('JWT_SECRET'),
  googleClientId: required('GOOGLE_CLIENT_ID'),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/subscription-tracker',

  allowedOrigins: parseOrigins(process.env.FRONTEND_URL || 'http://localhost:5173'),

  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || '',
};

export const isProduction = env.nodeEnv === 'production';

export default env;
