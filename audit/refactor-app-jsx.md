# Распил src/App.jsx — план

Дата: 2026-05-05
Текущий размер: 18 273 строк
Цель: разнести по модулям без изменения логики.

---

## Существующая структура src/

```
src/
  App.jsx                  ← монолит 18 273 строк
  main.jsx                 ← точка входа, не трогаем
  firestore-rest.js        ← Firestore REST wrapper, не трогаем
  CustomNode.jsx           ← уже отдельный файл (ReactFlow node)
  CustomNode.tsx           ← TS-версия, не трогаем
  MagicEdge.jsx            ← уже отдельный файл (ReactFlow edge)
  NpcContext.jsx           ← уже отдельный файл
  ThemeContext.jsx         ← уже отдельный файл
  DiagnosticEngine.js      ← уже отдельный файл (движок диагностики)
  MapStyles.css            ← стили ReactFlow
  assets/                  ← картинки
  components/
    NpcGuide.jsx           ← уже отдельный файл
    auth/
      EmailAuthScreen.jsx  ← уже отдельный файл
  constants/
    npcDialogues.json      ← константы NPC
    npcTours.js            ← маршруты NPC
  contexts/
    AuthContext.jsx        ← уже отдельный файл
  lib/
    firebase.js            ← уже отдельный файл
    contentCache.js        ← уже отдельный файл
```

Стиль существующих модулей: **плоский** (компоненты и утилиты в src/), с зачатками feature-папок (components/, contexts/, lib/). Нет screens/ и hooks/ — создадим в процессе распила.

---

## Карта App.jsx

