// js/engine.js — the whole engine surface: legalActions / apply / isTerminal, plus whoActs.
// CLAUDE.md hard rules 2-5. Section numbers are Bandai's Comprehensive Rules v1.2.1; see
// docs/rules.md for the index.
//
// THE RESOLUTION MODEL
//
// One queue. A pending head OWNS the turn: while it is there the only legal actions are answers
// to it, and legalActions THROWS on a head that offers nothing rather than silently stalling.
//
// An effect is an *invocation* {src, ctrl, self, cardId, ops, answers}. execute() runs it on a
// COPY. When an op needs a decision it throws through offerChoice(); execute() then DISCARDS
// the partial run and returns the pre-effect state with a choice step parked on the queue,
// carrying the invocation and the answers collected so far. Answering re-runs the invocation
// from the pre-effect state with every answer pre-filled. Two properties fall out: an effect is
// atomic even though it asks questions in the middle, and the RNG advances only on the run that
// survives, so a game stays a pure function of its seed and its action list.
//
// THE REACTIVE WINDOW (CR 7-1-2, 7-1-3, 10-1-5) is not a second mechanism. A Block, Counter or
// Trigger step is a queue step whose `ctrl` is the OTHER seat. whoActs() returns that seat and
// the UI, the AI and the black box all route correctly without knowing anything new.
(function (NS) {
  'use strict';

  // js/state.js is declared before this file in the one script list (tools/lib/load.mjs and
  // both entry points), so this is not a lazy lookup that can silently miss.
  var S = NS.state;
  if (!S) throw new Error('engine: js/state.js must load first (hard rule 11)');
  function bind() { return S; }
  function clone(s) { return JSON.parse(JSON.stringify(s)); }

  // =======================================================================================
  // THE ONE CHOICE DOOR — CLAUDE.md hard rule 12.
  // tools/check-pages.mjs greps for ops that pick without coming through here.
  // =======================================================================================
  function offerChoice(s, opts) {
    var min = opts.min === undefined ? 1 : opts.min;
    var max = opts.max === undefined ? min : opts.max;
    if (max < min) throw new Error('offerChoice: max < min');
    var options = opts.options || [];

    // PLAN.md D8 — NEVER ASSUME A CHOICE. Even a single legal option is shown and confirmed, so
    // the player always knows which card an effect touched. This used to take the options
    // without asking whenever there were no more of them than `min`, and a forced single target
    // resolved silently. The only thing skipped is a question with nothing to choose from,
    // unless the caller has cards to SHOW regardless (a "look at N" with no qualifier).
    if (!options.length && !opts.showEmpty) return [];

    var picked = [];
    var pool = options.slice();
    var shown = false;
    while (picked.length < max && (pool.length || (opts.showEmpty && !shown))) {
      shown = true;
      if (!pool.length && picked.length) break;
      var ans = ask(s, {
        kind: opts.kind || 'target',
        ctrl: opts.ctrl,
        prompt: opts.prompt || '',
        source: opts.source === undefined ? null : opts.source,
        options: pool.slice(),
        canStop: picked.length >= min,
        already: picked.slice(),
        min: min, max: max,
        seen: opts.seen,                        // CR 8-4-4-4 — every card the player looked at
        cardId: opts.cardId
      });
      if (ans === '__done') break;
      picked.push(ans);
      pool = pool.filter(function (o) { return o.v !== ans; });
    }
    return picked;
  }

  // The throw that parks a question. Never called outside offerChoice.
  function ask(s, question) {
    if (s._ans && s._ansIdx < s._ans.length) return s._ans[s._ansIdx++];
    var e = new Error('OP_NEED_CHOICE');
    e.__need = question;
    throw e;
  }

  function execute(state, inv) {
    var trial = clone(state);
    trial._ans = (inv.answers || []).slice();
    trial._ansIdx = 0;
    try {
      NS.ops.run(trial, { ctrl: inv.ctrl, self: inv.self, cardId: inv.cardId, src: inv.src,
                          onceKey: inv.onceKey }, inv.ops);
      delete trial._ans; delete trial._ansIdx;
      return afterEffect(trial);
    } catch (e) {
      if (!e.__need) throw e;
      var s2 = clone(state);                    // discard the partial run entirely
      s2.queue.unshift({ k: 'choice', ctrl: e.__need.ctrl, q: e.__need, inv: inv });
      return s2;
    }
  }

  // CR 9-1 — rule processing runs immediately when its event occurs, even mid-action.
  function afterEffect(s) { checkDefeat(s); return s; }

  // =======================================================================================
  // CR 9-2 — defeat judgment. Two conditions only, and losing is "damaged with no Life left",
  // never "Life reaches 0".
  // =======================================================================================
  function checkDefeat(s) {
    if (s.winner !== null) return s;
    for (var i = 0; i < 2; i++) {
      if (s.players[i].deck.length === 0 && s.players[i]._deckedOut) {       // CR 9-2-1-2
        s.winner = 1 - i; NS.log.push(s, 'game.over', { winner: 1 - i, why: 'deckout', loser: i });
        return s;
      }
      if (s.players[i]._lethal) {                                            // CR 9-2-1-1
        s.winner = 1 - i; NS.log.push(s, 'game.over', { winner: 1 - i, why: 'life', loser: i });
        return s;
      }
    }
    return s;
  }

  // =======================================================================================
  // THE ONE DRAW DOOR — CR 4-5. Drawing from an empty deck does not lose the game on its own;
  // having 0 cards in the deck does, at the next rule processing (CR 9-2-1-2).
  // =======================================================================================
  function draw(s, seat, n) {
    var p = s.players[seat];
    for (var i = 0; i < n; i++) {
      if (!p.deck.length) { p._deckedOut = true; break; }
      p.hand.push(p.deck.shift());
    }
    if (!p.deck.length) p._deckedOut = true;
    NS.log.push(s, 'card.drawn', { seat: seat, n: n, hand: p.hand.length, deck: p.deck.length });
    return s;
  }

  function hasTrigger(id) {
    return (S.card(id).abilities || []).some(function (a) { return a.when === 'trigger'; });
  }

  // `filter` narrows which cards qualify: "trash 1 card with a [Trigger] from your hand".
  function trashFromHand(s, seat, n, filter) {
    var p = s.players[seat];
    for (var i = 0; i < n && p.hand.length; i++) {
      var opts = [];
      p.hand.forEach(function (id, ix) {
        if (!filter || filter(id)) opts.push({ v: id + '#' + ix, label: S.card(id).name, cardId: id });
      });
      if (!opts.length) break;
      // The owner chooses which card to trash (CR 10-2-14). One card at a time through the door.
      var chosen = offerChoice(s, {
        kind: 'trash', ctrl: seat, prompt: 'Trash a card from your hand',
        options: opts,
        min: 1, max: 1
      });
      var id = String(chosen[0]).split('#')[0];
      var at = p.hand.indexOf(id);
      if (at >= 0) { p.hand.splice(at, 1); p.trash.push(id); NS.log.push(s, 'card.trashed', { seat: seat, id: id }); }
    }
    return s;
  }

  // =======================================================================================
  // THE ONE K.O. DOOR — CR 10-2-1. Nothing else moves a Character to the trash as a K.O.
  // tools/check-pages.mjs greps for `chars.splice` outside this file.
  // =======================================================================================
  function koUnit(s, uid, byUid) {
    var seat = S.seatOf(s, uid);
    if (seat < 0) return s;
    var p = s.players[seat];
    var ix = -1;
    for (var i = 0; i < p.chars.length; i++) if (p.chars[i].uid === uid) ix = i;
    if (ix < 0) return s;                                   // Leaders cannot be K.O.'d (CR 3-6-3)
    var u = p.chars[ix];
    // CR 6-5-5-4 — DON!! given to a card that moves area returns to the cost area, rested.
    if (u.don > 0) { p.donRested += u.don; u.don = 0; }
    p.chars.splice(ix, 1);
    p.trash.push(u.id);
    NS.log.push(s, 'char.ko', { uid: uid, id: u.id, seat: seat, by: byUid || null });
    fireAuto(s, 'onKO', { unit: u, seat: seat });           // CR 10-2-17
    return s;
  }

  // Plays a card with its cost already paid (or waived). CR 3-7-3.
  function playCardFree(s, seat, cardId) {
    var c = S.card(cardId);
    var p = s.players[seat];
    if (c.category === 'STAGE') {
      if (p.stage) { p.trash.push(p.stage.id); }            // CR 3-8-5-1
      p.stage = S.unit('S', cardId);
      NS.log.push(s, 'stage.played', { seat: seat, id: cardId });
      return s;
    }
    if (p.chars.length >= S.MAX_CHARS) {                    // CR 3-7-6-1
      var chosen = offerChoice(s, {
        kind: 'overflow', ctrl: seat,
        prompt: 'Your Character area is full — trash 1 Character to make room',
        options: p.chars.map(function (u) { return { v: u.uid, label: S.card(u.id).name, uid: u.uid }; }),
        min: 1, max: 1
      });
      var victim = chosen[0];
      for (var i = 0; i < p.chars.length; i++) {
        if (p.chars[i].uid === victim) {
          if (p.chars[i].don > 0) { p.donRested += p.chars[i].don; }
          p.trash.push(p.chars[i].id); p.chars.splice(i, 1); break;
        }
      }
      // CR 3-7-6-1-1 — this trashing is rule processing; it is NOT a K.O. and fires nothing.
      NS.log.push(s, 'char.overflowTrashed', { seat: seat });
    }
    var u = S.unit('C', cardId);
    u.playedOn = s.turn;                                     // CR 3-7-4
    p.chars.push(u);
    NS.log.push(s, 'char.played', { seat: seat, id: cardId, uid: u.uid });
    fireAuto(s, 'onPlay', { unit: u, seat: seat });          // CR 10-2-6
    return s;
  }

  // =======================================================================================
  // Auto effects — CR 8-1-3-1. The engine collects matching abilities and runs them in turn.
  // A mandatory one runs; an optional one becomes a yes/no through the choice door.
  // =======================================================================================
  // Leader, Characters and Stage, in that order: every card on a player's field with a timing.
  function fieldOf(s, seat) {
    var p = s.players[seat];
    return [p.leader].concat(p.chars.slice(), p.stage ? [p.stage] : []);
  }

  function abilitiesOf(u) {
    var c = S.card(u.id);
    return (c.abilities || []).slice();
  }

  function condsMet(s, u, ab, ctx, seatHint) {
    // An Event has no unit on the field, so its controller cannot be derived from the board.
    var seat = S.seatOf(s, u.uid);
    if (seat < 0 && seatHint !== undefined) seat = seatHint;
    if (seat < 0) return false;
    return (ab.conds || []).every(function (cd) {
      switch (cd.k) {
        case 'donAtLeast':   return u.don >= cd.n;                        // CR 8-3-2-3
        case 'yourTurn':     return s.active === seat;                    // CR 8-3-2-4
        case 'opponentTurn': return s.active !== seat;                    // CR 8-3-2-5
        case 'charCountAtLeast': return s.players[seat].chars.length >= cd.n;
        case 'selfRested':   return u.rested === true;
        case 'lifeAtMost':   return s.players[seat].life.length <= cd.n;
        case 'oppAttrIs':    return S.card(s.players[1 - seat].leader.id).attribute.indexOf(cd.attr) >= 0;
        case 'leaderType':   return S.card(s.players[seat].leader.id).types.indexOf(cd.type) >= 0;
        case 'lifeAtLeast':  return s.players[seat].life.length >= cd.n;
        case 'turnAtLeast':  return s.turn >= cd.n;
        case 'haveCharCostAtLeast':
          return s.players[seat].chars.some(function (x) {
            var cc = S.card(x.id); return cc.cost !== null && cc.cost >= cd.n;
          });
        // "If there is a Character ..." names no player: either field (CR 3-1-2-1 defines only
        // "you have"). OP14-020 Mihawk and the OP17 Elbaph Characters read this way.
        case 'anyCharCostAtLeast':
          return s.players[0].chars.concat(s.players[1].chars).some(function (x) {
            var cc = S.card(x.id); return cc.cost !== null && cc.cost >= cd.n;
          });
        case 'anyCharBasePowerAtLeast':
          return s.players[0].chars.concat(s.players[1].chars).some(function (x) {
            var cc = S.card(x.id); return cc.power !== null && cc.power >= cd.n;
          });
        case 'haveCharBasePowerAtLeast':
          return s.players[seat].chars.some(function (x) {
            var cc = S.card(x.id); return cc.power !== null && cc.power >= cd.n;
          });
        case 'oppLifeAtMost': return s.players[1 - seat].life.length <= cd.n;
        case 'oppCharCountAtLeast': return s.players[1 - seat].chars.length >= cd.n;
        case 'donOnFieldAtLeast': {
          var pl = s.players[seat];
          return pl.donActive + pl.donRested + pl.leader.don +
                 pl.chars.reduce(function (a, x) { return a + x.don; }, 0) >= cd.n;
        }
        case 'battled':      // CR 7-1-5-2, only meaningful inside endBattle()
          if (!s._battled) return false;
          return cd.what === 'leader' ? s._battled.targetWasLeader : !s._battled.targetWasLeader;
        default: throw new Error('condsMet: unknown condition "' + cd.k + '"');
      }
    });
  }

  // CR 8-3-1 — an activation cost becomes ops that run at the FRONT of the invocation, so a cost
  // and its effect are one atomic run and a question asked while paying replays cleanly.
  // Without this an auto effect resolved for free: OP17-058 Kaido's DON!! -1 was never taken,
  // which only became visible once the timing itself started firing.
  //
  // `ask` says whether to offer the payment as a yes/no. An activated ([Activate: Main]) effect
  // never asks: choosing to activate it IS the choice. Everything else asks when the text says
  // "you may", and DON!! −X always prints "(You may return ...)" (CR 8-3-1-4, 8-3-1-6).
  function costOps(ab, ask) {
    if (!ab.cost || !ab.cost.length) return [];
    var optional = !!ask && (!!ab.optional || ab.cost.some(function (c) { return c.k === 'donMinus'; }));
    return [{ k: 'cost', costs: ab.cost, optional: optional }];
  }

  function canAfford(s, seat, u, ab) {
    var p = s.players[seat];
    return (ab.cost || []).every(function (c) {
      if (c.k === 'restDon') return p.donActive >= c.n;            // CR 8-3-1-3
      if (c.k === 'trashHand') {
        return p.hand.filter(function (id) { return !c.withTrigger || hasTrigger(id); }).length >= c.n;
      }
      if (c.k === 'restSelf') return u.rested === false;
      if (c.k === 'restOwn') {
        return [p.leader].concat(p.chars, p.stage ? [p.stage] : [])
          .filter(function (x) { return !x.rested; }).length + p.donActive >= c.n;
      }
      if (c.k === 'donMinus') {
        return p.donActive + p.donRested + p.leader.don +
               p.chars.reduce(function (a, x) { return a + x.don; }, 0) >= c.n;
      }
      return false;
    });
  }

  function fireAuto(s, when, info) {
    var u = info.unit, seat = info.seat;
    // CR 10-2-5 / 10-2-16 — "[When Attacking]/[On Your Opponent's Attack]" is one printed
    // effect under two timings, and tools/build-abilities.mjs emits ONE ABILITY PER TIMING.
    // Matching `alsoWhen` here as well fired the same effect twice under the second timing.
    var abs = abilitiesOf(u).filter(function (a) { return a.when === when; });
    for (var i = 0; i < abs.length; i++) {
      var ab = abs[i];
      // The unit may already have left the field ([On K.O.]), so the seat comes from the caller.
      // Without the hint condsMet found no seat and every [On K.O.] effect silently did nothing.
      if (!condsMet(s, u, ab, info, seat)) continue;
      if (!canAfford(s, seat, u, ab)) continue;              // CR 8-3-1-3
      if (ab.once && u.onceUsed[when + i]) continue;         // CR 10-2-13
      if (ab.once) u.onceUsed[when + i] = true;
      var out = execute(s, { ctrl: seat, self: u.uid, cardId: u.id, src: u.uid,
                             onceKey: ab.once ? when + i : null,
                             ops: costOps(ab, true).concat(ab.ops), answers: [] });
      // execute() returns a new state; copy it back onto `s` so callers keep their reference.
      Object.keys(out).forEach(function (k) { s[k] = out[k]; });
    }
    return s;
  }

  // =======================================================================================
  // Turn flow — CR 6-1-1: Refresh, Draw, DON!!, Main, End.
  // =======================================================================================
  function beginTurn(s) {
    var seat = s.active, p = s.players[seat];

    // CR 6-2-1 — effects lasting "until the start of your next turn" end.
    S.allUnits(s).forEach(function (u) {
      u.mods = u.mods.filter(function (m) { return m.until !== 'startOfNextTurn'; });
    });
    // CR 6-2-3 — DON!! given to your Leader and Characters returns to the cost area, rested.
    p.leader.don = 0;
    p.chars.forEach(function (u) { p.donRested += u.don; u.don = 0; });
    // (the Leader's DON!! is counted back below with everything else)
    p.donRested = p.donRested;
    // CR 6-2-4 — set every rested card in your Leader/Character/Stage/cost areas as active.
    p.leader.rested = false;
    p.chars.forEach(function (u) { u.rested = false; });
    if (p.stage) p.stage.rested = false;
    p.donActive += p.donRested; p.donRested = 0;
    p.leader.onceUsed = {}; p.chars.forEach(function (u) { u.onceUsed = {}; });
    if (p.stage) p.stage.onceUsed = {};
    NS.log.push(s, 'phase.refresh', { seat: seat });

    // CR 6-3-1 — draw 1. The player going first does not draw on their first turn.
    s.phase = 'draw';
    if (!(s.turn === 1 && seat === s.first)) draw(s, seat, 1);

    // CR 6-4-1 — place 2 DON!!; the player going first places only 1 on their first turn.
    s.phase = 'don';
    var want = (s.turn === 1 && seat === s.first) ? 1 : 2;
    var got = Math.min(want, p.donDeck);                       // CR 6-4-2, 6-4-3
    p.donDeck -= got; p.donActive += got;
    NS.log.push(s, 'phase.don', { seat: seat, n: got, active: p.donActive });

    s.phase = 'main';
    NS.log.push(s, 'phase.main', { seat: seat, turn: s.turn });
    return afterEffect(s);
  }

  function endTurn(s) {
    var seat = s.active;
    s.phase = 'end';
    NS.log.push(s, 'phase.end', { seat: seat });

    // CR 6-6-1-1 — [End of Your Turn] then [End of Your Opponent's Turn].
    // A Stage carries timings too (CR 3-8); it used to be skipped by every timing loop.
    fieldOf(s, seat).forEach(function (u) {
      fireAuto(s, 'endOfYourTurn', { unit: u, seat: seat });
    });
    fieldOf(s, 1 - seat).forEach(function (u) {
      fireAuto(s, 'endOfOpponentTurn', { unit: u, seat: 1 - seat });
    });

    // CR 6-6-1-2/3 — effects lasting "during this turn" or "until the end of the turn" end.
    S.allUnits(s).forEach(function (u) {
      u.mods = u.mods.filter(function (m) { return m.until !== 'turn' && m.until !== 'battle'; });
      u.keywords = [];
    });
    s.noBlock = s.noBlock.filter(function (l) { return l.scope !== 'turn' && l.scope !== 'battle'; });
    s.lockPlay = [];

    // CR 6-6-1-4 — the turn ends and the other player becomes the turn player.
    s.active = 1 - s.active;
    if (s.active === s.first) s.turn++;
    return beginTurn(s);
  }

  // =======================================================================================
  // Battle — CR 7-1. Attack -> Block -> Counter -> Damage -> End of the Battle.
  // Two of those four steps hand control to the player whose turn it is not.
  // =======================================================================================
  function declareAttack(s, attackerUid, targetUid) {
    var seat = s.active;
    var a = S.findUnit(s, attackerUid);
    a.rested = true;                                          // CR 7-1-1-1
    s.battle = { attacker: attackerUid, target: targetUid, step: 'block', blocked: false, seat: seat };
    NS.log.push(s, 'battle.declared', {
      attacker: attackerUid, attackerId: a.id, target: targetUid,
      targetId: S.findUnit(s, targetUid).id, seat: seat
    });
    fireAuto(s, 'whenAttacking', { unit: a, seat: seat });     // CR 7-1-1-3, 10-2-5
    var def = S.findUnit(s, targetUid);
    if (def) fireAuto(s, 'whenAttacked', { unit: def, seat: 1 - seat });

    // CR 10-2-16-1 — [On Your Opponent's Attack] fires when the OPPONENT declares an attack,
    // AFTER their [When Attacking] effects, and it belongs to the defending PLAYER rather than
    // to the card being attacked: the Leader may carry it while a Character is the target.
    // OP17-058 Kaido prints it as the second half of a dual timing.
    var dSeat = 1 - seat;
    // OP17-057 Fullalead is a STAGE with this timing, and the loop used to skip Stages.
    fieldOf(s, dSeat).forEach(function (u) {
      if (S.findUnit(s, u.uid) || (s.players[dSeat].stage && s.players[dSeat].stage.uid === u.uid)) {
        fireAuto(s, 'onOpponentAttack', { unit: u, seat: dSeat });
      }
    });

    if (gone(s)) return endBattle(s);                          // CR 7-1-1-4
    return openBlockStep(s);
  }

  // CR 7-1-1-4 / 7-1-2-3 / 7-1-3-1-3 — if either card has left the field, skip to End of Battle.
  function gone(s) {
    if (!s.battle) return true;
    return !S.findUnit(s, s.battle.attacker) || !S.findUnit(s, s.battle.target);
  }

  function blockers(s) {
    var defSeat = 1 - s.battle.seat;
    var atk = S.findUnit(s, s.battle.attacker);
    if (S.hasKeyword(s, atk, 'unblockable')) return [];        // CR 10-1-7
    var locks = s.noBlock.filter(function (l) { return l.seat === defSeat; });
    return s.players[defSeat].chars.filter(function (u) {
      if (!S.hasKeyword(s, u, 'blocker')) return false;        // CR 10-1-4
      if (u.rested) return false;                              // it must rest to block
      if (u.uid === s.battle.target) return false;             // it is already the target
      return !locks.some(function (l) {
        // A lock may be tied to one attacker (markNoBlocker) or apply to the whole battle.
        if (l.attackerUid && l.attackerUid !== s.battle.attacker) return false;
        if (l.powerMin === undefined || l.powerMin === null) return true;
        return S.power(s, u) >= l.powerMin;
      });
    });
  }

  // CR 8-6-1 — an effect that is mid-resolution finishes before play continues. An auto effect
  // fired during the Attack Step may park a question, and unshifting the Block or Counter step
  // in front of it would ask the defender to block before they had answered their own card.
  // The step goes behind any parked choices instead.
  function enqueue(s, step) {
    var i = 0;
    while (i < s.queue.length && s.queue[i].k === 'choice') i++;
    s.queue.splice(i, 0, step);
    return s;
  }

  function openBlockStep(s) {
    s.battle.step = 'block';
    var opts = blockers(s);
    // PLAN.md D4 — a window with no legal option is never shown.
    if (!opts.length) return openCounterStep(s);
    enqueue(s, { k: 'block', ctrl: 1 - s.battle.seat });
    return s;
  }

  function openCounterStep(s) {
    s.battle.step = 'counter';
    if (!counterOptions(s).length) return damageStep(s);
    enqueue(s, { k: 'counter', ctrl: 1 - s.battle.seat });
    return s;
  }

  // CR 7-1-3-1 — the defender may, any number of times and in any order: trash a Character card
  // with a Counter value from hand, or pay for and trash an Event card with [Counter].
  function counterOptions(s) {
    var defSeat = 1 - s.battle.seat;
    var p = s.players[defSeat];
    var out = [];
    p.hand.forEach(function (id, ix) {
      var c = S.card(id);
      if (c.category === 'CHARACTER' && c.counter) {           // CR 7-1-3-1-1
        out.push({ kind: 'counterCard', id: id, ix: ix, n: c.counter, name: c.name });
      }
      if (c.category === 'EVENT' && (c.abilities || []).some(function (a) { return a.when === 'counter'; })) {
        if (p.donActive >= (c.cost || 0)) {                    // CR 7-1-3-1-2
          out.push({ kind: 'counterEvent', id: id, ix: ix, cost: c.cost || 0, name: c.name });
        }
      }
    });
    return out;
  }

  function damageStep(s) {
    if (gone(s)) return endBattle(s);
    s.battle.step = 'damage';
    var atk = S.findUnit(s, s.battle.attacker);
    var def = S.findUnit(s, s.battle.target);
    var ap = S.power(s, atk), dp = S.power(s, def);
    NS.log.push(s, 'battle.damage', { attacker: atk.uid, target: def.uid, attackPower: ap, defendPower: dp });

    // CR 7-1-4-1 — attacker wins on greater OR EQUAL power.
    if (ap >= dp) {
      if (S.isLeader(s, def)) {
        var defSeat = S.seatOf(s, def.uid);
        var n = S.hasKeyword(s, atk, 'doubleAttack') ? 2 : 1;  // CR 10-1-2
        var banish = S.hasKeyword(s, atk, 'banish');           // CR 10-1-3
        return dealLeaderDamage(s, defSeat, n, banish);
      }
      koUnit(s, def.uid, atk.uid);                             // CR 7-1-4-1-2
      return endBattle(s);
    }
    NS.log.push(s, 'battle.lost', { attacker: atk.uid });      // CR 7-1-4-2
    return endBattle(s);
  }

  // CR 4-6 / 7-1-4-1-1 — damage processing. Losing is "damaged with 0 Life", not "Life hits 0".
  function dealLeaderDamage(s, seat, n, banish) {
    var p = s.players[seat];
    for (var i = 0; i < n; i++) {
      if (!p.life.length) {                                    // CR 7-1-4-1-1-1
        p._lethal = true;
        NS.log.push(s, 'leader.lethal', { seat: seat });
        return afterEffect(s);
      }
      var id = p.life.shift();                                 // CR 3-10-2 — always the top
      if (banish) {                                            // CR 10-1-3-1 — no [Trigger]
        p.trash.push(id);
        NS.log.push(s, 'life.banished', { seat: seat, left: p.life.length });
        continue;
      }
      var c = S.card(id);
      var hasTrigger = (c.abilities || []).some(function (a) { return a.when === 'trigger'; });
      NS.log.push(s, 'life.taken', { seat: seat, left: p.life.length, trigger: hasTrigger });
      if (hasTrigger) {
        // CR 10-1-5 — an optional reveal, decided by the DAMAGED player during the attacker's
        // turn. Another queue step whose ctrl is the other seat.
        s.queue.unshift({ k: 'trigger', ctrl: seat, cardId: id, more: n - i - 1, banish: !!banish });
        return s;
      }
      p.hand.push(id);
    }
    return endBattle(s);
  }

  // THE OTHER LIFE DOOR — CR 3-10-2. Some cards read "Add 1 card from the top of your Life
  // cards to your hand". That is NOT damage processing: no [Trigger] is offered, because
  // CR 10-1-5-1 fires a [Trigger] only on taking damage. It lives here next to
  // dealLeaderDamage so tools/check-pages.mjs still has exactly one file to allow.
  function lifeToHand(s, seat, n) {
    var p = s.players[seat];
    for (var i = 0; i < n && p.life.length; i++) {
      p.hand.push(p.life.shift());                       // always the top (CR 3-10-2)
      NS.log.push(s, 'life.toHand', { seat: seat, left: p.life.length });
    }
    return s;
  }

  function endBattle(s) {
    if (s.battle) {
      NS.log.push(s, 'battle.end', { attacker: s.battle.attacker });
      // CR 7-1-5-2 — effects that read "if this ... battles" activate at the End of the Battle.
      s._battled = { attacker: s.battle.attacker, target: s.battle.target,
                     targetWasLeader: !!(S.findUnit(s, s.battle.target) && S.isLeader(s, S.findUnit(s, s.battle.target))) };
      [s.battle.attacker, s.battle.target].forEach(function (uid) {
        var u = S.findUnit(s, uid);
        if (u) fireAuto(s, 'endOfBattle', { unit: u, seat: S.seatOf(s, uid) });
      });
      delete s._battled;
    }
    // CR 7-1-5-3/4 — effects lasting "during this battle" become invalid.
    S.allUnits(s).forEach(function (u) {
      u.mods = u.mods.filter(function (m) { return m.until !== 'battle'; });
    });
    s.noBlock = s.noBlock.filter(function (l) { return l.scope !== 'battle'; });
    s.battle = null;
    s.phase = 'main';
    return afterEffect(s);
  }

  NS.engine = {
    enqueue: enqueue,
    offerChoice: offerChoice, execute: execute, draw: draw, trashFromHand: trashFromHand,
    koUnit: koUnit, playCardFree: playCardFree, hasTrigger: hasTrigger, fieldOf: fieldOf, fireAuto: fireAuto, condsMet: condsMet, costOps: costOps, canAfford: canAfford,
    beginTurn: beginTurn, endTurn: endTurn, declareAttack: declareAttack,
    openBlockStep: openBlockStep, openCounterStep: openCounterStep, damageStep: damageStep,
    dealLeaderDamage: dealLeaderDamage, lifeToHand: lifeToHand, endBattle: endBattle, blockers: blockers,
    counterOptions: counterOptions, checkDefeat: checkDefeat, clone: clone, gone: gone,
    _bind: bind
  };
}(window.OP = window.OP || {}));
