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
