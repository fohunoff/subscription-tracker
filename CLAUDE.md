# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack subscription tracker application that helps users manage their recurring expenses. Built with React + Vite frontend, Express backend, MongoDB database, and integrates with Google OAuth for authentication. Supports multi-currency tracking, category organization, and Telegram bot integration for payment reminders.

## Architecture

### Monorepo Structure
- `/` - React frontend (Vite + React 19 + TailwindCSS)
- `/server` - Express backend (ES modules, MongoDB/Mongoose)

### Frontend Architecture

**State Management Pattern:**
- Uses React Context API for global state (AuthContext)
- Custom hooks pattern for feature-specific logic
- API layer separated into context hooks (useCategoriesApi, useSubscriptionsApi, useStatsApi)
- Feature hooks wrap API calls with local state management (useCategories, useSubscriptions)

**Feature-Based Organization:**
```
src/
├── features/           # Feature modules (subscriptions, categories, auth, settings, telegram, notifications)
│   ├── [feature]/
│   │   ├── hooks/     # Feature-specific hooks
│   │   ├── utils/     # Feature utilities
│   │   └── *.jsx      # Feature components
├── contexts/          # Global contexts (AuthContext)
│   └── hooks/         # API layer hooks (useCategoriesApi, useSubscriptionsApi, useStatsApi)
├── shared/            # Shared components, hooks, and utils
└── App.jsx            # Main app component
```

