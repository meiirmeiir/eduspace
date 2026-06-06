/**
 * record-demos.mjs — записывает маркетинговые демо-ролики прод-платформы (Playwright).
 * Портрет 9:16 (720x1280) для Reels/TikTok, dark mode, под тест-учеником.
 * Persistent context (userDataDir) хранит Firebase-сессию → логин один раз.
 *   node scripts/record-demos.mjs login            # войти и сохранить сессию
 *   node scripts/record-demos.mjs <clip>           # записать один ролик
 *   node scripts/record-demos.mjs all              # все ролики
 *   clips: diagnostic | skill-map | solve-task | leaderboard | progress
 * webm (Playwright) → mp4 (ffmpeg libx264), обрезка до целевой длительности.
 */
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, renameSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (p) => resolve(__dirname, '..', p);
const BASE = 'https://eduspace-murex.vercel.app/';
const STUDENT = { email: 'meirbekbazarbek+student@gmail.com', password: 'TestStudent2026' };
const VW = 720, VH = 1280;
const USER_DATA = R('.rec-profile');
const RAW = R('_rec-raw');
const OUT = R('assets/marketing/videos');
const FF = 'C:\\Users\\hp\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
for (const d of [USER_DATA, RAW, OUT]) mkdirSync(d, { recursive: true });

const STUDENT_UID = 'bsZhaekYhxODSY9Xanxvh3WutIQ2';
// ВАЖНО: строка-IIFE, не стрелочная функция. Playwright строку в addInitScript/
// evaluate выполняет «как есть»: выражение `() => {}` вычисляется в функцию,
// но НЕ вызывается — из-за этого тема/NPC-флаги раньше не применялись.
const INIT = `(() => { try {
  localStorage.setItem('theme','dark');
  document.documentElement.setAttribute('data-theme','dark'); // main.jsx иногда не успевает подхватить ls → ставим атрибут явно
  var seen = {dashboard:true,plan:true,tasks:true,daily:true,leaderboard:true,rating:true,theory:true,profile:true,diagnostic:true,diagnostics:true,shop:true,map:true,homework:true,practice:true};
  localStorage.setItem('aapa_npc_seen_tours_${STUDENT_UID}', JSON.stringify(seen));
  localStorage.setItem('aapa_npc_greeted_${STUDENT_UID}', '1');
} catch(e){} })()`;
const sleep = (ms) => new Promise((f) => setTimeout(f, ms));

async function launch(record) {
  const ctx = await chromium.launchPersistentContext(USER_DATA, {
    headless: false,
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 1,
    recordVideo: record ? { dir: RAW, size: { width: VW, height: VH } } : undefined,
    // SwiftShader (программный WebGL): аппаратный canvas выпадает из screencast чёрным,
    // софт-рендер композитится в захватываемый кадр → 3D (подиум/карта/корабль) виден в видео.
    args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing'],
  });
  await ctx.addInitScript(INIT);
  return ctx;
}

async function dismissTour(page) {
  for (let i = 0; i < 4; i++) {
    const btn = page.getByRole('button', { name: /Пропустить|^\[X\]$|Закрыть/ }).first();
    if (await btn.isVisible().catch(() => false)) { await btn.click().catch(() => {}); await sleep(350); }
    else break;
  }
}

async function isLoggedIn(page) {
  // дашборд содержит нижнюю навигацию «Главная»
  return await page.getByRole('button', { name: /Главная/ }).first().isVisible().catch(() => false);
}

async function doLogin() {
  const ctx = await launch(false);
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  if (await isLoggedIn(page)) { console.log('уже залогинен'); await ctx.close(); return; }
  // новый лендинг (2df5b18+): форма логина открывается кнопкой «Войти» в шапке
  const loginBtn = page.getByRole('button', { name: /^Войти$/ }).first();
  if (await loginBtn.isVisible().catch(() => false)) { await loginBtn.click().catch(() => {}); await sleep(1500); }
  // логин-форма: поля по позиции (0=email, 1=пароль) — устойчивее к лейблам
  const boxes = page.getByRole('textbox');
  await boxes.nth(0).click(); await boxes.nth(0).fill(STUDENT.email);
  await boxes.nth(1).click(); await boxes.nth(1).fill(STUDENT.password);
  await sleep(400);
  await boxes.nth(1).press('Enter'); // клик по кнопке не сабмитит — submit формы работает
  let ok = false;
  for (let i = 0; i < 25; i++) { await sleep(1000); if (await isLoggedIn(page)) { ok = true; break; } }
  console.log(ok ? '✅ вошли, сессия сохранена' : '⚠️ логин не подтверждён');
  await ctx.close();
}

function nav(page, name) { return page.getByRole('button', { name }).first().click(); }

