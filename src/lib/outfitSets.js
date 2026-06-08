// Система GLTF-нарядов: 21 модель Quaternius (CC0) → 21 сет экипировки.
// Вместо примитивов извлекаем РЕАЛЬНЫЕ меши одежды из модели-наряда:
//   1) loadOutfitModel(file) — GLB кешируется на уровне модуля
//   2) buildSlotGroup(THREE, gltf, set, slot) — берёт меши одежды слота
//      (кожа/волосы/глаза исключаются), ЗАПЕКАЕТ их в idle-позе (CPU-skinning
//      через SkinnedMesh.boneTransform — T-pose с раскинутыми руками не годится),
//      нормализует к росту базового персонажа и возвращает статичную группу
//      с origin в якорной кости слота. Character3D ставит её на ту же кость
//      базовой модели (head — attach к кости, остальное статично в группе
//      персонажа: idle-поза почти неподвижна).
//
// Все наряды — один риг (62 кости: Body/Hips/Abdomen/Torso/Chest/Neck/Head/
// Shoulder*/UpperLeg*/Foot*), есть CharacterArmature|Idle. Структура модульная:
// {Prefix}_{Head|Body|Legs|Feet}; часть слотов — одиночный mesh в RootNode.
//
// «Тело» (НЕ переносится — кожа/волосы базовой модели): материалы Skin,
// Skin_Darker, Eye, Eyebrows, Hair*, Moustache, Earrings; в Head-группах
// дополнительно Brown (брови/глаза у женских моделей) — поэтому для helmet
// каждый сет задаёт ЯВНЫЙ список мешей одежды (meshes), для остальных слотов
// действует авто-фильтр по материалам.

const BODY_MATS = ['Skin', 'Skin_Darker', 'Eye', 'Eyebrows', 'Moustache', 'Earrings'];
const isBodyMat = (name = '') => BODY_MATS.includes(name) || name.startsWith('Hair');

export const TARGET_HEIGHT = 2.62; // рост нормализованного базового персонажа

// ── Каталог сетов ────────────────────────────────────────────────────────────
// items: helmet/top/bottom/boots → { node — имя группы/меша в сцене,
//   meshes — явный список (только для helmet), price, hp }
// Слот отсутствует у сета — предмета нет (сет из 3 предметов, бонус действует).

