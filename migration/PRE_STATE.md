# Состояние до миграции на Email/Password Auth

Дата: 2026-05-04
Коммит: 3bbe609690e62f7d037ee01bdd7a8c9065a71c2e

---

## Текущая структура `users/{phone}`

**Ключ документа:** номер телефона в E.164 без пробелов, например `+77001234567`.

### Поля, которые пишутся при создании (регистрации)

| Поле | Тип | Откуда | Примечание |
|------|-----|--------|------------|
| `phone` | string | форма | E.164, например `+77001234567` |
| `firstName` | string | форма | |
| `lastName` | string | форма | |
| `goalKey` | string | форма | `"exam"` / `"gaps"` / `"future"` |
| `goal` | string | REG_GOALS[goalKey] | Человекочитаемая метка |
| `details` | string | форма | Класс или экзамен (например `"9 класс"`, `"ЕНТ"`) |
| `registeredAt` | string ISO | `new Date().toISOString()` | |
| `status` | string | хардкод `"trial"` | При создании всегда trial |

### Поля, добавляемые позже (через updateDoc)

| Поле | Кто пишет | Где | Значение |
|------|-----------|-----|----------|
| `password` | система + admin | Auth flow + AdminScreen | SHA-256 hex (salt: `"aapa_2026"`) |
| `onboardingDone` | система | Onboarding:879 | `true` |
| `status` | admin | AdminScreen:6584 | `"trial"` / `"active"` / `"inactive"` |
| `dailyTasksLimit` | admin | AdminScreen:6616 | number |
| `learningPeriodStart` | admin | AdminScreen:6616 | string `"YYYY-MM-DD"` или `null` |
| `learningPeriodMonths` | admin | AdminScreen:6616 | number |
| `learningPeriodEnd` | admin | AdminScreen:6620 | string `"YYYY-MM-DD"` или `null` |
| `smartDiagDone` | система | Diagnostics:17912, 17961 | `true` / `false` |
| `smartDiagRoadmap` | система | Diagnostics:17912, 17961 | object |
| `smartDiagEngineState` | система | Diagnostics:17895 | object |
| `smartDiagNextSection` | система | Diagnostics:17895 | string |
| `role` | admin вручную | только вручную через Firestore Console | `"admin"` / `"teacher"` / `"student"` (по умолчанию отсутствует) |
| `avatarUrl` | ученик | ProfileScreen:12562 | base64 или URL |

> ⚠️ **`password` хранится в Firestore.** SHA-256 с солью (`"aapa_2026"`), но это всё равно не то, как должны храниться пароли. После миграции поле `password` **удаляется из Firestore полностью** — Firebase Auth берёт это на себя.

> ⚠️ **`role` не имеет дефолтного значения при создании** — поле просто отсутствует у большинства учеников. В коде это воспринимается как `"student"`.

---

## Текущий flow логина

**Файл:** `src/App.jsx`
**Компонент:** `AuthScreen` (строки 931–1097)
**Точка входа:** `screen === "auth"` → `<AuthScreen onRegister={handleRegister}/>` (строка 18302)

### Шаги (4 step-машина состояний):

**Step 1 — Ввод телефона (всегда первый):**
- Пользователь вводит номер (+7 …, маска 11 цифр).
- `checkUser()` → `getDoc(doc(db, "users", cp))`.
  - Документа нет → переход на Step 2 (регистрация).
  - Документ есть, `password` заполнен → Step 3 (ввод пароля).
  - Документ есть, `status === "trial"` и нет пароля → сразу вход без пароля (`onRegister(data)`).
  - Документ есть, статус не trial и нет пароля → Step 4 (создание пароля).

**Step 2 — Регистрация:**
- Поля: firstName, lastName, mainGoal (select из REG_GOALS), specificGoal (select из GRADES_LIST / EXAMS_LIST).
- `register()` → `setDoc(doc(db, "users", cp), data)` → `onRegister(data)`.
- Новый пользователь всегда получает `status: "trial"`.

**Step 3 — Ввод пароля:**
- `checkPassword()` → сравнивает с хешем в `foundUser.password`.
- Если пароль в базе не хеширован (старые данные) — сравнивает как строку и тут же мигрирует в SHA-256.
- При совпадении → `onRegister(foundUser)`.

**Step 4 — Создание нового пароля:**
- `createPassword()` → хеширует → `fsUpdateUser(phone, {password: hashed})` → `onRegister(...)`.