// ── флоу роликов ──────────────────────────────────────────────────────────────
const CLIPS = {
  'leaderboard': { sec: 15, fn: async (page) => {
    await nav(page, /🏆 Рейтинг|Рейтинг/); await sleep(3500);
    await dismissTour(page); // НПС-гид рейтинга вылезает после перехода
    // плавная прокрутка подиума/таблицы
    for (let y = 0; y < 4; y++) { await page.mouse.wheel(0, 220); await sleep(1200); }
    await page.mouse.wheel(0, -880); await sleep(2000);
  } },
  'skill-map': { sec: 15, fn: async (page) => {
    await nav(page, /🗺️ План|План/);
    // SwiftShader медленный — ждём, пока «Загрузка карты...» уйдёт (до 18с)
    await page.getByText(/Загрузка карты/).waitFor({ state: 'hidden', timeout: 18000 }).catch(() => {});
    await sleep(3500);
    for (let y = 0; y < 5; y++) { await page.mouse.wheel(0, 170); await sleep(1500); }
  } },
  'solve-task': { sec: 20, fn: async (page) => {
    await nav(page, /📝 Задачи|Задачи/); await sleep(3500);
    await dismissTour(page);
    // попытка начать решение: кнопки старта (Начать/Решать/Продолжить)
    const start = page.getByRole('button', { name: /Начать|Решать|Продолжить|Тренировка|Поехали/ }).first();
    if (await start.isVisible().catch(() => false)) { await start.click().catch(() => {}); await sleep(3000); }
    await sleep(8000);
  } },
  'diagnostic': { sec: 30, fn: async (page) => {
    // запуск: дашборд → карточка «Пройди Умную Диагностику» (Начать →) → правила → Начать диагностику →
    const startBtn = page.getByRole('button', { name: /^Начать →$/ }).first();
    await startBtn.waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
    await startBtn.click({ force: true, timeout: 5000 }).catch(() => {}); // 🎯-эмодзи перехватывает pointer → force
    await sleep(2800);
    const b2 = page.getByRole('button', { name: /Начать диагностику/ }).first();
    await b2.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    await b2.click({ force: true, timeout: 5000 }).catch(() => {});
    // ждём появления первого вопроса
    await page.locator('.options-grid .option-card').first().waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
    await sleep(1500);
    // таймлапс: вариант (.option-card) → уверенность (😊/🔥) → Следующий вопрос
    const conf = [/🔥 100%|100%/, /😊 Уверен|Уверен/, /😐 Норм|Норм/];
    for (let q = 0; q < 8; q++) {
      const opts = page.locator('.options-grid .option-card');
      const n = await opts.count().catch(() => 0);
      if (n === 0) break; // диагностика не на экране вопроса — не виснем на таймаутах
      await opts.nth(q % n).click({ force: true, timeout: 4000 }).catch(() => {});
      await sleep(650);
      await page.getByRole('button', { name: conf[q % conf.length] }).first().click({ timeout: 4000 }).catch(() => {});
      await sleep(650);
      const next = page.getByRole('button', { name: /Следующий вопрос/ }).first();
      if (await next.isEnabled().catch(() => false)) await next.click({ timeout: 4000 }).catch(() => {});
      await sleep(1350);
    }
  } },
  'progress': { sec: 15, fn: async (page) => {
    await nav(page, /🏠 Главная|Главная/); await sleep(3500);
    // прокрутка к 3D-кораблю прогресса
    for (let y = 0; y < 4; y++) { await page.mouse.wheel(0, 180); await sleep(1500); }
    await sleep(3000);
  } },
};

function newestWebm() {
  const files = readdirSync(RAW).filter((f) => f.endsWith('.webm')).map((f) => ({ f, t: statSync(join(RAW, f)).mtimeMs }));
  files.sort((a, b) => b.t - a.t);
  return files[0] ? join(RAW, files[0].f) : null;
}

function toMp4(webm, name, sec) {
  const out = join(OUT, `${name}.mp4`);
  execFileSync(FF, ['-y', '-i', webm, '-t', String(sec),
    '-vf', `scale=${VW}:${VH}:force_original_aspect_ratio=decrease,pad=${VW}:${VH}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', '-an', out], { stdio: 'pipe' });
  return out;
}

async function recordClip(name) {
  const spec = CLIPS[name];
  if (!spec) throw new Error('неизвестный ролик: ' + name);
  // очистить старые webm чтобы newestWebm был точным
  for (const f of readdirSync(RAW)) if (f.endsWith('.webm')) rmSync(join(RAW, f));
  const ctx = await launch(true);
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  let logged = false;
  for (let i = 0; i < 12; i++) { await sleep(1000); if (await isLoggedIn(page)) { logged = true; break; } }
  await dismissTour(page);
  if (!logged) { console.log('⚠️ не залогинен — запусти `login`'); await ctx.close(); return; }
  // страховка: addInitScript на persistent-контексте иногда не отрабатывает
  // (light-тема и НПС в записи) → ставим тему/seen-флаги явно и перезагружаем.
  await page.evaluate(INIT);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(3000);
  await dismissTour(page);
  await sleep(800);
  await spec.fn(page);
  await sleep(800);
  await ctx.close(); // сохраняет webm
  await sleep(1200);
  const webm = newestWebm();
  if (!webm) { console.log('⚠️ webm не найден для', name); return; }
  const mp4 = toMp4(webm, name, spec.sec);
  const kb = Math.round(statSync(mp4).size / 1024);
  console.log(`✅ ${name}.mp4 (${spec.sec}s, ${kb} KB) ← ${webm.split(/[\\/]/).pop()}`);
}

const arg = process.argv[2];
if (arg === 'login') { await doLogin(); }
else if (arg === 'all') { for (const k of Object.keys(CLIPS)) { console.log('\n▶', k); await recordClip(k); } }
else if (CLIPS[arg]) { await recordClip(arg); }
else { console.log('usage: login | all | ' + Object.keys(CLIPS).join(' | ')); }
process.exit(0);
