import React, { useEffect, useRef } from 'react';
import { loadThree } from '../lib/loadThree.js';

// 3D-взрыв частиц из центра (кубики). 3 InstancedMesh по цвету (тир + золото +
// белый) — r128 без instanceColor, цвет задаётся материалом группы. Физика:
// разлёт наружу + гравитация + вращение + затухание. При сбое Three → onFail().
const PER_GROUP = 40;          // 3 группы → ~120 частиц
const GRAVITY = 9;
const FADE_START = 1.6;        // c
const FADE_DUR = 1.0;          // c
const LIFETIME = 2.8;          // c — после этого rAF останавливается

export default function ParticleBurst3D({ color = '#fbbf24', onFail }) {
  const mountRef = useRef(null);
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  useEffect(() => {
    let renderer, scene, camera, frameId, boxGeo, clock;
    const mats = [], meshes = [];
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount) return;

    const onResize = () => {
      if (!renderer || !camera || !mount) return;
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };

    loadThree().then((THREE) => {
      if (cancelled || !mount) return;
      const W = mount.clientWidth || 600, H = mount.clientHeight || 400;

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, H);
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
      camera.position.set(0, 0, 12);

      boxGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const colors = [color, '#fbbf24', '#ffffff'];
      const dummy = new THREE.Object3D();

      const randDir = () => {
        const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
        return new THREE.Vector3(s * Math.cos(t), s * Math.sin(t), u);
      };

      const groups = colors.map((hex) => {
        const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity: 1, depthWrite: false });
        const mesh = new THREE.InstancedMesh(boxGeo, mat, PER_GROUP);
        const parts = [];
        for (let i = 0; i < PER_GROUP; i++) {
          parts.push({
            pos: new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5),
            vel: randDir().multiplyScalar(3 + Math.random() * 6).add(new THREE.Vector3(0, 2, 0)), // лёгкий апворд-bias
            rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
            angVel: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10),
            scale: 0.7 + Math.random() * 0.7,
          });
        }
        scene.add(mesh);
        mats.push(mat); meshes.push(mesh);
        return { mesh, mat, parts };
      });

      clock = new THREE.Clock();
      let elapsed = 0;
      const animate = () => {
        const dt = Math.min(clock.getDelta(), 0.05);
        elapsed += dt;
        const fade = elapsed < FADE_START ? 1 : Math.max(0, 1 - (elapsed - FADE_START) / FADE_DUR);
        for (const g of groups) {
          for (let i = 0; i < g.parts.length; i++) {
            const p = g.parts[i];
            p.vel.y -= GRAVITY * dt;
            p.pos.addScaledVector(p.vel, dt);
            p.rot.x += p.angVel.x * dt; p.rot.y += p.angVel.y * dt; p.rot.z += p.angVel.z * dt;
            dummy.position.copy(p.pos);
            dummy.rotation.copy(p.rot);
            dummy.scale.setScalar(p.scale);
            dummy.updateMatrix();
            g.mesh.setMatrixAt(i, dummy.matrix);
          }
          g.mesh.instanceMatrix.needsUpdate = true;
          g.mat.opacity = fade;
        }
        renderer.render(scene, camera);
        if (elapsed < LIFETIME && !cancelled) frameId = requestAnimationFrame(animate);
      };
      animate();
      window.addEventListener('resize', onResize);
    }).catch((e) => {
      console.warn('[particleburst3d] three load failed:', e?.message || e);
      if (!cancelled) onFailRef.current?.();
    });

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      if (boxGeo) boxGeo.dispose();
      mats.forEach((m) => m.dispose && m.dispose());
      if (renderer) {
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }} />;
}
