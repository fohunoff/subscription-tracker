// Единая точка правды для адреса API.
// В проде задаётся через VITE_API_URL на этапе сборки (см. .env в корне),
// фолбэк — только для локальной разработки.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
