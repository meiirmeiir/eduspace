import React, { useEffect, useRef, useState } from 'react';
import { loadThree } from '../lib/loadThree.js';
import { useTheme } from '../ThemeContext.jsx';
import { FRAME_STYLES } from '../lib/shopItems.js';

// Гибрид-подиум топ-3: 3D-тумбы (Three.js) + CSS-аватары поверх canvas.
// Тумбы металлические (envMap-блики, bumpMap-гравировка номера), мягко
// покачиваются ±15° через sin. Аватары — обычные DOM-узлы; их экранные
// координаты пересчитываются КАЖДЫЙ КАДР проекцией мировой точки верха тумбы
// через камеру (camera.project) → аватары «приклеены» к качающимся тумбам.
// Клик по аватару → onOpenPublicProfile. При сбое Three.js → fallbackRender().

const ACCENT_HEX = ['#fbbf24', '#94a3b8', '#b45309'];   // rank 1/2/3
const ACCENT_NUM = [0xfbbf24, 0x94a3b8, 0xb45309];
const SLOTS = [{ x: 0, h: 2.2 }, { x: -2.4, h: 1.5 }, { x: 2.4, h: 1.0 }]; // #1 центр, #2 лево, #3 право
const H = 360;
const SWAY_AMP = 0.26;    // ~15° в радианах
const SWAY_SPEED = 0.5;   // рад/с — медленное престижное покачивание
const initialsOf = (e) => ((e?.firstName?.[0] || '') + (e?.lastName?.[0] || '')).toUpperCase() || '?';

// Весь канвас → grayscale (яркость = высота для bumpMap).
function luminancePass(ctx, S) {
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = l; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// Bump-канвас номера места: нейтральный фон + приподнятая (светлее) цифра с
// тонким тёмным контуром → рельефная гравировка на грани тумбы.
function makeNumberBumpCanvas(rank) {
  const S = 512;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, S, S);          // высота 0
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = "800 340px 'Montserrat', sans-serif";
  ctx.lineWidth = S * 0.012; ctx.strokeStyle = '#383838';        // тёмный контур (канавка)
  ctx.strokeText(String(rank), S / 2, S / 2 + S * 0.02);
  ctx.fillStyle = '#ededed';                                     // приподнятая цифра
  ctx.fillText(String(rank), S / 2, S / 2 + S * 0.02);
  luminancePass(ctx, S);
  return c;
}

// Процедурный env-куб (6 граней с вертикальным градиентом) — металлу
// отражения/блеск без внешних ассетов.
function makeEnvCube(THREE) {
  const faces = [];
  for (let i = 0; i < 6; i++) {
    const S = 64;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#c8cdd6'); g.addColorStop(1, '#2b3340');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    faces.push(c);
  }
  const tex = new THREE.CubeTexture(faces);
  tex.needsUpdate = true;
  return tex;
}

// Радиальный золотой градиент для ауры-спрайта за тумбой #1.
function makeAuraCanvas() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(251,191,36,0.85)');
  g.addColorStop(0.45, 'rgba(251,191,36,0.35)');
  g.addColorStop(1, 'rgba(251,191,36,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return c;
}

