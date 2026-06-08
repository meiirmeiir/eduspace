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
import { OUTFIT_ITEMS, OUTFIT_EQUIPMENT_SETS } from './outfitSets.js';

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

  // ── Снаряжение: GLTF-наряды (21 сет × до 4 слотов, см. outfitSets.js).
  //    type = слот → equipped.{slot}; gender фильтрует каталог по полу героя. ──
  ...OUTFIT_ITEMS,
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
];

// ── Предложение недели: один товар со скидкой 30%, детерминированная ротация
//    по ISO-номеру недели (сброс — понедельник 00:00 UTC вместе с рейтингом). ──
const WEEKLY_OFFER_POOL = ['bg-cyberpunk', 'theme-galaxy', 'eq-top-astronaut-m', 'bg-anime-city', 'frame-neon', 'eq-top-witch-f', 'theme-matrix', 'bg-manga'];
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


// ── Снаряжение → HP для боёв с боссами (Этап 2C). База 3 HP; предметы дают
//    +1/+2/+3 (поле hp); полный тематический сет — бонус. Баланс мягкий. ──
const EQ_SLOTS = ['helmet', 'top', 'bottom', 'boots'];

// discount — скидка при покупке полным сетом (15–20%).
// Сеты — GLTF-наряды (см. outfitSets.js): 11 мужских + 10 женских, у сета
// есть gender (магазин фильтрует по полу героя) и rarity.
export const EQUIPMENT_SETS = OUTFIT_EQUIPMENT_SETS;

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
