import React, { useEffect, useRef, useState } from 'react';
import { loadThree } from '../lib/loadThree.js';
import { useTheme } from '../ThemeContext.jsx';

// 3D-подиум топ-3. top3 = [#1, #2, #3] (rank-порядок, до 3). Тумбы вращаются
// группой, аватар-диски billboard (контр-вращение → лицо к камере). Клик по
// аватару → onOpenPublicProfile(uid). При сбое Three.js → fallbackRender().

const ACCENT_HEX = ['#fbbf24', '#94a3b8', '#b45309'];   // rank 1/2/3
const ACCENT_NUM = [0xfbbf24, 0x94a3b8, 0xb45309];
const initialsOf = (e) => ((e?.firstName?.[0] || '') + (e?.lastName?.[0] || '')).toUpperCase() || '?';

function makeInitialsCanvas(entry, hex) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, '#6366f1'); g.addColorStop(1, '#a78bfa');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#fff';
  ctx.font = "800 120px 'Montserrat', sans-serif";
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(initialsOf(entry), S / 2, S / 2 + 8);
  return c;
}
function makeNumberCanvas(rank, hex) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = hex; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#fff';
  ctx.font = "800 150px 'Montserrat', sans-serif";
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('#' + rank, S / 2, S / 2 + 10);
  return c;
}

export default function Podium3D({ top3 = [], onOpenPublicProfile, fallbackRender }) {
  const { theme: THEME } = useTheme();
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);

  // onOpenPublicProfile через ref — чтобы не пересобирать сцену при смене ссылки.
  const onOpenRef = useRef(onOpenPublicProfile);
  onOpenRef.current = onOpenPublicProfile;

  // Стабильный ключ: пересоздаём сцену только при смене состава топ-3.
  const key = top3.map(e => (e ? `${e.uid}:${e.points}:${e.avatarUrl ? 1 : 0}` : 'x')).join('|');

  useEffect(() => {
    if (!key) return;
    let renderer, scene, camera, group, frameId, ro, canvas, cleanupListeners;
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;
    const geos = [], mats = [], texs = [], avatarMeshes = [];
    const SLOTS = [{ x: 0, h: 2.2 }, { x: -2.4, h: 1.5 }, { x: 2.4, h: 1.0 }]; // #1 центр, #2 лево, #3 право
    const H = 360;

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      const W = mount.clientWidth || 600;

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, H);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      canvas = renderer.domElement;
      canvas.style.touchAction = 'none';
      mount.appendChild(canvas);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
      camera.position.set(0, 3.6, 7.5);
      camera.lookAt(0, 1.0, 0);

      group = new THREE.Group();
      scene.add(group);

      // Свет
      scene.add(new THREE.AmbientLight(0xffffff, 0.65));
      const dir = new THREE.DirectionalLight(0xffffff, 0.95);
      dir.position.set(4, 8, 6);
      dir.castShadow = true;
      dir.shadow.mapSize.set(1024, 1024);
      Object.assign(dir.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });
      scene.add(dir);

      // Земля (только тень)
      const groundGeo = new THREE.PlaneGeometry(40, 40); groundGeo.rotateX(-Math.PI / 2);
      const groundMat = new THREE.ShadowMaterial({ opacity: 0.22 });
      const ground = new THREE.Mesh(groundGeo, groundMat); ground.receiveShadow = true;
      scene.add(ground); geos.push(groundGeo); mats.push(groundMat);

      // Тумбы + аватары
      top3.forEach((entry, i) => {
        if (!entry || i > 2) return;
        const slot = SLOTS[i], rank = i + 1, hex = ACCENT_HEX[i];

        const boxGeo = new THREE.BoxGeometry(1.7, slot.h, 1.7);
        const metalMat = new THREE.MeshStandardMaterial({ color: ACCENT_NUM[i], metalness: 0.5, roughness: 0.4 });
        const numTex = new THREE.CanvasTexture(makeNumberCanvas(rank, hex));
        const numMat = new THREE.MeshStandardMaterial({ map: numTex, metalness: 0.3, roughness: 0.55 });
        // BoxGeometry материалы: [+X,-X,+Y,-Y,+Z,-Z] → передняя грань = +Z = index 4
        const box = new THREE.Mesh(boxGeo, [metalMat, metalMat, metalMat, metalMat, numMat, metalMat]);
        box.position.set(slot.x, slot.h / 2, 0);
        box.castShadow = true; box.receiveShadow = true;
        group.add(box);
        geos.push(boxGeo); mats.push(metalMat, numMat); texs.push(numTex);

        const discGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.14, 48); discGeo.rotateX(Math.PI / 2);
        const ringMat = new THREE.MeshStandardMaterial({ color: ACCENT_NUM[i], metalness: 0.6, roughness: 0.35 });
        const faceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.7 });
        const initTex = new THREE.CanvasTexture(makeInitialsCanvas(entry, hex));
        faceMat.map = initTex; faceMat.needsUpdate = true;
        texs.push(initTex);
        if (entry.avatarUrl) {
          const loader = new THREE.TextureLoader();
          loader.setCrossOrigin('anonymous');
          loader.load(entry.avatarUrl, (tex) => {
            if (cancelled) { tex.dispose(); return; }
            faceMat.map = tex; faceMat.needsUpdate = true; texs.push(tex);
          }, undefined, () => { /* ошибка/CORS → остаются инициалы */ });
        }
        const disc = new THREE.Mesh(discGeo, [ringMat, faceMat, faceMat]);
        disc.position.set(slot.x, slot.h + 0.75, 0);
        disc.castShadow = true;
        disc.userData.uid = entry.uid;
        group.add(disc); avatarMeshes.push(disc);
        geos.push(discGeo); mats.push(ringMat, faceMat);
      });

      // Raycasting (клик/ховер по аватарам)
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const pick = (e) => {
        const r = canvas.getBoundingClientRect();
        ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(avatarMeshes, false);
        return hits.length ? hits[0].object : null;
      };
      const onMove = (e) => { canvas.style.cursor = pick(e) ? 'pointer' : 'default'; };
      const onClick = (e) => { const o = pick(e); if (o && o.userData.uid) onOpenRef.current?.(o.userData.uid); };
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('click', onClick);
      cleanupListeners = () => { canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('click', onClick); };

      // Resize
      ro = new ResizeObserver(() => {
        if (!renderer || !mount) return;
        const w = mount.clientWidth || W;
        renderer.setSize(w, H);
        camera.aspect = w / H; camera.updateProjectionMatrix();
      });
      ro.observe(mount);

      const animate = () => {
        frameId = requestAnimationFrame(animate);
        group.rotation.y += 0.005;
        for (const a of avatarMeshes) a.rotation.y = -group.rotation.y; // billboard
        renderer.render(scene, camera);
      };
      animate();
    }).catch((e) => { console.warn('[podium3d] three load failed:', e?.message || e); if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (cleanupListeners) cleanupListeners();
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

  const caps = [{ e: top3[1], rank: 2 }, { e: top3[0], rank: 1 }, { e: top3[2], rank: 3 }];
  return (
    <div style={{ marginBottom: 24 }}>
      <div ref={mountRef} style={{ width: '100%', height: 360 }} />
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
