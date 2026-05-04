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

| Коллекция | Поле-владелец сейчас | Тип ключа | Примечания |
|-----------|---------------------|-----------|------------|
| `users` | ключ = `phone` | document key | Переедет в `users/{uid}`, phone станет полем |
| `diagnosticResults` | поле `userPhone` | auto-ID | addDoc |
| `medals` | поле `userPhone` | auto-ID | addDoc |
| `hwSubmissions` | поле `userPhone` | auto-ID | addDoc |
| `expertReports` | поле `userId` (= phone) | auto-ID | addDoc; также есть `studentId` в данных |

---

## ⚠️ Все коллекции, использующие `phone` как ключ документа

Эти коллекции требуют замены паттерна доступа в коде на фазе 4:
`doc(db, 'коллекция', user.phone)` → `doc(db, 'коллекция', user.uid)`

### `skillProgress/{phone}` → `skillProgress/{uid}`

| Строка | Операция | Переменная-ключ |
|--------|----------|----------------|
| 3828 | `getDoc` | `user?.phone` |
| 6801 | `getDoc` | `phone` (phone студента, выбранного учителем) |
| 6875 | `getDoc` | `rStudentId` (= phone, см. :6633) |
| 6902 | `setDoc` | `rStudentId` (= phone) |
| 12790 | `getDoc` | `user?.phone` |
| 15400 | `getDoc` | `user.phone` |
| 17228 | `setDoc` | `userId` (= phone, аргумент `autoGeneratePlan`) |

### `skillMastery/{phone}` → `skillMastery/{uid}`

| Строка | Операция | Переменная-ключ |
|--------|----------|----------------|
| 3365 | `getDoc` | `user?.phone` |
| 3413 | `setDoc` (merge) | `user.phone` |
| 3831 | `getDoc` | `user?.phone` |
| 15022 | `getDoc` | `user.phone` |
| 15128 | `updateDoc` | `user.phone` |

### `userProgress/{phone}` → `userProgress/{uid}`

| Строка | Операция | Переменная-ключ |
|--------|----------|----------------|
| 6874 | `getDoc` | `rStudentId` (= phone) |
| 6901 | `setDoc` | `rStudentId` (= phone) |
| 12787 | `getDoc` | `user?.phone` |
| 15399 | `getDoc` | `user.phone` |

### `individualPlans/{phone}` → `individualPlans/{uid}`

| Строка | Операция | Переменная-ключ |
|--------|----------|----------------|
| 3827 | `getDoc` | `user?.phone` |
| 17227 | `setDoc` | `userId` (= phone, аргумент `autoGeneratePlan`) |

### `quizProgress/{progressDocId(phone)}` → `quizProgress/{uid}`

Сейчас ключ строится через `progressDocId(phone)` — функция заменяет спецсимволы в телефоне на `_`, т.е. `+77001234567` → `_77001234567`.

После миграции: ключ = `user.uid` напрямую (uid уже безопасен для Firestore-ключа, спецсимволов нет).
Функцию `progressDocId` можно удалить.

| Строка | Операция | Переменная-ключ |
|--------|----------|----------------|
| 17692 | `setDoc` | `progressDocId(user.phone)` |
| 17697 | `deleteDoc` | `progressDocId(user.phone)` |
| 17718 | `getDoc` | `progressDocId(user.phone)` |

### `autoGeneratePlan(userId, ...)` — фиксировать вызовы

Функция `autoGeneratePlan` (App.jsx:17160) принимает `userId` как первый аргумент и использует его как ключ для `skillProgress` и `individualPlans`. После миграции все вызовы должны передавать `user.uid`, а не `user.phone`.

Текущие вызовы:
- App.jsx:17895 — `autoGeneratePlan(user.phone, ...)`
- App.jsx:17959 — `autoGeneratePlan(user.phone, ...)`

### `rStudentId` в AdminScreen — отдельный случай

`rStudentId` (App.jsx:6633) — это phone выбранного студента, используемый учителем/админом для записи в `skillProgress/{rStudentId}` и `userProgress/{rStudentId}`.

После миграции `rStudentId` должен хранить `uid` студента, а не phone.
Студенты загружаются через `getDocs(collection(db,"users"))` → `students` массив.
Нужно убедиться, что `students[i].id` после миграции будет uid (ключ документа), а не phone.
Это произойдёт автоматически, если коллекция `users` переедет на `users/{uid}`.

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