| Строки | Имя | Тип | Строк | Используется в |
|---|---|---|---|---|
| 1–28 | imports | imports | 28 | — |
| 29–156 | `jsExprToLatex` | util | 128 | `LatexText` |
| 157–204 | `LatexText` | UI atom | 48 | QuestionScreen, SkillMasteryScreen, многие |
| 205–252 | константы (TELEGRAM, THEME, FALLBACK_QUESTIONS, CONFIDENCE_LEVELS, RPG_NODES...) | constants | 48 | повсеместно |
| 253–279 | `ErrorCard` | UI atom | 27 | DiagnosticsScreen |
| 280–338 | `compressImage` | util | 59 | AdminScreen, DashboardScreen, UploadAnalysisScreen |
| 339–651 | formula utils (`preprocessFormula`, `evalFormulaMulti/Raw`, `floatToFraction`, `formatAnswerValue`, `generateQuestion`, `parseGradeNumber`...) | utils | 313 | QuestionScreen, PracticeScreen, BossFightScreen, AdminScreen |
| 652–794 | `SqrtSpan`, `FracSpan`, `_mNodes`, `MathText` | UI atoms | 143 | QuestionScreen, PracticeScreen, SkillMasteryScreen, многие |
| 795–819 | `Logo`, `Timer` | UI atoms | 25 | QuestionScreen, DiagnosticsScreen, SkillMasteryScreen |
| 820–852 | `ONBOARDING_STEPS` | constant | 33 | OnboardingScreen |
| 853–914 | `OnboardingScreen` | Screen | 62 | App root |
| 915–1042 | `DiagnosticRulesScreen` | Screen | 128 | App root |
| 1043–1229 | `DiagnosticsScreen` | Screen | 187 | App root |
| 1230–1498 | `QuestionScreen` | Screen | 269 | App root |
| 1499–1545 | `ReportScreen` | Screen | 47 | App root |
| 1546–1644 | `UploadAnalysisScreen` | Screen | 99 | App root |
| 1645–2203 | SkillTree system: константы (`SKILL_VERT_LABELS`, `BIOME_CFG`...), утилиты (`buildSkillGraph`, `computeSkillLayout`...), node-компоненты (`ZoneBgNode`, `PixelSkillNode`, `PixelEdge`) | feature | 559 | `InteractiveSkillTree` |
| 2204–2265 | `buildPixelFlow` | util | 62 | `InteractiveSkillTree` |
| 2266–2394 | `InteractiveSkillTree` | Component | 129 | AdminScreen (line 11755) |
| 2395–2513 | `SoulNode` | Component | 119 | внутри SkillTree system (неиспользован?) |
| 2514–3116 | DiagModuleTree system: `buildDiagModuleTree`, `buildDiagModuleLayout`, `StarryNightBackground`, `PixelGameBackground`, `CrystalGem`, node-компоненты, `DiagModulePopup`, `DiagnosticModuleTree` | feature | 603 | `IndividualPlanScreen` (line 3784) |
| 3117–3146 | SRS utils: `getAlmatyNextMidnightAfter`, `isStageUnlocked`, `getAlmatyDateStr`, `SRS_INTERVALS`, `fmtCountdown` | utils | 30 | `SkillMasteryScreen` |
| 3147–3626 | `SkillMasteryScreen` | Screen | 480 | App root |
| 3627–3797 | `IndividualPlanScreen` | Screen | 171 | App root |
| 3798–3838 | `PathMap`, `RadarChart` | Screen+Component | 41 | (PathMap не используется в App root) |
| 3839–3993 | `ExpertReportView` | Screen | 155 | ProfileSection (12407), App root (18246) |
| 3994–4016 | `AnimCounter` | UI atom | 23 | `LandingScreen` |
| 4017–4447 | `LandingScreen` | Screen | 431 | App root |
| 4448–4458 | `ImageModal` | UI atom | 11 | QuestionScreen |
| 4459–4575 | `ChartRenderer` | Component | 117 | QuestionScreen, PracticeScreen, BossFightScreen, AdminScreen |
| 4576–4612 | `ChartEditor` | Component | 37 | AdminScreen только |
| 4613–4716 | `QuestionPreview` | Component | 104 | AdminScreen только |
| 4717–4767 | `RichTextEditor` | Component | 51 | (объявлен, но не используется в вызовах — только определён) |
| 4768–4935 | `SkillMapCanvas` | Component | 168 | AdminScreen только |
| 4936–5228 | ModuleTree system: константы, `ModuleFloorLabelNode`, `CustomModuleEdge`, `buildModuleTreeLayout`, `ModuleTreeModal` | feature | 293 | AdminScreen только |
| 5229–12329 | **`AdminScreen`** | Screen | **7101** | App root |
| 12330–12569 | `ProfileSection` | Component | 240 | DashboardScreen |
| 12570–13151 | `PracticeScreen` | Screen | 582 | App root |
| 13152–13779 | Whiteboard: `WB_COLORS`, `WB_WIDTHS`, `WhiteboardCanvas` | feature | 628 | `LessonModal` |
| 13780–14027 | `LessonModal` | Component | 248 | DashboardScreen (через LessonsSection) |
| 14028–14135 | `RecordingModal` | Component | 108 | DashboardScreen (через LessonsSection) |
| 14136–14395 | `LessonsSection` | Component | 260 | DashboardScreen |
| 14396–14521 | `MathToolsSection` | Component | 126 | DashboardScreen |
| 14522–14812 | `TheoryBrowseScreen` | Screen | 291 | App root |
| 14813–15138 | `DailyTasksScreen` | Screen | 326 | App root |
| 15139–15152 | `ThemeToggle` | Component | 14 | DashboardScreen |
| 15153–15236 | `ChangePasswordInline` | Component | 84 | DashboardScreen |
| 15237–15851 | `DashboardScreen` | Screen | 615 | App root |
| 15852–15906 | `PixelBoss` | Component | 55 | IntermediateTestsScreen, BossFightScreen |
| 15907–15994 | `IntermediateTestsScreen` | Screen | 88 | App root |
| 15995–16237 | `BossFightScreen` | Screen | 243 | App root |
| 16238–16258 | `checkTestStatus` | util | 21 | DiagnosticEngine |
| 16259–16780 | `DiagnosticEngine` (class) | Engine | 522 | SmartDiagRunner |
| 16781–17150 | `parseGrade`, `generateRoadmap`, `runDiagnosticSimulation`, `VERTICAL_LABELS` | utils | 370 | SmartDiagRunner, AdminScreen |
| 17151–17360 | `RoadmapScreen` | Screen | 210 | App root |
| 17361–17541 | `SmartDiagRunner` | Screen | 181 | App root |
| 17542–18273 | `QUIZ_PROGRESS_KEY` + `App` (root) | Root | 732 | — |

---

## Карта зависимостей

