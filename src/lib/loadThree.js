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
