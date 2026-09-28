# 🥃 100 ГРАМ

Свій Telegram, але «100 ГРАМ» — месенджер у реальному часі з реєстрацією, чатами,
власною валютою (ГРАМи) та преміум-підпискою. Статичний фронтенд на React,
весь бекенд — Firebase (Auth + Firestore), тому окремого сервера немає.

## Що всередині

- **Реєстрація та вхід** — email + пароль через Firebase Auth, вітальний бонус 500 ГРАМів
- **Чати в реальному часі** — приватні чати з живими оновленнями через Firestore, індикатор "друкує…"
- **Групи** — чат на кількох людей, писати можуть усі учасники
- **Канали** — публікувати можуть лише адміни (той, хто створив), решта тільки читає
- **Пошук користувачів** — знайти будь-кого за `@username` і почати чат
- **Гаманець "ГРАМи"** — власна валюта застосунку: атомарні перекази між користувачами (Firestore transactions), історія транзакцій
- **Преміум-підписка** — плани на 1/6/12 місяців, оплата ГРАМами, бейдж ⭐ біля імені
- **Налаштування** — редагування профілю (ім'я, опис, колір аватара), світла/темна тема
- **Встановлюється як застосунок** (PWA) — на телефон (Android/iOS) і ПК (Windows/Mac/Linux) прямо з браузера, без App Store/Play Market

## Застосунок на телефоні та ПК

100 ГРАМ — це [PWA](https://web.dev/progressive-web-apps/): той самий сайт можна
"встановити" як звичайний застосунок з окремою іконкою та вікном без адресного рядка.

- **Android / Chrome / Edge (ПК)**: відкрити сайт → кнопка встановлення в адресному
  рядку, або Налаштування → Вигляд → «📲 Встановити застосунок» у самому 100 ГРАМ
- **iPhone/iPad (Safari)**: кнопка «Поділитися» → «На екран «Домій»» (iOS не підтримує
  автоматичний install-prompt — це обмеження самого iOS, не застосунку)

Реалізовано через `vite-plugin-pwa`: маніфест + service worker кешують лише статичний
код застосунку (HTML/JS/CSS/іконки) для офлайн-запуску — самі дані (чати, гаманець)
завжди йдуть напряму у Firebase, ніколи не кешуються, тому користувач завжди бачить
актуальний стан.

Нативних App Store/Google Play застосунків з цього репозиторію немає — для них
знадобився б окремий проєкт (Capacitor/React Native) і платні акаунти розробника
(Apple $99/рік, Google $25 одноразово), яких я не можу створити за тебе.

## Стек

- **Frontend**: React 18, TypeScript, Vite, React Router
- **Backend**: Firebase Authentication + Cloud Firestore (жодного власного сервера — фронтенд статичний і йде прямо на Vercel)

## Налаштування Firebase (один раз)

1. Створи проєкт на [console.firebase.google.com](https://console.firebase.google.com)
2. **Authentication → Sign-in method** → увімкни **Email/Password**
3. **Firestore Database** → створи базу (Production mode)
4. **Firestore → Rules** → встав вміст файлу [`firestore.rules`](./firestore.rules) з кореня цього репозиторію і опублікуй
5. **Project settings → General → Your apps** → додай Web-застосунок, скопіюй `firebaseConfig`
6. Встав ці значення у `frontend/src/firebase.ts` замість `"REPLACE_ME"`

Значення `firebaseConfig` (apiKey, authDomain, projectId…) публічні за задумом Firebase —
безпеку забезпечують Firestore Security Rules, а не приховування цих полів,
тому їх спокійно можна тримати прямо в коді фронтенду.

## Запуск локально

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

## Деплой на Vercel

Це звичайний статичний Vite-застосунок — жодних змінних середовища не потрібно
(конфіг Firebase уже в коді). Framework Preset: Vite, Root Directory: `frontend`,
Build Command: `npm run build`, Output Directory: `dist`.

## Структура проєкту

```
firestore.rules          # Security Rules для Firestore (users, chats, messages, транзакції)
frontend/
  src/
    firebase.ts            # ініціалізація Firebase (App, Auth, Firestore)
    data/firestore-api.ts  # весь доступ до даних: auth, users, chats, messages, гаманець, преміум
    pages/                 # Login, Register, ChatPage, SettingsPage
    components/            # Sidebar, ChatWindow, MessageBubble, MessageInput, Avatar
    context/AuthContext.tsx
```

## Модель даних Firestore

```
usernames/{usernameLower}          -> { uid }                      // унікальність username
users/{uid}                        -> профіль, ГРАМи, преміум
users/{uid}/transactions/{txId}    -> історія гаманця
chats/{chatId}                     -> memberUids, memberProfiles, adminUids, isGroup, isChannel, lastMessage
chats/{chatId}/messages/{msgId}    -> повідомлення (реалтайм через onSnapshot)
chats/{chatId}/typing/{uid}        -> ефемерний індикатор "друкує…"
```

Пряме повідомлення має детермінований id `dm_<uidA>_<uidB>` (uid відсортовані),
тому повторний пошук того самого співрозмовника відкриває той самий чат. Групи й
канали отримують випадковий id (`grp_…` / `ch_…`); те, хто в чаті може писати,
вирішує `isChannel` + `adminUids` — і на клієнті (ховається поле вводу), і в
`firestore.rules` (правило `create` для `messages` реально це блокує).

## Валюта ГРАМ

Кожен новий користувач отримує 500 ГРАМів на старт. Перекази та покупка преміуму
виконуються через `runTransaction` у Firestore — атомарно, без гонки станів.
Це ігрова валюта: правила Firestore не можуть повністю заборонити клієнту
редагувати власне поле `grams` напряму (для цього знадобились би Cloud Functions
на платному плані) — прийнятний компроміс для несерйозного застосунку, але
не варто зберігати тут щось цінне.
