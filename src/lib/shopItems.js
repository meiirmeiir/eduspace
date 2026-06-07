// Каталог магазина кристаллов. Раскладка:
//   - background: SVG/JPG-фон, применяется как layer под секцией профиля
//   - frame:      SVG-рамка вокруг аватара в профиле
//   - title:      строковый титул под именем
//   - theme:      ключ темы (визуальные CSS-правила добавляются отдельной задачей)
//
// price — в кристаллах. isExclusive + requiredLeague: 'diamond' → доступен
// только пока ученик в Алмаз-лиге (по weekPoints). После покупки frame
// остаётся в инвентаре, даже если лига сменилась.

// rarity — тир редкости (см. RARITY ниже). Распределение по цене:
//   <200 common · 200–400 rare · 400–600 epic (порог 400 не включается) ·
//   600+ legendary · алмазные/эксклюзивные предметы всегда legendary.
// isNew / isHit — бейджи витрины «NEW» / «HIT» (хиты захардкожены, пока нет
// статистики покупок).
export const SHOP_ITEMS = [
  // ── Фоны (1 SVG + 7 JPG-слотов; JPG-файлы загружаются вручную в public/shop/backgrounds/) ──
  { id: 'bg-manga',            type: 'background', name: 'Манга стиль',       price: 300, rarity: 'rare',                file: '/shop/backgrounds/manga-style.svg',     preview: '/shop/backgrounds/manga-style.svg' },
  { id: 'bg-anime-city',       type: 'background', name: 'Аниме город',       price: 350, rarity: 'rare', isHit: true,   file: '/shop/backgrounds/anime-city.jpg',      preview: '/shop/backgrounds/anime-city.jpg' },
  { id: 'bg-sakura',           type: 'background', name: 'Сакура',            price: 300, rarity: 'rare',                file: '/shop/backgrounds/sakura.jpg',          preview: '/shop/backgrounds/sakura.jpg' },
  { id: 'bg-cyberpunk',        type: 'background', name: 'Cyberpunk',         price: 450, rarity: 'epic',                file: '/shop/backgrounds/cyberpunk.jpg',       preview: '/shop/backgrounds/cyberpunk.jpg' },
  { id: 'bg-lofi',             type: 'background', name: 'Lo-Fi',             price: 300, rarity: 'rare',                file: '/shop/backgrounds/lofi.png',            preview: '/shop/backgrounds/lofi.png' },
  { id: 'bg-minecraft',        type: 'background', name: 'Minecraft',         price: 250, rarity: 'rare',                file: '/shop/backgrounds/minecraft.jpg',       preview: '/shop/backgrounds/minecraft.jpg' },
  { id: 'bg-aesthetic-black',  type: 'background', name: 'Aesthetic Black',   price: 350, rarity: 'rare',                file: '/shop/backgrounds/aesthetic-black.jpg', preview: '/shop/backgrounds/aesthetic-black.jpg' },
  { id: 'bg-neon-waves',       type: 'background', name: 'Неоновые волны',    price: 300, rarity: 'rare', isNew: true,   file: '/shop/backgrounds/neon-waves.jpg',      preview: '/shop/backgrounds/neon-waves.jpg' },

  // ── Рамки (чистый CSS: border + boxShadow вокруг круглого аватара) ──
  // Стили живут в FRAME_STYLES ниже; здесь храним только метаданные предмета.
  { id: 'frame-fire',     type: 'frame', name: 'Огненная рамка',    price: 300, rarity: 'rare', isHit: true, cssFrame: true },
  { id: 'frame-neon',     type: 'frame', name: 'Неоновая рамка',    price: 400, rarity: 'rare',              cssFrame: true },
  { id: 'frame-pixel',    type: 'frame', name: 'Пиксельная рамка',  price: 200, rarity: 'rare',              cssFrame: true },
  { id: 'frame-rainbow',  type: 'frame', name: 'Радужная рамка',    price: 350, rarity: 'rare', isNew: true, cssFrame: true },
  { id: 'frame-diamond',  type: 'frame', name: 'Алмазная рамка 💎', price: 800, rarity: 'legendary', cssFrame: true, isExclusive: true, requiredLeague: 'diamond' },

  // ── Титулы (отображаются под именем в профиле) ──
  { id: 'title-math-mafia',    type: 'title', name: 'Math Mafia',                       price: 350,  rarity: 'rare',                value: 'Math Mafia' },
  { id: 'title-ent-easy',      type: 'title', name: 'ЕНТ — это легко',                  price: 300,  rarity: 'rare',                value: 'ЕНТ — это легко' },
  { id: 'title-meme-math',     type: 'title', name: 'Задачи решаю, мемы листаю',        price: 200,  rarity: 'rare',                value: 'Задачи решаю, мемы листаю' },
  { id: 'title-king-formulas', type: 'title', name: 'Король формул',                    price: 400,  rarity: 'rare', isNew: true,   value: 'Король формул' },
  { id: 'title-top1-kz',       type: 'title', name: 'Топ 1 Казахстан',                  price: 1000, rarity: 'legendary',           value: 'Топ 1 Казахстан' },

  // ── Темы (визуальный CSS добавится отдельным апдейтом; пока — только хранение equipped.theme) ──
  { id: 'theme-galaxy',  type: 'theme', name: 'Galaxy 🌌',  price: 500, rarity: 'epic', isNew: true, value: 'galaxy' },
  { id: 'theme-sakura',  type: 'theme', name: 'Sakura 🌸',  price: 400, rarity: 'rare',              value: 'sakura' },
  { id: 'theme-matrix',  type: 'theme', name: 'Matrix 💻',  price: 450, rarity: 'epic', isHit: true, value: 'matrix' },
  { id: 'theme-fire',    type: 'theme', name: 'Fire 🔥',    price: 400, rarity: 'rare',              value: 'fire' },

  // ── Снаряжение (космос/sci-fi): надевается на 3D-персонажа. Визуал — в
  //    EQUIPMENT_MODELS ниже (ключ = id). type = слот → equipped.{slot}. ──
  { id: 'eq-helmet-pilot', type: 'helmet', name: 'Шлем пилота',          price: 100, rarity: 'common',              icon: '🪖',  hp: 1 },
  { id: 'eq-helmet-astro', type: 'helmet', name: 'Шлем астронавта',      price: 250, rarity: 'rare',                icon: '🧑‍🚀', hp: 2 },
  { id: 'eq-helmet-cyber', type: 'helmet', name: 'Кибер-визор',          price: 450, rarity: 'epic', isNew: true,   icon: '🤖',  hp: 3 },
  { id: 'eq-top-jacket',   type: 'top',    name: 'Лётная куртка',        price: 120, rarity: 'common',              icon: '🧥',  hp: 1 },
  { id: 'eq-top-suit',     type: 'top',    name: 'Скафандр',             price: 300, rarity: 'rare',                icon: '🚀',  hp: 2 },
  { id: 'eq-top-armor',    type: 'top',    name: 'Броня десантника',     price: 550, rarity: 'epic',                icon: '🛡️',  hp: 3 },
  { id: 'eq-bottom-pants', type: 'bottom', name: 'Лётные штаны',         price: 80,  rarity: 'common',              icon: '👖',  hp: 1 },
  { id: 'eq-bottom-suit',  type: 'bottom', name: 'Штаны скафандра',      price: 220, rarity: 'rare',                icon: '🩳',  hp: 2 },
  { id: 'eq-bottom-armor', type: 'bottom', name: 'Бронепластины',        price: 400, rarity: 'rare',                icon: '🦿',  hp: 3 },
  { id: 'eq-boots-pilot',  type: 'boots',  name: 'Ботинки пилота',       price: 90,  rarity: 'common',              icon: '🥾',  hp: 1 },
  { id: 'eq-boots-magnet', type: 'boots',  name: 'Магнитные сапоги',     price: 200, rarity: 'rare', isHit: true,   icon: '🧲',  hp: 2 },
  { id: 'eq-boots-jet',    type: 'boots',  name: 'Реактивные ботинки',   price: 500, rarity: 'epic',                icon: '🔥',  hp: 3 },

  // ── Сет «Ниндзя» (rare) ──
  { id: 'eq-helmet-ninja', type: 'helmet', name: 'Капюшон ниндзя',       price: 200, rarity: 'rare', isNew: true,   icon: '🥷',  hp: 1 },
  { id: 'eq-top-ninja',    type: 'top',    name: 'Костюм синоби',        price: 250, rarity: 'rare',                icon: '🌑',  hp: 1 },
  { id: 'eq-bottom-ninja', type: 'bottom', name: 'Штаны-шаровары',       price: 180, rarity: 'rare',                icon: '👖',  hp: 1 },
  { id: 'eq-boots-ninja',  type: 'boots',  name: 'Таби-сапоги',          price: 200, rarity: 'rare',                icon: '🦶',  hp: 1 },

  // ── Сет «Рыцарь» (epic) ──
  { id: 'eq-helmet-knight', type: 'helmet', name: 'Рыцарский шлем',      price: 350, rarity: 'epic',                icon: '⚔️',  hp: 2 },
  { id: 'eq-top-knight',    type: 'top',    name: 'Латная броня',        price: 400, rarity: 'epic',                icon: '🛡️',  hp: 2 },
  { id: 'eq-bottom-knight', type: 'bottom', name: 'Боевые поножи',       price: 300, rarity: 'epic',                icon: '🦵',  hp: 1 },
  { id: 'eq-boots-knight',  type: 'boots',  name: 'Стальные сапоги',     price: 350, rarity: 'epic',                icon: '🥾',  hp: 1 },

  // ── Сет «Маг» (epic) ──
  { id: 'eq-helmet-mage',  type: 'helmet', name: 'Шляпа волшебника',     price: 380, rarity: 'epic', isNew: true,   icon: '🧙',  hp: 2 },
  { id: 'eq-top-mage',     type: 'top',    name: 'Мантия мага',          price: 420, rarity: 'epic',                icon: '🔮',  hp: 2 },
  { id: 'eq-bottom-mage',  type: 'bottom', name: 'Магические штаны',     price: 280, rarity: 'epic',                icon: '✨',  hp: 1 },
  { id: 'eq-boots-mage',   type: 'boots',  name: 'Башмаки чародея',      price: 320, rarity: 'epic',                icon: '🌟',  hp: 1 },

  // ── Сет «Степной воин» (legendary, казахская эстетика) ──
  { id: 'eq-helmet-steppe', type: 'helmet', name: 'Борик',               price: 500, rarity: 'legendary', isNew: true, icon: '🎩', hp: 2 },
  { id: 'eq-top-steppe',    type: 'top',    name: 'Чапан',               price: 600, rarity: 'legendary',           icon: '🧥',  hp: 2 },
  { id: 'eq-bottom-steppe', type: 'bottom', name: 'Шалбар',              price: 450, rarity: 'legendary',           icon: '👖',  hp: 1 },
  { id: 'eq-boots-steppe',  type: 'boots',  name: 'Кебис',               price: 500, rarity: 'legendary',           icon: '👢',  hp: 1 },

  // ── Сет «Король математики» (legendary, ТОЛЬКО за достижение).
  //    achievementOnly: не продаётся за кристаллы — выдаёт система достижений
  //    (Cloud Function пишет itemId в inventory) при освоении всех 307 навыков. ──
  { id: 'eq-helmet-king', type: 'helmet', name: 'Корона короля',          price: 0, rarity: 'legendary', achievementOnly: true, icon: '👑', hp: 2 },
  { id: 'eq-top-king',    type: 'top',    name: 'Королевская мантия',     price: 0, rarity: 'legendary', achievementOnly: true, icon: '🟣', hp: 2 },
  { id: 'eq-bottom-king', type: 'bottom', name: 'Королевские штаны',      price: 0, rarity: 'legendary', achievementOnly: true, icon: '👖', hp: 1 },
  { id: 'eq-boots-king',  type: 'boots',  name: 'Сапоги короля',          price: 0, rarity: 'legendary', achievementOnly: true, icon: '👞', hp: 1 },
];

