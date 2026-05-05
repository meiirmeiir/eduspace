# Аудит безопасности серверных эндпоинтов

Дата: 2026-05-05
Платформа: **Vercel Serverless Functions** (`api/*.js`, `module.exports = async (req, res) => {...}`)
(firebase.json содержит только Firestore rules + emulators — Cloud Functions не используются)

---

## api/lessons.js

- **Методы:** GET, POST (OPTIONS для preflight)
- **Параметры (POST):** `studentId`, `date`, `durationMinutes`, `studentName`, `subject`
- **Что делает:**
  - GET — читает из Firestore ALL уроки (`lessons` коллекция, orderBy date) и возвращает весь список
  - POST — создаёт Zoom-митинг через API, затем сохраняет урок в Firestore
- **Кто вызывает:**
  - GET: `LessonsSection.loadLessons()` (строка 14169) — вызывается при монтировании компонента **всеми пользователями** (ученик, учитель, админ). Фильтрация по studentId делается **на клиенте**, не на сервере.
  - POST: `LessonsSection.handleCreate()` (строка 14205) и `DashboardScreen.handleNewLesson()` (строка 15414) — видимо, только учитель/админ (по UI-логике), но серверной проверки нет.
- **CORS:** `Access-Control-Allow-Origin: '*'` — открыт для любого домена
- **Текущая защита:** ❌ **ОТСУТСТВУЕТ** — никакой проверки токена или ключа
- **Уровень риска:** 🔴 **CRITICAL**
  - Любой человек в интернете через `curl` может:
    - GET: получить все уроки всех учеников (ФИО, даты, Zoom-ссылки включая `zoomStartUrl` — ссылка хоста!)
    - POST: создать произвольный Zoom-митинг, записать мусор в Firestore, спалить Zoom API квоту

---

## api/lessons-batch.js

- **Метод:** POST
- **Параметры:** `studentId`, `studentName`, `dates[]`, `durationMinutes`, `subject`
- **Что делает:** создаёт один Zoom-митинг типа 3 (recurring, no fixed time), затем batch-записывает N уроков в Firestore
- **Кто вызывает:** `LessonsSection.handleCreate()` (строка 14214) и `DashboardScreen.handleNewLesson()` (строка 15426) — режим `weekly`, только учитель/админ по UI
- **CORS:** `Access-Control-Allow-Origin: '*'`
- **Текущая защита:** ❌ **ОТСУТСТВУЕТ**
- **Уровень риска:** 🔴 **CRITICAL**
  - Аналогично lessons.js. Дополнительно: `dates` — произвольный массив, можно создать сотни Zoom-митингов за один запрос (DoS на квоту Zoom API)

---

## api/webhooks/zoom.js

- **Метод:** POST
- **События Zoom:** `endpoint.url_validation`, `recording.completed`, `meeting.summary_completed`
- **Что делает:**
  - `recording.completed` → находит урок в Firestore по `zoomMeetingId`, обновляет `status=completed` и `driveVideoUrl`
  - `meeting.summary_completed` → сохраняет AI-summary урока в Firestore
- **Webhook secret в env:** `ZOOM_WEBHOOK_SECRET` ✅ (переменная задана)
- **Проверка подписи Zoom:** ✅ ЕСТЬ, но с двумя уязвимостями:
  1. ⚠️ **Timing attack** (строка 57): `if (signature !== expected)` — обычное строковое сравнение. Нужно `crypto.timingSafeEqual`.
  2. ⚠️ **Replay attack** (нет проверки): `x-zm-request-timestamp` читается (строка 53), но возраст запроса не проверяется. Нужна проверка `|now - timestamp| < 300 секунд`.
- **Уровень риска:** 🟡 **MEDIUM**
  - Если атакующий может наблюдать за timing-ответами — теоретически подобрать подпись
  - Перехваченный легитимный запрос Zoom можно воспроизвести (replay) через любое время — урок обновится повторно

---

## Дополнительно: CORS

`api/lessons.js` и `api/lessons-batch.js` выставляют `Access-Control-Allow-Origin: *`. После добавления Bearer-токена это нужно сузить до конкретного домена (`https://eduspace-murex.vercel.app`), иначе браузер с любого сайта сможет делать запросы от имени залогиненного пользователя.

---

## Предлагаемый план защиты

### api/lessons.js и api/lessons-batch.js

**Тип защиты:** Firebase ID Token (Bearer в заголовке `Authorization`)

**На сервере — добавить в начало обработчика:**
```
verifyAuth(req) → admin.auth().verifyIdToken(token) → decoded.uid
```
Для POST (создание уроков) — дополнительно проверить роль:
```
admin.firestore().doc(`users/${uid}`).get() → data.role === 'admin' || 'teacher'
```

**На клиенте — изменить 4 вызова fetch:**
```
строки 14169, 14205, 14214, 15414, 15426
добавить: headers: { Authorization: `Bearer ${idToken}` }
```
`idToken` получать через `firebaseUser.getIdToken()` — `firebaseUser` уже есть в контексте.

**ENV-переменные:** новых не нужно (Admin SDK уже инициализирован через `FIREBASE_ADMIN_SERVICE_ACCOUNT`).

**Что может сломаться:** ничего — оба экрана уже за стеной `firebaseUser`-guard, так что токен всегда доступен.

**Нужно уточнить перед реализацией:**
- GET `/api/lessons` — должен ли ученик видеть только свои уроки на сервере (а не делать фильтрацию клиентски)? Сейчас сервер отдаёт всё, клиент фильтрует. После защиты токеном можно оставить так же или сразу добавить серверную фильтрацию — на твоё усмотрение.

---

### api/webhooks/zoom.js

**Тип защиты:** исправить существующую HMAC SHA-256 верификацию

Два точечных изменения в ~5 строках кода:
1. Заменить `signature !== expected` на `crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))`
2. Добавить проверку возраста timestamp: `if (Math.abs(Date.now()/1000 - parseInt(timestamp)) > 300) return res.status(401)...`

**ENV-переменные:** `ZOOM_WEBHOOK_SECRET` уже есть.

**Что может сломаться:** ничего — логика не меняется, только ужесточается проверка.

---

## Итого по рискам

| Эндпоинт | Риск сейчас | После защиты |
|---|---|---|
| GET /api/lessons | 🔴 CRITICAL — утечка всех уроков | ✅ только авторизованные |
| POST /api/lessons | 🔴 CRITICAL — создание уроков кем угодно | ✅ только admin/teacher |
| POST /api/lessons-batch | 🔴 CRITICAL — то же + DoS на Zoom квоту | ✅ только admin/teacher |
| POST /api/webhooks/zoom | 🟡 MEDIUM — timing + replay attack | ✅ после патча |
