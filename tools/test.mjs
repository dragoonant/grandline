#!/usr/bin/env node
// tools/test.mjs — the suite. Tests are named by the Comprehensive Rules section they check, so
// a failure points straight at the rule: `CR 7-1-4-1: the attacker wins on equal power`.
//
//   --quiet   only the summary and failures
//   --filter  substring match on the test name
//   --full    print every assertion
import { loadEngine, deckFor, ROOT } from './lib/load.mjs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const full = args.includes('--full');
const fi = args.indexOf('--filter');
const filter = fi >= 0 ? args[fi + 1] : null;

const OP = await loadEngine();
let pass = 0, fail = 0, skipped = 0;
const failures = [];

const ctx = {
  OP, deckFor: (k) => deckFor(OP, k),
  eq(a, b, msg) {
    if (a === b) { if (full) console.log(`      ok  ${msg} (${a})`); return; }
    throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  },
  ok(v, msg) { if (!v) throw new Error(msg); if (full) console.log(`      ok  ${msg}`); },
  throws(fn, msg) {
    try { fn(); } catch { if (full) console.log(`      ok  ${msg}`); return; }
    throw new Error(`${msg}: expected a throw, got none`);
  }
};

const tests = [];
globalThis.test = (name, fn) => tests.push({ name, fn });

const dir = join(ROOT, 'tests');
for (const f of (await readdir(dir)).filter((x) => x.endsWith('.mjs')).sort()) {
  await import(join(dir, f));
}

for (const t of tests) {
  if (filter && !t.name.includes(filter)) { skipped++; continue; }
  try { await t.fn(ctx); pass++; if (!quiet) console.log(`  ok    ${t.name}`); }
  catch (e) { fail++; failures.push([t.name, e]); console.log(`  FAIL  ${t.name}\n        ${e.message}`); }
}

console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} filtered out` : ''}`);
if (fail) { for (const [n, e] of failures) if (e.stack && full) console.log(`\n${n}\n${e.stack}`); process.exit(1); }
