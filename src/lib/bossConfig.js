// Единый конфиг боссов: id, имя, tier, HP, GLB-модель, описание.
// Модели лежат в public/models/bosses/. Используется и в ежедневных задачах
// (Boss3D / BattleScene3D), и в mastery-битвах (BossFightScreen).
import { loadThreeGLTF } from './loadThree.js';

export const BOSSES = [
  { id: 'shadow', name: 'Теневой Фантом', tier: 1, hp: 80,  model: '/models/bosses/shadow.glb', description: 'Слабый, но коварный' },
  { id: 'ninja',  name: 'Космо-Ниндзя',   tier: 2, hp: 100, model: '/models/bosses/ninja.glb',  description: 'Мастер уклонений' },
  { id: 'demon',  name: 'Демон Бездны',    tier: 3, hp: 130, model: '/models/bosses/demon.glb',  description: 'Крылатый ужас' },
  { id: 'dragon', name: 'Звёздный Дракон', tier: 4, hp: 160, model: '/models/bosses/dragon.glb', description: 'Финальная угроза' },
];

export const BOSS_BY_ID = Object.fromEntries(BOSSES.map((b) => [b.id, b]));
export const bossById = (id) => BOSS_BY_ID[id] || BOSSES[0];
export const bossForTier = (tier) => BOSSES.find((b) => b.tier === tier) || BOSSES[0];

// tier по классу: 5-6 → 1, 7-8 → 2, 9-10 → 3, 11(+) → 4.
export function tierForGrade(grade) {
  const g = parseInt(String(grade ?? '').replace(/\D/g, ''), 10) || 0;
  if (g >= 11) return 4;
  if (g >= 9) return 3;
  if (g >= 7) return 2;
  return 1; // 5-6 и неизвестно
}
export const bossForGrade = (grade) => bossForTier(tierForGrade(grade));

// Mastery: topic → лёгкие tier (1-2), chapter → тяжёлые (3-4), в рамках класса.
export function bossForSection(sectionType, grade) {
  const t = tierForGrade(grade);
  if (sectionType === 'chapter') return bossForTier(Math.max(3, t));
  return bossForTier(Math.min(2, t));
}

// ── GLB-загрузчик боссов (кеш по URL, матовые материалы как у персонажей) ──
const _bossCache = {};
export function loadBossModel(url) {
  if (_bossCache[url]) return _bossCache[url];
  _bossCache[url] = loadThreeGLTF().then((THREE) => new Promise((resolve, reject) => {
    new THREE.GLTFLoader().load(
      url,
      (gltf) => {
        gltf.scene.traverse((o) => {
          const m = o.material; if (!m) return;
          (Array.isArray(m) ? m : [m]).forEach((mm) => {
            if (mm.metalness !== undefined && mm.metalness > 0.2) mm.metalness = 0.1;
            if (mm.roughness !== undefined && mm.roughness < 0.6) mm.roughness = 0.7;
            mm.needsUpdate = true;
          });
        });
        resolve({ THREE, gltf });
      },
      undefined,
      (e) => reject(e || new Error('boss glb load failed: ' + url)),
    );
  })).catch((e) => { delete _bossCache[url]; throw e; });
  return _bossCache[url];
}

// Нормализация модели босса: масштаб к targetH (чуть выше игрока ≈2.62),
// ноги на y=0, центр по X/Z. Возвращает применённый масштаб.
export function normalizeBoss(THREE, root, targetH = 3.0) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); box.getSize(size);
  const s = size.y > 0 ? targetH / size.y : 1;
  root.scale.setScalar(s);
  const b2 = new THREE.Box3().setFromObject(root);
  const c = new THREE.Vector3(); b2.getCenter(c);
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.position.y -= b2.min.y;
  return s;
}
