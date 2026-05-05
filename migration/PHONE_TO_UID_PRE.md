# Снимок состояния перед миграцией phone → uid

Дата: 2026-05-05
Коммит: 84bd7f389aa6857618674725669d111f38d3ef67

---

## Коллекции к миграции (полный список)

Все 5 коллекций с doc-ключом = phone. Остальные 11 из списка rules — auto-ID или uid-независимые.

| Коллекция | Текущий ключ | Защита в rules | Мест в коде |
|-----------|-------------|----------------|-------------|
| `skillProgress` | `user.phone` / `rStudentId` | `if true` | 7 |
| `skillMastery` | `user.phone` | `if true` | 5 |
| `userProgress` | `user.phone` / `rStudentId` | `if true` | 4 |
| `individualPlans` | `user.phone` | `if true` | 2 |
| `quizProgress` | `progressDocId(user.phone)` | `if true` | 3 |

**Итого замен в коде: 21 место.**

---

## Коллекции, которые НЕ меняем (auto-ID, привязка по полю)

Эти коллекции используют `addDoc` (auto-ID), а ссылка на пользователя — поле внутри документа.
После миграции: поле `userPhone` заменится на `userId: user.uid` (при новых записях), правила закроются по `resource.data.userId`.

| Коллекция | Поле сейчас | Что сделать |
|-----------|-------------|-------------|
| `diagnosticResults` | `userPhone` | добавить `userId: uid` при записи; rules по `userId` |
| `expertReports` | `userId` (= phone) | уже называется `userId` — поменять значение на uid |
| `medals` | `userPhone` | добавить `userId: uid` при записи |
| `hwSubmissions` | `userPhone` | добавить `userId: uid` при записи |

**Коллекции НЕ входят в Фазу 2 кода** — они сложнее (admin читает всё, ученик только своё, записи по addDoc). Отдельная задача после основной миграции.

---

## Коллекции, которые НЕ трогаем (учительские/системные)

| Коллекция | Почему |
|-----------|--------|
| `schedule`, `homework`, `hwSubmissions`, `lessons`, `lessonLogs` | Учительские; нет прямого `user.phone` как ключа; закрыть отдельно |
| `wbImages`, `wbStrokes`, `whiteboards` | Доска урока, ключ = `wbId` (не phone) |
| `diagnosticResults`, `medals` | auto-ID, поле userId — отдельная задача |

---

## Карта замен phone → uid в коде (App.jsx)

### `skillProgress/{phone}` → `skillProgress/{uid}` (7 мест)

| Строка (текущая) | Операция | Ключ сейчас | Ключ после |
|-----------------|----------|-------------|-----------|
| 3649 | `getDoc` | `user?.phone` | `user?.uid` |
| 3652 | `getDoc` | `user?.phone` | `user?.uid` |
| 6698 | `getDoc` | `rStudentId` (= phone) | `rStudentId` (= uid после) |
| 6725 | `setDoc` | `rStudentId` | `rStudentId` |
| 12614 | `getDoc` | `user?.phone` | `user?.uid` |
| 15309 | `getDoc` | `user.phone` | `user.uid` |
| 17833 / 17884 | через `autoGeneratePlan` | `user.phone` → внутри функции | `user.uid` |

### `skillMastery/{phone}` → `skillMastery/{uid}` (5 мест)

| Строка | Операция | Ключ сейчас | Ключ после |
|--------|----------|-------------|-----------|
| 3186 | `getDoc` | `user?.phone` | `user?.uid` |
| 3234 | `setDoc` merge | `user.phone` | `user.uid` |
| 3648 | `getDoc` | `user?.phone` | `user?.uid` |
| 14846 | `getDoc` | `user.phone` | `user.uid` |
| 14952 | `updateDoc` | `user.phone` | `user.uid` |

### `userProgress/{phone}` → `userProgress/{uid}` (4 места)

| Строка | Операция | Ключ сейчас | Ключ после |
|--------|----------|-------------|-----------|
| 6697 | `getDoc` | `rStudentId` | `rStudentId` (= uid после) |
| 6724 | `setDoc` | `rStudentId` | `rStudentId` |
| 12611 | `getDoc` | `user?.phone` | `user?.uid` |
| 15308 | `getDoc` | `user.phone` | `user.uid` |

### `individualPlans/{phone}` → `individualPlans/{uid}` (2 места)

| Строка | Операция | Ключ сейчас | Ключ после |
|--------|----------|-------------|-----------|
| 3648 | `getDoc` | `user?.phone` | `user?.uid` |
| через `autoGeneratePlan` | `setDoc` | `userId` = phone | `userId` = uid |

### `quizProgress/{progressDocId(phone)}` → `quizProgress/{uid}` (3 места)

| Строка | Операция | Ключ сейчас | Ключ после |
|--------|----------|-------------|-----------|
| 17610 | `setDoc` | `progressDocId(user.phone)` | `user.uid` |
| 17615 | `deleteDoc` | `progressDocId(user.phone)` | `user.uid` |
| 17636 | `getDoc` | `progressDocId(user.phone)` | `user.uid` |

---

## Хелперы, которые станут ненужными

- `progressDocId(phone)` — App.jsx:17601 — удалить функцию и все 3 вызова.
- `rStudentId` — App.jsx:6456 — переменная хранит phone студента; после миграции `students[i].id` будет uid (т.к. users уже на uid-ключах) — значение само станет uid, переименование опционально.
- `autoGeneratePlan(user.phone, ...)` — App.jsx:17833, 17884 — заменить на `user.uid`; внутри функции `userId` параметр используется как ключ для `skillProgress` и `individualPlans`.

---

## Зависимые места

- `autoGeneratePlan` (App.jsx:17069) — фильтрует `diagnosticResults` по `r.userPhone !== userId` (строка 17078). После миграции: `diagnosticResults` пока остаётся с `userPhone`, поэтому **эту проверку временно менять не нужно** — функция будет получать `user.uid`, но фильтровать по `userPhone`. Нужно будет добавить `userId` в `diagnosticResults` при записи и обновить фильтр — **отдельная задача**.
- `updateTopicProgress(_userPhone, ...)` — App.jsx:278 — функция уже помечена как unused (`_userPhone`). Проверить, не вызывается ли нигде.
- `firestore-rest.js` — REST-обёртка, токен-агностик; uid/phone — просто строка в URL. Менять не нужно.