export const OUTFIT_SETS = {
  // ════ МУЖСКИЕ ════
  'adventurer-m': {
    name: 'Искатель', gender: 'male', rarity: 'epic', emoji: '🏹',
    file: 'Adventurer.glb', setBonus: 4, setDiscount: 0,
    items: {
      top:    { node: 'Adventurer_Body', price: 150, hp: 1 },
      bottom: { node: 'Adventurer_Legs', price: 130, hp: 1 },
      boots:  { node: 'Adventurer_Feet', price: 120, hp: 1 },
    },
  },
  'astronaut-m': {
    name: 'Астронавт', gender: 'male', rarity: 'epic', emoji: '🚀',
    file: 'Astronaut.glb', setBonus: 4, setDiscount: 0,
    items: {
      helmet: { node: 'SpaceSuit_Head', meshes: ['SpaceSuit_Head_1', 'SpaceSuit_Head_2', 'SpaceSuit_Head_3'], price: 110, hp: 2 },
      top:    { node: 'SpaceSuit_Body', price: 120, hp: 2 },
      bottom: { node: 'SpaceSuit_Legs', price: 95, hp: 2 },
      boots:  { node: 'SpaceSuit_Feet', price: 85, hp: 2 },
    },
  },
  'beach-m': {
    name: 'Пляжный', gender: 'male', rarity: 'common', emoji: '🏖️',
    file: 'Beach Character.glb', setBonus: 2, setDiscount: 0,
    items: {
      top:    { node: 'Beach_Body', price: 50, hp: 1 },
      bottom: { node: 'Beach_Legs', price: 40, hp: 1 },
      boots:  { node: 'Beach_Feet', price: 30, hp: 1 },
    },
  },
  'business-m': {
    name: 'Бизнесмен', gender: 'male', rarity: 'epic', emoji: '💼',
    file: 'Business Man.glb', setBonus: 4, setDiscount: 0,
    items: {
      top:    { node: 'Suit_Body', price: 170, hp: 2 },
      bottom: { node: 'Suit_Legs', price: 140, hp: 2 },
      boots:  { node: 'Suit_Feet', price: 120, hp: 2 },
    },
  },
  'casual-m': {
    name: 'Повседневный', gender: 'male', rarity: 'common', emoji: '👕',
    file: 'Casual Character.glb', setBonus: 2, setDiscount: 0,
    items: {
      top:    { node: 'Casual2_Body', price: 50, hp: 1 },
      bottom: { node: 'Casual2_Legs', price: 40, hp: 1 },
      boots:  { node: 'Casual2_Feet', price: 35, hp: 1 },
    },
  },
  'farmer-m': {
    name: 'Фермер', gender: 'male', rarity: 'common', emoji: '🌾',
    file: 'Farmer.glb', setBonus: 2, setDiscount: 0,
    items: {
      helmet: { node: 'Farmer_Head', meshes: ['Farmer_Head_2', 'Farmer_Head_4'], price: 30, hp: 1 },
      top:    { node: 'Farmer_Body', price: 40, hp: 1 },
      bottom: { node: 'Farmer_Pants', price: 30, hp: 1 },
      boots:  { node: 'Farmer_Feet', price: 25, hp: 1 },
    },
  },
  'hoodie-m': {
    name: 'Уличный', gender: 'male', rarity: 'rare', emoji: '🧥',
    file: 'Hoodie Character.glb', setBonus: 3, setDiscount: 0,
    items: {
      top:    { node: 'Casual_Body', price: 100, hp: 1 },
      bottom: { node: 'Casual_Legs', price: 80, hp: 1 },
      boots:  { node: 'Casual_Feet', price: 70, hp: 1 },
    },
  },
  'king-m': {
    name: 'Монарх', gender: 'male', rarity: 'legendary', emoji: '👑',
    file: 'King.glb', setBonus: 5, setDiscount: 0,
    items: {
      helmet: { node: 'King_Head', meshes: ['King_Head_4'], price: 250, hp: 3 },
      top:    { node: 'King_Body', price: 220, hp: 3 },
      bottom: { node: 'King_Legs', price: 180, hp: 2 },
      boots:  { node: 'King_Feet', price: 150, hp: 2 },
    },
  },
  'punk-m': {
    name: 'Бунтарь', gender: 'male', rarity: 'rare', emoji: '🎸',
    file: 'Punk.glb', setBonus: 3, setDiscount: 0,
    items: {
      helmet: { node: 'Punk_Head', meshes: ['Punk_Head_2', 'Punk_Head_4'], price: 60, hp: 1 },
      top:    { node: 'Punk_Body', price: 75, hp: 1 },
      bottom: { node: 'Punk_Legs', price: 60, hp: 1 },
      boots:  { node: 'Punk_Feet', price: 55, hp: 1 },
    },
  },
  'swat-m': {
    name: 'Спецназ', gender: 'male', rarity: 'epic', emoji: '🛡️',
    file: 'Swat.glb', setBonus: 4, setDiscount: 0,
    items: {
      helmet: { node: 'Swat_Head', meshes: ['Swat_Head_1', 'Swat_Head_2', 'Swat_Head_3'], price: 105, hp: 2 },
      top:    { node: 'Swat_Body', price: 120, hp: 2 },
      bottom: { node: 'Swat_Legs', price: 95, hp: 2 },
      boots:  { node: 'Swat_Feet', price: 80, hp: 2 },
    },
  },
  'worker-m': {
    name: 'Мастер', gender: 'male', rarity: 'rare', emoji: '🔧',
    file: 'Worker.glb', setBonus: 3, setDiscount: 0,
    items: {
      helmet: { node: 'Worker_Head', meshes: ['Worker_Head_1'], price: 55, hp: 1 },
      top:    { node: 'Worker_Body', price: 80, hp: 1 },
      bottom: { node: 'Worker_Legs', price: 60, hp: 1 },
      boots:  { node: 'Worker_Feet', price: 55, hp: 1 },
    },
  },

  // ════ ЖЕНСКИЕ ════
  'adventurer-f': {
    name: 'Искательница', gender: 'female', rarity: 'epic', emoji: '🏹',
    file: 'Adventurer_f.glb', setBonus: 4, setDiscount: 0,
    items: {
      top:    { node: 'Adventurer_Body', price: 150, hp: 1 },
      bottom: { node: 'Adventurer_Legs', price: 130, hp: 1 },
      boots:  { node: 'Adventurer_Feet', price: 120, hp: 1 },
    },
  },
  'animwoman-f': {
    name: 'Модная', gender: 'female', rarity: 'common', emoji: '💃',
    file: 'Animated Woman.glb', setBonus: 2, setDiscount: 0,
    items: {
      top:    { node: 'Casual_Body', price: 50, hp: 1 },
      bottom: { node: 'Casual_Legs', price: 40, hp: 1 },
      boots:  { node: 'Casual_Feet', price: 35, hp: 1 },
    },
  },
  'formal-f': {
    name: 'Стильная', gender: 'female', rarity: 'common', emoji: '👗',
    file: 'Animated Woman-nIItLV9nxS.glb', setBonus: 2, setDiscount: 0,
    items: {
      top:    { node: 'Formal_Body', price: 50, hp: 1 },
      bottom: { node: 'Formal_Legs', price: 35, hp: 1 },
      boots:  { node: 'Formal_Feet', price: 30, hp: 1 },
    },
  },
  'medieval-f': {
    name: 'Рыцарь', gender: 'female', rarity: 'legendary', emoji: '⚔️',
    file: 'Medieval.glb', setBonus: 5, setDiscount: 0,
    items: {
      helmet: { node: 'Medieval_Head', meshes: ['Medieval_Head_1', 'Medieval_Head_2', 'Medieval_Head_4'], price: 250, hp: 2 },
      top:    { node: 'Medieval_Body', price: 220, hp: 2 },
      bottom: { node: 'Medieval_Legs', price: 180, hp: 2 },
      boots:  { node: 'Medieval_Feet', price: 150, hp: 2 },
    },
  },
  'punk-f': {
    name: 'Бунтарка', gender: 'female', rarity: 'rare', emoji: '🎸',
    file: 'Punk_f.glb', setBonus: 3, setDiscount: 0,
    items: {
      helmet: { node: 'Punk_Head', meshes: ['Punk_Head_2', 'Punk_Head_3'], price: 60, hp: 1 },
      top:    { node: 'Punk_Body', price: 75, hp: 1 },
      bottom: { node: 'Punk_Legs', price: 60, hp: 1 },
      boots:  { node: 'Punk_Feet', price: 55, hp: 1 },
    },
  },
  'scifi-f': {
    name: 'Космонавт', gender: 'female', rarity: 'epic', emoji: '🔬',
    file: 'Sci Fi Character.glb', setBonus: 4, setDiscount: 0,
    items: {
      helmet: { node: 'SciFi_Head', meshes: ['SciFi_Head_1', 'SciFi_Head_3'], price: 130, hp: 2 },
      top:    { node: 'SciFi_Body', price: 120, hp: 2 },
      bottom: { node: 'SciFi_Legs', price: 95, hp: 2 },
      boots:  { node: 'SciFi_Feet', price: 85, hp: 2 },
    },
  },
  'soldier-f': {
    name: 'Боец', gender: 'female', rarity: 'epic', emoji: '🎖️',
    file: 'Soldier.glb', setBonus: 4, setDiscount: 0,
    items: {
      top:    { node: 'Soldier_Body', price: 160, hp: 2 },
      bottom: { node: 'Soldier_Legs', price: 130, hp: 2 },
      boots:  { node: 'Soldier_Feet', price: 110, hp: 2 },
    },
  },
  'suit-f': {
    name: 'Деловая', gender: 'female', rarity: 'rare', emoji: '👔',
    file: 'Suit.glb', setBonus: 3, setDiscount: 0,
    items: {
      top:    { node: 'Suit_Body', price: 90, hp: 1 },
      bottom: { node: 'Suit_Legs', price: 70, hp: 1 },
      boots:  { node: 'Suit_Feet', price: 60, hp: 1 },
    },
  },
  'witch-f': {
    name: 'Ведьма', gender: 'female', rarity: 'legendary', emoji: '🧙',
    file: 'Witch.glb', setBonus: 5, setDiscount: 0,
    items: {
      helmet: { node: 'Witch_Head', meshes: ['Witch_Head_1', 'Witch_Head_3'], price: 250, hp: 2 },
      top:    { node: 'Witch_Body', price: 220, hp: 2 },
      bottom: { node: 'Witch_Legs', price: 180, hp: 2 },
      boots:  { node: 'Witch_Feet', price: 150, hp: 2 },
    },
  },
  'worker-f': {
    name: 'Мастерица', gender: 'female', rarity: 'common', emoji: '🔧',
    file: 'Worker_f.glb', setBonus: 2, setDiscount: 0,
    items: {
      helmet: { node: 'Worker_Head', meshes: ['Worker_Head_2'], price: 28, hp: 1 },
      top:    { node: 'Worker_Body', price: 38, hp: 1 },
      bottom: { node: 'Worker_Legs', price: 30, hp: 1 },
      boots:  { node: 'Worker_Feet', price: 25, hp: 1 },
    },
  },
};

