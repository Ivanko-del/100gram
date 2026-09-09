# 🥃 100 ГРАМ

Свій Telegram, але «100 ГРАМ» — месенджер у реальному часі з реєстрацією, чатами,
власною валютою (ГРАМи) та преміум-підпискою.

## Що всередині

- **Реєстрація та вхід** — email/username + пароль, JWT-автентифікація, вітальний бонус 500 ГРАМів
- **Чати в реальному часі** — приватні та групові чати на Socket.IO (миттєві повідомлення, індикатор "друкує…", присутність онлайн)
- **Пошук користувачів** — знайти будь-кого за `@username` і почати чат
- **Гаманець "ГРАМи"** — власна валюта застосунку: переказ ГРАМів іншим користувачам, історія транзакцій
- **Преміум-підписка** — плани на 1/6/12 місяців, оплата ГРАМами, бейдж ⭐ біля імені
- **Налаштування** — редагування профілю (ім'я, опис, колір аватара), світла/темна тема

## Стек

- **Backend**: Node.js, Express, TypeScript, Prisma + SQLite, Socket.IO, JWT, bcrypt, Zod
- **Frontend**: React 18, TypeScript, Vite, React Router, socket.io-client

## Запуск

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run seed      # створює демо-акаунти anton / olha (пароль: password123)
npm run dev        # http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev         # http://localhost:5173 (проксує /api та /socket.io на бекенд)
```

Відкрий http://localhost:5173, зареєструйся або увійди демо-акаунтом
(`anton` / `password123`, `olha` / `password123`) і почни спілкування.

## Структура проєкту

```
backend/
  prisma/schema.prisma   # User, Chat, ChatMember, Message, Transaction
  src/
    routes/               # auth, users, chats, wallet, premium
    sockets/chat.ts        # реалтайм повідомлення, typing, presence
    middleware/auth.ts     # JWT middleware
frontend/
  src/
    pages/                # Login, Register, ChatPage, SettingsPage
    components/            # Sidebar, ChatWindow, MessageBubble, MessageInput, Avatar
    context/                # AuthContext, SocketContext
```

## Валюта ГРАМ

Кожен новий користувач отримує 500 ГРАМів на старт. ГРАМи можна переказувати
іншим користувачам через гаманець у налаштуваннях або витрачати на преміум-підписку.