// ── Тиры редкости: метаданные для рамок карточек и бейджей ──
export const RARITY = {
  common:    { name: 'Обычный',      stars: '★',    color: '#94a3b8' },
  rare:      { name: 'Редкий',       stars: '★★',   color: '#3b82f6' },
  epic:      { name: 'Эпический',    stars: '★★★',  color: '#a78bfa' },
  legendary: { name: 'Легендарный',  stars: '★★★★', color: '#fbbf24' },
};

// ── Эксклюзивы «только за достижения» — НЕ продаются за кристаллы.
//    Выдача — системой достижений (Cloud Function пишет itemId в inventory);
//    в магазине это витрина-мотиватор с замочком и условием получения. ──
export const ACHIEVEMENT_EXCLUSIVES = [
  { id: 'frame-class-top1', type: 'frame',      name: 'Рамка «#1 в классе»',          rarity: 'legendary', cssFrame: true, icon: '🥇', requirement: 'Займи 1 место в недельном рейтинге своего класса' },
  { id: 'bg-fire-streak',   type: 'background', name: 'Огненный фон',                  rarity: 'legendary', icon: '🔥', requirement: 'Заработай стрик 30 дней подряд' },
  { id: 'title-math-king',  type: 'title',      name: 'Корона короля математики',      rarity: 'legendary', icon: '👑', value: '👑 Король математики', requirement: 'Освой все 307 навыков на карте' },
  // Полный сет снаряжения короля (4 предмета achievementOnly из SHOP_ITEMS).
  { id: 'set-king',         type: 'set',        name: 'Сет «Король математики»',       rarity: 'legendary', icon: '👑', requirement: 'Освой все 307 навыков — сет откроется целиком (+6 ❤️ бонус)' },
];

// ── Предложение недели: один товар со скидкой 30%, детерминированная ротация
//    по ISO-номеру недели (сброс — понедельник 00:00 UTC вместе с рейтингом). ──
const WEEKLY_OFFER_POOL = ['bg-cyberpunk', 'theme-galaxy', 'eq-top-armor', 'bg-anime-city', 'frame-neon', 'eq-boots-jet', 'theme-matrix', 'bg-manga'];
export const WEEKLY_OFFER_DISCOUNT = 30; // %

export function getWeeklyOffer(weekId) {
  const n = parseInt(String(weekId || '').split('-W')[1] || '0', 10);
  const item = getShopItem(WEEKLY_OFFER_POOL[n % WEEKLY_OFFER_POOL.length]);
  if (!item) return null;
  const salePrice = Math.round(item.price * (100 - WEEKLY_OFFER_DISCOUNT) / 100 / 10) * 10;
  return { item, discountPct: WEEKLY_OFFER_DISCOUNT, salePrice };
}

export const SHOP_TYPES = [
  { id: 'background', icon: '🖼️', label: 'Фоны' },
  { id: 'frame',      icon: '🔲', label: 'Рамки' },
  { id: 'title',      icon: '📝', label: 'Титулы' },
  { id: 'theme',      icon: '🎨', label: 'Темы' },
  { id: 'equipment',  icon: '⚔️', label: 'Снаряжение' },
];

export function getShopItem(id) {
  return SHOP_ITEMS.find(i => i.id === id) || null;
}

