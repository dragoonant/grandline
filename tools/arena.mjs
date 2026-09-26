#!/usr/bin/env node
// tools/arena.mjs — AI against AI. Its one job is TUNING THE AI (lessons-5 §7.5); it is not a
// design instrument, because balance is Bandai's.
//
// Two rules for not fooling yourself (OVERNIGHT-BUILD-PLAYBOOK §5):
//   - play BOTH SEATS, and count only DECISIVE results, where the same deck wins from both.
//   - report the BEHAVIOUR counters, not just the win rate. `turnsWithNoAction` and
//     `counterWindowsDeclined` catch a class of defect that win rate cannot see, because both
//     sides have the same bug.
import { loadEngine, deckFor } from './lib/load.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const GAMES = Number(opt('--games', 20));
const MAXT = Number(opt('--max-turns', 60));
const A = opt('--a', 'st01'), B = opt('--b', 'st02');

const OP = await loadEngine();

function playGame(seed, deckA, deckB) {
  let s = OP.engine.newGame({ seed, first: 0, decks: [deckFor(OP, deckA), deckFor(OP, deckB)] });
  const stats = {};
  let guard = 0;
  while (s.winner === null) {
    if (++guard > 4000) return { winner: null, why: 'action cap', turns: s.turn, stats, s };
    if (s.turn > MAXT) return { winner: null, why: 'turn cap', turns: s.turn, stats, s };
    const who = OP.engine.whoActs(s);
    if (who === null) break;
    let act;
    try { act = OP.ai.choose(s, { stats }); }
    catch (e) { return { winner: null, why: 'choose threw: ' + e.message, turns: s.turn, stats, s }; }
    try { s = OP.engine.apply(s, act); }
    catch (e) { return { winner: null, why: 'apply threw: ' + e.message, turns: s.turn, stats, s, act }; }
    if (act.t === 'endTurn') {
      stats.turns = (stats.turns || 0) + 1;
      if (!stats._acted) stats.turnsWithNoAction = (stats.turnsWithNoAction || 0) + 1;
      stats._acted = 0;
    } else if (!['keepHand', 'redraw'].includes(act.t)) stats._acted = 1;
  }
  return { winner: s.winner, why: 'defeat', turns: s.turn, stats, s };
}

let aWins = 0, bWins = 0, draws = 0, errors = 0, firstWins = 0, decided = 0;
const agg = {};
const seen = new Map();
for (let g = 0; g < GAMES; g++) {
  for (const [x, y, flip] of [[A, B, false], [B, A, true]]) {
    const r = playGame(1000 + g, x, y);
    for (const k of Object.keys(r.stats)) if (!k.startsWith('_')) agg[k] = (agg[k] || 0) + r.stats[k];
    if (r.winner === null) {
      if (r.why !== 'turn cap') { errors++; if (errors <= 3) console.error(`  seed ${1000 + g} ${x}v${y}: ${r.why}`); }
      else draws++;
      continue;
    }
    decided++;
    if (r.winner === 0) firstWins++;          // seat 0 always goes first in this harness
    const aWon = flip ? r.winner === 1 : r.winner === 0;
    const key = `${g}`;
    const prev = seen.get(key);
    if (prev === undefined) seen.set(key, aWon);
    else { if (prev === aWon) (aWon ? aWins++ : bWins++); else draws++; seen.delete(key); }
  }
}

const decisive = aWins + bWins;
console.log(`\n${A} vs ${B} — ${GAMES} seeds, both seats each`);
console.log(`  decisive ${decisive}  (${A} ${aWins}, ${B} ${bWins})   non-decisive/capped ${draws}   errors ${errors}`);
if (decisive) console.log(`  ${A} win rate over decisive: ${(100 * aWins / decisive).toFixed(1)}%`);
console.log(`\n  games that reached a defeat condition: ${decided} of ${GAMES * 2}`);
console.log(`  THE PLAYER GOING FIRST won ${firstWins} of those (${decided ? (100 * firstWins / decided).toFixed(1) : '0.0'}%)`);
console.log('    Bandai already answers first-player advantage: no draw and 1 DON!! on turn one');
console.log('    (CR 6-3-1, 6-4-1). A large skew here is an engine or AI defect, not a balance one.');
console.log('\nBehaviour counters — these are the ones win rate cannot see:');
const t = agg.turns || 1;
console.log(`  turns played              ${agg.turns || 0}`);
console.log(`  turns with NO action      ${agg.turnsWithNoAction || 0}  (${(100 * (agg.turnsWithNoAction || 0) / t).toFixed(1)}%)`);
console.log(`  counter windows offered   ${agg.counterWindows || 0}`);
console.log(`  counter windows DECLINED  ${agg.counterWindowsDeclined || 0}  (${agg.counterWindows ? (100 * (agg.counterWindowsDeclined || 0) / agg.counterWindows).toFixed(1) : '0.0'}%)`);
console.log(`  block windows offered     ${agg.blockWindows || 0}`);
console.log(`  block windows DECLINED    ${agg.blockWindowsDeclined || 0}  (${agg.blockWindows ? (100 * (agg.blockWindowsDeclined || 0) / agg.blockWindows).toFixed(1) : '0.0'}%)`);
