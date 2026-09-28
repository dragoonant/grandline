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
    // The banned thing is WORKING AROUND a missing dependency, not noticing one. `if (!NS.x)
    // throw` is the correct pattern and the whole point of the rule, so the check looks at the
    // next 3 lines for a throw rather than carrying an allow list that would grow forever and
    // eventually hide a real bypass.
    window: 3, windowRe: /throw\b/,
    why: 'a missing dependency must THROW on the first frame, not be worked around',
    allow: [] },

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
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      if (!c.re.test(line)) return;
      if (c.except && c.except.test(line)) return;
      if (c.window && c.windowRe &&
          lines.slice(i, i + 1 + c.window).some((l) => c.windowRe.test(l))) return;
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

// PLAN.md D8 / CARD-GAME-LESSONS-6 §9.1 — everything either player does must be SHOWN. Every
// tag the engine logs needs a line in js/ui.js LOGLINE, or a place on this list of pure
// bookkeeping. 2026-09-27: eleven tags had no line, so what the AI did with its effects —
// which Character it trashed, which of your DON!! it rested — reached no one.
{
  const BOOKKEEPING = new Set(['phase.refresh', 'phase.end', 'battle.end', 'don.deckSize']);
  const uiSrc = await readFile(join(ROOT, 'js/ui.js'), 'utf8');
  const shown = new Set([...uiSrc.matchAll(/^\s+'([a-zA-Z.]+)': function \(e?\)/gm)].map((m) => m[1]));
  const unshown = [];
  for (const f of ['js/engine.js', 'js/ops.js', 'js/actions.js']) {
    const src = await readFile(join(ROOT, f), 'utf8');
    for (const m of src.matchAll(/log\.push\(s, '([a-zA-Z.]+)'/g)) {
      if (!shown.has(m[1]) && !BOOKKEEPING.has(m[1])) unshown.push(`${m[1]} (${f})`);
    }
  }
  if (unshown.length) fail('engine events the player is never shown:\n        ' + [...new Set(unshown)].join('\n        '));
  else ok('every engine event has a log line the player can see');
}

console.log(`\n${fails} failures, ${warns} warnings`);
process.exit(fails ? 1 : 0);
