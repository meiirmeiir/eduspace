// Каталог магазина кристаллов. Раскладка:
//   - background: SVG/JPG-фон, применяется как layer под секцией профиля
//   - frame:      SVG-рамка вокруг аватара в профиле
//   - title:      строковый титул под именем
//   - theme:      ключ темы (визуальные CSS-правила добавляются отдельной задачей)
//
// price — в кристаллах. isExclusive + requiredLeague: 'diamond' → доступен
// только пока ученик в Алмаз-лиге (по weekPoints). После покупки frame
// остаётся в инвентаре, даже если лига сменилась.

export const SHOP_ITEMS = [
  // ── Фоны (1 SVG + 7 JPG-слотов; JPG-файлы загружаются вручную в public/shop/backgrounds/) ──
  { id: 'bg-manga',            type: 'background', name: 'Манга стиль',       price: 300, file: '/shop/backgrounds/manga-style.svg',     preview: '/shop/backgrounds/manga-style.svg' },
  { id: 'bg-anime-city',       type: 'background', name: 'Аниме город',       price: 350, file: '/shop/backgrounds/anime-city.jpg',      preview: '/shop/backgrounds/anime-city.jpg' },
  { id: 'bg-sakura',           type: 'background', name: 'Сакура',            price: 300, file: '/shop/backgrounds/sakura.jpg',          preview: '/shop/backgrounds/sakura.jpg' },
  { id: 'bg-cyberpunk',        type: 'background', name: 'Cyberpunk',         price: 450, file: '/shop/backgrounds/cyberpunk.jpg',       preview: '/shop/backgrounds/cyberpunk.jpg' },
  { id: 'bg-lofi',             type: 'background', name: 'Lo-Fi',             price: 300, file: '/shop/backgrounds/lofi.png',            preview: '/shop/backgrounds/lofi.png' },
  { id: 'bg-minecraft',        type: 'background', name: 'Minecraft',         price: 250, file: '/shop/backgrounds/minecraft.jpg',       preview: '/shop/backgrounds/minecraft.jpg' },
  { id: 'bg-aesthetic-black',  type: 'background', name: 'Aesthetic Black',   price: 350, file: '/shop/backgrounds/aesthetic-black.jpg', preview: '/shop/backgrounds/aesthetic-black.jpg' },
  { id: 'bg-neon-waves',       type: 'background', name: 'Неоновые волны',    price: 300, file: '/shop/backgrounds/neon-waves.jpg',      preview: '/shop/backgrounds/neon-waves.jpg' },

  // ── Рамки (чистый CSS: border + boxShadow вокруг круглого аватара) ──
  // Стили живут в FRAME_STYLES ниже; здесь храним только метаданные предмета.
  { id: 'frame-fire',     type: 'frame', name: 'Огненная рамка',    price: 300, cssFrame: true },
  { id: 'frame-neon',     type: 'frame', name: 'Неоновая рамка',    price: 400, cssFrame: true },
  { id: 'frame-pixel',    type: 'frame', name: 'Пиксельная рамка',  price: 200, cssFrame: true },
  { id: 'frame-rainbow',  type: 'frame', name: 'Радужная рамка',    price: 350, cssFrame: true },
  { id: 'frame-diamond',  type: 'frame', name: 'Алмазная рамка 💎', price: 800, cssFrame: true, isExclusive: true, requiredLeague: 'diamond' },

  // ── Титулы (отображаются под именем в профиле) ──
  { id: 'title-math-mafia',    type: 'title', name: 'Math Mafia',                       price: 350, value: 'Math Mafia' },
  { id: 'title-ent-easy',      type: 'title', name: 'ЕНТ — это легко',                  price: 300, value: 'ЕНТ — это легко' },
  { id: 'title-meme-math',     type: 'title', name: 'Задачи решаю, мемы листаю',        price: 200, value: 'Задачи решаю, мемы листаю' },
  { id: 'title-king-formulas', type: 'title', name: 'Король формул',                    price: 400, value: 'Король формул' },
  { id: 'title-top1-kz',       type: 'title', name: 'Топ 1 Казахстан',                  price: 1000, value: 'Топ 1 Казахстан' },

  // ── Темы (визуальный CSS добавится отдельным апдейтом; пока — только хранение equipped.theme) ──
  { id: 'theme-galaxy',  type: 'theme', name: 'Galaxy 🌌',  price: 500, value: 'galaxy' },
  { id: 'theme-sakura',  type: 'theme', name: 'Sakura 🌸',  price: 400, value: 'sakura' },
  { id: 'theme-matrix',  type: 'theme', name: 'Matrix 💻',  price: 450, value: 'matrix' },
  { id: 'theme-fire',    type: 'theme', name: 'Fire 🔥',    price: 400, value: 'fire' },

  // ── Снаряжение (космос/sci-fi): надевается на 3D-персонажа. Визуал — в
  //    EQUIPMENT_MODELS ниже (ключ = id). type = слот → equipped.{slot}. ──
  { id: 'eq-helmet-pilot', type: 'helmet', name: 'Шлем пилота',          price: 100, icon: '🪖' },
  { id: 'eq-helmet-astro', type: 'helmet', name: 'Шлем астронавта',      price: 250, icon: '🧑‍🚀' },
  { id: 'eq-helmet-cyber', type: 'helmet', name: 'Кибер-визор',          price: 450, icon: '🤖' },
  { id: 'eq-top-jacket',   type: 'top',    name: 'Лётная куртка',        price: 120, icon: '🧥' },
  { id: 'eq-top-suit',     type: 'top',    name: 'Скафандр',             price: 300, icon: '🚀' },
  { id: 'eq-top-armor',    type: 'top',    name: 'Броня десантника',     price: 550, icon: '🛡️' },
  { id: 'eq-bottom-pants', type: 'bottom', name: 'Лётные штаны',         price: 80,  icon: '👖' },
  { id: 'eq-bottom-suit',  type: 'bottom', name: 'Штаны скафандра',      price: 220, icon: '🩳' },
  { id: 'eq-bottom-armor', type: 'bottom', name: 'Бронепластины',        price: 400, icon: '🦿' },
  { id: 'eq-boots-pilot',  type: 'boots',  name: 'Ботинки пилота',       price: 90,  icon: '🥾' },
  { id: 'eq-boots-magnet', type: 'boots',  name: 'Магнитные сапоги',     price: 200, icon: '🧲' },
  { id: 'eq-boots-jet',    type: 'boots',  name: 'Реактивные ботинки',   price: 500, icon: '🔥' },
];

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
};