// CSS-стили для рамок аватара. Применяются как inline style к
// круглому элементу (img/div). Ключ — itemId предмета типа 'frame'.
// border перекрывает дефолтную обводку аватара; boxShadow добавляет
// glow/orbs/rings снаружи.
export const FRAME_STYLES = {
  'frame-fire':    { border: '3px solid #f97316', boxShadow: '0 0 8px #f97316, 0 0 16px #ef4444, 0 0 24px #dc2626' },
  'frame-neon':    { border: '3px solid #22d3ee', boxShadow: '0 0 8px #22d3ee, 0 0 16px #818cf8, 0 0 24px #c084fc' },
  'frame-pixel':   { border: '4px solid #22c55e', boxShadow: '4px 4px 0 #15803d, -4px -4px 0 #15803d, 4px -4px 0 #15803d, -4px 4px 0 #15803d' },
  'frame-rainbow': { boxShadow: '0 0 0 3px #f43f5e, 0 0 0 5px #f97316, 0 0 0 7px #eab308, 0 0 0 9px #22c55e, 0 0 0 11px #3b82f6, 0 0 0 13px #a855f7' },
  'frame-diamond': { border: '3px solid #bae6fd', boxShadow: '0 0 8px #bae6fd, 0 0 16px #7dd3fc, inset 0 0 8px rgba(186,230,253,0.3)' },
  // Эксклюзив за #1 в недельном рейтинге класса (ACHIEVEMENT_EXCLUSIVES).
  'frame-class-top1': { border: '3px solid #fbbf24', boxShadow: '0 0 10px #fbbf24, 0 0 20px #f59e0b, 0 0 30px rgba(212,175,55,0.5)' },
};

