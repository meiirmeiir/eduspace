// Ленивая загрузка Three.js r128 (UMD-сборка) с CDN.
// Скрипт инъектируется один раз; промис кэшируется. Резолвит window.THREE.
// При ошибке загрузки промис сбрасывается, чтобы следующий вызов мог повторить.
// r128 выбран намеренно: соответствует ограничениям (нет OrbitControls в ядре,
// нет CapsuleGeometry).

const SRC = 'https://unpkg.com/three@0.128.0/build/three.min.js';
let _promise = null;

export function loadThree() {
  if (typeof window !== 'undefined' && window.THREE) return Promise.resolve(window.THREE);
  if (_promise) return _promise;

  _promise = new Promise((resolve, reject) => {
    const fail = (msg) => { _promise = null; reject(new Error(msg)); };
    let s = document.querySelector('script[data-three-cdn]');
    if (s) {
      if (window.THREE) { resolve(window.THREE); return; }
      s.addEventListener('load', () => window.THREE ? resolve(window.THREE) : fail('THREE missing after load'));
      s.addEventListener('error', () => fail('three CDN load failed'));
      return;
    }
    s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.setAttribute('data-three-cdn', '');
    s.onload = () => window.THREE ? resolve(window.THREE) : fail('THREE missing after load');
    s.onerror = () => fail('three CDN load failed');
    document.head.appendChild(s);
  });
  return _promise;
}

// Аддоны r128 для 3D-текста: FontLoader + TextGeometry лежат в examples/js и
// цепляются к глобальному THREE классическими скриптами (в core-сборке их нет).
const FONT_LOADER_SRC = 'https://unpkg.com/three@0.128.0/examples/js/loaders/FontLoader.js';
const TEXT_GEO_SRC = 'https://unpkg.com/three@0.128.0/examples/js/geometries/TextGeometry.js';
let _textPromise = null;
const _fontCache = {};

function injectScript(src, marker) {
  return new Promise((resolve, reject) => {
    let s = document.querySelector(`script[${marker}]`);
    if (s) {
      if (s.dataset.loaded) return resolve();
      s.addEventListener('load', () => resolve());
      s.addEventListener('error', () => reject(new Error(src + ' load failed')));
      return;
    }
    s = document.createElement('script');
    s.src = src; s.async = true; s.setAttribute(marker, '');
    s.onload = () => { s.dataset.loaded = '1'; resolve(); };
    s.onerror = () => reject(new Error(src + ' load failed'));
    document.head.appendChild(s);
  });
}

// ── GLTF: загрузчик моделей + SkeletonUtils (клонирование скиннед-мешей) ──
// r128 UMD: GLTFLoader/SkeletonUtils лежат в examples/js и цепляются к
// глобальному THREE классическими скриптами (тот же паттерн, что FontLoader).
const GLTF_LOADER_SRC = 'https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js';
const SKELETON_UTILS_SRC = 'https://unpkg.com/three@0.128.0/examples/js/utils/SkeletonUtils.js';
let _gltfPromise = null;

// Гарантирует THREE + THREE.GLTFLoader (+ THREE.SkeletonUtils, если доступен —
// без него клонируем через scene.clone(true)). Промис кэшируется; при ошибке
// сбрасывается для повторной попытки.
export function loadThreeGLTF() {
  if (_gltfPromise) return _gltfPromise;
  _gltfPromise = loadThree().then(async (THREE) => {
    if (!THREE.GLTFLoader) await injectScript(GLTF_LOADER_SRC, 'data-three-gltfloader');
    if (!THREE.SkeletonUtils) {
      try { await injectScript(SKELETON_UTILS_SRC, 'data-three-skeletonutils'); }
      catch { /* не критично — будет clone(true) */ }
    }
    if (!THREE.GLTFLoader) throw new Error('THREE.GLTFLoader missing after load');
    return THREE;
  }).catch((e) => { _gltfPromise = null; throw e; });
  return _gltfPromise;
}

// Гарантирует наличие THREE + THREE.FontLoader + THREE.TextGeometry. Промис
// кэшируется; при ошибке сбрасывается для повторной попытки.
export function loadThreeText() {
  if (_textPromise) return _textPromise;
  _textPromise = loadThree().then(async (THREE) => {
    if (!THREE.FontLoader) await injectScript(FONT_LOADER_SRC, 'data-three-fontloader');
    if (!THREE.TextGeometry) await injectScript(TEXT_GEO_SRC, 'data-three-textgeo');
    if (!THREE.FontLoader || !THREE.TextGeometry) throw new Error('THREE text addons missing after load');
    return THREE;
  }).catch((e) => { _textPromise = null; throw e; });
  return _textPromise;
}

// Загружает и парсит typeface-шрифт через FontLoader. Кэш по URL.
export function loadTypeface(url) {
  if (_fontCache[url]) return Promise.resolve(_fontCache[url]);
  return loadThreeText().then((THREE) => new Promise((resolve, reject) => {
    new THREE.FontLoader().load(
      url,
      (font) => { _fontCache[url] = font; resolve(font); },
      undefined,
      (err) => reject(err || new Error('typeface load failed')),
    );
  }));
}
