// tools/lib/load.mjs — load the browser scripts into a Node sandbox, in the SAME order
// index.html declares. tools/check-pages.mjs asserts this list matches both entry points, so a
// script that runs in Node but not in the browser cannot happen.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// THE SCRIPT LIST. index.html and tests.html are checked against this.
export const ENGINE_SCRIPTS = [
  'js/rng.js', 'js/log.js', 'js/names.js', 'js/state.js', 'js/statics.js',
  'js/ops.js', 'js/text.js', 'js/engine.js', 'js/actions.js',
  'data/printed.js', 'data/abilities.js', 'data/defects.js', 'data/decks.js',
  'js/cards.js', 'js/ai.js'
];

export async function loadEngine() {
  const win = { OP: {} };
  for (const rel of ENGINE_SCRIPTS) {
    const src = await readFile(join(ROOT, rel), 'utf8');
    try { new Function('window', src)(win); }
    catch (e) { throw new Error(`loading ${rel}: ${e.message}`); }
  }
  win.OP.cards.build();
  return win.OP;
}

// Turn a registered deck into the shape engine.newGame wants.
export function deckFor(OP, key) {
  const d = OP.decks.find((x) => x.key === key);
  if (!d) throw new Error(`no registered deck "${key}"`);
  const cards = [];
  d.list.forEach(([id, n]) => { for (let i = 0; i < n; i++) cards.push(id); });
  return { key: d.key, leader: d.leader, cards, name: d.name };
}
