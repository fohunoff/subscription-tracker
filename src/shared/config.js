// Единая точка правды для адреса API.
// В проде задаётся через VITE_API_URL на этапе сборки (см. .env в корне),
// фолбэк — только для локальной разработки.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Версия сборки. Значения подставляет Vite (см. define в vite.config.js):
// version из package.json, короткий git-хеш и время сборки. Показываются в
// подвале — чтобы по скриншоту бага было понятно, какая сборка на экране.
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
export const APP_COMMIT = typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : 'unknown';
export const APP_BUILD_DATE = typeof __APP_BUILD_DATE__ === 'string' ? __APP_BUILD_DATE__ : null;
