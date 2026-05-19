# DashboardScreen — dead branches / cleanup (TODO)

Cleanup-коммит запланирован **после завершения 7.6e** (когда сам
DashboardScreen уже будет в отдельном модуле). Не трогаем по ходу
поэтапного распила, чтобы каждый шаг оставался строго 1:1.

## activeSection === "tools" — мёртвая ветка

В `DashboardScreen` есть условный рендер:

```jsx
{activeSection==="tools"&&<MathToolsSection/>}
```

Но в `navItems` (массив пунктов сайдбара) **нет** элемента с
`id: "tools"`, и нигде в коде нет вызова `setActiveSection("tools")`
из доступных пользователю UI-элементов. То есть ветка недостижима.

`MathToolsSection` (НОД/НОК калькулятор с алгоритмом Евклида) после
7.6b живёт в `src/components/MathToolsSection.jsx`. Если фичу не
планируется возвращать — после 7.6e можно:

1. Удалить условный рендер `{activeSection==="tools"&&...}` из
   `DashboardScreen`.
2. Удалить импорт `MathToolsSection` из того места, куда он попал
   после 7.6e (App.jsx → DashboardScreen.jsx).
3. Если компонент нигде больше не используется — удалить и сам
   `src/components/MathToolsSection.jsx`.

Если фичу планируется вернуть — оставить как есть и добавить
`{id:"tools",icon:"🧮",label:"Инструменты"}` в `navItems`.

## activeSection === "schedule" — мёртвая ветка

Аналогичная история (обнаружено в 7.6d):

```jsx
{activeSection==="schedule"&&<LessonsSection user={user} firebaseUser={firebaseUser} isAdmin={isAdmin} isTeacher={isTeacher} students={students}/>}
```

`handleNav("schedule")` устанавливает `activeSection` в `"schedule"`,
но в `navItems` нет элемента с `id: "schedule"`, и других вызовов
`handleNav("schedule")` тоже нет. Расписание занятий и так
отображается внутри `activeSection==="home"` (week-calendar), а
`LessonsSection` — отдельный список «Все предстоящие уроки» через
`/api/lessons` — оказался отрезан от UI.

После 7.6e либо:

1. Удалить условный рендер и импорт `LessonsSection` (и сам файл,
   если ни о ком больше не нужен).
2. Либо вернуть пункт сайдбара `{id:"schedule",icon:"📅",label:"Расписание"}`
   и связать с активацией.

## LessonsSection — pre-existing bugs (1:1 carried over)

Перенесены без правок в `src/components/LessonsSection.jsx`. Чинить
отдельным bugfix-коммитом после 7.6e (или после удаления компонента,
если выбран вариант 1 выше).

### Bug A — `useState` используется вместо `useEffect`

```jsx
useState(()=>{ loadLessons(); },[]);
// Use useEffect to load on mount
React.useEffect(()=>{ loadLessons(); },[]);
```

`useState((init), [])` — `useState` не принимает второй аргумент,
массив зависимостей игнорируется. Init-функция возвращает `undefined`
→ состояние = `undefined`, сеттер не используется. Зато `loadLessons()`
всё-таки вызывается. Дальше идёт настоящий `useEffect`, который
вызывает `loadLessons()` повторно. На монтировании уходят **два
параллельных fetch** к `/api/lessons`. Состояние обновляет последний
ответ — race-condition.

Фикс: удалить строку с `useState(()=>{...},[])`, оставить только
`useEffect`.

### Bug B — `THEME.card` не существует

```jsx
<div … style={{…background:THEME.card,…}}>
```

В `lib/appConstants.js` экспорт `THEME` имеет поля `primary / accent /
bg / surface / text / textLight / border / success / warning / error`.
`card` отсутствует — `THEME.card === undefined` → атрибут CSS
проигнорируется, фон карточки выпадает к дефолту (прозрачный/унаследованный).

Фикс: заменить на `THEME.surface` (белый) или `THEME.bg` (светло-серый
fond) в зависимости от желаемого вида.
