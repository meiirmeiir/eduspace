# Карта коллекций Firestore — EduSpace

> Дата аудита: 2026-05-04
> Аудитор: Claude Code (этап 1)
> ⚠️ На этом этапе ничего не изменялось. Только чтение и анализ.

---

## ⚠️ АРХИТЕКТУРНЫЙ ФЛАГ #0 (КРИТИЧНО — читать первым)

Проект **не использует Firebase Authentication**.
В `firestore.rules` есть явный комментарий:

```
// Приложение использует кастомную авторизацию (телефон+пароль),
// Firebase Auth не используется — request.auth всегда null.
```

Это означает:
- `request.auth` во всех запросах **всегда `null`**
- Любое правило вида `if request.auth != null` будет **запрещать всё**
- Firestore Security Rules **не могут различить пользователей** — нет `request.auth.uid`
- Единственный барьер сейчас — клиентский код (легко обходится)
- Любой, кто знает `projectId`, может обратиться к Firestore напрямую и получить **все данные всех учеников**

Текущие `if true` — не халтура, а вынужденный костыль из-за отсутствия Firebase Auth.

**Без миграции на Firebase Auth (или хотя бы на Firebase Anonymous Auth + custom claims) — написать нормальные rules невозможно.**

Этот вопрос нужно обсудить до этапа 3.

---

## 1. Карта коллекций

### Клиентский доступ (src/App.jsx)

#### `users/{phone}` — **ДАННЫЕ ПОЛЬЗОВАТЕЛЕЙ**
- `App.jsx:879` — `updateDoc` → поле `onboardingDone`
- `App.jsx:956` — `getDoc` → чтение профиля по телефону (логин)
- `App.jsx:969` — `updateDoc` → обновление произвольных полей (`fsUpdateUser`)
- `App.jsx:970` — `setDoc` → создание профиля (`fsCreateUser`)
- `App.jsx:5576` — `getDocs(collection("users"))` — **admin panel: список ВСЕХ пользователей** (включая пароли)
- `App.jsx:6584` — `updateDoc` → смена статуса студента
- `App.jsx:6590` — `updateDoc` → смена пароля (!)
- `App.jsx:6598` — `updateDoc` → сброс пароля
- `App.jsx:6625` — `updateDoc` → обновление данных студента
- `App.jsx:9674` — `updateDoc` → сброс `smartDiagDone`
- `App.jsx:12565` — `updateDoc` → обновление профиля
- `App.jsx:15384` — `getDocs` → учитель загружает список учеников
- `App.jsx:15422` — `updateDoc` → смена статуса на `inactive`
- `App.jsx:17743` — `getDoc` → чтение профиля при диагностике
- `App.jsx:17837` — `getDoc` → чтение профиля
- `App.jsx:17895/17912` — `updateDoc` → обновление после диагностики

> ⚠️ **Документы хранят пароли** (`password` field). Это само по себе проблема безопасности, отдельная от rules.

#### `diagnosticResults/{docId}`
- `App.jsx:1244/1245` — `getDocs` (admin: все результаты)
- `App.jsx:1761` — `updateDoc` → добавление фото студента
- `App.jsx:6672` — `getDocs` (admin)
- `App.jsx:6794` — `getDocs` (admin)
- `App.jsx:9668` — `deleteDoc` (admin)
- `App.jsx:12576` — `getDocs` (student: загрузка своих результатов)
- `App.jsx:16159/17877/17938` — `addDoc` → сохранение результата диагностики
- `App.jsx:17166` — `getDocs` (admin)