// 3D-визуал снаряжения для LegoCharacter3D. Ключ = itemId. Координаты — в
// системе charGroup (поверх базовых частей: голова y≈2.32 r0.4 фронт z0.4;
// торс y1.6; таз y1.0; ноги x±0.23 y0..0.85; стопы y0..0.22). Каждый part:
//   shape: 'box'|'cyl'|'sphere'|'torus'|'cone'
//   box:    w,h,d ; cyl: rTop,rBottom,h ; sphere: r ; torus: r,tube ; cone: r,h
//   x,y,z позиция; color; metal/rough (default 0.4/0.5); emissive+ei (свечение);
//   scale:[x,y,z] опц. Цвета sci-fi: стальной/синий/оранжевый, emissive у визоров/сопел.
export const EQUIPMENT_MODELS = {
  // ── helmet (на голову) ──
  'eq-helmet-pilot': { slot: 'helmet', parts: [
    { shape: 'cyl', rTop: 0.45, rBottom: 0.45, h: 0.5, x: 0, y: 2.45, z: 0, color: 0x5a4632, metal: 0.2, rough: 0.7 },
    { shape: 'box', w: 0.66, h: 0.16, d: 0.16, x: 0, y: 2.36, z: 0.4, color: 0x222222, metal: 0.5, rough: 0.5 },
    { shape: 'box', w: 0.16, h: 0.12, d: 0.06, x: -0.16, y: 2.36, z: 0.47, color: 0x7dd3fc, emissive: 0x7dd3fc, ei: 0.7 },
    { shape: 'box', w: 0.16, h: 0.12, d: 0.06, x: 0.16, y: 2.36, z: 0.47, color: 0x7dd3fc, emissive: 0x7dd3fc, ei: 0.7 },
  ] },
  'eq-helmet-astro': { slot: 'helmet', parts: [
    { shape: 'sphere', r: 0.5, x: 0, y: 2.4, z: 0, color: 0xe8edf5, metal: 0.3, rough: 0.25, scale: [1, 0.95, 1] },
    { shape: 'box', w: 0.6, h: 0.32, d: 0.16, x: 0, y: 2.34, z: 0.42, color: 0x16203a, emissive: 0x3a7bd5, ei: 0.5, metal: 0.6, rough: 0.2 },
  ] },
  'eq-helmet-cyber': { slot: 'helmet', parts: [
    { shape: 'cyl', rTop: 0.46, rBottom: 0.46, h: 0.4, x: 0, y: 2.5, z: 0, color: 0x6b7280, metal: 0.9, rough: 0.2 },
    { shape: 'box', w: 0.66, h: 0.14, d: 0.5, x: 0, y: 2.34, z: 0.08, color: 0x0b1220, emissive: 0x22d3ee, ei: 0.9, metal: 0.7, rough: 0.2 },
    { shape: 'cyl', rTop: 0.02, rBottom: 0.02, h: 0.28, x: 0.3, y: 2.78, z: 0, color: 0x6b7280, metal: 0.9, rough: 0.3 },
    { shape: 'sphere', r: 0.05, x: 0.3, y: 2.94, z: 0, color: 0x22d3ee, emissive: 0x22d3ee, ei: 1.0 },
  ] },
  // ── top (на торс) ──
  'eq-top-jacket': { slot: 'top', parts: [
    { shape: 'cyl', rTop: 0.44, rBottom: 0.54, h: 0.95, x: 0, y: 1.6, z: 0, color: 0x4d5a32, metal: 0.2, rough: 0.7, rot4: true, scale: [1.12, 1, 0.8] },
    { shape: 'box', w: 0.5, h: 0.12, d: 0.5, x: 0, y: 2.0, z: 0, color: 0x3a4525, metal: 0.2, rough: 0.7 },
    { shape: 'box', w: 0.12, h: 0.5, d: 0.06, x: 0, y: 1.6, z: 0.3, color: 0xf97316, emissive: 0xf97316, ei: 0.4 },
  ] },
  'eq-top-suit': { slot: 'top', parts: [
    { shape: 'cyl', rTop: 0.45, rBottom: 0.55, h: 0.96, x: 0, y: 1.6, z: 0, color: 0xe6ebf2, metal: 0.25, rough: 0.3, rot4: true, scale: [1.13, 1, 0.82] },
    { shape: 'box', w: 0.34, h: 0.26, d: 0.12, x: 0, y: 1.6, z: 0.3, color: 0x1b2740, metal: 0.6, rough: 0.3 },
    { shape: 'box', w: 0.07, h: 0.07, d: 0.04, x: -0.1, y: 1.66, z: 0.37, color: 0x22d3ee, emissive: 0x22d3ee, ei: 0.9 },
    { shape: 'box', w: 0.07, h: 0.07, d: 0.04, x: 0, y: 1.66, z: 0.37, color: 0xf97316, emissive: 0xf97316, ei: 0.9 },
    { shape: 'box', w: 0.07, h: 0.07, d: 0.04, x: 0.1, y: 1.66, z: 0.37, color: 0x22c55e, emissive: 0x22c55e, ei: 0.9 },
    { shape: 'torus', r: 0.17, tube: 0.05, x: -0.5, y: 1.95, z: 0, color: 0xcbd5e1, metal: 0.6, rough: 0.3, scale: [1, 1, 0.6] },
    { shape: 'torus', r: 0.17, tube: 0.05, x: 0.5, y: 1.95, z: 0, color: 0xcbd5e1, metal: 0.6, rough: 0.3, scale: [1, 1, 0.6] },
  ] },
  'eq-top-armor': { slot: 'top', parts: [
    { shape: 'box', w: 0.62, h: 0.62, d: 0.42, x: 0, y: 1.62, z: 0, color: 0x4a5568, metal: 0.85, rough: 0.3 },
    { shape: 'box', w: 0.36, h: 0.26, d: 0.36, x: -0.5, y: 1.98, z: 0, color: 0x3a4458, metal: 0.85, rough: 0.3 },
    { shape: 'box', w: 0.36, h: 0.26, d: 0.36, x: 0.5, y: 1.98, z: 0, color: 0x3a4458, metal: 0.85, rough: 0.3 },
    { shape: 'box', w: 0.5, h: 0.08, d: 0.06, x: 0, y: 1.78, z: 0.22, color: 0xf97316, emissive: 0xf97316, ei: 0.5 },
  ] },
  // ── bottom (таз + ноги) ──
  'eq-bottom-pants': { slot: 'bottom', parts: [
    { shape: 'box', w: 0.46, h: 0.62, d: 0.56, x: -0.23, y: 0.5, z: 0, color: 0x3a4525, metal: 0.2, rough: 0.7 },
    { shape: 'box', w: 0.46, h: 0.62, d: 0.56, x: 0.23, y: 0.5, z: 0, color: 0x3a4525, metal: 0.2, rough: 0.7 },
    { shape: 'box', w: 0.96, h: 0.14, d: 0.6, x: 0, y: 0.92, z: 0, color: 0x222222, metal: 0.4, rough: 0.5 },
  ] },
  'eq-bottom-suit': { slot: 'bottom', parts: [
    { shape: 'box', w: 0.46, h: 0.7, d: 0.56, x: -0.23, y: 0.45, z: 0, color: 0xdfe5ee, metal: 0.25, rough: 0.35 },
    { shape: 'box', w: 0.46, h: 0.7, d: 0.56, x: 0.23, y: 0.45, z: 0, color: 0xdfe5ee, metal: 0.25, rough: 0.35 },
    { shape: 'torus', r: 0.14, tube: 0.05, x: -0.23, y: 0.42, z: 0.05, color: 0x3a7bd5, emissive: 0x3a7bd5, ei: 0.6, scale: [1, 1, 0.6] },
    { shape: 'torus', r: 0.14, tube: 0.05, x: 0.23, y: 0.42, z: 0.05, color: 0x3a7bd5, emissive: 0x3a7bd5, ei: 0.6, scale: [1, 1, 0.6] },
  ] },
  'eq-bottom-armor': { slot: 'bottom', parts: [
    { shape: 'box', w: 0.5, h: 0.66, d: 0.58, x: -0.23, y: 0.48, z: 0, color: 0x4a5568, metal: 0.85, rough: 0.3 },
    { shape: 'box', w: 0.5, h: 0.66, d: 0.58, x: 0.23, y: 0.48, z: 0, color: 0x4a5568, metal: 0.85, rough: 0.3 },
    { shape: 'box', w: 0.42, h: 0.5, d: 0.12, x: -0.23, y: 0.55, z: 0.28, color: 0x3a4458, metal: 0.85, rough: 0.3 },
    { shape: 'box', w: 0.42, h: 0.5, d: 0.12, x: 0.23, y: 0.55, z: 0.28, color: 0x3a4458, metal: 0.85, rough: 0.3 },
    { shape: 'box', w: 0.4, h: 0.05, d: 0.06, x: -0.23, y: 0.75, z: 0.34, color: 0xf97316, emissive: 0xf97316, ei: 0.5 },
    { shape: 'box', w: 0.4, h: 0.05, d: 0.06, x: 0.23, y: 0.75, z: 0.34, color: 0xf97316, emissive: 0xf97316, ei: 0.5 },
  ] },
  // ── boots (низ ног) ──
  'eq-boots-pilot': { slot: 'boots', parts: [
    { shape: 'box', w: 0.46, h: 0.3, d: 0.62, x: -0.23, y: 0.13, z: 0.04, color: 0x3a2a1a, metal: 0.2, rough: 0.7 },
    { shape: 'box', w: 0.46, h: 0.3, d: 0.62, x: 0.23, y: 0.13, z: 0.04, color: 0x3a2a1a, metal: 0.2, rough: 0.7 },
  ] },
  'eq-boots-magnet': { slot: 'boots', parts: [
    { shape: 'box', w: 0.48, h: 0.34, d: 0.6, x: -0.23, y: 0.15, z: 0.03, color: 0x6b7280, metal: 0.9, rough: 0.2 },
    { shape: 'box', w: 0.48, h: 0.34, d: 0.6, x: 0.23, y: 0.15, z: 0.03, color: 0x6b7280, metal: 0.9, rough: 0.2 },
    { shape: 'box', w: 0.5, h: 0.06, d: 0.62, x: -0.23, y: 0.01, z: 0.03, color: 0x3a7bd5, emissive: 0x3a7bd5, ei: 0.8 },
    { shape: 'box', w: 0.5, h: 0.06, d: 0.62, x: 0.23, y: 0.01, z: 0.03, color: 0x3a7bd5, emissive: 0x3a7bd5, ei: 0.8 },
  ] },
  'eq-boots-jet': { slot: 'boots', parts: [
    { shape: 'box', w: 0.48, h: 0.32, d: 0.58, x: -0.23, y: 0.16, z: 0.03, color: 0x4a5568, metal: 0.85, rough: 0.3 },
    { shape: 'box', w: 0.48, h: 0.32, d: 0.58, x: 0.23, y: 0.16, z: 0.03, color: 0x4a5568, metal: 0.85, rough: 0.3 },
    { shape: 'cone', r: 0.12, h: 0.22, x: -0.23, y: -0.08, z: -0.05, color: 0xf97316, emissive: 0xf97316, ei: 0.9, flip: true },
    { shape: 'cone', r: 0.12, h: 0.22, x: 0.23, y: -0.08, z: -0.05, color: 0xf97316, emissive: 0xf97316, ei: 0.9, flip: true },
  ] },

  // ══ СЕТ «НИНДЗЯ» — матовый чёрный, красная лента/пояс ══
  'eq-helmet-ninja': { slot: 'helmet', parts: [
    // ── Тканевой капюшон, натянутый на голову: открыта ТОЛЬКО полоска глаз ──
    // купол (верх головы + лоб)
    { shape: 'sphere', r: 0.46, x: 0, y: 2.54, z: -0.02, color: 0x14141c, metal: 0.05, rough: 0.9, scale: [1, 0.82, 0.96] },
    // лобовая панель — нижняя граница чуть выше глаз
    { shape: 'box', w: 0.8, h: 0.16, d: 0.12, x: 0, y: 2.53, z: 0.36, color: 0x14141c, rough: 0.9 },
    // нижняя маска: от подбородка до носа (темнее капюшона), глаза остаются в щели
    { shape: 'box', w: 0.8, h: 0.26, d: 0.14, x: 0, y: 2.17, z: 0.34, color: 0x0b0b10, rough: 0.95 },
    // плоская накладка прямо на лицо — закрывает рот (глаза выше остаются видны)
    { shape: 'box', w: 0.58, h: 0.2, d: 0.05, x: 0, y: 2.19, z: 0.415, color: 0x0b0b10, rough: 0.95 },
    // боковые панели — смыкают щель в кольцо
    { shape: 'box', w: 0.14, h: 0.56, d: 0.82, x: -0.4, y: 2.32, z: -0.04, color: 0x14141c, rough: 0.9 },
    { shape: 'box', w: 0.14, h: 0.56, d: 0.82, x: 0.4, y: 2.32, z: -0.04, color: 0x14141c, rough: 0.9 },
    // вытянутый затылок со «складками» ткани (стопка сужающихся сегментов)
    { shape: 'box', w: 0.66, h: 0.5, d: 0.2, x: 0, y: 2.36, z: -0.36, color: 0x14141c, rough: 0.9 },
    { shape: 'box', w: 0.5, h: 0.14, d: 0.1, x: 0, y: 2.5, z: -0.47, color: 0x1d1d28, rough: 0.95 },
    { shape: 'box', w: 0.42, h: 0.12, d: 0.08, x: 0, y: 2.34, z: -0.5, color: 0x10101a, rough: 0.95 },
    { shape: 'box', w: 0.34, h: 0.1, d: 0.07, x: 0, y: 2.2, z: -0.52, color: 0x1d1d28, rough: 0.95 },
  ] },
  'eq-top-ninja': { slot: 'top', parts: [
    { shape: 'cyl', rTop: 0.42, rBottom: 0.53, h: 0.95, x: 0, y: 1.6, z: 0, color: 0x14141c, metal: 0.05, rough: 0.85, rot4: true, scale: [1.1, 1, 0.8] },
    // ── Перекрёстные ремни X на груди: «лесенка» из сегментов (поворотов
    //    у примитивов нет — диагональ собирается ступеньками, в Lego-стиле ок) ──
    { shape: 'box', w: 0.13, h: 0.15, d: 0.05, x: -0.21, y: 1.92, z: 0.3, color: 0x7f1d1d, rough: 0.7 },
    { shape: 'box', w: 0.13, h: 0.15, d: 0.05, x: -0.07, y: 1.78, z: 0.32, color: 0x7f1d1d, rough: 0.7 },
    { shape: 'box', w: 0.13, h: 0.15, d: 0.05, x: 0.07, y: 1.64, z: 0.33, color: 0x7f1d1d, rough: 0.7 },
    { shape: 'box', w: 0.13, h: 0.15, d: 0.05, x: 0.21, y: 1.5, z: 0.34, color: 0x7f1d1d, rough: 0.7 },
    { shape: 'box', w: 0.13, h: 0.15, d: 0.05, x: 0.21, y: 1.92, z: 0.3, color: 0x7f1d1d, rough: 0.7 },
    { shape: 'box', w: 0.13, h: 0.15, d: 0.05, x: 0.07, y: 1.78, z: 0.32, color: 0x7f1d1d, rough: 0.7 },
    { shape: 'box', w: 0.13, h: 0.15, d: 0.05, x: -0.07, y: 1.64, z: 0.33, color: 0x7f1d1d, rough: 0.7 },
    { shape: 'box', w: 0.13, h: 0.15, d: 0.05, x: -0.21, y: 1.5, z: 0.34, color: 0x7f1d1d, rough: 0.7 },
    // пряжка на пересечении ремней
    { shape: 'box', w: 0.14, h: 0.14, d: 0.06, x: 0, y: 1.71, z: 0.34, color: 0x44444f, metal: 0.7, rough: 0.3 },
    // ── Катана за спиной: вертикальные ножны + рукоять с гардой над плечом ──
    { shape: 'box', w: 0.1, h: 0.78, d: 0.07, x: -0.14, y: 1.55, z: -0.38, color: 0x1f1f29, rough: 0.7 },
    { shape: 'box', w: 0.12, h: 0.06, d: 0.09, x: -0.14, y: 1.18, z: -0.38, color: 0xd4af37, metal: 0.7, rough: 0.3 },
    { shape: 'cyl', rTop: 0.035, rBottom: 0.035, h: 0.3, x: -0.14, y: 2.1, z: -0.38, color: 0x3f3f46, rough: 0.5 },
    { shape: 'box', w: 0.16, h: 0.04, d: 0.1, x: -0.14, y: 1.96, z: -0.38, color: 0xb8860b, metal: 0.8, rough: 0.3 },
    // алый пояс-оби с узлом
    { shape: 'box', w: 0.98, h: 0.14, d: 0.62, x: 0, y: 1.18, z: 0, color: 0x7f1d1d, rough: 0.65 },
    { shape: 'box', w: 0.18, h: 0.12, d: 0.08, x: 0, y: 1.18, z: 0.34, color: 0x991b1b, rough: 0.6 },
  ] },
  'eq-bottom-ninja': { slot: 'bottom', parts: [
    // широкие шаровары + тёмные манжеты-обмотки
    { shape: 'box', w: 0.54, h: 0.66, d: 0.62, x: -0.23, y: 0.48, z: 0, color: 0x1b1b24, metal: 0.05, rough: 0.85 },
    { shape: 'box', w: 0.54, h: 0.66, d: 0.62, x: 0.23, y: 0.48, z: 0, color: 0x1b1b24, metal: 0.05, rough: 0.85 },
    { shape: 'box', w: 0.5, h: 0.12, d: 0.58, x: -0.23, y: 0.16, z: 0, color: 0x0d0d12, rough: 0.9 },
    { shape: 'box', w: 0.5, h: 0.12, d: 0.58, x: 0.23, y: 0.16, z: 0, color: 0x0d0d12, rough: 0.9 },
    { shape: 'box', w: 0.98, h: 0.12, d: 0.64, x: 0, y: 0.92, z: 0, color: 0x0d0d12, rough: 0.9 },
  ] },
  'eq-boots-ninja': { slot: 'boots', parts: [
    { shape: 'box', w: 0.44, h: 0.26, d: 0.56, x: -0.23, y: 0.12, z: 0.02, color: 0x12121a, rough: 0.85 },
    { shape: 'box', w: 0.44, h: 0.26, d: 0.56, x: 0.23, y: 0.12, z: 0.02, color: 0x12121a, rough: 0.85 },
    // раздельный носок таби — два передних сегмента с зазором
    { shape: 'box', w: 0.15, h: 0.18, d: 0.16, x: -0.33, y: 0.1, z: 0.34, color: 0x12121a, rough: 0.85 },
    { shape: 'box', w: 0.15, h: 0.18, d: 0.16, x: -0.13, y: 0.1, z: 0.34, color: 0x12121a, rough: 0.85 },
    { shape: 'box', w: 0.15, h: 0.18, d: 0.16, x: 0.13, y: 0.1, z: 0.34, color: 0x12121a, rough: 0.85 },
    { shape: 'box', w: 0.15, h: 0.18, d: 0.16, x: 0.33, y: 0.1, z: 0.34, color: 0x12121a, rough: 0.85 },
    // белые обмотки-завязки
    { shape: 'box', w: 0.46, h: 0.06, d: 0.58, x: -0.23, y: 0.26, z: 0.02, color: 0xe2e8f0, rough: 0.8 },
    { shape: 'box', w: 0.46, h: 0.06, d: 0.58, x: 0.23, y: 0.26, z: 0.02, color: 0xe2e8f0, rough: 0.8 },
  ] },

  // ══ СЕТ «РЫЦАРЬ» — полированная сталь, алое перо ══
  'eq-helmet-knight': { slot: 'helmet', parts: [
    { shape: 'cyl', rTop: 0.45, rBottom: 0.47, h: 0.55, x: 0, y: 2.42, z: 0, color: 0xcbd5e1, metal: 0.9, rough: 0.2 },
    { shape: 'sphere', r: 0.46, x: 0, y: 2.68, z: 0, color: 0xcbd5e1, metal: 0.9, rough: 0.2, scale: [1, 0.55, 1] },
    // смотровая щель визора
    { shape: 'box', w: 0.56, h: 0.1, d: 0.08, x: 0, y: 2.38, z: 0.42, color: 0x111827, metal: 0.3, rough: 0.6 },
    // алое перо на гребне
    { shape: 'sphere', r: 0.06, x: 0, y: 2.9, z: 0, color: 0xdc2626, rough: 0.7 },
    { shape: 'cone', r: 0.07, h: 0.42, x: 0, y: 3.12, z: 0, color: 0xdc2626, rough: 0.7 },
  ] },
  'eq-top-knight': { slot: 'top', parts: [
    { shape: 'box', w: 0.68, h: 0.68, d: 0.5, x: 0, y: 1.62, z: 0, color: 0xcbd5e1, metal: 0.9, rough: 0.22 },
    // круглые наплечники
    { shape: 'sphere', r: 0.19, x: -0.55, y: 1.98, z: 0, color: 0xaab6c6, metal: 0.9, rough: 0.25, scale: [1, 0.75, 1] },
    { shape: 'sphere', r: 0.19, x: 0.55, y: 1.98, z: 0, color: 0xaab6c6, metal: 0.9, rough: 0.25, scale: [1, 0.75, 1] },
    // золотой герб на груди
    { shape: 'box', w: 0.2, h: 0.22, d: 0.06, x: 0, y: 1.68, z: 0.28, color: 0xfbbf24, metal: 0.8, rough: 0.3, emissive: 0xfbbf24, ei: 0.2 },
  ] },
  'eq-bottom-knight': { slot: 'bottom', parts: [
    { shape: 'box', w: 0.5, h: 0.7, d: 0.58, x: -0.23, y: 0.47, z: 0, color: 0xb6c2d2, metal: 0.85, rough: 0.28 },
    { shape: 'box', w: 0.5, h: 0.7, d: 0.58, x: 0.23, y: 0.47, z: 0, color: 0xb6c2d2, metal: 0.85, rough: 0.28 },
    // наколенники
    { shape: 'sphere', r: 0.13, x: -0.23, y: 0.8, z: 0.26, color: 0xcbd5e1, metal: 0.9, rough: 0.2 },
    { shape: 'sphere', r: 0.13, x: 0.23, y: 0.8, z: 0.26, color: 0xcbd5e1, metal: 0.9, rough: 0.2 },
  ] },
  'eq-boots-knight': { slot: 'boots', parts: [
    { shape: 'box', w: 0.48, h: 0.32, d: 0.6, x: -0.23, y: 0.15, z: 0.03, color: 0xcbd5e1, metal: 0.9, rough: 0.22 },
    { shape: 'box', w: 0.48, h: 0.32, d: 0.6, x: 0.23, y: 0.15, z: 0.03, color: 0xcbd5e1, metal: 0.9, rough: 0.22 },
    // выступающие стальные носки
    { shape: 'box', w: 0.42, h: 0.18, d: 0.18, x: -0.23, y: 0.09, z: 0.37, color: 0xaab6c6, metal: 0.9, rough: 0.25 },
    { shape: 'box', w: 0.42, h: 0.18, d: 0.18, x: 0.23, y: 0.09, z: 0.37, color: 0xaab6c6, metal: 0.9, rough: 0.25 },
  ] },

  // ══ СЕТ «МАГ» — глубокий синий, золото, светящиеся звёзды ══
  'eq-helmet-mage': { slot: 'helmet', parts: [
    // широкие поля + высокий конус со звёздами и золотым кончиком
    { shape: 'cyl', rTop: 0.62, rBottom: 0.62, h: 0.06, x: 0, y: 2.62, z: 0, color: 0x1e3a8a, rough: 0.6 },
    { shape: 'cone', r: 0.45, h: 0.85, x: 0, y: 3.06, z: 0, color: 0x1e3a8a, rough: 0.6 },
    { shape: 'sphere', r: 0.07, x: 0, y: 3.5, z: 0, color: 0xd4af37, metal: 0.8, rough: 0.3 },
    { shape: 'box', w: 0.09, h: 0.09, d: 0.04, x: 0.18, y: 2.88, z: 0.3, color: 0xfbbf24, emissive: 0xfbbf24, ei: 0.8 },
    { shape: 'box', w: 0.07, h: 0.07, d: 0.04, x: -0.2, y: 3.1, z: 0.22, color: 0xfbbf24, emissive: 0xfbbf24, ei: 0.8 },
    { shape: 'box', w: 0.06, h: 0.06, d: 0.04, x: 0.05, y: 3.28, z: 0.16, color: 0xfbbf24, emissive: 0xfbbf24, ei: 0.8 },
  ] },
  'eq-top-mage': { slot: 'top', parts: [
    { shape: 'cyl', rTop: 0.44, rBottom: 0.62, h: 1.0, x: 0, y: 1.55, z: 0, color: 0x1e3a8a, rough: 0.6, rot4: true, scale: [1.12, 1, 0.84] },
    // золотая кайма подола + пояс-верёвка
    { shape: 'torus', r: 0.56, tube: 0.05, x: 0, y: 1.08, z: 0, color: 0xd4af37, metal: 0.7, rough: 0.35, scale: [1.05, 0.6, 0.82] },
    { shape: 'torus', r: 0.45, tube: 0.04, x: 0, y: 1.28, z: 0, color: 0xd4af37, metal: 0.7, rough: 0.35, scale: [1.08, 0.6, 0.8] },
    // светящаяся руна на груди
    { shape: 'box', w: 0.13, h: 0.18, d: 0.04, x: 0, y: 1.72, z: 0.33, color: 0x7dd3fc, emissive: 0x7dd3fc, ei: 0.85 },
  ] },
  'eq-bottom-mage': { slot: 'bottom', parts: [
    { shape: 'box', w: 0.48, h: 0.66, d: 0.58, x: -0.23, y: 0.48, z: 0, color: 0x1e3a8a, rough: 0.65 },
    { shape: 'box', w: 0.48, h: 0.66, d: 0.58, x: 0.23, y: 0.48, z: 0, color: 0x1e3a8a, rough: 0.65 },
    // золотые манжеты
    { shape: 'box', w: 0.5, h: 0.1, d: 0.6, x: -0.23, y: 0.17, z: 0, color: 0xd4af37, metal: 0.7, rough: 0.35 },
    { shape: 'box', w: 0.5, h: 0.1, d: 0.6, x: 0.23, y: 0.17, z: 0, color: 0xd4af37, metal: 0.7, rough: 0.35 },
  ] },
  'eq-boots-mage': { slot: 'boots', parts: [
    { shape: 'box', w: 0.44, h: 0.28, d: 0.56, x: -0.23, y: 0.13, z: 0.0, color: 0x1e3a8a, rough: 0.6 },
    { shape: 'box', w: 0.44, h: 0.28, d: 0.56, x: 0.23, y: 0.13, z: 0.0, color: 0x1e3a8a, rough: 0.6 },
    // загнутые носы башмаков
    { shape: 'sphere', r: 0.11, x: -0.23, y: 0.16, z: 0.36, color: 0x1e3a8a, rough: 0.6 },
    { shape: 'sphere', r: 0.11, x: 0.23, y: 0.16, z: 0.36, color: 0x1e3a8a, rough: 0.6 },
    // золотые пряжки
    { shape: 'box', w: 0.1, h: 0.1, d: 0.04, x: -0.23, y: 0.2, z: 0.29, color: 0xd4af37, metal: 0.8, rough: 0.3, emissive: 0xd4af37, ei: 0.2 },
    { shape: 'box', w: 0.1, h: 0.1, d: 0.04, x: 0.23, y: 0.2, z: 0.29, color: 0xd4af37, metal: 0.8, rough: 0.3, emissive: 0xd4af37, ei: 0.2 },
  ] },

  // ══ СЕТ «СТЕПНОЙ ВОИН» — борик с мехом, бордовый чапан с золотой вышивкой ══
  'eq-helmet-steppe': { slot: 'helmet', parts: [
    // ── Борик: меховой отворот ВНИЗУ + ВЫСОКИЙ куполовидный верх (юртообразный
    //    двухступенчатый профиль — конус, но не острый). Купол ТЁМНО-СИНИЙ:
    //    бордовый+белый мех читался как колпак Санты. Кольцо сидит над глазами. ──
    // широкое меховое кольцо по нижнему краю (белый мех, rough 0.95)
    { shape: 'cyl', rTop: 0.52, rBottom: 0.54, h: 0.22, x: 0, y: 2.54, z: 0, color: 0xf1e9dc, rough: 0.95 },
    // бугристость меха — приплюснутая сфера в кольце
    { shape: 'sphere', r: 0.54, x: 0, y: 2.56, z: 0, color: 0xeae0d0, rough: 0.95, scale: [1, 0.26, 1] },
    // высокий бархатный купол: расширяющееся основание + конусная макушка
    { shape: 'cyl', rTop: 0.3, rBottom: 0.44, h: 0.3, x: 0, y: 2.8, z: 0, color: 0x1e3a8a, rough: 0.75 },
    { shape: 'cone', r: 0.31, h: 0.44, x: 0, y: 3.16, z: 0, color: 0x1e3a8a, rough: 0.75 },
    // золотой шарик на вершине
    { shape: 'sphere', r: 0.06, x: 0, y: 3.4, z: 0, color: 0xd4af37, metal: 0.85, rough: 0.25 },
    // золотая окантовка между мехом и куполом
    { shape: 'torus', r: 0.44, tube: 0.035, x: 0, y: 2.66, z: 0, color: 0xd4af37, metal: 0.7, rough: 0.3, scale: [1, 0.7, 1] },
  ] },
  'eq-top-steppe': { slot: 'top', parts: [
    // ── Чапан: бордовый бархат (в тон купола борика), КРУПНЫЙ золотой ромб
    //    на груди, широкий золотой пояс-цилиндр, золотой воротник ──
    { shape: 'cyl', rTop: 0.46, rBottom: 0.62, h: 1.0, x: 0, y: 1.55, z: 0, color: 0x7f1d1d, rough: 0.7, rot4: true, scale: [1.13, 1, 0.85] },
    // золотая кайма воротника — заметное кольцо вокруг шеи
    { shape: 'torus', r: 0.38, tube: 0.06, x: 0, y: 2.06, z: 0, color: 0xd4af37, metal: 0.7, rough: 0.3, scale: [1.1, 0.7, 0.8] },
    // КРУПНЫЙ ромб из золотых квадратов на груди (вынесен ПЕРЕД грань
    //    rot4-цилиндра: фронтальная грань ближе номинального радиуса)
    { shape: 'box', w: 0.13, h: 0.13, d: 0.06, x: 0, y: 1.88, z: 0.38, color: 0xd4af37, metal: 0.65, rough: 0.3 },
    { shape: 'box', w: 0.13, h: 0.13, d: 0.06, x: -0.15, y: 1.73, z: 0.39, color: 0xd4af37, metal: 0.65, rough: 0.3 },
    { shape: 'box', w: 0.13, h: 0.13, d: 0.06, x: 0.15, y: 1.73, z: 0.39, color: 0xd4af37, metal: 0.65, rough: 0.3 },
    { shape: 'box', w: 0.13, h: 0.13, d: 0.06, x: 0, y: 1.58, z: 0.4, color: 0xd4af37, metal: 0.65, rough: 0.3 },
    // центр ромба — янтарный акцент
    { shape: 'box', w: 0.1, h: 0.1, d: 0.07, x: 0, y: 1.73, z: 0.4, color: 0xfbbf24, metal: 0.6, rough: 0.3, emissive: 0xfbbf24, ei: 0.25 },
    // ШИРОКИЙ золотой пояс — цилиндр шире подола, виден со всех сторон
    { shape: 'cyl', rTop: 0.66, rBottom: 0.68, h: 0.22, x: 0, y: 1.14, z: 0, color: 0xd4af37, metal: 0.6, rough: 0.35, rot4: true, scale: [1.08, 1, 0.8] },
    // тёмная пряжка по центру пояса
    { shape: 'box', w: 0.18, h: 0.14, d: 0.06, x: 0, y: 1.14, z: 0.52, color: 0x92400e, rough: 0.5 },
  ] },
  'eq-bottom-steppe': { slot: 'bottom', parts: [
    // широкий шалбар — тёмно-синий, в тон чапану
    { shape: 'box', w: 0.56, h: 0.68, d: 0.62, x: -0.23, y: 0.47, z: 0, color: 0x16243f, rough: 0.78 },
    { shape: 'box', w: 0.56, h: 0.68, d: 0.62, x: 0.23, y: 0.47, z: 0, color: 0x16243f, rough: 0.78 },
    { shape: 'box', w: 0.52, h: 0.07, d: 0.58, x: -0.23, y: 0.15, z: 0, color: 0xd4af37, metal: 0.6, rough: 0.4 },
    { shape: 'box', w: 0.52, h: 0.07, d: 0.58, x: 0.23, y: 0.15, z: 0, color: 0xd4af37, metal: 0.6, rough: 0.4 },
  ] },
  'eq-boots-steppe': { slot: 'boots', parts: [
    // высокие тёмно-коричневые кебис: основание + голенище ПОВЕРХ штанины
    { shape: 'box', w: 0.48, h: 0.32, d: 0.62, x: -0.23, y: 0.15, z: 0.04, color: 0x5b3a21, rough: 0.8 },
    { shape: 'box', w: 0.48, h: 0.32, d: 0.62, x: 0.23, y: 0.15, z: 0.04, color: 0x5b3a21, rough: 0.8 },
    { shape: 'cyl', rTop: 0.3, rBottom: 0.32, h: 0.38, x: -0.23, y: 0.46, z: 0, color: 0x5b3a21, rough: 0.78 },
    { shape: 'cyl', rTop: 0.3, rBottom: 0.32, h: 0.38, x: 0.23, y: 0.46, z: 0, color: 0x5b3a21, rough: 0.78 },
    // золотая строчка по верху голенища и по ранту
    { shape: 'torus', r: 0.3, tube: 0.025, x: -0.23, y: 0.64, z: 0, color: 0xd4af37, metal: 0.6, rough: 0.35, scale: [1, 0.6, 1] },
    { shape: 'torus', r: 0.3, tube: 0.025, x: 0.23, y: 0.64, z: 0, color: 0xd4af37, metal: 0.6, rough: 0.35, scale: [1, 0.6, 1] },
    { shape: 'box', w: 0.44, h: 0.04, d: 0.58, x: -0.23, y: 0.3, z: 0.04, color: 0xd4af37, metal: 0.6, rough: 0.4 },
    { shape: 'box', w: 0.44, h: 0.04, d: 0.58, x: 0.23, y: 0.3, z: 0.04, color: 0xd4af37, metal: 0.6, rough: 0.4 },
  ] },

  // ══ СЕТ «КОРОЛЬ МАТЕМАТИКИ» — золото, пурпур, горностай (эксклюзив за 307 навыков) ══
  'eq-helmet-king': { slot: 'helmet', parts: [
    // золотой обод + 5 зубцов по кругу + самоцветы
    { shape: 'cyl', rTop: 0.46, rBottom: 0.46, h: 0.2, x: 0, y: 2.62, z: 0, color: 0xd4af37, metal: 0.95, rough: 0.15 },
    { shape: 'cone', r: 0.07, h: 0.24, x: 0.46, y: 2.82, z: 0, color: 0xd4af37, metal: 0.95, rough: 0.15 },
    { shape: 'cone', r: 0.07, h: 0.24, x: 0.142, y: 2.82, z: 0.437, color: 0xd4af37, metal: 0.95, rough: 0.15 },
    { shape: 'cone', r: 0.07, h: 0.24, x: -0.372, y: 2.82, z: 0.27, color: 0xd4af37, metal: 0.95, rough: 0.15 },
    { shape: 'cone', r: 0.07, h: 0.24, x: -0.372, y: 2.82, z: -0.27, color: 0xd4af37, metal: 0.95, rough: 0.15 },
    { shape: 'cone', r: 0.07, h: 0.24, x: 0.142, y: 2.82, z: -0.437, color: 0xd4af37, metal: 0.95, rough: 0.15 },
    { shape: 'sphere', r: 0.055, x: 0, y: 2.62, z: 0.46, color: 0xdc2626, emissive: 0xdc2626, ei: 0.7 },
    { shape: 'sphere', r: 0.045, x: -0.33, y: 2.62, z: 0.33, color: 0x10b981, emissive: 0x10b981, ei: 0.7 },
    { shape: 'sphere', r: 0.045, x: 0.33, y: 2.62, z: 0.33, color: 0x3b82f6, emissive: 0x3b82f6, ei: 0.7 },
  ] },
  'eq-top-king': { slot: 'top', parts: [
    { shape: 'cyl', rTop: 0.46, rBottom: 0.66, h: 1.0, x: 0, y: 1.55, z: 0, color: 0x6d28d9, rough: 0.55, rot4: true, scale: [1.12, 1, 0.85] },
    // горностаевый воротник и кайма (белый мех с чёрными кисточками)
    { shape: 'torus', r: 0.42, tube: 0.1, x: 0, y: 2.02, z: 0, color: 0xf8fafc, rough: 0.92, scale: [1.1, 0.8, 0.85] },
    { shape: 'torus', r: 0.6, tube: 0.07, x: 0, y: 1.1, z: 0, color: 0xf8fafc, rough: 0.92, scale: [1.05, 0.7, 0.82] },
    { shape: 'box', w: 0.05, h: 0.08, d: 0.04, x: -0.25, y: 1.08, z: 0.45, color: 0x111111, rough: 0.8 },
    { shape: 'box', w: 0.05, h: 0.08, d: 0.04, x: 0.05, y: 1.06, z: 0.48, color: 0x111111, rough: 0.8 },
    { shape: 'box', w: 0.05, h: 0.08, d: 0.04, x: 0.32, y: 1.08, z: 0.42, color: 0x111111, rough: 0.8 },
    // золотая брошь
    { shape: 'sphere', r: 0.07, x: 0, y: 1.92, z: 0.36, color: 0xfbbf24, metal: 0.9, rough: 0.2, emissive: 0xfbbf24, ei: 0.4 },
  ] },
  'eq-bottom-king': { slot: 'bottom', parts: [
    { shape: 'box', w: 0.5, h: 0.68, d: 0.58, x: -0.23, y: 0.47, z: 0, color: 0x5b21b6, rough: 0.6 },
    { shape: 'box', w: 0.5, h: 0.68, d: 0.58, x: 0.23, y: 0.47, z: 0, color: 0x5b21b6, rough: 0.6 },
    // золотые лампасы по внешним швам + кайма
    { shape: 'box', w: 0.05, h: 0.6, d: 0.5, x: -0.49, y: 0.47, z: 0, color: 0xd4af37, metal: 0.8, rough: 0.3 },
    { shape: 'box', w: 0.05, h: 0.6, d: 0.5, x: 0.49, y: 0.47, z: 0, color: 0xd4af37, metal: 0.8, rough: 0.3 },
  ] },
  'eq-boots-king': { slot: 'boots', parts: [
    { shape: 'box', w: 0.46, h: 0.3, d: 0.6, x: -0.23, y: 0.14, z: 0.04, color: 0xd4af37, metal: 0.9, rough: 0.18 },
    { shape: 'box', w: 0.46, h: 0.3, d: 0.6, x: 0.23, y: 0.14, z: 0.04, color: 0xd4af37, metal: 0.9, rough: 0.18 },
    // тёмно-золотые отвороты
    { shape: 'box', w: 0.48, h: 0.08, d: 0.62, x: -0.23, y: 0.3, z: 0.04, color: 0xb8860b, metal: 0.85, rough: 0.25 },
    { shape: 'box', w: 0.48, h: 0.08, d: 0.62, x: 0.23, y: 0.3, z: 0.04, color: 0xb8860b, metal: 0.85, rough: 0.25 },
  ] },
};