// ── Производные каталоги (магазин/HP/сеты) ──────────────────────────────────

const SLOT_RU = { helmet: 'Шлем', top: 'Верх', bottom: 'Низ', boots: 'Обувь' };
const SLOT_ICON = { helmet: '🪖', top: '🧥', bottom: '👖', boots: '🥾' };

export const itemIdFor = (setKey, slot) => `eq-${slot}-${setKey}`;

// Плоский список предметов для SHOP_ITEMS (магазин). gender фильтрует каталог.
export const OUTFIT_ITEMS = Object.entries(OUTFIT_SETS).flatMap(([key, set]) =>
  Object.entries(set.items).map(([slot, it]) => ({
    id: itemIdFor(key, slot),
    type: slot,
    gender: set.gender,
    name: `${SLOT_RU[slot]} «${set.name}»`,
    price: it.price,
    rarity: set.rarity,
    icon: set.emoji || SLOT_ICON[slot],
    hp: it.hp,
    setKey: key,
  }))
);

// EQUIPMENT_SETS-совместимая структура (магазин/«Мой герой»/completedSet).
export const OUTFIT_EQUIPMENT_SETS = Object.fromEntries(Object.entries(OUTFIT_SETS).map(([key, set]) => [
  key,
  {
    name: set.name,
    gender: set.gender,
    bonus: set.setBonus,
    discount: set.setDiscount,
    icon: set.emoji,
    rarity: set.rarity,
    items: Object.keys(set.items).map((slot) => itemIdFor(key, slot)),
  },
]));

