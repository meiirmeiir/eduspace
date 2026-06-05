/**
 * migrate-sphere.mjs — структурная миграция:
 *   (1) sphere_and_ball: 6 класс → 11 класс (стереометрия «Фигуры в пространстве»)
 *   (2) создание узлов нового навыка sphere_basics (6 класс) в структурных коллекциях.
 * Затрагивает: dailyTasks, taskBank, globalSkillMap, skillHierarchies (kQhj2 + dqZBuSkMll3),
 * crossGradeLinks (5_6). dailyTasks/sphere_basics (банк задач) создаётся отдельным скриптом.
 *
 *   node scripts/migrate-sphere.mjs            # DRY-RUN (по коллекциям)
 *   node scripts/migrate-sphere.mjs --apply    # backup всех доков + запись
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const sa = JSON.parse(readFileSync(resolve(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const TARGET_SECTION = 'Фигуры в пространстве';
const TARGET_HIER = 'dqZBuSkMll3I1nyR1MKY';
const SRC_HIER = 'kQhj2mANpntB3G9xfsbI';
const SPHERE_PIVOT = { skill_id: 'sphere_and_ball', skill_name: 'Пространственные фигуры: шар и сфера', level: 1, prerequisites: ['sphere_basics'], impacted_skills: ["Различение понятий 'шар' (тело) и 'сфера' (поверхность)", 'Формулы объёма шара и площади поверхности сферы'] };
const BASICS_PIVOT = { skill_id: 'sphere_basics', skill_name: 'Шар и сфера: основные понятия', level: 1, prerequisites: ['circle_and_pi'], impacted_skills: ['Узнавание шара/сферы/круга/окружности', "Различение шара (тело) и сферы (поверхность)", 'Радиус и диаметр (d=2r), сечения как круг'] };

const backups = {};
const diffs = [];
function note(col, msg) { diffs.push(`[${col}] ${msg}`); }

// читаем все доки
const refs = {
  'dailyTasks/sphere_and_ball': db.collection('dailyTasks').doc('sphere_and_ball'),
  'taskBank/sphere_and_ball': db.collection('taskBank').doc('sphere_and_ball'),
  'globalSkillMap/master': db.collection('globalSkillMap').doc('master'),
  ['skillHierarchies/' + SRC_HIER]: db.collection('skillHierarchies').doc(SRC_HIER),
  ['skillHierarchies/' + TARGET_HIER]: db.collection('skillHierarchies').doc(TARGET_HIER),
  'crossGradeLinks/5_класс__6_класс': db.collection('crossGradeLinks').doc('5_класс__6_класс'),
};
const data = {};
for (const [k, ref] of Object.entries(refs)) { data[k] = (await ref.get()).data(); backups[k] = JSON.parse(JSON.stringify(data[k])); }

// (1) dailyTasks/sphere_and_ball
const dt = data['dailyTasks/sphere_and_ball'];
note('dailyTasks/sphere_and_ball', `grade "${dt.grade}"→"11 класс"; section "${dt.section}"→"${TARGET_SECTION}"`);
dt.grade = '11 класс'; dt.section = TARGET_SECTION;

// (2) taskBank/sphere_and_ball
const tb = data['taskBank/sphere_and_ball'];
note('taskBank/sphere_and_ball', `grade ${tb.grade}→11`);
tb.grade = 11;

// (3) globalSkillMap/master
const gsm = data['globalSkillMap/master'];
const old = gsm.skills.sphere_and_ball;
note('globalSkillMap', `sphere_and_ball: grade "${old.grade}"→"11 класс", section→"${TARGET_SECTION}", cluster_name→"Шар и сфера"`);
old.grade = '11 класс'; old.section = TARGET_SECTION; old.cluster_name = 'Шар и сфера';
gsm.skills.sphere_basics = { skill_id: 'sphere_basics', skill_name: 'Шар и сфера: основные понятия', level: 1, grade: '6 класс', section: 'Отношения и пропорции', cluster_name: 'Геометрические фигуры', vertical_line_id: 'GEOMETRY', prerequisites: [], impacted_skills: ['Узнавание шара/сферы/круга', 'Радиус и диаметр шара'] };
note('globalSkillMap', `+ новый навык sphere_basics (6 класс, Отношения и пропорции/Геометрические фигуры)`);

// (4) skillHierarchies SRC (kQhj2): убрать sphere_and_ball из cluster[5], добавить sphere_basics
const src = data['skillHierarchies/' + SRC_HIER];
const c5 = src.clusters[5];
c5.pivot_skills = c5.pivot_skills.filter((s) => s.skill_id !== 'sphere_and_ball');
c5.pivot_skills.push(BASICS_PIVOT);
note('skillHierarchies/' + SRC_HIER, `cluster[5] "${c5.cluster_name}": − sphere_and_ball, + sphere_basics (ids: ${c5.pivot_skills.map((s) => s.skill_id).join(',')})`);

// (5) skillHierarchies TARGET (dqZBuSkMll3): добавить кластер «Шар и сфера»
const tgt = data['skillHierarchies/' + TARGET_HIER];
tgt.clusters.push({ cluster_name: 'Шар и сфера', vertical_line_id: 'GEOMETRY', pivot_skills: [SPHERE_PIVOT] });
note('skillHierarchies/' + TARGET_HIER, `+ кластер "Шар и сфера" с sphere_and_ball (clusters: ${tgt.clusters.map((c) => c.cluster_name).join(', ')})`);

// (6) crossGradeLinks 5_6: в 6-кл модуле заменить sphere_and_ball → sphere_basics
const cgl = data['crossGradeLinks/5_класс__6_класс'];
const m6 = cgl.grade_modules['6 класс'];
const arr = Array.isArray(m6) ? m6 : [m6];
for (const m of arr) if (Array.isArray(m.pivot_skills) && m.pivot_skills.includes('sphere_and_ball')) {
  m.pivot_skills = m.pivot_skills.map((s) => (s === 'sphere_and_ball' ? 'sphere_basics' : s));
  note('crossGradeLinks/5_6', `модуль "${m.module_name}": sphere_and_ball → sphere_basics`);
}
note('crossGradeLinks', 'ПРОБЕЛ: в 11-классовой цепочке нет гео-модуля → sphere_and_ball НЕ добавляется в crossGradeLinks 11 (его 11-кл размещение обеспечивают skillHierarchies/dqZBuSkMll3 + grade-поля).');

console.log(`\n${APPLY ? '🟠 APPLY' : '🔵 DRY-RUN'} · миграция sphere\n`);
diffs.forEach((d) => console.log('  • ' + d));

if (!APPLY) { console.log('\n🔵 DRY-RUN: ничего не записано.\n'); process.exit(0); }
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bk = resolve(__dirname, `../migration/backups/${ts}-sphere-migration`);
mkdirSync(bk, { recursive: true });
writeFileSync(join(bk, 'before.json'), JSON.stringify(backups, null, 2), 'utf8');
console.log(`\n💾 Backup (все 6 доков) → migration/backups/${ts}-sphere-migration/before.json`);
for (const [k, ref] of Object.entries(refs)) { await ref.set(data[k]); console.log('  ✅ записан ' + k); }
console.log('\n✅ Миграция применена.\n');