// ── Снаряжение → HP для боёв с боссами (Этап 2C). База 3 HP; предметы дают
//    +1/+2/+3 (поле hp); полный тематический сет — бонус. Баланс мягкий. ──
const EQ_SLOTS = ['helmet', 'top', 'bottom', 'boots'];

// discount — скидка при покупке полным сетом (15–20%).
// achievementOnly — сет не продаётся (выдаётся системой достижений целиком).
export const EQUIPMENT_SETS = {
  pilot:   { name: 'Пилот',             bonus: 2, discount: 0.15, icon: '✈️', items: ['eq-helmet-pilot',  'eq-top-jacket', 'eq-bottom-pants',  'eq-boots-pilot'] },
  astro:   { name: 'Астронавт',         bonus: 3, discount: 0.17, icon: '🚀', items: ['eq-helmet-astro',  'eq-top-suit',   'eq-bottom-suit',   'eq-boots-magnet'] },
  trooper: { name: 'Десантник',         bonus: 4, discount: 0.20, icon: '🛡️', items: ['eq-helmet-cyber',  'eq-top-armor',  'eq-bottom-armor',  'eq-boots-jet'] },
  ninja:   { name: 'Ниндзя',            bonus: 3, discount: 0.15, icon: '🥷', items: ['eq-helmet-ninja',  'eq-top-ninja',  'eq-bottom-ninja',  'eq-boots-ninja'] },
  knight:  { name: 'Рыцарь',            bonus: 4, discount: 0.17, icon: '⚔️', items: ['eq-helmet-knight', 'eq-top-knight', 'eq-bottom-knight', 'eq-boots-knight'] },
  mage:    { name: 'Маг',               bonus: 4, discount: 0.17, icon: '🧙', items: ['eq-helmet-mage',   'eq-top-mage',   'eq-bottom-mage',   'eq-boots-mage'] },
  steppe:  { name: 'Степной воин',      bonus: 5, discount: 0.20, icon: '🏹', items: ['eq-helmet-steppe', 'eq-top-steppe', 'eq-bottom-steppe', 'eq-boots-steppe'] },
  king:    { name: 'Король математики', bonus: 6, discount: 0,    icon: '👑', achievementOnly: true, items: ['eq-helmet-king', 'eq-top-king', 'eq-bottom-king', 'eq-boots-king'] },
};

