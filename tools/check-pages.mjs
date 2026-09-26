#!/usr/bin/env node
// tools/check-pages.mjs — the gate. A convention in a document is a suggestion; a convention a
// tool can check is a rule.
//
// THE GREPS ARE THE IMPORTANT PART, and the rule is: add a grep the first time a bypass costs an
// hour. Every one below is a bypass that has actually happened in this series.
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, ENGINE_SCRIPTS } from './lib/load.mjs';

let fails = 0, warns = 0;
const fail = (m) => { console.error('FAIL  ' + m); fails++; };
const warn = (m) => { console.warn('warn  ' + m); warns++; };
const ok = (m) => console.log('ok    ' + m);

const scriptsIn = (html) => [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);

// -----------------------------------------------------------------------------------------
// 1. Two entry points, one script list. Hard rule 14.
// -----------------------------------------------------------------------------------------
const index = await readFile(join(ROOT, 'index.html'), 'utf8');
const tests = await readFile(join(ROOT, 'tests.html'), 'utf8');
const iS = scriptsIn(index), tS = scriptsIn(tests);

for (const s of [...iS, ...tS]) {
  try { await stat(join(ROOT, s)); }
  catch { fail(`a page declares ${s}, which does not exist`); }
}
// tests.html carries the engine half only; it must be a PREFIX-EQUAL subset in the same order.
const iEngine = iS.filter((s) => ENGINE_SCRIPTS.includes(s));
if (JSON.stringify(iEngine) !== JSON.stringify(tS)) {
  fail('index.html and tests.html disagree about the engine script list:\n' +
       '        index: ' + iEngine.join(' ') + '\n        tests: ' + tS.join(' '));
} else ok(`both entry points agree on ${tS.length} engine scripts`);

if (JSON.stringify(ENGINE_SCRIPTS) !== JSON.stringify(tS)) {
  fail('tools/lib/load.mjs ENGINE_SCRIPTS differs from the pages:\n' +
       '        load: ' + ENGINE_SCRIPTS.join(' ') + '\n        page: ' + tS.join(' '));
} else ok('the Node loader agrees with the pages');

// Every js/*.js must be declared on index.html, or it is dead code that still loads in Node.
const jsFiles = (await readdir(join(ROOT, 'js'))).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);
for (const f of jsFiles) if (!iS.includes(f)) fail(`${f} exists but index.html never loads it`);
ok(`${jsFiles.length} engine/UI files, all declared`);

// -----------------------------------------------------------------------------------------
// 2. THE BYPASS GREPS.
// -----------------------------------------------------------------------------------------
// Comments are stripped first — without that the gate fails on its own documentation, which is
// exactly what happened on project 5.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const CHECKS = [
  { name: 'silent fallback `if (!NS.x)`',
    re: /\bif\s*\(\s*!\s*(NS|OP|window\.OP)\s*\.\s*[A-Za-z_$][\w$]*\s*\)/,
    why: 'a missing dependency must THROW on the first frame, not be worked around',
    allow: ['js/art.js', 'js/cards.js', 'js/main.js', 'js/engine.js', 'js/actions.js'] },

  { name: 'silent fallback `NS.x || {}`',
    re: /\b(NS|OP|window\.OP)\s*\.\s*[A-Za-z_$][\w$]*\s*\|\|\s*(\{\}|\[\])/,
    why: 'this is the one that cost project 5 an entire art pass — lessons-5 §5.3',
    allow: [] },

  { name: 'power arithmetic outside the one power door',
    re: /\.power\s*\+=|\.power\s*=\s*[^=]/,
    // `H.power = function` and `D.power = function` are the op handler and describer TABLES,
    // not a power value being written. Keyed tables are named by their op, so this is the one
    // shape that will keep tripping it.
    except: /^\s*[HD]\.power\s*=/,
    why: 'CR 2-6 — only js/state.js power() adds up a power value',
    allow: ['js/state.js', 'js/render.js'] },

  { name: 'a Character removed from the field outside the one K.O. door',
    re: /\.chars\.splice\s*\(/,
    why: 'CR 10-2-1 — only js/engine.js koUnit() and the overflow rule move a Character out',
    allow: ['js/engine.js', 'js/ops.js'] },

  { name: 'a question asked outside the one choice door',
    re: /__need|OP_NEED_CHOICE/,
    why: 'hard rule 12 — every choice goes through OP.engine.offerChoice',
    allow: ['js/engine.js'] },

  { name: 'a life card moved outside damage processing',
    re: /\.life\.(shift|pop|splice)\s*\(/,
    why: 'CR 4-6 — only dealLeaderDamage takes a Life card',
    allow: ['js/engine.js'] },

  { name: 'Math.random inside the engine',
    re: /Math\.random\s*\(/,
    why: 'hard rule 10 — every shuffle is seeded and happens inside apply()',
    allow: ['js/art.js', 'js/audio.js', 'js/screens.js'] }
];

for (const c of CHECKS) {
  const hits = [];
  for (const f of jsFiles) {
    if (c.allow.includes(f)) continue;
    const src = stripComments(await readFile(join(ROOT, f), 'utf8'));
    src.split('\n').forEach((line, i) => {
      if (!c.re.test(line)) return;
      if (c.except && c.except.test(line)) return;
      hits.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`);
    });
  }
  if (hits.length) { fail(`${c.name} — ${c.why}`); hits.forEach((h) => console.error('        ' + h)); }
  else ok(c.name + ': none');
}

// -----------------------------------------------------------------------------------------
// 3. Generated files must not be hand-edited.
// -----------------------------------------------------------------------------------------
for (const g of ['data/printed.js', 'data/abilities.js', 'data/decks.js', 'art/manifest.js']) {
  const src = await readFile(join(ROOT, g), 'utf8');
  if (!/GENERATED by tools\//.test(src)) fail(`${g} has lost its GENERATED header`);
}
ok('every generated file still says it is generated');

// -----------------------------------------------------------------------------------------
// 4. Docs must not claim a tool that does not exist. Project 5 shipped a document describing a
//    tool that had never been written, for two days (lessons-5 §6.1).
// -----------------------------------------------------------------------------------------
const docs = ['CLAUDE.md', 'PLAN.md', 'NOTICE.md', 'docs/rights.md', 'docs/takedown.md'];
for (const d of docs) {
  let src;
  try { src = await readFile(join(ROOT, d), 'utf8'); } catch { fail(`${d} is named by this gate but does not exist`); continue; }
  for (const m of src.matchAll(/`(tools\/[\w.-]+\.mjs|js\/[\w.-]+\.js|data\/[\w.-]+\.js|docs\/[\w.-]+\.md)`/g)) {
    try { await stat(join(ROOT, m[1])); }
    catch { fail(`${d} names ${m[1]}, which does not exist`); }
  }
}
ok('every path a document claims exists, exists');

console.log(`\n${fails} failures, ${warns} warnings`);
process.exit(fails ? 1 : 0);
