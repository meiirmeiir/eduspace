import React, { useEffect, useRef, useState } from 'react';
import { loadThree } from '../lib/loadThree.js';
import { buildLego } from './LegoCharacter3D.jsx';
import { loadCharacterModel, cloneCharacterScene, pickClip, normalizeCharacter } from './Character3D.jsx';
import { applyBossDamageDim, buildBossFromGltf } from './Boss3D.jsx';
import { bossById, loadBossModel } from '../lib/bossConfig.js';
import { OUTFIT_SETS, OUTFIT_EQUIPMENT_SETS, loadOutfitModel } from '../lib/outfitSets.js';
import PixelBoss from './PixelBoss.jsx';

// Покемон-арена боя (ОДИН WebGL-контекст). Камера под углом ~30° сверху: игрок
// ближе/крупнее (снизу-слева), босс дальше/мельче (сверху-справа). Космический
// фон (звёзды + планета + скалы), отдельные платформы. Вход моделей — слайд
// из-за экрана с overshoot (easeOutBack). Бой: верный → выпад игрока + белая
// вспышка + отдача/тряска босса; ошибка → выпад босса + красная вспышка +
// отшат игрока + красная вспышка экрана. HP-бар и красный flash — CSS поверх
// канваса. Все 3D-анимации — через rAF + elapsed (lerp/easeOutBack). Фолбэк → PixelBoss.

const SLOTS = ['helmet', 'top', 'bottom', 'boots'];
const PLAYER = { x: -1.5, z: 1.5 };
const BOSS = { x: 1.5, z: -1.5 };
// единичный вектор player→boss в плоскости XZ (направление выпадов)
const DPB = (() => { const dx = BOSS.x - PLAYER.x, dz = BOSS.z - PLAYER.z; const l = Math.hypot(dx, dz) || 1; return { x: dx / l, z: dz / l }; })();
const PLAYER_YAW = Math.atan2(BOSS.x - PLAYER.x, BOSS.z - PLAYER.z); // лицом к боссу
const BOSS_YAW = Math.atan2(PLAYER.x - BOSS.x, PLAYER.z - BOSS.z);   // лицом к игроку
const ENTRANCE = 1.2; // сек слайд-входа

const lerp = (a, b, t) => a + (b - a) * t;
function easeOutBack(x) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function makeGlowCanvas(rgb) {
  const S = 128; const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.4, `rgba(${rgb},0.55)`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S); return c;
}

// Флаг визуала арены v2 (свет/контровой + платформа + плотное инстансированное
// окружение + blob-тени). false → прежняя арена (свет/грунт/окружение как было).
const BATTLE_ARENA_V2 = true;

// Мягкая blob-тень (canvas-радиал, чёрный→прозрачный) под бойцами — дёшево, вместо
// дорогого shadowMap. Возвращает THREE-текстуру (как alpha/диффуз тёмного пятна).
function makeBlobTex(THREE) {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.5, 'rgba(0,0,0,0.26)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  return t;
}