// Полная цена сета (сумма предметов без скидки).
export function setFullPrice(setId) {
  const set = EQUIPMENT_SETS[setId];
  if (!set) return 0;
  return set.items.reduce((s, id) => s + (getShopItem(id)?.price || 0), 0);
}

// Цена покупки сета: скидка применяется к НЕдостающим предметам (уже купленные
// не оплачиваются повторно). Округление вниз к десяткам — приятные ценники.
export function setPurchasePrice(setId, inventory = []) {
  const set = EQUIPMENT_SETS[setId];
  if (!set) return { missing: [], price: 0 };
  const missing = set.items.filter(id => !inventory.includes(id));
  const raw = missing.reduce((s, id) => s + (getShopItem(id)?.price || 0), 0);
  return { missing, price: Math.floor(raw * (1 - set.discount) / 10) * 10 };
}

// id завершённого сета (все 4 предмета линейки надеты) или null.
export function completedSet(equipped) {
  if (!equipped) return null;
  for (const [id, set] of Object.entries(EQUIPMENT_SETS)) {
    if (set.items.every((it) => EQ_SLOTS.some((s) => equipped[s] === it))) return id;
  }
  return null;
}

// HP персонажа для боя: база 3 + сумма hp надетых предметов + сет-бонус.
export function computePlayerHp(equipped) {
  let hp = 3;
  EQ_SLOTS.forEach((s) => { const it = getShopItem(equipped?.[s]); if (it?.hp) hp += it.hp; });
  const set = completedSet(equipped);
  if (set) hp += EQUIPMENT_SETS[set].bonus;
  return hp;
}
