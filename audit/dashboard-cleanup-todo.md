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
