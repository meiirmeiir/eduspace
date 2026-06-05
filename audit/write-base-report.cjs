const fs = require('fs');
const f = 'C:/Users/hp/AppData/Local/Temp/claude/C--Users-hp-Desktop-eduspace-main/690d489d-9b13-40e3-9aec-99f896a438cc/tasks/wq46oki5x.output';
const r = JSON.parse(fs.readFileSync(f, 'utf8')).result;
fs.writeFileSync('audit/_st_base_audit.json', JSON.stringify(r, null, 1));
const all = JSON.parse(fs.readFileSync('audit/_base_cases.json', 'utf8'));
const byIdx = new Map(all.map((c) => [c.idx, c]));
const norm = (s) => String(s == null ? '' : s).replace(/\$/g, '').replace(/\\dfrac/g, 'frac').replace(/\\frac/g, 'frac').replace(/[\s{}]/g, '').toLowerCase();
let keyFixable = 0, rewrite = 0;
for (const p of r.problems) {
  const c = byIdx.get(p.idx);
  if (!c) continue;
  if (p.kind === 'no_correct') { rewrite++; continue; }
  const opts = (c.options || []).map(norm); const sv = norm(p.solved);
  if (sv && opts.some((o) => o && (o === sv || o.includes(sv) || sv.includes(o)))) keyFixable++; else rewrite++;
}
const bk = r.stats.byKind;
const md = ['# Логик-аудит 207 базовых банков skillTasks (маркер-триаж)', '',
  `**Метод.** Маркер-триаж explanation (ой ошибка / перепроверим / опечатка / сдвинуто / исправим / пусть будет / пересчёт / Подожди / Стоп) в a/b/c всех **207** ранее непроверенных банков → **${all.length}** подозрительных задач в **50** банках → Workflow (14 агентов решают каждую и сверяют с correct/explanation). Read-only.`, '',
  `## Итог: ${r.stats.checked} маркер-задач → **${r.stats.problems} реальных проблем** (${r.stats.ok} ok = ложные маркеры)`, '',
  `- ошибки ключа: **${bk.key_error || 0}** · нет верного: **${bk.no_correct || 0}** · противоречие explanation: **${bk.expl_contradiction || 0}**`,
  `- оценка чинимости: ключ-фикс (re-point correct из решённого) ≈ **${keyFixable}** · нужен rewrite/ручная ≈ **${rewrite}**`, '',
  `Маркер-триаж показал высокую точность (**${r.stats.problems}/${r.stats.checked}**) — фразы саморедактирования надёжно указывают на сломанный ключ/ответ. Расширять до случайных 30 банков не потребовалось.`, '',
  '## Все находки', '', '| Банк | Ур | # | Вид | Решено | corr | Заметка |', '|---|--|--|---|---|--|---|'];
for (const p of r.problems) md.push(`| \`${p.bank}\` | ${p.level} | ${p.ti} | ${p.kind} | ${String(p.solved).replace(/\|/g, '\\|').slice(0, 26)} | ${p.currentCorrectIdx} | ${String(p.note).replace(/\|/g, '\\|').slice(0, 95)} |`);
fs.writeFileSync('audit/skilltasks-base-audit.md', md.join('\n'));
console.log('stats:', JSON.stringify(r.stats));
console.log('ключ-фикс ≈', keyFixable, '| rewrite ≈', rewrite);
console.log('отчёт → audit/skilltasks-base-audit.md (' + md.length + ' строк)');