```
НЕЗАВИСИМЫЕ (выносятся первыми):
  jsExprToLatex, compressImage, formula utils, generateQuestion
  THEME, FALLBACK_QUESTIONS, CONFIDENCE_LEVELS, все константы
  getAlmaty*, SRS_INTERVALS, fmtCountdown
  DiagnosticEngine, checkTestStatus, parseGrade, generateRoadmap, runDiagnosticSimulation

UI ATOMS (зависят от jsExprToLatex):
  LatexText → jsExprToLatex
  MathText → (независим)
  Logo, Timer, ErrorCard, AnimCounter, ImageModal, RadarChart → независимы

CHARTS:
  ChartRenderer → (независим от App.jsx-кода)
  ChartEditor → ChartRenderer
  QuestionPreview → ChartRenderer, MathText, LatexText, generateQuestion
  RichTextEditor → (независим)
  SkillMapCanvas → (независим)

SKILL TREE (используется только в AdminScreen):
  InteractiveSkillTree → BIOME_CFG, buildSkillGraph, buildPixelFlow, PixelSkillNode, ZoneBgNode, PixelEdge

DIAG MODULE TREE (используется только в IndividualPlanScreen):
  DiagnosticModuleTree → buildDiagModuleTree, buildDiagModuleLayout, node-компоненты

MODULE TREE MODAL (используется только в AdminScreen):
  ModuleTreeModal → buildModuleTreeLayout, константы

SCREENS с минимальными зависимостями (после Stage 1+2+3):
  OnboardingScreen → Logo
  DiagnosticRulesScreen → Logo, THEME
  ReportScreen → THEME
  UploadAnalysisScreen → compressImage, Logo
  ExpertReportView → THEME (используется в ProfileSection и App root)
  LandingScreen → AnimCounter, Logo
  RoadmapScreen → THEME, VERTICAL_LABELS

SCREENS со средними зависимостями (после Stage 4):
  DiagnosticsScreen → ErrorCard, Logo
  QuestionScreen → MathText, LatexText, ChartRenderer, ImageModal, Logo, Timer, generateQuestion
  IndividualPlanScreen → DiagnosticModuleTree, contentCache
  SkillMasteryScreen → LatexText, Logo, SRS utils, contentCache
  SmartDiagRunner → DiagnosticEngine
  IntermediateTestsScreen → PixelBoss, contentCache
  BossFightScreen → PixelBoss, ChartRenderer, generateQuestion

DASHBOARD SYSTEM (после Stage 5):
  WhiteboardCanvas → WB_COLORS, WB_WIDTHS
  LessonModal → WhiteboardCanvas
  RecordingModal → (независим)
  LessonsSection → LessonModal, RecordingModal, contentCache
  ProfileSection → ExpertReportView
  DashboardScreen → LessonsSection, ProfileSection, MathToolsSection, ThemeToggle, ChangePasswordInline, contentCache

SCREENS с зависимостью от contentCache:
  PracticeScreen, TheoryBrowseScreen, DailyTasksScreen → contentCache, generateQuestion, LatexText/MathText

ADMIN SCREEN (последний, зависит от всего):
  AdminScreen → ChartRenderer, ChartEditor, QuestionPreview, SkillMapCanvas, ModuleTreeModal,
                InteractiveSkillTree, ImageModal, Logo, generateQuestion, compressImage,
                evalFormula*, runDiagnosticSimulation, THEME, contentCache (нет — прямой getDocs)
```

---

## Предложенная новая структура

```
src/
  App.jsx                          ← ~800 строк после всех этапов (только App root + imports)
  main.jsx
  firestore-rest.js                ← не трогаем
  CustomNode.jsx / .tsx            ← не трогаем
  MagicEdge.jsx                    ← не трогаем
  NpcContext.jsx, ThemeContext.jsx  ← не трогаем
  DiagnosticEngine.js              ← не трогаем (уже есть, но в App.jsx ещё один — объединить в Stage 1)
  MapStyles.css
  assets/

  lib/
    firebase.js          ← не трогаем
    contentCache.js      ← не трогаем
    appConstants.js      ← NEW: THEME, FALLBACK_QUESTIONS, CONFIDENCE_LEVELS, и все константы
    mathUtils.js         ← NEW: jsExprToLatex, compressImage, formula utils, generateQuestion
    srsUtils.js          ← NEW: getAlmaty*, SRS_INTERVALS, fmtCountdown
    diagnosticUtils.js   ← NEW: parseGrade, generateRoadmap, runDiagnosticSimulation, DiagnosticEngine, checkTestStatus, VERTICAL_LABELS

  components/
    ui/
      LatexText.jsx      ← NEW
      MathText.jsx       ← NEW: SqrtSpan, FracSpan, _mNodes, MathText
      Logo.jsx           ← NEW
      Timer.jsx          ← NEW
      ErrorCard.jsx      ← NEW
      AnimCounter.jsx    ← NEW
      ImageModal.jsx     ← NEW
      RadarChart.jsx     ← NEW
      PixelBoss.jsx      ← NEW
    charts/
      ChartRenderer.jsx  ← NEW
    admin/
      ChartEditor.jsx    ← NEW
      QuestionPreview.jsx ← NEW
      RichTextEditor.jsx ← NEW
      SkillMapCanvas.jsx ← NEW
    skillTree/
      InteractiveSkillTree.jsx ← NEW (+ все sub-компоненты внутри)
    diagTree/
      DiagnosticModuleTree.jsx ← NEW (+ все sub-компоненты внутри)
    moduleTree/
      ModuleTreeModal.jsx      ← NEW (+ buildModuleTreeLayout, константы)
    dashboard/
      WhiteboardCanvas.jsx ← NEW
      LessonModal.jsx      ← NEW
      RecordingModal.jsx   ← NEW
      LessonsSection.jsx   ← NEW
      MathToolsSection.jsx ← NEW
      ProfileSection.jsx   ← NEW
      ThemeToggle.jsx      ← NEW
      ChangePasswordInline.jsx ← NEW
    NpcGuide.jsx        ← не трогаем
    auth/
      EmailAuthScreen.jsx ← не трогаем

  contexts/
    AuthContext.jsx     ← не трогаем

  constants/
    npcDialogues.json   ← не трогаем
    npcTours.js         ← не трогаем

  screens/
    OnboardingScreen.jsx
    DiagnosticRulesScreen.jsx
    DiagnosticsScreen.jsx
    QuestionScreen.jsx
    ReportScreen.jsx
    UploadAnalysisScreen.jsx
    ExpertReportView.jsx
    LandingScreen.jsx
    SkillMasteryScreen.jsx
    IndividualPlanScreen.jsx
    PathMap.jsx
    RoadmapScreen.jsx
    SmartDiagRunner.jsx
    PracticeScreen.jsx
    TheoryBrowseScreen.jsx
    DailyTasksScreen.jsx
    DashboardScreen.jsx
    IntermediateTestsScreen.jsx
    BossFightScreen.jsx
    admin/
      AdminScreen.jsx   ← 7101 строк перемещается как есть
```

