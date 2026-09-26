// js/ai.js — the computer opponent.
//
// THE HORIZON RULE. CARD-GAME-LESSONS-5.md §5.1 cost project 5 a playtest, and the shape of the
// defect is general to every turn-based game: some actions RESOLVE things and others do not.
// `endTurn` resolves the whole end of turn; `noCounter` resolves the rest of the battle. If
// those are scored as ordinary candidates, they carry a windfall no single action can match and
// the AI passes while holding a winning line.
//
// The fix is to score every candidate AT THE SAME HORIZON:
//   - In the Main Phase the baseline is the CURRENT state, not the state after ending the turn.
//     `endTurn` is the fallback taken when nothing improves, never a candidate.
//   - In the Block and Counter steps every candidate is rolled forward to the end of the battle
//     before it is scored, and so is the baseline. Without this the AI never counters and its
//     win rate never shows it, because both sides have the same bug.
//
// Two behaviour counters exist from day one for exactly that reason — win rate cannot see
// either: `turnsWithNoAction` and `counterWindowsDeclined`.
(function (NS) {
  'use strict';

  var S, E;
  function bind() { if (!S) { S = NS.state; E = NS.engine; } }

  // Weights. Life is the clock and dominates; board power is the means.
  //
  // charCount and blocker were swept on 2026-09-26 over 16 seeds in both seats. The first
  // version of this table had NO TERM FOR [Blocker] AT ALL, and the arena duly reported 0 block
  // windows in 32 games — not because blocking was bad but because the evaluator could not see
  // it (CARD-GAME-LESSONS-5.md §5.2: measuring a rule with an evaluator blind to that rule
  // measures the evaluator). Neighbours are recorded beside each swept value so the next
  // session does not re-run the sweep.
  var W = {
    life: 900,          // a Life card is the game
    oppLife: -900,
    charPower: 0.010,   // 1 point per 100 power on board
    oppCharPower: -0.010,
    leaderPower: 0.008, // DON!! on the Leader is how most attacks actually get through
    charCount: 110,     // swept: 45 under-developed badly, 110 best, 180 over-developed
    oppCharCount: -95,
    blocker: 70,        // an ACTIVE [Blocker] you control — the term that was missing entirely
    oppBlocker: -55,
    hand: 28,
    oppHand: -18,
    donActive: 20,
    donOnBoard: 14,
    leaderRested: -26,
    deck: 0.6,
    win: 100000
  };

  function evaluate(s, seat) {
    bind();
    if (s.winner !== null) return s.winner === seat ? W.win : -W.win;
    var me = s.players[seat], op = s.players[1 - seat];
    var n = 0;
    n += me.life.length * W.life + op.life.length * W.oppLife;
    n += me.hand.length * W.hand + op.hand.length * W.oppHand;
    n += me.chars.length * W.charCount + op.chars.length * W.oppCharCount;
    n += me.donActive * W.donActive;
    n += (me.leader.don + me.chars.reduce(function (a, u) { return a + u.don; }, 0)) * W.donOnBoard;
    n += me.deck.length * W.deck;
    if (me.leader.rested) n += W.leaderRested;
    n += S.power(s, me.leader) * W.leaderPower;
    me.chars.forEach(function (u) {
      n += S.power(s, u) * W.charPower + (u.rested ? -12 : 0);
      if (!u.rested && S.hasKeyword(s, u, 'blocker')) n += W.blocker;
    });
    op.chars.forEach(function (u) {
      n += S.power(s, u) * W.oppCharPower + (u.rested ? 12 : 0);
      if (!u.rested && S.hasKeyword(s, u, 'blocker')) n += W.oppBlocker;
    });
    return n;
  }

  // Roll a state forward through any reactive window by declining everything, so two candidates
  // can be compared at the same horizon. Never used to CHOOSE — only to score.
  function settle(s, guard) {
    bind();
    guard = guard || 0;
    if (guard > 40 || s.winner !== null) return s;
    var h = s.queue[0];
    if (!h) return s;
    var acts;
    try { acts = E.legalActions(s); } catch (e) { return s; }
    var decline =
      acts.filter(function (a) { return a.t === 'noBlock' || a.t === 'noCounter' || a.t === 'takeLife'; })[0] ||
      acts.filter(function (a) { return a.t === 'choose' && a.v === '__done'; })[0] ||
      acts[0];
    return settle(E.apply(s, decline), guard + 1);
  }

  function score(s, seat) { return evaluate(settle(s), seat); }

  // ---------------------------------------------------------------------------------------
  function choose(s, opts) {
    bind();
    opts = opts || {};
    var seat = E.whoActs(s);
    var acts = E.legalActions(s);
    var stats = opts.stats || null;
    var h = s.queue[0];

    // --- reactive windows: every candidate rolled to the end of the battle, baseline too ---
    if (h && (h.k === 'block' || h.k === 'counter')) {
      var declineAct = acts.filter(function (a) { return a.t === 'noBlock' || a.t === 'noCounter'; })[0];
      var base = score(E.apply(s, declineAct), seat);
      var best = null, bestN = base;
      acts.forEach(function (a) {
        if (a === declineAct) return;
        var n = score(E.apply(s, a), seat);
        if (n > bestN + 0.0001) { bestN = n; best = a; }
      });
      if (stats) {
        if (h.k === 'counter') {
          stats.counterWindows = (stats.counterWindows || 0) + 1;
          if (!best) stats.counterWindowsDeclined = (stats.counterWindowsDeclined || 0) + 1;
        } else {
          stats.blockWindows = (stats.blockWindows || 0) + 1;
          if (!best) stats.blockWindowsDeclined = (stats.blockWindowsDeclined || 0) + 1;
        }
      }
      return best || declineAct;
    }

    // --- trigger: a free look, so take it whenever it scores better ---
    if (h && h.k === 'trigger') {
      var take = acts.filter(function (a) { return a.t === 'takeLife'; })[0];
      var use = acts.filter(function (a) { return a.t === 'useTrigger'; })[0];
      return score(E.apply(s, use), seat) > score(E.apply(s, take), seat) ? use : take;
    }

    // --- mulligan: redraw a hand that cannot act ---
    if (h && h.k === 'mulligan') {
      var p = s.players[seat];
      var cheap = p.hand.filter(function (id) {
        var c = S.card(id);
        return c.cost !== null && c.cost <= 2;
      }).length;
      var redrew = p.redrew;
      return (!redrew && cheap < 2) ? { t: 'redraw' } : { t: 'keepHand' };
    }

    // --- a parked choice: pick the best answer, or stop if stopping is better ---
    if (h && h.k === 'choice') {
      var bestC = acts[0], bestCn = -Infinity;
      acts.forEach(function (a) {
        var n = score(E.apply(s, a), seat);
        if (n > bestCn) { bestCn = n; bestC = a; }
      });
      return bestC;
    }

    // --- Main Phase: the baseline is DOING NOTHING, at this same horizon. endTurn is the
    //     fallback, never a candidate. §5.1.
    var baseline = evaluate(s, seat);
    var endAct = acts.filter(function (a) { return a.t === 'endTurn'; })[0];
    var pick = null, pickN = baseline;
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (a.t === 'endTurn') continue;
      var next;
      try { next = E.apply(s, a); } catch (e) { continue; }
      var n = evaluate(settle(next), seat);
      if (n > pickN + 0.0001) { pickN = n; pick = a; }
    }
    if (stats) {
      stats.decisions = (stats.decisions || 0) + 1;
      if (!pick) stats.passes = (stats.passes || 0) + 1;
    }
    return pick || endAct;
  }

  // Play one seat's whole turn, counting turns on which it did nothing at all.
  function takeTurn(s, stats) {
    bind();
    var seat = s.active, acted = 0, guard = 0;
    while (s.winner === null && E.whoActs(s) === seat && !s.queue.length && s.active === seat) {
      if (++guard > 400) throw new Error('ai.takeTurn: no progress after 400 actions');
      var a = choose(s, { stats: stats });
      s = E.apply(s, a);
      if (a.t === 'endTurn') break;
      acted++;
      while (s.queue.length && s.winner === null && E.whoActs(s) === seat) {
        s = E.apply(s, choose(s, { stats: stats }));
      }
    }
    if (stats) {
      stats.turns = (stats.turns || 0) + 1;
      if (acted === 0) stats.turnsWithNoAction = (stats.turnsWithNoAction || 0) + 1;
    }
    return s;
  }

  NS.ai = { choose: choose, evaluate: evaluate, takeTurn: takeTurn, settle: settle, W: W };
}(window.OP = window.OP || {}));