// itemId → { setKey, set, slot } (для рендера экипировки).
export const OUTFIT_ITEM_INDEX = Object.fromEntries(
  Object.entries(OUTFIT_SETS).flatMap(([key, set]) =>
    Object.keys(set.items).map((slot) => [itemIdFor(key, slot), { setKey: key, set, slot }])
  )
);

// ── Загрузка и извлечение ────────────────────────────────────────────────────

const _outfitCache = {}; // file → Promise<{THREE, gltf, prepared}>

export function loadOutfitModel(file) {
  if (_outfitCache[file]) return _outfitCache[file];
  _outfitCache[file] = import('./loadThree.js')
    .then(({ loadThreeGLTF }) => loadThreeGLTF())
    .then((THREE) => new Promise((resolve, reject) => {
      new THREE.GLTFLoader().load(
        '/models/' + encodeURIComponent(file),
        (gltf) => {
          // Матовые материалы (как у базовых моделей — glTF metalness=1 чинится)
          gltf.scene.traverse((o) => {
            const m = o.material;
            if (!m) return;
            (Array.isArray(m) ? m : [m]).forEach((mm) => {
              if (mm.metalness !== undefined && mm.metalness > 0.2) mm.metalness = 0.08;
              if (mm.roughness !== undefined && mm.roughness < 0.75) mm.roughness = 0.82;
            });
          });
          // Миксер с Idle держим наготове: top запекается в idle-позе (в T-pose
          // рукава раскинуты), остальные слоты — в bind-позе (ноги строго прямые,
          // совпадают со стойкой базовой модели). Позой управляет buildSlotGroup.
          // Idle_Neutral — симметричная ровная стойка (ступни ±x, один z);
          // обычный Idle у Quaternius «шагнувший» и для запекания не годится.
          const idle = gltf.animations.find((a) => /\|Idle_Neutral$/.test(a.name))
            || gltf.animations.find((a) => /\|Idle$/.test(a.name))
            || gltf.animations.find((a) => /idle/i.test(a.name));
          const mixer = idle ? new THREE.AnimationMixer(gltf.scene) : null;
          const idleAction = mixer ? mixer.clipAction(idle) : null;
          gltf.scene.updateMatrixWorld(true);
          resolve({ THREE, gltf, mixer, idleAction });
        },
        undefined,
        (e) => reject(e || new Error('outfit load failed: ' + file)),
      );
    }))
    .catch((e) => { delete _outfitCache[file]; throw e; });
  return _outfitCache[file];
}