---

## План этапов

### Этап 1 — Константы и чистые утилиты
**Выносим:** jsExprToLatex, compressImage, все formula utils, generateQuestion, parseGradeNumber; THEME и все константы; SRS utils; DiagnosticEngine (class), checkTestStatus, parseGrade, generateRoadmap, runDiagnosticSimulation, VERTICAL_LABELS.
**Новые файлы:** `src/lib/appConstants.js`, `src/lib/mathUtils.js`, `src/lib/srsUtils.js`, `src/lib/diagnosticUtils.js`
**Зависимости на этапе:** Нет — всё это чистые JS без React и без ссылок на другой код App.jsx.
**Убирает из App.jsx:** ~1 200 строк
**Коммит:** `refactor(app): extract constants and pure utilities`

### Этап 2 — UI атомы
**Выносим:** LatexText, MathText (SqrtSpan, FracSpan, _mNodes), Logo, Timer, ErrorCard, AnimCounter, ImageModal, RadarChart.
**Новые файлы:** `src/components/ui/*.jsx`
**Зависимости:** LatexText → jsExprToLatex (уже в lib/mathUtils из этапа 1)
**Убирает из App.jsx:** ~450 строк
**Коммит:** `refactor(app): extract UI atoms to src/components/ui/`

### Этап 3 — Компоненты для работы с вопросами
**Выносим:** ChartRenderer; ChartEditor, QuestionPreview, RichTextEditor, SkillMapCanvas (admin-only).
**Новые файлы:** `src/components/charts/ChartRenderer.jsx`, `src/components/admin/*.jsx`
**Зависимости:** ChartEditor → ChartRenderer; QuestionPreview → ChartRenderer, MathText, LatexText, generateQuestion (всё из этапов 1–2+3)
**Убирает из App.jsx:** ~480 строк
**Коммит:** `refactor(app): extract chart and question-editor components`

### Этап 4 — SkillTree, DiagModuleTree, ModuleTreeModal системы
**Выносим:** InteractiveSkillTree (+ все sub-компоненты SkillTree); DiagnosticModuleTree (+ все sub-компоненты DiagModuleTree); ModuleTreeModal (+ buildModuleTreeLayout).
**Новые файлы:** `src/components/skillTree/InteractiveSkillTree.jsx`, `src/components/diagTree/DiagnosticModuleTree.jsx`, `src/components/moduleTree/ModuleTreeModal.jsx`
**Зависимости:** Каждая система самодостаточна внутри себя; использует константы из этапа 1.
**Убирает из App.jsx:** ~1 765 строк
**Коммит:** `refactor(app): extract SkillTree, DiagModuleTree, ModuleTreeModal`