**Key Architectural Patterns:**
1. **Two-Layer Hook Pattern**: API hooks (in contexts/hooks) provide raw fetch calls, feature hooks (in features/*/hooks) add state management and business logic
2. **Centralized API**: All API methods exposed through AuthContext.api object, composed from individual API hooks
3. **Feature Isolation**: Each feature has its own components, hooks, and utils with barrel exports (index.js)
4. **Auth Flow**: Google OAuth → JWT token stored in localStorage → token sent as Bearer in Authorization headers

### Backend Architecture

**Database Models:**
- User: Google OAuth user data (googleId, email, name, picture)
- Category: User-defined expense categories (name, color, hasReminders, order, isDefault)
- Subscription: Recurring expenses (name, cost, currency, cycle, paymentDay, fullPaymentDate)
  - References: userId, categoryId
  - Supports: RUB, USD, EUR, RSD currencies
  - Cycles: monthly, quarterly, annually
  - status: 'active' | 'archived' + endDate, archivedAt (завершённые подписки)
- SubscriptionEvent: лог изменений по подписке (created/updated/archived/restored/deleted)

**Authentication:**
- JWT-based with Bearer token authentication
- Middleware validates tokens on protected routes
- Google OAuth library validates Google tokens on login

**API Structure:**
```
/api/auth         - Google OAuth login, logout, user info
/api/categories   - CRUD + reorder operations
/api/subscriptions - CRUD + import + archive/restore/history
/api/stats        - Aggregated statistics
/api/health       - Health check endpoint
/api/telegram     - Telegram bot connection
/api/currency-rates - Cached currency rates
```

**Циклы оплаты — одно место на слой.** `server/utils/cycle.js` и
`src/shared/utils/cycle.js` описывают циклы (длительность в месяцах, подписи) и
считают производные величины: месячную/годовую стоимость, дату следующего платежа,
попадание платежа в конкретный месяц. Раньше эта логика была продублирована
примерно в 15 местах — не возвращайте `if (cycle === 'annually')` в компоненты и
роуты, добавляйте цикл в `CYCLES`.

Квартальной подписке обязательна `fullPaymentDate`: по одному дню месяца
невозможно определить, в какие месяцы приходится списание. Проверяется и на
сервере (`validateSubscriptionData`), и в форме.

**Архив подписок.** Активные выбираются как `{ status: { $ne: 'archived' } }`, а не
`status: 'active'` — документы, созданные до появления поля, его не имеют и должны
считаться активными. Есть идемпотентная миграция
`server/scripts/migrate-add-status.js`, но приложение работает и без неё.
Архивные подписки не участвуют в суммах, статистике и Telegram-уведомлениях.

**Поиск и представления.** `useSubscriptionFilters` (features/subscriptions/hooks)
держит всю логику поиска и группировки: фильтрация по названию подписки и названию
категории, сортировка сплошного списка по дате ближайшего платежа, скрытие пустых
категорий при активном запросе. Поиск охватывает и архив — при непустом запросе
архив подгружается сам, даже если раздел ни разу не открывали. Выбранный вид
(`categories` / `list`) хранится в localStorage под ключом `viewMode`.

Блок расходов (`TotalExpenses`) сужается вместе с поиском: сумма и топ категорий
считаются по найденному, заголовок меняется на «Расход в месяц по найденному»,
а счётчик показывает «Найдено подписок: N из M». Поэтому `useSubscriptionFilters`
объявляется в `App.jsx` раньше расчёта сумм — они зависят от `filteredSubscriptions`.

**Детали подписки.** Клик по названию/цифрам карточки открывает `SubscriptionDetails`
в общем `Modal`: сводка плюс история из `GET /api/subscriptions/:id/history`.
Записи лога переводит в человеческий вид `features/subscriptions/utils/formatHistoryEvent.js`
(значения приходят нормализованными: даты — ISO-строками, массивы — через запятую,
`categoryId` — строкой, поэтому имена категорий подставляются по списку категорий).

Кнопки на карточке (уведомления, правка, архив, удаление) лежат вне кликабельной
области, поэтому детали по ним не открываются — отдельный `stopPropagation` не нужен.

Загрузка истории завязана только на `subscription.id`: методы `api` пересоздаются
на каждом рендере `AuthContext`, поэтому колбэк держится в ref — иначе история
перезапрашивалась бы на каждое нажатие клавиши в поиске.

**Server composition:** `server/app.js` собирает Express-приложение (helmet, CORS,
rate-limit, роуты, обработка ошибок) и экспортирует его; `server/index.js` только
подключает MongoDB, слушает порт и поднимает Telegram-бота со scheduler'ом.

## Common Commands

### Frontend Development
```bash
npm run dev        # Start Vite dev server (http://localhost:5173)
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

### Backend Development
```bash
cd server
npm run dev        # Start with nodemon (http://localhost:3001)
npm start          # Start production server
npm run lint       # Run ESLint
npm run lint:fix   # Auto-fix ESLint issues
```

### Full Stack Development
Start both servers in separate terminals:
1. Terminal 1: `npm run dev` (frontend on :5173)
2. Terminal 2: `cd server && npm run dev` (backend on PORT from server/.env, по умолчанию :3001)

## Environment Variables

Шаблоны — `.env.example` в корне и `server/.env.example`. Полная схема деплоя и чек-лист
смены домена — в `DEPLOY.md`.

### Frontend (.env in root)
```
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_API_URL=http://localhost:3001/api
```
`VITE_*` вшиваются в бандл при сборке — после правки нужен повторный `npm run build`.
Обе переменные читаются в одном месте: `src/shared/config.js`. Не обращайтесь к
`import.meta.env` напрямую из компонентов и хуков.

### Backend (server/.env)
```
GOOGLE_CLIENT_ID=your_google_client_id
JWT_SECRET=your_jwt_secret
MONGODB_URI=mongodb://localhost:27017/subscription-tracker
PORT=3001
FRONTEND_URL=http://localhost:5173   # несколько origin — через запятую
NODE_ENV=development
```
Всё окружение сервера собрано в `server/config.js`. Он падает при старте, если не заданы
`JWT_SECRET` или `GOOGLE_CLIENT_ID` — fallback-секретов нет намеренно. Новый код должен
импортировать `env` из `server/config.js`, а не читать `process.env` напрямую.

`server/ecosystem.config.cjs` (PM2) версионируется и **не должен содержать секретов** —
только `NODE_ENV`; всё остальное приходит из `server/.env`. Расширение `.cjs` обязательно:
`server/package.json` объявляет `"type": "module"`. Запуск на сервере —
`pm2 start ecosystem.config.cjs --env production` (без флага возьмётся development-блок).

## Deployment

Деплой — `./deploy.sh` на сервере (см. `DEPLOY.md`): бэкап базы и статики, `git pull`,
установка зависимостей только при изменении lock-файлов, сборка фронта только при
изменении фронтового кода, `pm2 restart` только при изменении серверного,
health-check и автоматический откат кода и статики при неудаче.

Ручные команды остались в `DEPLOY.md` как запасной вариант. Скрипт не запускается
при незакоммиченных изменениях: откат делает `git reset --hard` и затёр бы их.

Откат навешен на ловушку `ERR` и срабатывает при любой ошибке после начала изменений
(упавший `npm ci`, неудачная сборка, сорвавшееся копирование), а не только по
health-check. Поэтому в скрипте `set -Eeuo pipefail`: без `-E` ловушка не наследуется
подоболочками, и падение `npm ci` внутри `( cd server && ... )` прошло бы мимо отката.

Если `git pull` обновил сам скрипт, он перезапускается через `exec` на новой версии —
bash читает файл по мере выполнения, поэтому иначе доигрывалась бы смесь версий.

Что выкачено, скрипт помнит в `~/backups/subscription-tracker/last-deployed-commit`
и сверяет дифф с ним, а не с предыдущим `HEAD`: иначе коммит, тронувший только доки,
пропустил бы сборку фронта, даже когда статика отстала от кода. `--force` пересобирает
всё принудительно.

**`server/package-lock.json` генерируйте npm 10** (`npx -y npm@10 install --package-lock-only`):
npm 11 выбрасывает из lock опциональную peer-зависимость `gcp-metadata`, которую требует
npm 10 на сервере, и там ломается `npm ci`. Подробности — в `DEPLOY.md`.

## Production — намеренные решения, которые нельзя «чинить»

Приложение живёт на **https://tracker.fohunoff.com**. Подробности — в `DEPLOY.md`.

1. **`VITE_API_URL=/api` в проде — относительный путь, не абсолютный.** Так бандл не
   привязан к домену: фронт стучится на тот же хост, с которого отдан, а Nginx проксирует
   `/api/` на `127.0.0.1:5000`. Замена на полный URL — регресс, не улучшение.
2. **Путь к статике `/var/www/fohunoff/data/www/tracker.fohunoff.ru` оканчивается на `.ru`,
   хотя домен `.com`.** Это не опечатка: папку намеренно не переименовывали при переезде,
   переименование лежит в отложенных задачах (`TODO.md`). Nginx смотрит именно туда.
3. **У `JWT_SECRET` нет fallback-значения**, и сервер падает при старте без него. Это
   защита от молчаливой подписи токенов общеизвестным ключом, а не недоделка.

## Important Implementation Notes

### Data Flow Pattern
1. User action in component → Feature hook function
2. Feature hook → API hook (from AuthContext)
3. API hook → Fetch with Bearer token
4. Response → Feature hook updates local state
5. Component re-renders with new data

### Adding New Features
When adding API-dependent features:
1. Create API hook in `src/contexts/hooks/use[Feature]Api.js` (raw fetch calls)
2. Add to api composition in `src/contexts/AuthContext.jsx`
3. Create feature hook in `src/features/[feature]/hooks/use[Feature].js` (state + business logic)
4. Components consume feature hook, not API hook directly

### Category-Subscription Relationship
- Subscriptions MUST have a categoryId (required field)
- Categories can have multiple subscriptions
- App.jsx groups subscriptions by category for display
- Category deletion should be handled carefully (check for associated subscriptions)

### Currency Handling
- Base currency stored in localStorage ('baseCurrency')
- Currency rates fetched from external API (useCurrencyRates hook)
- All costs displayed in base currency using conversion rates
- Monthly cost calculation: annually subscriptions divided by 12

### Modal Management
- App.jsx uses single Modal component with dynamic content
- modalType state switches between 'subscription' and 'category' forms
- Edit mode controlled by editingSubscription/editingCategory state
- selectedCategory pre-fills categoryId when adding subscription to specific category

### Authentication State
- AuthContext handles: user state, token, login, logout, API composition
- Loading state prevents rendering before auth check completes
- Token expiration checked on mount (jwtDecode)
- Failed auth clears localStorage and redirects to LoginPage

### Валюты и заглушки загрузки

Список валют — `src/shared/utils/currency.js` (коды должны совпадать с enum в
`server/models/Subscription.js`). Настройки различают две валюты: `baseCurrency` —
в чём показывать итоги, `defaultCurrency` — что подставить в форму новой подписки;
обе живут в localStorage.

Скелетоны вместо спиннеров — `src/shared/components/Skeleton.jsx`
(`SubscriptionListSkeleton`, `CategorySkeleton`, `TotalExpensesSkeleton`).

### Styling Approach
- TailwindCSS with custom brand colors (brand-primary, brand-secondary, brand-danger)
- Dark mode support via 'class' strategy (check tailwind.config.js)
- Theme managed by useTheme hook in settings
- Responsive design with mobile-first approach