// Запекает SkinnedMesh в текущей позе скелета → обычная BufferGeometry
// в мировых координатах сцены наряда.
function bakeSkinned(THREE, skinned) {
  const src = skinned.geometry;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', src.attributes.position.clone());
  if (src.attributes.normal) geo.setAttribute('normal', src.attributes.normal.clone());
  if (src.attributes.uv) geo.setAttribute('uv', src.attributes.uv.clone());
  if (src.index) geo.setIndex(src.index.clone());
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    skinned.boneTransform(i, v); // скиннинг в ЛОКАЛИ меша (r128)
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.applyMatrix4(skinned.matrixWorld); // локаль меша → мир сцены наряда
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Кость-якорь слота в наряде (Quaternius-риг общий для всех нарядов).
// boots — середина между ступнями (обе ноги в одном меше).
const OUTFIT_ANCHOR = { helmet: 'Head', top: 'Torso', bottom: 'Hips' };

// Ставит наряд в нужную позу: top → idle (руки опущены), остальные → bind
// (T-pose: ноги прямые на стандартной ширине — совпадает со стойкой базы).
export function poseOutfit(THREE, outfit) {
  const { gltf, mixer, idleAction } = outfit;
  // Все слоты запекаются в первом кадре Idle: руки опущены, стойка ровная
  // (skeleton.pose()/bind-поза у этих ригов даёт некорректный мир — armature
  // имеет собственные трансформы, bind не предназначен для прямого показа).
  if (mixer && idleAction) {
    idleAction.reset().play();
    mixer.update(0);
  }
  gltf.scene.updateMatrixWorld(true);
  // boneMatrices пересчитываются только в рендере — для CPU-запекания обновляем вручную
  gltf.scene.traverse((o) => { if (o.isSkinnedMesh && o.skeleton && o.skeleton.update) o.skeleton.update(); });
}

// Строит статичную группу мешей одежды слота: origin = якорная кость наряда,
// масштаб нормализован к росту базового персонажа. Возвращает { group } или null.
export function buildSlotGroup(THREE, gltf, set, slot) {
  const def = set.items[slot];
  if (!def) return null;
  const node = gltf.scene.getObjectByName(def.node);
  if (!node) return null;
  const meshes = [];
  if (node.isSkinnedMesh || node.isMesh) meshes.push(node);
  else node.traverse((o) => { if (o.isSkinnedMesh || o.isMesh) meshes.push(o); });
  const wanted = meshes.filter((m) => {
    if (def.meshes) return def.meshes.includes(m.name);
    const matName = Array.isArray(m.material) ? m.material[0]?.name : m.material?.name;
    return !isBodyMat(matName);
  });
  if (!wanted.length) return null;

  // Масштаб наряда → рост базы (bbox в применённой idle-позе)
  const bbox = new THREE.Box3().setFromObject(gltf.scene);
  const size = new THREE.Vector3(); bbox.getSize(size);
  const scale = size.y > 0 ? TARGET_HEIGHT / size.y : 1;

  const anchor = new THREE.Vector3();
  if (slot === 'boots') {
    const fl = gltf.scene.getObjectByName('FootL'), fr = gltf.scene.getObjectByName('FootR');
    if (fl && fr) {
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      fl.getWorldPosition(a); fr.getWorldPosition(b);
      anchor.addVectors(a, b).multiplyScalar(0.5);
    } else anchor.set(0, bbox.min.y, 0);
  } else {
    const anchorBone = gltf.scene.getObjectByName(OUTFIT_ANCHOR[slot]);
    if (anchorBone) anchorBone.getWorldPosition(anchor);
    else anchor.set(0, bbox.min.y, 0);
  }

  const group = new THREE.Group();
  wanted.forEach((m) => {
    const geo = m.isSkinnedMesh ? bakeSkinned(THREE, m) : m.geometry.clone();
    if (!m.isSkinnedMesh) geo.applyMatrix4(m.matrixWorld);
    geo.translate(-anchor.x, -anchor.y, -anchor.z); // origin в якорной кости
    const mats = Array.isArray(m.material) ? m.material.map((mm) => mm.clone()) : m.material.clone();
    const mesh = new THREE.Mesh(geo, mats);
    mesh.castShadow = true;
    group.add(mesh);
  });
  group.scale.setScalar(scale);
  return { group };
}

// Полный dispose группы, созданной buildSlotGroup.
export function disposeSlotGroup(group) {
  group.traverse((o) => {
    if (o.isMesh) {
      o.geometry && o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m && m.dispose());
    }
  });
}