### Этап 5 — Малые и средние экраны (без тяжёлых Firestore-зависимостей)
**Выносим:** OnboardingScreen, DiagnosticRulesScreen, ReportScreen, UploadAnalysisScreen, ExpertReportView, LandingScreen, PathMap, RoadmapScreen.
**Новые файлы:** `src/screens/*.jsx`
**Зависимости:** Используют UI атомы из этапа 2 и константы из этапа 1.
**Убирает из App.jsx:** ~1 170 строк
**Коммит:** `refactor(app): extract small/medium screens`

### Этап 6 — Основные экраны (диагностика, вопросы, обучение)
**Выносим:** DiagnosticsScreen, QuestionScreen, IndividualPlanScreen, SkillMasteryScreen, SmartDiagRunner, PixelBoss, IntermediateTestsScreen, BossFightScreen.
**Новые файлы:** `src/screens/*.jsx`, `src/components/ui/PixelBoss.jsx`
**Зависимости:** QuestionScreen → ChartRenderer (этап 3); IndividualPlanScreen → DiagnosticModuleTree (этап 4); SmartDiagRunner → DiagnosticEngine (этап 1).
**Убирает из App.jsx:** ~1 370 строк
**Коммит:** `refactor(app): extract core diagnostic and learning screens`

### Этап 7 — Dashboard система
**Выносим:** WhiteboardCanvas, LessonModal, RecordingModal, LessonsSection, MathToolsSection, ProfileSection, ThemeToggle, ChangePasswordInline → папка `src/components/dashboard/`; затем DashboardScreen, PracticeScreen, TheoryBrowseScreen, DailyTasksScreen → `src/screens/`.
**Зависимости:** LessonModal → WhiteboardCanvas; LessonsSection → LessonModal, RecordingModal; DashboardScreen → вся dashboard/; ProfileSection → ExpertReportView (этап 5).
**Убирает из App.jsx:** ~3 200 строк
**Коммит:** `refactor(app): extract dashboard system and remaining screens`

### Этап 8 — AdminScreen
**Выносим:** AdminScreen (7 101 строка) как есть в `src/screens/admin/AdminScreen.jsx`.
**Зависимости:** AdminScreen использует почти всё из предыдущих этапов — поэтому идёт последним.
**Убирает из App.jsx:** ~7 100 строк
**Коммит:** `refactor(app): extract AdminScreen`

---

## Итог после всех этапов

| До | После |
|---|---|
| App.jsx: 18 273 строк | App.jsx: ~800 строк (App root + QUIZ_PROGRESS_KEY + imports) |
| 1 файл | ~45 новых файлов |

---

## Риски

1. **Circular imports**: если при переносе экранов окажется, что они ссылаются друг на друга — нужно вынести shared-часть в отдельный файл. Ожидается только в ExpertReportView (используется в ProfileSection и App root) — обоим передаём импорт из src/screens/ExpertReportView.jsx.

2. **DiagnosticEngine дублирование**: `src/DiagnosticEngine.js` уже существует в проекте. В App.jsx ещё одна копия (class DiagnosticEngine, строки 16259–16780). Нужно сверить, одинаковые ли они, и при этапе 1 — использовать одну. **Требует проверки перед этапом 1.**

3. **AdminScreen — 7 101 строк в одном файле**: после переноса файл будет большим. Это нормально по правилам (логику не меняем). В будущем — отдельная задача разбить AdminScreen на табы.

4. **ONBOARDING_STEPS** — константа объявлена в App.jsx прямо перед OnboardingScreen. При выносе OnboardingScreen — её надо вынести туда же (или в appConstants.js).

5. **SoulNode** — объявлен внутри SkillTree-блока, но похоже не используется нигде в текущем коде. Перенесём вместе с InteractiveSkillTree на этапе 4, не удаляем.

6. **PIXEL_NODE_TYPES / PIXEL_EDGE_TYPES / DIAG_MOD_NODE_TYPES / DIAG_MOD_EDGE_TYPES** — объявлены как const на уровне модуля, не как useState. При переносе в отдельный файл убедиться, что они не переопределяются при ре-рендере.

7. **Самый связанный компонент** — `QuestionScreen`: использует MathText, LatexText, ChartRenderer, ImageModal, Logo, Timer, generateQuestion. Все они должны быть вынесены до этапа 6.

---

## Чеклист для каждого этапа

- [ ] `npm run build` без ошибок после каждого переноса
- [ ] Пользователь запускает `npm run dev` и проверяет затронутые экраны
- [ ] Git commit с понятным сообщением
- [ ] Пользователь даёт `git push` + Vercel deploy самостоятельно
- [ ] После деплоя — проверка прода перед следующим этапом