export default function BattleScene3D({ equipped = {}, gender = 'male', bossId = 'shadow', bossHp = 100, maxHp, attackSeq = 0, hitSeq = 0, playerHp = 3, playerMaxHp = 3, playerName = 'Ты', hud = true, height = 320 }) {
  const mountRef = useRef(null);
  const bossOvRef = useRef(null);   // HP-плашка босса (позиционируется под моделью)
  const playerOvRef = useRef(null); // сердечки игрока (над головой)
  const [failed, setFailed] = useState(false);
  const [redFlash, setRedFlash] = useState(false);
  const [losingHeart, setLosingHeart] = useState(null); // индекс исчезающего сердца
  const boss = bossById(bossId);
  const max = maxHp || boss.hp;
  const hpPct = max ? Math.max(0, Math.min(100, (bossHp / max) * 100)) : 0;
  const hpColor = hpPct > 50 ? '#ef4444' : hpPct > 25 ? '#f97316' : '#eab308';

  const hpRef = useRef(bossHp); hpRef.current = bossHp;
  const attackRef = useRef(attackSeq); attackRef.current = attackSeq;
  const hitRef = useRef(hitSeq); hitRef.current = hitSeq;
  const apiRef = useRef(null);

  const resolved = {}; SLOTS.forEach((s) => { resolved[s] = (equipped && equipped[s]) || null; });
  const resolvedKey = SLOTS.map((s) => resolved[s] || '-').join('|');
  const resolvedRef = useRef(resolved); resolvedRef.current = resolved;
  useEffect(() => { apiRef.current?.rebuild(resolvedRef.current); }, [resolvedKey]);

  // Полный сет → подмена модели целиком на наряд (как Character3D:135-157). Частичная/
  // смешанная экипировка → базовая модель по полу. Та же логика, что в превью — чтобы
  // бой === превью (Монарх в шопе = Монарх в бою). HP-бонусы считаются отдельно (computePlayerHp).
  const equippedIds = SLOTS.map((s) => resolved[s]).filter(Boolean);
  const fullSetKey = Object.entries(OUTFIT_EQUIPMENT_SETS).find(([, set]) =>
    set.gender === gender && set.items.length > 0 && set.items.every((id) => equippedIds.includes(id))
  )?.[0] || null;

  // Красная вспышка экрана при контратаке (пропуск самого первого hitSeq).
  const firstHit = useRef(true);
  useEffect(() => {
    if (firstHit.current) { firstHit.current = false; return; }
    setRedFlash(true);
    const id = setTimeout(() => setRedFlash(false), 220);
    return () => clearTimeout(id);
  }, [hitSeq]);

  // Потеря сердца → анимация исчезновения у только что опустевшего слота.
  const prevHp = useRef(playerHp);
  useEffect(() => {
    if (playerHp < prevHp.current) {
      const idx = playerHp; // слот, который опустел
      setLosingHeart(idx);
      const id = setTimeout(() => setLosingHeart(null), 450);
      prevHp.current = playerHp;
      return () => clearTimeout(id);
    }
    prevHp.current = playerHp;
  }, [playerHp]);

  useEffect(() => {
    let renderer, scene, camera, frameId, clock, ro, mixer;
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;
    const geos = [], mats = [], texs = [], clonedMats = [];
    const planets = [];

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      let W = mount.clientWidth || 480;

      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
      catch (e) { if (!cancelled) setFailed(true); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, height);
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      // Космический фон (как на карте навыков) + туман: дальние объекты уходят в темноту.
      scene.fog = new THREE.FogExp2(0x12102a, 0.05);
      // Камера ближе к бойцам (прежний «покемон»-ракурс): крупные персонажи.
      // lookAt чуть выше горизонта → над скалами видна полоса неба со звёздами.
      camera = new THREE.PerspectiveCamera(47, W / height, 0.1, 200);
      camera.position.set(0, 3.4, 5.6); camera.lookAt(0, 1.2, 0);

      // ── Освещение ──
      scene.add(new THREE.AmbientLight(0x9db4ff, 0.6));                 // мягкий голубоватый
      scene.add(new THREE.HemisphereLight(0x1a1a4a, 0x2a1a0a, 0.3));    // небо/земля
      const keyL = new THREE.DirectionalLight(0xffffff, 1.3); keyL.position.set(5, 10, 5); scene.add(keyL); // key сверху-спереди
      const bossRim = new THREE.PointLight(0xff5a2b, 0.6, 24); bossRim.position.set(BOSS.x + 0.8, 2.2, BOSS.z - 1.4); scene.add(bossRim); // красный контровой за боссом
      // ── V2: холодный контровой (rim/back) сзади-сверху — очерчивает силуэт бойцов
      //    краевым светом, читает ТЁМНЫХ боссов на тёмном фоне, НЕ пересвечивая
      //    светлых (грани, не фронтальная заливка → сумрак сохраняется). ──
      if (BATTLE_ARENA_V2) {
        const rimL = new THREE.DirectionalLight(0x93b7ff, 1.25); rimL.position.set(-3.5, 6.5, -10); scene.add(rimL);
        const rimL2 = new THREE.DirectionalLight(0x6f86c8, 0.55); rimL2.position.set(4.5, 5.0, -9); scene.add(rimL2);
      }

      // ── Звёзды: мелкие точки с мягким glow (canvas-текстура), additive ──
      const sc = document.createElement('canvas'); sc.width = sc.height = 32;
      const sctx = sc.getContext('2d');
      const sg = sctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      sg.addColorStop(0, 'rgba(255,255,255,1)'); sg.addColorStop(0.35, 'rgba(255,255,255,0.55)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      sctx.fillStyle = sg; sctx.fillRect(0, 0, 32, 32);
      const starTex = new THREE.CanvasTexture(sc); texs.push(starTex);
      const STAR_N = 1800;
      const starPos = new Float32Array(STAR_N * 3);
      for (let i = 0; i < STAR_N; i++) {
        const r = 30 + ((i * 1327) % 1000) / 1000 * 20;                 // 30..50, детерминированно
        const th = (i * 2.399963);                                     // golden-angle по азимуту
        const ph = Math.acos((i % 100) / 100);                         // только верхняя полусфера (y>0)
        starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
        starPos[i * 3 + 1] = r * Math.cos(ph) + 1;
        starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) - 12;
      }
      const starGeo = new THREE.BufferGeometry(); geos.push(starGeo);
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      const starMat = new THREE.PointsMaterial({ map: starTex, color: 0xffffff, size: 0.32, sizeAttenuation: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }); mats.push(starMat);
      scene.add(new THREE.Points(starGeo, starMat));

      // ── Земля: процедурная плоская поверхность (тёмная) ──
      const groundGeo = new THREE.PlaneGeometry(40, 40); geos.push(groundGeo);
      const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2019, roughness: 0.95, metalness: 0.05 }); mats.push(groundMat);
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2; ground.position.y = 0;
      scene.add(ground);

      // ── V2: боевая ПЛАТФОРМА (каменный диск в тон скал) + приглушённое сине-
      //    фиолетовое кольцо (low emissive, не неон). Верх диска на y=0 → бойцы (y=0)
      //    стоят на нём, НЕ сдвинуты; polygonOffset от z-fight с грунтом. + blob-тени
      //    под бойцами (дёшево, вместо дорогого shadowMap). ──
      if (BATTLE_ARENA_V2) {
        const padGeo = new THREE.CylinderGeometry(3.3, 3.55, 0.16, 40); geos.push(padGeo);
        const padMat = new THREE.MeshStandardMaterial({ color: 0x3a332e, roughness: 0.9, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); mats.push(padMat);
        const pad = new THREE.Mesh(padGeo, padMat); pad.position.y = -0.08; scene.add(pad);
        const ringGeo = new THREE.TorusGeometry(3.34, 0.05, 8, 48); ringGeo.rotateX(Math.PI / 2); geos.push(ringGeo);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0x35306a, emissive: 0x4a44b4, emissiveIntensity: 0.6, roughness: 0.5, metalness: 0.2 }); mats.push(ringMat);
        const ring = new THREE.Mesh(ringGeo, ringMat); ring.position.y = 0.02; scene.add(ring);
        const blobTex = makeBlobTex(THREE); texs.push(blobTex);
        const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.6, fog: false }); mats.push(blobMat);
        [PLAYER, BOSS].forEach((p) => {
          const bg = new THREE.PlaneGeometry(2.4, 2.4); bg.rotateX(-Math.PI / 2); geos.push(bg);
          const blob = new THREE.Mesh(bg, blobMat); blob.position.set(p.x, 0.015, p.z); blob.renderOrder = 2; scene.add(blob);
        });
      }

      // ── Окружение: скалы + трава ──
      const ROCKS = ['/models/environment/rock1.glb', '/models/environment/rock2.glb', '/models/environment/rock3.glb'];

      if (BATTLE_ARENA_V2) {
        // ── V2: ПЛОТНОЕ окружение через InstancedMesh (геометрия из GLB, 1 draw-call
        //    на тип) — десятки камней/травы без роста draw calls. [size, x, z, ry]. ──
        const ROCK_P = [
          [4.6,-7.5,-7.0,0.4],[5.0,-3.5,-8.0,1.7],[4.2,0.0,-8.3,0.9],[4.8,3.8,-7.8,2.6],[4.4,7.8,-6.8,0.2],
          [2.4,-6.0,-5.0,1.1],[2.0,-2.2,-5.6,2.9],[2.6,2.0,-5.8,0.6],[2.2,5.6,-5.2,1.9],
          [0.9,-4.6,-3.2,0.8],[0.7,4.4,-3.4,2.2],
          [0.6,PLAYER.x-1.5,PLAYER.z+0.5,1.3],[0.5,BOSS.x+1.3,BOSS.z+0.6,2.4],
          // уплотнение: дальний задний ряд + боковые гряды + средний план (за платформой)
          [5.2,-9.6,-9.0,1.2],[4.0,-6.0,-9.4,0.5],[4.6,6.2,-9.1,2.0],[3.6,9.4,-8.0,1.5],[3.2,-9.8,-7.4,2.7],
          [1.9,-8.2,-4.4,0.3],[1.7,7.4,-4.0,1.1],[1.5,-7.6,-2.4,2.4],[1.3,6.8,-2.2,0.9],
          [0.9,-6.4,-1.0,1.8],[0.8,6.2,-0.8,0.4],[1.0,8.8,-5.6,2.1],[0.95,-9.0,-5.8,1.6],
          [0.55,-5.2,1.2,1.0],[0.5,5.4,1.0,2.5],
        ];
        const GRASS_P = [
          [0.5,PLAYER.x-0.9,PLAYER.z+0.9,0.4],[0.4,PLAYER.x+0.8,PLAYER.z-0.5,1.9],[0.45,BOSS.x-1.0,BOSS.z+0.5,2.7],
          [0.5,0.2,1.6,0.9],[0.4,-3.5,-2.2,1.3],[0.45,3.0,-2.6,0.5],[0.35,-1.0,-1.0,2.1],[0.4,1.4,0.2,1.5],
          [0.4,-3.9,2.0,0.7],[0.35,3.7,2.2,1.2],[0.5,-4.6,-0.5,2.4],[0.45,4.7,-0.6,0.3],
          [0.4,-2.0,2.6,1.8],[0.38,2.2,2.8,0.6],[0.42,0.0,3.0,1.1],[0.36,-5.4,-3.0,2.0],[0.4,5.0,-3.2,0.9],[0.34,-0.5,-3.6,1.5],
        ];
        // Геометрия+материал из первого меша GLB (локальный трансформ запечён) → InstancedMesh.
        const mkInstanced = (gltf, placements) => {
          if (cancelled || !scene || !placements.length) return;
          gltf.scene.updateMatrixWorld(true);
          let mesh = null; gltf.scene.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
          if (!mesh) return;
          const geo = mesh.geometry.clone(); geo.applyMatrix4(mesh.matrixWorld); geo.computeBoundingBox(); geos.push(geo);
          const bb = geo.boundingBox; const sz = new THREE.Vector3(); bb.getSize(sz); const maxDim = Math.max(sz.x, sz.y, sz.z) || 1;
          const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).clone(); mats.push(mat);
          const inst = new THREE.InstancedMesh(geo, mat, placements.length);
          const d = new THREE.Object3D();
          placements.forEach((p, i) => { const s = p[0] / maxDim; d.position.set(p[1], -bb.min.y * s, p[2]); d.rotation.set(0, p[3], 0); d.scale.setScalar(s); d.updateMatrix(); inst.setMatrixAt(i, d.matrix); });
          inst.instanceMatrix.needsUpdate = true; scene.add(inst);
        };
        const rockBuckets = [[], [], []]; ROCK_P.forEach((p, i) => rockBuckets[i % 3].push(p));
        Promise.all(ROCKS.map((u) => loadBossModel(u))).then((res) => { if (cancelled || !scene) return; res.forEach(({ gltf }, t) => mkInstanced(gltf, rockBuckets[t])); }).catch(() => { /* env не критично */ });
        loadBossModel('/models/environment/grass.glb').then(({ gltf }) => mkInstanced(gltf, GRASS_P)).catch(() => { /* env не критично */ });
      } else {
        // ── Прежнее окружение (GLB-клоны, НЕ инстансировано) ──
        const fit = (m, targetMax) => { const b = new THREE.Box3().setFromObject(m); const sz = new THREE.Vector3(); b.getSize(sz); const mx = Math.max(sz.x, sz.y, sz.z) || 1; m.scale.setScalar(targetMax / mx); };
        const onGround = (m, x, z, ry = 0) => { m.rotation.y = ry; const b = new THREE.Box3().setFromObject(m); m.position.set(x, -b.min.y, z); };
        const trackMats = (m) => m.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((mm) => clonedMats.push(mm)); });
        const addEnv = (url, place) => loadBossModel(url).then(({ gltf }) => {
          if (cancelled || !scene) return;
          const m = cloneCharacterScene(THREE, gltf); place(m); trackMats(m); scene.add(m);
        }).catch(() => { /* окружение не критично */ });
        const addRock = (s, x, z, ry) => addEnv(ROCKS[((Math.round(x * 7 + z * 3) % 3) + 3) % 3], (m) => { fit(m, s); onGround(m, x, z, ry); });
        addRock(4.6, -7.5, -7.0, 0.4); addRock(5.0, -3.5, -8.0, 1.7); addRock(4.2, 0.0, -8.3, 0.9);
        addRock(4.8,  3.8, -7.8, 2.6); addRock(4.4,  7.8, -6.8, 0.2);
        addRock(2.4, -6.0, -5.0, 1.1); addRock(2.0, -2.2, -5.6, 2.9); addRock(2.6, 2.0, -5.8, 0.6);
        addRock(2.2,  5.6, -5.2, 1.9);
        addRock(0.9, -4.6, -3.2, 0.8); addRock(0.7, 4.4, -3.4, 2.2);
        addRock(0.6, PLAYER.x - 1.5, PLAYER.z + 0.5, 1.3); addRock(0.5, BOSS.x + 1.3, BOSS.z + 0.6, 2.4);
        addEnv('/models/environment/grass.glb', (m) => { fit(m, 0.5);  onGround(m, PLAYER.x - 0.9, PLAYER.z + 0.9, 0.4); });
        addEnv('/models/environment/grass.glb', (m) => { fit(m, 0.4);  onGround(m, PLAYER.x + 0.8, PLAYER.z - 0.5, 1.9); });
        addEnv('/models/environment/grass.glb', (m) => { fit(m, 0.45); onGround(m, BOSS.x - 1.0, BOSS.z + 0.5, 2.7); });
        addEnv('/models/environment/grass.glb', (m) => { fit(m, 0.5);  onGround(m, 0.2, 1.6, 0.9); });
        addEnv('/models/environment/grass.glb', (m) => { fit(m, 0.4);  onGround(m, -3.5, -2.2, 1.3); });
        addEnv('/models/environment/grass.glb', (m) => { fit(m, 0.45); onGround(m, 3.0, -2.6, 0.5); });
        addEnv('/models/environment/grass.glb', (m) => { fit(m, 0.35); onGround(m, -1.0, -1.0, 2.1); });
        addEnv('/models/environment/grass.glb', (m) => { fit(m, 0.4);  onGround(m, 1.4, 0.2, 1.5); });
      }

      // ── Игрок (слева-снизу, ближе к камере) ──
      const hero = new THREE.Group();
      hero.position.set(PLAYER.x, 0, PLAYER.z); hero.rotation.y = PLAYER_YAW;
      scene.add(hero);
      let lego = buildLego(THREE, null, {});
      hero.add(lego.group);
      geos.push(...lego.geos); mats.push(...lego.mats); texs.push(...lego.texs);
      apiRef.current = { rebuild: lego.rebuildEquip, dispose: lego.dispose };
      lego.rebuildEquip(resolvedRef.current);
      let heroKind = 'lego';
      // Полный сет → GLB наряда (King.glb и т.п.), иначе базовая модель по полу.
      // Наряд-модели имеют idle (Idle_Neutral) + богаче анимаций; бой играет idle +
      // позиционный lunge → свап безопасен. Lego выше — заглушка, пока грузится GLTF.
      const heroModelPromise = fullSetKey
        ? loadOutfitModel(OUTFIT_SETS[fullSetKey].file)
        : loadCharacterModel(gender);
      heroModelPromise.then(({ gltf }) => {
        if (cancelled || !scene) return;
        const model = cloneCharacterScene(THREE, gltf);
        normalizeCharacter(THREE, model);
        hero.remove(lego.group);
        hero.add(model);
        heroKind = 'gltf';
        if (gltf.animations && gltf.animations.length) {
          mixer = new THREE.AnimationMixer(model);
          const clip = pickClip(gltf.animations, 'idle');
          if (clip) mixer.clipAction(clip).play();
        }
        apiRef.current = { rebuild: () => {}, dispose: lego.dispose };
      }).catch((e) => { console.warn('[battle3d] GLTF hero failed, keep Lego:', e?.message || e); });

      // ── Босс (справа-сверху, дальше) ──
      let built = null;
      loadBossModel(boss.model).then(({ gltf }) => {
        if (cancelled || !scene) return;
        built = buildBossFromGltf(THREE, gltf, 2.8);
        built.group.position.set(BOSS.x, 0, BOSS.z);
        built.group.rotation.y = BOSS_YAW;
        clonedMats.push(...built.dmgMats);
        scene.add(built.group);
      }).catch((e) => { console.warn('[battle3d] boss GLB failed:', e?.message || e); });

      // ── Вспышки удара ──
      const whiteTex = new THREE.CanvasTexture(makeGlowCanvas('255,255,255')); texs.push(whiteTex);
      const redTex = new THREE.CanvasTexture(makeGlowCanvas('255,90,60')); texs.push(redTex);
      const mkFlash = (tex, x, y, z) => { const m = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(m); const s = new THREE.Sprite(m); s.position.set(x, y, z); s.scale.set(0.1, 0.1, 1); scene.add(s); return s; };
      const hitFlash = mkFlash(whiteTex, BOSS.x, 1.2, BOSS.z);   // удар по боссу
      const counterFlash = mkFlash(redTex, PLAYER.x, 1.2, PLAYER.z); // контратака по игроку

      ro = new ResizeObserver(() => { if (!renderer || !mount) return; W = mount.clientWidth || W; renderer.setSize(W, height); camera.aspect = W / height; camera.updateProjectionMatrix(); });
      ro.observe(mount);

      clock = new THREE.Clock(); let last = 0, lastBlink = false, entranceStart = null;
      let lastAttack = attackRef.current, lastHit = hitRef.current;
      let atkStart = null, hitStart = null;
      const projV = new THREE.Vector3(); // переиспользуемый вектор для 3D→2D проекции

      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime(); const dt = Math.min(t - last, 0.05); last = t;
        if (entranceStart == null) entranceStart = t;
        const ep = clamp01((t - entranceStart) / ENTRANCE);
        const entered = easeOutBack(ep);

        planets.forEach((p) => {
          p.obj.rotation.y += p.speed;
          if (p.drift) p.obj.position.x = p.drift.base + ((t * p.drift.x * 60) % 22); // корабль медленно дрейфует вправо и зацикливается
        });
        if (mixer) mixer.update(dt);

        // ── триггеры ──
        if (attackRef.current !== lastAttack) { lastAttack = attackRef.current; atkStart = t; }
        if (hitRef.current !== lastHit) { lastHit = hitRef.current; hitStart = t; }

        // ── ИГРОК: вход слева + idle + выпад/отшат ──
        let heroLunge = 0, heroStagger = 0, heroTilt = 0;
        if (atkStart != null) {
          const e = t - atkStart;
          if (e < 0.4) { const u = e / 0.4; heroLunge = Math.sin(u * Math.PI) * 0.5; } else atkStart = null;
        }
        if (hitStart != null) {
          const e = t - hitStart;
          if (e < 0.5) { const u = e / 0.5; heroStagger = Math.sin(Math.min(1, e / 0.18) * Math.PI * 0.5) * 0.3 * (1 - u); heroTilt = Math.sin(e * 40) * 0.17 * (1 - u); }
        }
        const heroBaseX = lerp(PLAYER.x - 7, PLAYER.x, entered);
        hero.position.x = heroBaseX + DPB.x * heroLunge - DPB.x * heroStagger;
        hero.position.z = PLAYER.z + DPB.z * heroLunge - DPB.z * heroStagger;
        hero.rotation.z = heroTilt;
        hero.rotation.y = PLAYER_YAW + (heroKind === 'lego' ? 0 : 0);
        if (heroKind === 'lego') {
          hero.position.y = Math.abs(Math.sin(t * 1.9)) * 0.05;
          lego.torso.scale.y = 1 + Math.sin(t * 1.2) * 0.03;
          const sw = Math.sin(t * 1.7) * 0.2;
          if (lego.arms[0]) lego.arms[0].rotation.x = sw;
          if (lego.arms[1]) lego.arms[1].rotation.x = -sw;
          const blink = (t % 4) > 3.88;
          if (blink !== lastBlink) { lego.faceMat.map = blink ? lego.faceBlinkTex : lego.faceOpenTex; lego.faceMat.needsUpdate = true; lastBlink = blink; }
        }

        // ── БОСС: вход справа + idle (покачивание+поворот) + отдача/выпад/тряска ──
        if (built) {
          built.tick(t, dt);
          const bossBaseX = lerp(BOSS.x + 7, BOSS.x, entered);
          let bossRecoil = 0, bossLunge = 0, bossShake = 0;
          if (atkStart != null || (t - (atkStart ?? -9)) < 0.45) {
            const e = t - (atkStart ?? t);
            if (atkStart != null && e < 0.45) { bossRecoil = Math.sin(Math.min(1, e / 0.15) * Math.PI * 0.5) * 0.3 * (1 - e / 0.45); bossShake = (e < 0.3) ? Math.sin(e * 70) * 0.05 : 0; }
          }
          if (hitStart != null) { const e = t - hitStart; if (e < 0.4) bossLunge = Math.sin((e / 0.4) * Math.PI) * 0.5; }
          built.group.position.x = bossBaseX + DPB.x * bossRecoil - DPB.x * bossLunge + bossShake;
          built.group.position.z = BOSS.z + DPB.z * bossRecoil - DPB.z * bossLunge;
          built.group.position.y = (built.hasAnim ? Math.sin(t * 2.51) * 0.04 : Math.sin(t * 2.51) * 0.08);
          built.group.rotation.y = BOSS_YAW + Math.sin(t * 1.57) * 0.087; // ±5° период ~4с
          built.group.rotation.z = bossShake * 1.2;
          applyBossDamageDim(built.dmgMats, hpRef.current, t, true);
        }

        // ── вспышки ──
        if (atkStart != null || hitFlash.material.opacity > 0.01) {
          const e = atkStart != null ? t - atkStart : 1;
          const u = clamp01(e / 0.3);
          const k = Math.sin(u * Math.PI);
          hitFlash.material.opacity = k; hitFlash.scale.setScalar(0.2 + k * 1.6);
        }
        if (hitStart != null || counterFlash.material.opacity > 0.01) {
          const e = hitStart != null ? t - hitStart : 1;
          const u = clamp01(e / 0.3);
          const k = Math.sin(u * Math.PI);
          counterFlash.material.opacity = k; counterFlash.scale.setScalar(0.2 + k * 1.4);
        }

        // ── привязка HP-оверлеев к моделям (3D world → 2D screen), с clamp в пределах канваса ──
        const cw = renderer.domElement.clientWidth || W;
        const ch = renderer.domElement.clientHeight || height;
        const project = (x, y, z) => { projV.set(x, y, z).project(camera); return { x: (projV.x * 0.5 + 0.5) * cw, y: (-projV.y * 0.5 + 0.5) * ch }; };
        const clampX = (x) => Math.max(90, Math.min(cw - 90, x));
        const clampY = (y) => Math.max(4, Math.min(ch - 28, y));
        if (built && bossOvRef.current) {
          const p = project(built.group.position.x, 0.3, built.group.position.z); // у ног босса → плашка ещё ниже
          bossOvRef.current.style.left = clampX(p.x) + 'px';
          bossOvRef.current.style.top = clampY(p.y + 46) + 'px';
        }
        if (playerOvRef.current) {
          const p = project(hero.position.x, 3.0, hero.position.z); // высоко над головой игрока
          playerOvRef.current.style.left = clampX(p.x) + 'px';
          playerOvRef.current.style.top = clampY(p.y - 30) + 'px';
        }

        renderer.render(scene, camera);
      };
      animate();
    }).catch((e) => { console.warn('[battle3d] three load failed:', e?.message || e); if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (ro) ro.disconnect();
      if (mixer) { mixer.stopAllAction(); try { mixer.uncacheRoot(mixer.getRoot()); } catch { /* noop */ } }
      if (apiRef.current) { apiRef.current.dispose && apiRef.current.dispose(); apiRef.current = null; }
      geos.forEach((g) => g.dispose && g.dispose());
      mats.forEach((m) => m.dispose && m.dispose());
      clonedMats.forEach((m) => m.dispose && m.dispose());
      texs.forEach((tx) => tx.dispose && tx.dispose());
      if (renderer) {
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bossId, height, gender, fullSetKey]);

  if (failed) {
    const legacy = boss.tier <= 2 ? 'topic' : 'chapter';
    return <div style={{ width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}><PixelBoss type={legacy} hpPct={hpPct} shake={false} /></div>;
  }
  return (
    <div style={{ position: 'relative', width: '100%', height, background: 'linear-gradient(180deg,#0a0a1a 0%,#0f0f2a 55%,#1a0a2a 100%)' }}>
      <div ref={mountRef} style={{ width: '100%', height }} />
      {/* HP-плашка босса — привязана ПОД модель (left/top задаются imperative в rAF) */}
      {hud && (
        <div ref={bossOvRef} style={{ position: 'absolute', transform: 'translate(-50%,0)', background: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: '6px 12px', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: "'Montserrat',sans-serif", textAlign: 'center' }}>{boss.name}</div>
          <div style={{ width: 160, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.2)', marginTop: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${hpPct}%`, background: hpColor, borderRadius: 4, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2, textAlign: 'center', fontFamily: "'Inter',sans-serif" }}>{Math.max(0, bossHp)}/{max}</div>
        </div>
      )}
      {/* HP игрока — только сердечки, привязаны НАД головой (left/top — imperative в rAF) */}
      {hud && (
        <div ref={playerOvRef} style={{ position: 'absolute', transform: 'translate(-50%,-100%)', pointerEvents: 'none' }}>
          {/* maxWidth=140 (≈5 сердец/ряд) + flex-wrap: 3-5 HP в один ряд, при многих
              (Монарх=8) переносится на 2 ряда (5+3), не вылезая за арену (overflow:hidden
              обрезал бы). half-width (~70px) < clampX-margin 90px → ряд всегда в пределах
              канваса. transform -100% по Y — растём ВВЕРХ от якоря (над головой), 2-й ряд
              не лезет на модель. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', maxWidth: 140, margin: '0 auto' }}>
            {Array.from({ length: playerMaxHp }).map((_, i) => {
              const isLosing = i === losingHeart;
              const full = i < playerHp || isLosing;
              return (
                <span key={i} style={{
                  fontSize: 18, lineHeight: 1, display: 'inline-block',
                  filter: full ? 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))' : 'grayscale(1) opacity(0.35)',
                  animation: isLosing ? 'bs-heart-out 0.45s ease forwards' : 'none',
                }}>{full || isLosing ? '❤️' : '🤍'}</span>
              );
            })}
          </div>
        </div>
      )}
      {/* красная вспышка экрана при контратаке */}
      <div style={{ position: 'absolute', inset: 0, background: '#ff2a2a', opacity: redFlash ? 0.3 : 0, transition: 'opacity 0.2s ease', pointerEvents: 'none', borderRadius: 'inherit' }} />
      <style>{`@keyframes bs-heart-out{0%{transform:scale(1);filter:drop-shadow(0 0 6px #ff2a2a);opacity:1}60%{transform:scale(1.3);filter:drop-shadow(0 0 10px #ff2a2a)}100%{transform:scale(0);opacity:0}}`}</style>
    </div>
  );
}
