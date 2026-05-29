import React, { useEffect, useRef, useState } from 'react';
import { loadThree } from '../lib/loadThree.js';
import PixelBoss from './PixelBoss.jsx';

// 3D-боссы (Three.js r128) в космо-стиле, единые с Lego-персонажем. 5 типов:
// ufo / robot / slime / dragon / asteroid — из примитивов, металлик + emissive.
// Совместимый с PixelBoss интерфейс: props { type, hpPct, shake }. Idle-анимация
// (спин/скан/сквош/волна/кувырок), shake при уроне, затемнение при низком HP.
// Один WebGL-контекст, полный cleanup. При сбое Three.js → PixelBoss (фолбэк).

export const BOSS3D_TYPES = ['ufo', 'robot', 'slime', 'dragon', 'asteroid'];

function makeEnvCube(THREE) {
  const faces = [];
  for (let i = 0; i < 6; i++) {
    const S = 64;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#cdd8f0'); g.addColorStop(0.5, '#6b7aa0'); g.addColorStop(1, '#222a40');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    faces.push(c);
  }
  const tex = new THREE.CubeTexture(faces); tex.needsUpdate = true; return tex;
}

export default function Boss3D({ type = 'ufo', hpPct = 100, shake = false, height = 150 }) {
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const hpRef = useRef(hpPct); hpRef.current = hpPct;
  const shakeRef = useRef(shake); shakeRef.current = shake;

  useEffect(() => {
    let renderer, scene, camera, frameId, clock, ro;
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;
    const geos = [], mats = [], texs = [];
    const dmgMats = []; // материалы с baseColor/baseEmis для затемнения по HP

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      let W = mount.clientWidth || 180;

      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
      catch (e) { if (!cancelled) setFailed(true); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, height);
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(40, W / height, 0.1, 100);
      camera.position.set(0, 0.4, 5);
      camera.lookAt(0, 0, 0);

      const env = makeEnvCube(THREE); texs.push(env);
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const keyL = new THREE.DirectionalLight(0xffffff, 1.0); keyL.position.set(3, 5, 6); scene.add(keyL);
      const fill = new THREE.DirectionalLight(0x9bd0ff, 0.4); fill.position.set(-4, 1, 3); scene.add(fill);

      const bossGroup = new THREE.Group(); scene.add(bossGroup);

      // материал с регистрацией базовых цветов (для damage-dim)
      const M = (color, o = {}) => {
        const m = new THREE.MeshStandardMaterial({
          color, metalness: o.metal ?? 0.5, roughness: o.rough ?? 0.4,
          envMap: o.flat ? null : env, envMapIntensity: o.flat ? 0 : 0.8,
          emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissive ? (o.ei ?? 0.6) : 0,
          flatShading: !!o.flat, transparent: !!o.transparent, opacity: o.opacity ?? 1,
        });
        m.userData.baseColor = m.color.clone();
        m.userData.baseEmis = m.emissiveIntensity;
        m.userData.isEmis = !!o.emissive;
        mats.push(m); dmgMats.push(m); return m;
      };
      const add = (geo, mat, x = 0, y = 0, z = 0) => { geos.push(geo); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); bossGroup.add(m); return m; };

      let tick = () => {};

      // ── Сборка по типу ──
      if (type === 'robot') {
        const body = add(new THREE.BoxGeometry(1.2, 1.3, 0.7), M(0x556070, { metal: 0.85, rough: 0.3 }), 0, -0.1, 0);
        add(new THREE.BoxGeometry(0.74, 0.52, 0.62), M(0x44506a, { metal: 0.85, rough: 0.3 }), 0, 0.78, 0);
        const eye = add(new THREE.BoxGeometry(0.5, 0.13, 0.1), M(0x0b1220, { emissive: 0x22d3ee, ei: 0.95, metal: 0.6 }), 0, 0.8, 0.32);
        const cannonGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.8, 16); cannonGeo.rotateX(Math.PI / 2);
        [-0.85, 0.85].forEach((x) => { add(cannonGeo, M(0x3a4458, { metal: 0.9, rough: 0.25 }), x, 0, 0.2); add(new THREE.SphereGeometry(0.13, 12, 12), M(0x0b1220, { emissive: 0xf97316, ei: 0.8 }), x, 0, 0.62); });
        tick = (t) => { eye.position.x = Math.sin(t * 2.2) * 0.13; };
      } else if (type === 'slime') {
        const body = add(new THREE.SphereGeometry(1.1, 24, 20), M(0x22c55e, { emissive: 0x0f5132, ei: 0.3, rough: 0.35, metal: 0.1 }), 0, -0.1, 0);
        [-0.34, 0.34].forEach((x) => { add(new THREE.SphereGeometry(0.2, 14, 14), M(0xffffff, { emissive: 0x335544, ei: 0.2, rough: 0.2 }), x, 0.15, 0.92); add(new THREE.SphereGeometry(0.09, 10, 10), M(0x0a0f0a), x, 0.15, 1.06); });
        tick = (t) => { const s = 1 + 0.08 * Math.sin(t * 2.6); body.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s)); };
      } else if (type === 'dragon') {
        add(new THREE.BoxGeometry(0.7, 0.6, 0.7), M(0x3a2a55, { metal: 0.4, rough: 0.5 }), 0, 0.3, 0.1);
        const snout = new THREE.ConeGeometry(0.32, 0.6, 12); snout.rotateX(Math.PI / 2);
        add(snout, M(0x4a3a66, { metal: 0.4 }), 0, 0.2, 0.6);
        [-0.22, 0.22].forEach((x) => { const horn = new THREE.ConeGeometry(0.08, 0.34, 8); add(horn, M(0xc9b9e6, { metal: 0.3 }), x, 0.66, 0); add(new THREE.SphereGeometry(0.075, 10, 10), M(0xff5a2b, { emissive: 0xff5a2b, ei: 0.9 }), x, 0.32, 0.42); });
        const segs = [];
        [[0, -0.4, -0.5, 0.5], [-0.15, -0.7, -1.0, 0.4], [-0.25, -0.95, -1.5, 0.3]].forEach(([x, y, z, r]) => segs.push(add(new THREE.SphereGeometry(r, 16, 14), M(0x4a3a66, { metal: 0.4, rough: 0.5 }), x, y, z)));
        tick = (t) => { segs.forEach((sg, i) => { sg.position.x = (i + 1) * 0.12 * Math.sin(t * 2 + i * 0.9); }); };
      } else if (type === 'asteroid') {
        const rock = add(new THREE.IcosahedronGeometry(1.15, 0), M(0x5a5048, { flat: true, rough: 0.95, metal: 0.1 }), 0, 0, 0);
        const cryGeo = new THREE.OctahedronGeometry(0.22);
        [[0.7, 0.5, 0.5, 0x22d3ee], [-0.6, 0.3, 0.7, 0xa855f7], [0.2, -0.6, 0.8, 0x22d3ee], [-0.4, -0.4, 0.6, 0xf6a93b]].forEach(([x, y, z, c]) => add(cryGeo, M(c, { emissive: c, ei: 0.85, rough: 0.2 }), x, y, z));
        [-0.28, 0.3].forEach((x) => add(new THREE.SphereGeometry(0.11, 12, 12), M(0xf6a93b, { emissive: 0xf6a93b, ei: 0.9 }), x, 0.12, 0.92));
        tick = (t) => { rock.rotation.y = t * 0.35; rock.rotation.x = Math.sin(t * 0.4) * 0.2; };
      } else { // ufo
        const disc = add(new THREE.SphereGeometry(1.15, 28, 16), M(0x8893a8, { metal: 0.92, rough: 0.22 }), 0, 0, 0); disc.scale.set(1, 0.32, 1);
        const ringGeo = new THREE.TorusGeometry(1.12, 0.06, 10, 32); ringGeo.rotateX(Math.PI / 2);
        add(ringGeo, M(0x0b1220, { emissive: 0x22d3ee, ei: 0.8 }), 0, 0, 0);
        const dome = add(new THREE.SphereGeometry(0.55, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2), M(0x6fc9f0, { emissive: 0x3a7bd5, ei: 0.45, metal: 0.3, rough: 0.15, transparent: true, opacity: 0.92 }), 0, 0.18, 0);
        const lights = [];
        const N = 8;
        for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; lights.push({ m: add(new THREE.SphereGeometry(0.08, 10, 10), M(0x22d3ee, { emissive: 0x22d3ee, ei: 0.9 }), Math.cos(a) * 1.08, 0, Math.sin(a) * 1.08), p: a }); }
        tick = (t) => { disc.rotation.y = t * 0.6; lights.forEach((l, i) => { l.m.material.emissiveIntensity = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 3 + l.p * 2)); }); };
      }

      ro = new ResizeObserver(() => { if (!renderer || !mount) return; W = mount.clientWidth || W; renderer.setSize(W, height); camera.aspect = W / height; camera.updateProjectionMatrix(); });
      ro.observe(mount);

      clock = new THREE.Clock(); let last = 0;
      const animate = () => {
        frameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime(); const dt = Math.min(t - last, 0.05); last = t;
        tick(t, dt);
        // idle bob + shake
        bossGroup.position.y = Math.sin(t * 1.3) * 0.05;
        if (shakeRef.current) { bossGroup.position.x = Math.sin(t * 60) * 0.08; bossGroup.rotation.z = Math.sin(t * 55) * 0.05; }
        else { bossGroup.position.x += (0 - bossGroup.position.x) * 0.3; bossGroup.rotation.z += (0 - bossGroup.rotation.z) * 0.3; }
        // damage-dim по HP + тревожный пульс emissive при низком HP
        const hp = hpRef.current;
        const dim = hp < 25 ? 0.55 : hp < 50 ? 0.78 : 1;
        const lowPulse = hp < 25 ? (0.6 + 0.4 * Math.sin(t * 8)) : 1;
        for (const m of dmgMats) {
          m.color.copy(m.userData.baseColor).multiplyScalar(dim);
          if (m.userData.isEmis && type !== 'ufo') m.emissiveIntensity = m.userData.baseEmis * lowPulse;
        }
        renderer.render(scene, camera);
      };
      animate();
    }).catch((e) => { console.warn('[boss3d] three load failed:', e?.message || e); if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (ro) ro.disconnect();
      geos.forEach((g) => g.dispose && g.dispose());
      mats.forEach((m) => m.dispose && m.dispose());
      texs.forEach((t) => t.dispose && t.dispose());
      if (renderer) {
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, height]);

  if (failed) {
    const legacy = (type === 'slime' || type === 'ufo') ? 'topic' : 'chapter';
    return <PixelBoss type={legacy} hpPct={hpPct} shake={shake} />;
  }
  return <div ref={mountRef} style={{ width: '100%', height }} />;
}