#### `skillProgress/{phone}`
- `App.jsx:3828` — `getDoc(phone)` (student reads own)
- `App.jsx:6801` — `getDoc(phone)` (teacher reads student's)
- `App.jsx:6902` — `setDoc(phone)` (teacher/admin writes)
- `App.jsx:12790` — `getDoc(phone)` (student reads own)
- `App.jsx:15400` — `getDoc(phone)` (student reads own)
- `App.jsx:17228` — `setDoc(userId)` (teacher/admin writes)

#### `skillMastery/{phone}`
- `App.jsx:3365` — `getDoc(phone)` (student reads own)
- `App.jsx:3413` — `setDoc(phone, merge)` (student writes)
- `App.jsx:3831` — `getDoc(phone)` (student reads own)
- `App.jsx:15022` — `getDoc(phone)` (student reads own)
- `App.jsx:15128` — `updateDoc(phone)` (student writes)

#### `userProgress/{phone}`
- `App.jsx:6874` — `getDoc(studentId)` (teacher reads)
- `App.jsx:6901` — `setDoc(studentId)` (teacher writes)
- `App.jsx:12787` — `getDoc(phone)` (student reads own)
- `App.jsx:15399` — `getDoc(phone)` (student reads own)

#### `individualPlans/{phone}`
- `App.jsx:3827` — `getDoc(phone)` (student reads own)
- `App.jsx:17227` — `setDoc(userId)` (teacher/admin writes)

#### `expertReports/{docId}`
- `App.jsx:1244` — `getDocs` (admin)
- `App.jsx:6672` — `getDocs` (admin)
- `App.jsx:6745/6757/6758` — `updateDoc` / `addDoc` (teacher writes)
- `App.jsx:6797` — `getDocs` (admin)
- `App.jsx:6861/6864` — `updateDoc` / `addDoc` (teacher writes)
- `App.jsx:9669` — `deleteDoc` (admin)
- `App.jsx:12577` — `getDocs` (student or teacher)

#### `quizProgress/{docId}`
- `App.jsx:17692` — `setDoc` (student saves quiz state)
- `App.jsx:17697` — `deleteDoc` (student clears)
- `App.jsx:17718` — `getDoc` (student reads own)

> Note: `progressDocId` вычисляется из `user.phone` — де-факто ключ по телефону.

#### `hwSubmissions/{docId}`
- `App.jsx:15385` — `getDocs` (teacher/student loads)
- `App.jsx:15452` — `addDoc` (student submits)
- `App.jsx:15465` — `updateDoc` → review + grade (teacher)

#### `medals/{docId}`
- `App.jsx:12578` — `getDocs` (student читает свои)
- `App.jsx:16016/16151` — `getDocs` (admin)
- `App.jsx:16172` — `addDoc` (система создаёт)

#### `schedule/{docId}`
- `App.jsx:15382` — `getDocs` (все загружают)
- `App.jsx:15525` — `deleteDoc` (admin/teacher)

#### `homework/{docId}`
- `App.jsx:15383` — `getDocs` (все загружают)
- `App.jsx:15476` — `addDoc` (teacher создаёт)
- `App.jsx:15524` — `deleteDoc` (teacher)

#### `lessons/{docId}`
- `App.jsx:15386` — `getDocs` (все)
- `App.jsx:14224` — `onSnapshot` (real-time)
- `App.jsx:14244` — `updateDoc` → summary (teacher)
- `App.jsx:15526` — `deleteDoc` (teacher/admin)

#### `lessonLogs/{docId}`
- `App.jsx:6673` — `getDocs` (admin)
- `App.jsx:6703` — `addDoc` (teacher)
- `App.jsx:6712` — `deleteDoc` (admin)

#### `whiteboards/{wbId}` + `wbStrokes/{wbId_i}` + `wbImages/{wbId_imgId}`
- `App.jsx:13981/14046/14060/14075/14077` — read/write (учитель + ученик, per-lesson)
- `App.jsx:14010/14030` — чтение и запись изображений

#### Контентные коллекции (read: все аутентифицированные; write: только admin через панель)
| Коллекция | Строки чтения | Строки записи |
|-----------|--------------|---------------|
| `sections/{docId}` | 1242, 12788 | 5616, 5626, 5633, 5769, 6136 |
| `questions/{docId}` | 1243, 12815, 16110, 17724, 17850 | 5870, 5885, 5892, 6407, 6500 |
| `theories/{docId}` | 12843 | 5987, 6038, 6042 |
| `topics/{docId}` | 12789 | 5666, 5670, 5678, 5730, 5748 |
| `skills/{docId}` | 5576 | 6049 |
| `skillsDb/{docId}` | 5576 | 6067, 6071, 6079, 6160 |
| `prereqMap/{docId}` | 5576 | 6188, 6191, 9418 |
| `skillHierarchies/{docId}` | 3830, 5576, 14721, 15023 | 6984, 6992, 7378, 7398, 7416 |
| `skillTheory/{docId}` | 5592, 14720 | 8863, 8935 |
| `skillTasks/{docId}` | 3363, 12359 | 12417, 12497 |
| `taskBank/{docId}` | 5590, 17473 | 7003, 7103, 7142, 7280, 11477 |
| `dailyTasks/{docId}` | 11964, 15048 | 11970, 11978, 12074, 12076, 12206 |
| `crossGradeLinks/{docId}` | 3829, 5586 | 6947, 6962, 6970 |
| `globalSkillMap/{docId}` | 5588 | 7226 |
| `moduleMap/{docId}` | — (в rules есть, в коде не найден) | — |
| `config/{docId}` | — (в rules есть, в коде не найден) | — |

#### `settings/{docId}`
- `App.jsx:5496` — `getDoc("settings/admin")` (admin reads)

#### `studyPlans/{docId}` / `topicProgress/{docId}`
- В rules присутствуют, в коде src/ не обнаружены → возможно мёртвый код или используются через динамические пути

### Серверный доступ (api/) — Admin SDK

#### `lessons/{docId}`
- `api/lessons.js:33` — `collection('lessons').orderBy` → читать все
- `api/lessons.js:55` — `collection('lessons').add` → создать урок
- `api/lessons-batch.js:59` — `collection('lessons').doc()` → создать пакетом
- `api/webhooks/zoom.js:18` — `collection('lessons')` → поиск по Zoom meeting ID

> Admin SDK обходит Security Rules — это нормально и ожидаемо.

---

## 2. Желаемый уровень доступа

| Коллекция | Желаемая защита | Обоснование |
|-----------|----------------|-------------|
| `users/{phone}` | **PRIVATE** | Личные данные + пароли. Только владелец + admin |
| `diagnosticResults/{docId}` | **READ_OWN_WRITE_OWN** + teacher read/admin write | Результаты ученика |
| `skillProgress/{phone}` | **READ_OWN_WRITE_OWN** + teacher write | Прогресс ученика |
| `skillMastery/{phone}` | **READ_OWN_WRITE_OWN** | Мастерство, пишет только сам ученик |
| `userProgress/{phone}` | **READ_OWN** + teacher write | Прогресс, teacher/admin управляет |
| `individualPlans/{phone}` | **READ_OWN** + teacher write | Планы создаёт учитель |
| `expertReports/{docId}` | **ADMIN_ONLY** write + owner/teacher read | Экспертные отчёты |
| `quizProgress/{phone}` | **READ_OWN_WRITE_OWN** | Текущее состояние квиза |
| `hwSubmissions/{docId}` | **READ_OWN_WRITE_OWN** + teacher read/update | Сдача ДЗ |
| `medals/{docId}` | **READ_OWN** + system write | Медали ученика |
| `schedule/{docId}` | **READ_ONLY_AUTHENTICATED** + teacher write | Расписание |
| `homework/{docId}` | **READ_ONLY_AUTHENTICATED** + teacher write | Задания |
| `lessons/{docId}` | **READ_ONLY_AUTHENTICATED** + teacher write | Записи уроков |
| `lessonLogs/{docId}` | **ADMIN_ONLY** | Внутренние логи |
| `whiteboards/{wbId}` | **READ_OWN_WRITE_OWN** (per session) | Доски per-урок |
| `wbStrokes/{docId}` | **READ_OWN_WRITE_OWN** | Штрихи доски |
| `wbImages/{docId}` | **READ_OWN_WRITE_OWN** | Изображения доски |
| `sections/{docId}` | **READ_ONLY_AUTHENTICATED** + ADMIN write | Контент |
| `questions/{docId}` | **READ_ONLY_AUTHENTICATED** + ADMIN write | Контент |
| `theories/{docId}` | **READ_ONLY_AUTHENTICATED** + ADMIN write | Контент |
| `topics/{docId}` | **READ_ONLY_AUTHENTICATED** + ADMIN write | Контент |
| `skills/{docId}` | **READ_ONLY_AUTHENTICATED** + ADMIN write | Контент |
| `skillsDb/{docId}` | **READ_ONLY_AUTHENTICATED** + ADMIN write | Контент |
| `prereqMap/{docId}` | **READ_ONLY_AUTHENTICATED** + ADMIN write | Контент |
| `skillHierarchies/{docId}` | **READ_ONLY_AUTHENTICATED** + ADMIN write | Контент |
| `skillTheory/{docId}` | **READ_ONLY_AUTHENTICATED** + ADMIN write | Контент |
| `skillTasks/{docId}` | **READ_ONLY_AUTHENTICATED** + ADMIN write | Контент |
| `taskBank/{docId}` | **READ_ONLY_AUTHENTICATED** + ADMIN write | Контент |
| `dailyTasks/{docId}` | **READ_ONLY_AUTHENTICATED** + ADMIN write | Контент |
| `crossGradeLinks/{docId}` | **READ_ONLY_AUTHENTICATED** + ADMIN write | Контент |
| `globalSkillMap/{docId}` | **READ_ONLY_AUTHENTICATED** + ADMIN write | Контент |
| `moduleMap/{docId}` | **READ_ONLY_AUTHENTICATED** + ADMIN write | Контент (мёртвый?) |
| `config/{docId}` | **ADMIN_ONLY** | Конфигурация системы |
| `settings/{docId}` | **ADMIN_ONLY** | Настройки системы |
| `studyPlans/{docId}` | **READ_OWN_WRITE_OWN** + ADMIN | Не найден в коде — уточнить |
| `topicProgress/{docId}` | **READ_OWN_WRITE_OWN** | Не найден в коде — уточнить |

---

## 3. Текущие правила и соответствие

### `match /users/{userId}`
```
allow read, create, update: if true;
allow delete: if false;
```
**Соответствие:** ❌ КРИТИЧНО — любой анонимный запрос читает и изменяет любой профиль.
Поле `password` хранится в открытом виде и доступно всем.

### `match /diagnosticResults/{docId}`
```
allow read, write: if true;
```
**Соответствие:** ❌ КРИТИЧНО — результаты диагностики всех учеников открыты для чтения и записи любым.

### `match /skillProgress/{docId}`
```
allow read, write: if true;
```
**Соответствие:** ❌ HIGH — прогресс ученика открыт для подделки.

### `match /topicProgress/{docId}`
```
allow read, write: if true;
```
**Соответствие:** ❌ HIGH (но коллекция, возможно, не используется).

### `match /studyPlans/{docId}`
```
allow read, write: if true;
```
**Соответствие:** ❌ HIGH (но коллекция, возможно, не используется).

### `match /quizProgress/{docId}`
```
allow read, write: if true;
```
**Соответствие:** ❌ HIGH — прогресс квиза открыт всем.

### `match /skillMastery/{docId}`
```
allow read, write: if true;
```
**Соответствие:** ❌ HIGH — мастерство ученика можно подделать.

### `match /userProgress/{docId}`
```
allow read, write: if true;
```
**Соответствие:** ❌ HIGH — прогресс открыт.

### `match /expertReports/{docId}`
```
allow read, write: if true;
```
**Соответствие:** ❌ HIGH — персональные отчёты доступны всем.

### `match /taskBank/{docId}` и все контентные коллекции
```
allow read, write: if true;
```
**Соответствие:** ⚠️ MEDIUM — чтение ожидаемо открыто, но запись должна быть только admin. Сейчас любой может изменить/удалить весь контент системы.

### `match /schedule/{docId}`, `/homework/{docId}`, `/hwSubmissions/{docId}`, `/lessons/{docId}`, `/lessonLogs/{docId}`
```
allow read, write: if true;
```
**Соответствие:** ⚠️ MEDIUM-HIGH — расписание и ДЗ можно подделать, логи — прочитать.

### `match /wbImages/{docId}`, `/wbStrokes/{docId}`, `/whiteboards/{docId}`
```
allow read, write: if true;
```
**Соответствие:** ⚠️ MEDIUM — доски открыты для чтения/записи любым.

### `match /individualPlans/{docId}`, `/settings/{docId}`, `/medals/{docId}`
```
allow read, write: if true;
```
**Соответствие:** ❌ HIGH — индивидуальные планы и настройки открыты.

### `match /{document=**}`
```
allow read, write: if false;
```
**Соответствие:** ✅ ОК — catch-all правильно закрывает всё остальное (deny by default).

---

## 4. Сводная таблица проблем

| Коллекция | Текущая защита | Требуемая | Тяжесть |
|-----------|---------------|-----------|---------|
| `users/{phone}` | `if true` (read+write) | PRIVATE + ADMIN | **CRITICAL** |
| `diagnosticResults` | `if true` | READ_OWN + teacher | **CRITICAL** |
| `skillProgress` | `if true` | READ_OWN_WRITE_OWN + teacher | **HIGH** |
| `skillMastery` | `if true` | READ_OWN_WRITE_OWN | **HIGH** |
| `userProgress` | `if true` | READ_OWN + teacher write | **HIGH** |
| `expertReports` | `if true` | ADMIN write + owner/teacher read | **HIGH** |
| `individualPlans` | `if true` | READ_OWN + teacher write | **HIGH** |
| `quizProgress` | `if true` | READ_OWN_WRITE_OWN | **HIGH** |
| `hwSubmissions` | `if true` | READ_OWN_WRITE_OWN + teacher | **HIGH** |
| `medals` | `if true` | READ_OWN + system write | **HIGH** |
| `settings` | `if true` | ADMIN_ONLY | **HIGH** |
| `config` | `if true` | ADMIN_ONLY | **HIGH** |
| `lessonLogs` | `if true` | ADMIN_ONLY | **HIGH** |
| `sections` / `questions` / `theories` / `topics` | `if true` | READ_AUTH + ADMIN write | **MEDIUM** |
| `skills` / `skillsDb` / `prereqMap` / `skillHierarchies` | `if true` | READ_AUTH + ADMIN write | **MEDIUM** |
| `skillTheory` / `skillTasks` / `taskBank` / `dailyTasks` | `if true` | READ_AUTH + ADMIN write | **MEDIUM** |
| `crossGradeLinks` / `globalSkillMap` / `moduleMap` | `if true` | READ_AUTH + ADMIN write | **MEDIUM** |
| `schedule` / `homework` / `lessons` | `if true` | READ_AUTH + teacher write | **MEDIUM** |
| `whiteboards` / `wbStrokes` / `wbImages` | `if true` | READ_OWN_WRITE_OWN | **MEDIUM** |
| `studyPlans` / `topicProgress` | `if true` | READ_OWN (если используется) | **MEDIUM** |
| `moduleMap` / `config` | `if true` — в коде не найдены | — | **LOW / уточнить** |

---

## 5. Вопросы к владельцу до этапа 3

1. **Главный вопрос:** Планируется ли миграция на Firebase Phone Authentication?
   - Без неё написать нормальные rules на основе `request.auth` **невозможно**.
   - Альтернатива: перейти на Firebase Anonymous Auth + Firestore-хранение ролей — но это тоже требует изменений в коде.

2. `studyPlans` и `topicProgress` — коллекции есть в rules, но **не найдены в коде**. Это мёртвый код или используется где-то ещё?

3. `moduleMap` и `config` — аналогично, в коде не найдены.

4. `whiteboards` / `wbStrokes` / `wbImages` — у документа есть `wbId`. Как определяется, кто «владелец» доски? По `studentId` в поле документа?

5. `diagnosticResults` и `expertReports` — документы создаются через `addDoc` (auto-ID). Как отличить «свой» документ от чужого? Есть ли поле `studentId` / `phone`?

6. `medals` — по какому полю определяется владелец?

7. `hwSubmissions` — есть ли поле `studentPhone` или `userId` в документе?

8. Кто в системе считается «admin»? Это захардкоженный `phone` в `settings/admin`? Или поле `role` в `users/{phone}`?