### Хранение сессии:

```
localStorage.setItem("aapa_user", JSON.stringify(user))   // App.jsx:17811
```

`user` — весь Firestore-документ, включая все поля (и раньше — пароль!).
Ключ: `"aapa_user"`.

**При старте приложения:**
```js
// App.jsx:17643
const [user, setUser] = useState(() => {
  const u = localStorage.getItem("aapa_user");
  return u ? JSON.parse(u) : null;
});
```
Сессия восстанавливается из localStorage без проверки с сервером.

**Logout:**
```js
// App.jsx:17812
const handleLogout = () => {
  setUser(null);
  localStorage.removeItem("aapa_user");
  _setScreen("landing");
};
```

**Защита маршрутов:**
- Экраны `["dashboard","plan","practice","admin",...]` проверяют наличие `localStorage("aapa_user")` при инициализации state (App.jsx:17647–17652).
- После старта — только React state, без re-check.

---

## Все коллекции с `userPhone` (для последующего добавления `uid`)

После миграции в каждый новый документ нужно добавить поле `uid` (Firebase UID) вместо/вместе с `userPhone`. Правила будут сравнивать `request.auth.uid == resource.data.uid`.

| Коллекция | Поле-владелец сейчас | Примечания |
|-----------|---------------------|------------|
| `users` | ключ документа = `phone` | Переедет в `users/{uid}`, phone станет полем |
| `diagnosticResults` | `userPhone` | addDoc, auto-ID |
| `medals` | `userPhone` | addDoc, auto-ID |
| `hwSubmissions` | `userPhone` | addDoc, auto-ID |
| `skillProgress` | ключ документа = `phone` | setDoc/getDoc по phone |
| `skillMastery` | ключ документа = `phone` | setDoc/getDoc по phone |
| `userProgress` | ключ документа = `phone` | setDoc/getDoc по phone |
| `individualPlans` | ключ документа = `phone` | setDoc/getDoc по phone |
| `quizProgress` | ключ документа = `progressDocId(phone)` | progressDocId — функция от phone |
| `expertReports` | поле `studentId` или `userPhone` — уточнить | addDoc, auto-ID |

> ⚠️ Коллекции с ключом = phone потребуют изменения паттерна в коде после миграции: `users/{uid}`, `skillProgress/{uid}` и т.д.

---

## Мёртвые коллекции в `firestore.rules` (удалить на этапе фазы 4)

- `studyPlans` — нет ни одного обращения в коде за всю git-историю
- `topicProgress` — аналогично
- `moduleMap` — аналогично
- `config` — аналогично

---

## Серверный код (НЕ трогать)

| Файл | Что делает | Коллекция |
|------|-----------|-----------|
| `api/lessons.js` | Admin SDK, CRUD уроков | `lessons` |
| `api/lessons-batch.js` | Admin SDK, batch-создание уроков | `lessons` |
| `api/webhooks/zoom.js` | Admin SDK, матчинг Zoom meeting → урок | `lessons` |

Все три файла используют Admin SDK — обходят Security Rules. Миграция их не затрагивает.

---

## Функция хеширования паролей (будет удалена)

```js
// App.jsx:311–315
async function hashPassword(pwd) {
  const data = new TextEncoder().encode(pwd + "aapa_2026");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}
```

SHA-256 с хардкоженой солью `"aapa_2026"`. Не bcrypt, не Argon2 — уязвимо к брутфорсу при утечке базы. После миграции — удалить полностью.

---

## Константы (остаются в коде после миграции)

```js
// App.jsx:237
const REG_GOALS = {
  exam:   "Подготовка к экзамену",
  gaps:   "Закрытие пробелов",
  future: "Подготовка к следующему классу"
};
// getSpecificList(goalKey) → EXAMS_LIST | GRADES_LIST
```

Используются в форме регистрации — останутся.

---

## Уязвимости, которые миграция закрывает

1. **Пароли в открытом Firestore** — любой с projectId может скачать все пароли (пусть и SHA-256, но всё равно).
2. **Сессия без проверки сервера** — localStorage можно подделать вручную и войти как любой пользователь без знания пароля (просто подменить `aapa_user` в DevTools).
3. **Нет `request.auth`** — Firestore Rules не работают, вся база открыта.
4. **Роль `admin` без защиты** — любой может поставить себе `role: "admin"` через DevTools → Network request.
