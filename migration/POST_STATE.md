# POST_STATE.md — состояние после миграции на Firebase Email/Password Auth

Дата: 2026-05-04

## Что было сделано (в коде)

### Фаза 0 — подготовка
- Создан `src/lib/firebase.js` — единственное место инициализации Firebase App + Auth.
  Критично: добавлен `authDomain` (без него Firebase Auth не работает).
- Создан `src/contexts/AuthContext.jsx` — провайдер `firebaseUser`, `profile`, `loading`.
  Использует `onIdTokenChanged` (а не `onAuthStateChanged`) — перехватывает ежечасное обновление токена.
- `src/main.jsx` — добавлен `<AuthProvider>` как самый внешний враппер.
- `src/firestore-rest.js` — добавлена инъекция Bearer-токена во все fetch-запросы:
  `setAuthToken(token)` / `_authHeader()`. Без этого `request.auth` в Rules всегда null.
- `migration/PRE_STATE.md` — зафиксировано полное состояние до миграции.

### Фаза 1 — новый AuthScreen
- Создан `src/components/auth/EmailAuthScreen.jsx`.
  - Режимы: регистрация / вход / сброс пароля.
  - Регистрация: создаёт Firebase Auth user + документ `users/{uid}` в Firestore.
  - Сброс: `sendPasswordResetEmail` + универсальное сообщение (не раскрывает, есть ли email).
  - Стили инжектируются внутри компонента (`FONTS_STYLE`) — т.к. рендерится до основного App.

### Фаза 2 — интеграция AuthContext в App.jsx
- Импортированы `useAuth`, `EmailAuthScreen`, `signOut`, `reauthenticateWithCredential`,
  `updatePassword`, `EmailAuthProvider` из `./lib/firebase`.
- Добавлен `const { firebaseUser, loading: authLoading } = useAuth()` в начало `App()`.
- Добавлен ранний return-guard: если `authLoading` — спиннер; если `!firebaseUser` — `EmailAuthScreen`.
- `handleLogout` теперь вызывает `signOut(auth)` перед очисткой localStorage.
- Добавлен компонент `ChangePasswordInline` (смена пароля через reauthenticate → updatePassword).

### Фаза 3 — тестирование
- Все 4 сценария проверены и работают:
  1. Регистрация нового пользователя
  2. Вход существующего пользователя
  3. Смена пароля
  4. Сброс пароля по email

### Фаза 4 — удаление легаси
- Удалена функция `hashPassword` (SHA-256 + хардкод соль `"aapa_2026"`).
- Удалён компонент `AuthScreen` (~170 строк — старый экран с телефоном и паролем).
- Удалён флаг `useNewAuth` — EmailAuthScreen теперь единственный путь входа.
- Роутер: убрана строка `{screen==="auth"&&<AuthScreen .../>}`.
  `onStart` в LandingScreen теперь ведёт на `"dashboard"` (route guard перехватит неавторизованных).
- `firestore.rules`: удалены мёртвые коллекции `studyPlans`, `topicProgress`, `moduleMap`, `config`.
  Обновлён комментарий — теперь описывает Firebase Auth.

---

## Что пользователю нужно сделать вручную

### 1. Задеплоить правила Firestore
```bash
firebase deploy --only firestore:rules
```
Без этого старые правила продолжают работать в продакшене.

### 2. Мигрировать существующих пользователей (опционально)
Старые пользователи хранились в `users/{phone}` с SHA-256 паролем.
Они **не могут войти** через новую систему — у них нет Firebase Auth аккаунтов.

Варианты:
- **Ручная регистрация**: попросить пользователей зарегистрироваться заново.
- **Скрипт миграции**: создать Firebase Auth аккаунты через Admin SDK (`createUser`)
  и перенести данные из `users/{phone}` в `users/{uid}`.
- Если пользователей мало — ручная регистрация проще.

### 3. Старые данные прогресса
Коллекции `skillProgress`, `skillMastery`, `userProgress`, `individualPlans`, `quizProgress`
хранят данные с ключом `{phone}` или содержат поле `phone`.
После регистрации с новым `uid` эти данные **не будут привязаны** к новому аккаунту.

Требуется отдельная миграция ключей, если история прогресса нужна.

---

## Схема нового документа users/{uid}

```json
{
  "uid": "...",
  "email": "user@example.com",
  "phone": "+7...",
  "firstName": "Имя",
  "lastName": "Фамилия",
  "goalKey": "ent",
  "goal": "Подготовка к ЕНТ",
  "details": "...",
  "role": "student",
  "status": "trial",
  "registeredAt": "2026-05-04T..."
}
```

Ключ документа = Firebase Auth UID (не номер телефона).

---

## Следующие шаги (Security Rules)

Текущие правила всё ещё `if true` — любой аутентифицированный пользователь читает/пишет всё.
Следующий этап — заменить на проверки `request.auth.uid`:

```
allow read: if request.auth != null && request.auth.uid == userId;
```

Подробный план — в `audit/firestore-inventory.md`.