export default function Podium3D({ top3 = [], onOpenPublicProfile, fallbackRender }) {
  const { theme: THEME } = useTheme();
  const wrapRef = useRef(null);
  const mountRef = useRef(null);
  const avatarRefs = useRef([]);   // DOM-узлы аватаров по индексам top3
  const [failed, setFailed] = useState(false);

  // onOpenPublicProfile через ref — чтобы не пересобирать сцену при смене ссылки.
  const onOpenRef = useRef(onOpenPublicProfile);
  onOpenRef.current = onOpenPublicProfile;

  // Стабильный ключ: пересоздаём сцену только при смене состава топ-3.
  const key = top3.map(e => (e ? `${e.uid}:${e.points}` : 'x')).join('|');

  useEffect(() => {
    if (!key) return;
    let renderer, scene, camera, group, frameId, ro, clock;
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;
    const geos = [], mats = [], texs = [], anchors = [];
    let curW = mount.clientWidth || 600;
    const tmp = { project: null };

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      const W = mount.clientWidth || 600; curW = W;
      const tmpVec = new THREE.Vector3();

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, H);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
      camera.position.set(0, 3.6, 7.5);
      camera.lookAt(0, 1.0, 0);

      group = new THREE.Group();
      scene.add(group);

      const envCube = makeEnvCube(THREE); texs.push(envCube);

      // ── Свет: env-база + key/fill + point для бликов на металле ──────────────
      scene.add(new THREE.AmbientLight(0xffffff, 0.45));
      const key1 = new THREE.DirectionalLight(0xffffff, 1.0);
      key1.position.set(4, 8, 6);
      key1.castShadow = true;
      key1.shadow.mapSize.set(1024, 1024);
      Object.assign(key1.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });
      scene.add(key1);
      const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-4, 2, 3); scene.add(fill);
      const pt = new THREE.PointLight(0xffffff, 0.6); pt.position.set(-1.5, 4, 4); scene.add(pt);

      // Земля (только тень)
      const groundGeo = new THREE.PlaneGeometry(40, 40); groundGeo.rotateX(-Math.PI / 2);
      const groundMat = new THREE.ShadowMaterial({ opacity: 0.24 });
      const ground = new THREE.Mesh(groundGeo, groundMat); ground.receiveShadow = true;
      scene.add(ground); geos.push(groundGeo); mats.push(groundMat);

      // ── Тумбы ────────────────────────────────────────────────────────────────
      top3.forEach((entry, i) => {
        if (!entry || i > 2) return;
        const slot = SLOTS[i];

        const boxGeo = new THREE.BoxGeometry(1.7, slot.h, 1.7);
        const metalMat = new THREE.MeshStandardMaterial({
          color: ACCENT_NUM[i], metalness: 0.9, roughness: 0.2,
          envMap: envCube, envMapIntensity: 1.0,
        });
        const numBump = new THREE.CanvasTexture(makeNumberBumpCanvas(i + 1));
        const numMat = new THREE.MeshStandardMaterial({
          color: ACCENT_NUM[i], metalness: 0.9, roughness: 0.2,
          envMap: envCube, envMapIntensity: 1.0,
          bumpMap: numBump, bumpScale: 0.06,
        });
        texs.push(numBump);
        // BoxGeometry материалы: [+X,-X,+Y,-Y,+Z,-Z] → передняя грань = +Z = index 4
        const box = new THREE.Mesh(boxGeo, [metalMat, metalMat, metalMat, metalMat, numMat, metalMat]);
        box.position.set(slot.x, slot.h / 2, 0);
        box.castShadow = true; box.receiveShadow = true;
        group.add(box);
        geos.push(boxGeo); mats.push(metalMat, numMat);

        // Якорь верха тумбы — для проекции экранной позиции аватара (с учётом sway).
        const anchor = new THREE.Object3D();
        anchor.position.set(slot.x, slot.h + 0.2, 0);
        group.add(anchor);
        anchors.push({ i, anchor });
      });

      // ── Золотая аура + тёплый point-свет у тумбы #1 ──────────────────────────
      if (top3[0]) {
        const auraTex = new THREE.CanvasTexture(makeAuraCanvas()); texs.push(auraTex);
        const auraMat = new THREE.SpriteMaterial({ map: auraTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
        const aura = new THREE.Sprite(auraMat);
        aura.scale.set(5, 5, 1);
        aura.position.set(SLOTS[0].x, SLOTS[0].h * 0.65, -0.6);
        group.add(aura); mats.push(auraMat);
        const goldPt = new THREE.PointLight(0xfbbf24, 0.8, 12);
        goldPt.position.set(SLOTS[0].x, SLOTS[0].h + 1.2, 2.5);
        scene.add(goldPt);
      }

      // ── Проекция экранных позиций аватаров (вызывается каждый кадр) ───────────
      const positionAvatars = () => {
        for (const a of anchors) {
          a.anchor.getWorldPosition(tmpVec);   // учитывает текущую ротацию group
          tmpVec.project(camera);
          const sx = (tmpVec.x * 0.5 + 0.5) * curW;
          const sy = (-tmpVec.y * 0.5 + 0.5) * H;
          const el = avatarRefs.current[a.i];
          if (el) {
            el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
            el.style.opacity = '1';
          }
        }
      };
      tmp.project = positionAvatars;

      // Resize
      ro = new ResizeObserver(() => {
        if (!renderer || !mount) return;
        curW = mount.clientWidth || W;
        renderer.setSize(curW, H);
        camera.aspect = curW / H; camera.updateProjectionMatrix();
        positionAvatars();
      });
      ro.observe(mount);

      clock = new THREE.Clock();
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        group.rotation.y = Math.sin(clock.getElapsedTime() * SWAY_SPEED) * SWAY_AMP;
        renderer.render(scene, camera);
        positionAvatars();   // аватары едут вместе с качающимися тумбами
      };
      positionAvatars();     // стартовая раскладка до первого кадра
      animate();
    }).catch((e) => { console.warn('[podium3d] three load failed:', e?.message || e); if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (ro) ro.disconnect();
      geos.forEach(g => g.dispose && g.dispose());
      mats.forEach(m => m.dispose && m.dispose());
      texs.forEach(t => t.dispose && t.dispose());
      if (renderer) {
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (failed) return <>{fallbackRender ? fallbackRender() : null}</>;

  const clickable = !!onOpenPublicProfile;
  const caps = [{ e: top3[1], rank: 2 }, { e: top3[0], rank: 1 }, { e: top3[2], rank: 3 }];

  return (
    <div style={{ marginBottom: 24 }}>
      <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: H }}>
        <div ref={mountRef} style={{ width: '100%', height: H }} />

        {/* CSS-аватары поверх canvas — позиционируются проекцией каждый кадр */}
        {top3.map((e, i) => {
          if (!e || i > 2) return null;
          const accent = ACCENT_HEX[i];
          const av = i === 0 ? 76 : 60;
          const frameStyle = e.equippedFrame ? (FRAME_STYLES[e.equippedFrame] || null) : null;
          return (
            <div
              key={e.uid}
              ref={(el) => { avatarRefs.current[i] = el; }}
              onClick={() => clickable && onOpenRef.current?.(e.uid)}
              role={clickable ? 'button' : undefined}
              title={initialsOf(e)}
              style={{
                position: 'absolute', left: 0, top: 0,
                transform: 'translate(-9999px,-9999px)', opacity: 0,
                transition: 'opacity 0.25s',
                pointerEvents: 'auto', zIndex: 2,
                cursor: clickable ? 'pointer' : 'default',
                willChange: 'transform',
              }}
            >
              {i === 0 && (
                <div style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', fontSize: 18, letterSpacing: 2, lineHeight: 1, pointerEvents: 'none' }}>
                  ✨
                </div>
              )}
              {e.avatarUrl
                ? <img src={e.avatarUrl} alt="" style={{
                    width: av, height: av, borderRadius: '50%', objectFit: 'cover', display: 'block',
                    border: `3px solid ${accent}`, boxShadow: `0 0 18px ${accent}88`, ...(frameStyle || {}),
                  }} />
                : <div style={{
                    width: av, height: av, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#6366f1,#a78bfa)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: i === 0 ? 24 : 18,
                    border: `3px solid ${accent}`, boxShadow: `0 0 18px ${accent}88`, ...(frameStyle || {}),
                  }}>{initialsOf(e)}</div>}
            </div>
          );
        })}
      </div>

      {/* Подписи под canvas */}
      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        {caps.map(({ e, rank }, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            {e && (
              <>
                <div style={{ fontSize: 18 }}>{rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</div>
                <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: rank === 1 ? 15 : 13, color: THEME.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {initialsOf(e)}
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: ACCENT_HEX[rank - 1] }}>
                  {Number(e.points || 0).toLocaleString('ru-RU')} очк.
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
