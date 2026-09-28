// js/ops.js — the effect grammar. CLAUDE.md hard rule 7: a new op is a handler PLUS a
// describer PLUS a test. Validation rejects an op with no handler; the describer throws on an
// op with no prose, so an op can never reach a card face as a blank.
//
// Every op that picks a card goes through OP.engine.offerChoice (hard rule 12). There is no
// second way to ask a question, which is what lets the UI, the AI and the black box all route
// a decision without knowing what asked it.
(function (NS) {
  'use strict';

  var S, E;
  function bind() { S = NS.state; E = NS.engine; }

  // =======================================================================================
  // Selectors — one resolver, so "up to 1 of your opponent's rested Characters with a cost of
  // 3 or less" is data and never a hand-written loop.
  // =======================================================================================
  function candidates(s, ctx, sel) {
    if (!S) bind();
    sel = sel || {};

    var out = [];
    var me = ctx.ctrl, opp = 1 - ctx.ctrl;
    var seats = sel.side === 'you' ? [me] : sel.side === 'opp' ? [opp] : [me, opp];
    var of = sel.of || ['character'];

    seats.forEach(function (seat) {
      var p = s.players[seat];
      if (of.indexOf('leader') >= 0) out.push(p.leader);
      if (of.indexOf('character') >= 0) out = out.concat(p.chars);
      if (of.indexOf('stage') >= 0 && p.stage) out.push(p.stage);
    });

    return out.filter(function (u) {
      var c = S.card(u.id);
      if (sel.prevTarget && (ctx.lastPicked || []).indexOf(u.uid) < 0) return false;
      if (sel.notSelf && u.uid === ctx.self) return false;
      if (sel.onlySelf && u.uid !== ctx.self) return false;
      if (sel.state === 'rested' && !u.rested) return false;
      if (sel.state === 'active' && u.rested) return false;
      if (sel.costMax !== undefined && !(c.cost !== null && c.cost <= sel.costMax)) return false;
      if (sel.costMin !== undefined && !(c.cost !== null && c.cost >= sel.costMin)) return false;
      // While a permanent effect is being evaluated, a power filter reads BASE power — see the
      // re-entrancy note at the top of js/statics.js.
      var pw = NS.statics.evaluating() ? (c.power === null ? 0 : c.power) : S.power(s, u);
      if (sel.powerMax !== undefined && pw > sel.powerMax) return false;
      if (sel.powerMin !== undefined && pw < sel.powerMin) return false;
      if (sel.basePowerMin !== undefined && (c.power === null || c.power < sel.basePowerMin)) return false;
      if (sel.basePowerMax !== undefined && !(c.power !== null && c.power <= sel.basePowerMax)) return false;
      if (sel.type && c.types.indexOf(sel.type) < 0) return false;
      if (sel.types && !sel.types.some(function (t) { return c.types.indexOf(t) >= 0; })) return false;
      if (sel.color && c.color.indexOf(sel.color) < 0) return false;
      if (sel.attr && c.attribute.indexOf(sel.attr) < 0) return false;
      if (sel.hasKw && !S.hasKeyword(s, u, sel.hasKw)) return false;
      if (sel.name && c.name !== sel.name) return false;
      // CR 2-1-2 — [Name] means cards with that card name.
      if (sel.names && sel.names.indexOf(c.name) < 0) return false;
      // CR 2-4-3-1 — a type in quotation marks means a type CONTAINING that text.
      if (sel.typeIncludes && !c.types.some(function (ty) {
        return ty.toLowerCase().indexOf(sel.typeIncludes.toLowerCase()) >= 0;
      })) return false;
      // "A or B" written as two alternative selectors sharing one filter.
      if (sel.anyOf && !sel.anyOf.some(function (alt) {
        // An alternative may be narrower than the whole selector: OP02-024 Moby Dick reaches your
        // [Edward.Newgate] Leader or Character, but only CHARACTERS by type.
        if (alt.of && alt.of.indexOf(S.isLeader(s, u) ? 'leader' : 'character') < 0) return false;
        if (alt.names && alt.names.indexOf(c.name) >= 0) return true;
        if (alt.typeIncludes && c.types.some(function (ty) {
          return ty.toLowerCase().indexOf(alt.typeIncludes.toLowerCase()) >= 0;
        })) return true;
        return false;
      })) return false;
      return true;
    });
  }

  function pick(s, ctx, sel, prompt) {
    var cands = candidates(s, ctx, sel);
    // "all of ..." chooses nothing: every match is affected (OP17-022 Shanks).
    if (sel && sel.all) { ctx.lastPicked = cands.map(function (u) { return u.uid; }); return cands; }
    // "this Character" and "that card" are not selections — the text names the card.
    if (sel && (sel.onlySelf || sel.prevTarget)) { ctx.lastPicked = cands.map(function (u) { return u.uid; }); return cands; }
    // Nothing legal to choose: say so, rather than resolve in silence.
    if (!cands.length) {
      NS.log.push(s, 'effect.noTarget', { seat: ctx.ctrl, id: ctx.cardId || null, prompt: prompt || '' });
      ctx.lastPicked = [];
      return [];
    }
    var min = sel.min === undefined ? 1 : sel.min;
    var max = sel.max === undefined ? Math.max(min, 1) : sel.max;
    var chosen = E.offerChoice(s, {
      kind: 'target',
      ctrl: ctx.ctrl,
      prompt: prompt || 'Choose a target',
      source: ctx.self,
      options: cands.map(function (u) {
        return { v: u.uid, label: S.card(u.id).name, uid: u.uid };
      }),
      min: min, max: max
    });
    var units = chosen.map(function (uid) { return S.findUnit(s, uid); }).filter(Boolean);
    // CR 8-4-4 — a later clause may say "that card", meaning the one just chosen. The engine
    // remembers the last selection on the invocation context so the follow-on clause is a
    // selector like any other rather than a special case.
    ctx.lastPicked = units.map(function (u) { return u.uid; });
    return units;
  }

  // =======================================================================================
  // Handlers
  // =======================================================================================
  var H = {};

  // CR 2-6-3 / 8-1-4-2 — a continuous power change for a stated duration.
  H.power = function (s, ctx, op) {
    pick(s, ctx, op.sel, op.prompt || ('Choose a card to get ' + (op.n >= 0 ? '+' : '−') + Math.abs(op.n) + ' power')).forEach(function (u) {
      u.mods.push({ stat: 'power', n: op.n, until: op.until || 'turn', src: ctx.self });
      NS.log.push(s, 'power.mod', { uid: u.uid, n: op.n, until: op.until || 'turn' });
    });
  };

  // CR 10-2-1 — K.O. means place a Character from the Character area into its owner's trash.
  H.ko = function (s, ctx, op) {
    pick(s, ctx, op.sel, op.prompt || 'Choose a Character to K.O.').forEach(function (u) {
      E.koUnit(s, u.uid, ctx.self);
    });
  };

  H.rest = function (s, ctx, op) {
    pick(s, ctx, op.sel, op.prompt || 'Choose a card to rest').forEach(function (u) {
      if (!u.rested) { u.rested = true; NS.log.push(s, 'unit.rested', { uid: u.uid }); }
    });
  };

  H.setActive = function (s, ctx, op) {
    pick(s, ctx, op.sel, op.prompt || 'Choose a card to set as active').forEach(function (u) {
      if (u.rested) { u.rested = false; NS.log.push(s, 'unit.active', { uid: u.uid }); }
    });
  };

  H.draw = function (s, ctx, op) { E.draw(s, ctx.ctrl, op.n); };

  // CR 6-5-5-1 — "giving" moves an ACTIVE DON!! from the cost area under a Leader/Character.
  // Several cards instead give a RESTED DON!! card; the engine tracks the cost area as two
  // counts, so `from` says which pool the DON!! comes out of.
  H.giveDon = function (s, ctx, op) {
    var p = s.players[ctx.ctrl];
    var pool = op.from === 'rested' ? 'donRested' : 'donActive';
    var n = Math.min(op.n, p[pool]);
    if (n <= 0) return;
    var sel = op.sel || { side: 'you', of: ['leader', 'character'], min: 0, max: 1 };
    var targets = pick(s, ctx, sel, 'Choose a card to give ' + n + ' DON!! to');
    targets.forEach(function (u) {
      p[pool] -= n;
      u.don += n;
      NS.log.push(s, 'don.given', { uid: u.uid, n: n, from: op.from || 'active' });
    });
  };

  // "Set up to N of your DON!! cards as active" — moves DON!! from rested to active in the
  // cost area. CR 3-9-3.
  H.setDonActive = function (s, ctx, op) {
    var p = s.players[ctx.ctrl];
    var n = Math.min(op.n, p.donRested);
    if (n <= 0) return;
    p.donRested -= n; p.donActive += n;
    NS.log.push(s, 'don.setActive', { seat: ctx.ctrl, n: n });
  };

  H.restOppDon = function (s, ctx, op) {
    var p = s.players[1 - ctx.ctrl];
    var n = Math.min(op.n, p.donActive);
    if (n <= 0) return;
    p.donActive -= n; p.donRested += n;
    NS.log.push(s, 'don.restedOpp', { seat: 1 - ctx.ctrl, n: n });
  };

  H.trashHand = function (s, ctx, op) { E.trashFromHand(s, ctx.ctrl, op.n); };

  // A [Trigger] that reads "Play this card." — CR 10-1-5-3 says the card is in no area while
  // its [Trigger] resolves, so the engine hands the id in rather than moving it from a zone.
  H.playSelf = function (s, ctx) {
    if (!ctx.cardId) throw new Error('playSelf: no cardId in context');
    // CR 10-1-5-3 — "trash that card unless otherwise specified". Playing it IS otherwise
    // specified; the Trigger step reads this marker instead of trashing a card that is on the
    // field. Without it every "[Trigger] Play this card." put one card in two places.
    s._playedSelf = ctx.cardId;
    E.playCardFree(s, ctx.ctrl, ctx.cardId);
  };

  // "Your opponent cannot activate [Blocker] during this battle."
  H.noBlocker = function (s, ctx, op) {
    var scope = op.scope || 'battle';
    s.noBlock.push({ seat: 1 - ctx.ctrl, scope: scope, powerMin: op.powerMin, uid: op.uid || null });
    NS.log.push(s, 'blocker.locked', { seat: 1 - ctx.ctrl, scope: scope, powerMin: op.powerMin || null });
  };

  H.gainKw = function (s, ctx, op) {
    pick(s, ctx, op.sel || { onlySelf: true, of: ['character'], min: 1, max: 1 },
         'Choose a card to gain ' + op.kw).forEach(function (u) {
      if (u.keywords.indexOf(op.kw) < 0) {
        u.keywords.push(op.kw);
        NS.log.push(s, 'kw.gained', { uid: u.uid, kw: op.kw });
      }
    });
  };

  // "Look at N cards from the top of your deck; reveal up to 1 {type} card and add it to your
  // hand. Then, place the rest at the bottom of your deck in any order." CR 11-3.
  H.lookAdd = function (s, ctx, op) {
    var p = s.players[ctx.ctrl];
    var seen = p.deck.slice(0, op.n);
    if (!seen.length) return;
    var eligible = seen.filter(function (id) {
      var c = S.card(id);
      if (op.type && c.types.indexOf(op.type) < 0) return false;
      if (op.category && c.category !== op.category) return false;
      if (op.costMax !== undefined && !(c.cost !== null && c.cost <= op.costMax)) return false;
      if (op.costMin !== undefined && !(c.cost !== null && c.cost >= op.costMin)) return false;
      if (op.excludeName && c.name === op.excludeName) return false;   // CR 2-1-2
      return true;
    });
    // CR 8-4-4-4 — the player looks at every card's face, including the ones they may not take,
    // so the question carries all of them. It used to carry only the eligible ones, and the
    // player never saw what they were putting on the bottom.
    // Shown even when nothing qualifies — the player still looked at those cards (PLAN.md D8).
    var chosen = E.offerChoice(s, {
      kind: 'deckpick', ctrl: ctx.ctrl, source: ctx.self, seen: seen.slice(), showEmpty: true,
      prompt: !op.add ? 'You looked at these cards; they go to the bottom of your deck'
        : eligible.length ? 'Add up to ' + op.add + ' card to your hand'
        : 'None of these qualify — they all go to the bottom of your deck',
      options: (op.add ? eligible : []).map(function (id, i) { return { v: id + '#' + i, label: S.card(id).name, cardId: id }; }),
      min: 0, max: Math.max(1, op.add || 0)
    }).filter(function (v) { return v !== '__done'; });
    if (!op.add) chosen = [];
    var taken = chosen.map(function (v) { return v.split('#')[0]; });
    taken.forEach(function (id) {
      var at = p.deck.indexOf(id);
      if (at >= 0) { p.deck.splice(at, 1); p.hand.push(id); }
    });
    // The rest go to the bottom, in the order they were seen. CR 3-1-7 lets the owner choose
    // the order; the AI never cares and a human ordering step here is all cost and no play.
    var rest = seen.filter(function (id) { return taken.indexOf(id) < 0 || false; });
    rest = seen.slice();
    taken.forEach(function (id) { var i = rest.indexOf(id); if (i >= 0) rest.splice(i, 1); });
    p.deck = p.deck.slice(rest.length);
    p.deck = p.deck.concat(rest);
    // "reveal up to 1 ... and add it" — the revealed card is public; the rest are not.
    NS.log.push(s, 'deck.looked', { seat: ctx.ctrl, n: op.n, took: taken.length, revealed: taken.slice() });
  };

  // "Play up to 1 {type} card with a cost of N or less from your hand."
  H.playFromHand = function (s, ctx, op) {
    var p = s.players[ctx.ctrl];
    var eligible = p.hand.filter(function (id) {
      var c = S.card(id);
      if (c.category !== (op.category || 'CHARACTER')) return false;
      if (op.type && c.types.indexOf(op.type) < 0) return false;
      if (op.costMax !== undefined && !(c.cost !== null && c.cost <= op.costMax)) return false;
      return true;
    });
    if (!eligible.length) return;
    var chosen = E.offerChoice(s, {
      kind: 'handpick', ctrl: ctx.ctrl, source: ctx.self,
      prompt: 'Play up to ' + (op.n || 1) + ' card from your hand without paying its cost',
      options: eligible.map(function (id, i) { return { v: id + '#' + i, label: S.card(id).name, cardId: id }; }),
      min: 0, max: op.n || 1
    });
    chosen.map(function (v) { return v.split('#')[0]; }).forEach(function (id) {
      var at = p.hand.indexOf(id);
      if (at >= 0) { p.hand.splice(at, 1); E.playCardFree(s, ctx.ctrl, id); }
    });
  };

  // Playing a card is an op so that it runs inside an invocation. Without this the Character
  // area overflow choice (CR 3-7-6-1) calls offerChoice OUTSIDE execute(), and OP_NEED_CHOICE
  // escapes apply() entirely — found by the CR 3-7-6 test, which is what that test is for.
  // The cost is already paid and the card already out of hand when this runs, so re-running the
  // invocation to answer a question re-plays only the placement, which is idempotent.
  H.playCard = function (s, ctx, op) {
    E.playCardFree(s, ctx.ctrl, op.id);
  };

  // CR 4-11 — "remove" a card from its area to another. Returning a Character to hand, or to
  // the top or bottom of its owner's deck.
  H.bounce = function (s, ctx, op) {
    var where = op.to || 'hand';
    pick(s, ctx, op.sel, op.prompt || ('Choose a Character to return to ' + (op.to === 'hand' || !op.to ? 'its owner\u2019s hand' : 'the ' + op.to + ' of its owner\u2019s deck'))).forEach(function (u) {
      var seat = S.seatOf(s, u.uid);
      if (seat < 0) return;
      var p = s.players[seat];
      var ix = -1;
      for (var i = 0; i < p.chars.length; i++) if (p.chars[i].uid === u.uid) ix = i;
      if (ix < 0) return;                                  // a Leader cannot be moved (CR 3-6-3)
      // CR 6-5-5-4 — DON!! given to a card that changes area goes back to the cost area, rested.
      if (p.chars[ix].don > 0) { p.donRested += p.chars[ix].don; }
      var id = p.chars[ix].id;
      p.chars.splice(ix, 1);
      if (where === 'hand') p.hand.push(id);
      else if (where === 'top') p.deck.unshift(id);
      else p.deck.push(id);
      NS.log.push(s, 'char.returned', { id: id, seat: seat, to: where });
    });
  };

  // "Add up to N DON!! card from your DON!! deck and set it as active." CR 3-3 / 3-9-3.
  H.addDon = function (s, ctx, op) {
    var p = s.players[ctx.ctrl];
    var n = Math.min(op.n, p.donDeck);
    if (n <= 0) return;
    p.donDeck -= n;
    if (op.rested) p.donRested += n; else p.donActive += n;
    NS.log.push(s, 'don.added', { seat: ctx.ctrl, n: n, rested: !!op.rested, donDeck: p.donDeck });
  };

  // "Select up to 1 of your {T} type Leader or Character cards. Your opponent cannot activate
  // [Blocker] if that Leader or Character attacks during this turn." A per-card lock, so it is
  // recorded against the chosen uid rather than against the seat.
  H.markNoBlocker = function (s, ctx, op) {
    pick(s, ctx, op.sel, 'Choose a card your opponent cannot block this turn').forEach(function (u) {
      s.noBlock.push({ seat: 1 - ctx.ctrl, scope: 'turn', attackerUid: u.uid });
      NS.log.push(s, 'blocker.lockedFor', { uid: u.uid, seat: 1 - ctx.ctrl });
    });
  };

  // "Add N cards from the top of your Life cards to your hand." CR 3-10-2 — always the top, and
  // this is NOT damage, so no [Trigger] is offered (CR 10-1-5-1 fires on damage only).
  H.lifeToHand = function (s, ctx, op) {
    E.lifeToHand(s, ctx.ctrl, op.n);        // the one Life door lives in js/engine.js
  };

  // "you cannot play Character cards during this turn" — a prohibition, and CR 1-3-3 says a
  // prohibiting effect always takes precedence over an effect that would allow the action.
  H.lockPlay = function (s, ctx, op) {
    s.lockPlay.push({ seat: ctx.ctrl, category: op.what, until: 'turn' });
    NS.log.push(s, 'play.locked', { seat: ctx.ctrl, category: op.what });
  };

  // "Reveal 1 card from the top of your deck. If its type includes X, draw N." CR 11-2.
  H.revealTop = function (s, ctx, op) {
    var p = s.players[ctx.ctrl];
    if (!p.deck.length) return;
    var seen = p.deck.slice(0, op.n);
    NS.log.push(s, 'deck.revealed', { seat: ctx.ctrl, ids: seen });
    var hit = seen.some(function (id) {
      return S.card(id).types.some(function (ty) {
        return ty.toLowerCase().indexOf(op.typeIncludes.toLowerCase()) >= 0;
      });
    });
    if (hit && op.thenDraw) E.draw(s, ctx.ctrl, op.thenDraw);
  };

  // CR 8-1-3-3-3 — "under the rules" effects are valid even from a secret area. The DON!! deck
  // size is read at setup, so this handler exists only so the op has one; js/actions.js
  // newGame() reads the Leader's static directly.
  H.donDeckSize = function (s, ctx, op) {
    NS.log.push(s, 'don.deckSize', { seat: ctx.ctrl, n: op.n });
  };

  // CR 4-10-1 — "Then, if <condition>, <effect>": if the "if" clause cannot be resolved,
  // the clause that follows it is not resolved either. One op that guards a nested run, so a
  // conditional follow-on is data like everything else.
  H.ifThen = function (s, ctx, op) {
    var u = S.findUnit(s, ctx.self);
    var probe = u || { uid: ctx.self, id: ctx.cardId, don: 0, rested: false, onceUsed: {} };
    if (!E.condsMet(s, probe, { conds: [op.cond] }, {}, ctx.ctrl)) return;
    run(s, ctx, op.ops);
  };

  // ---------------------------------------------------------------------------------------
  // Activation costs as ops (CR 8-3-1). An AUTO effect must pay its cost too, and paying may
  // itself ask a question (trashing from hand). Running the cost as the first ops of the same
  // invocation means the whole thing stays atomic: if the player is asked something mid-payment
  // the partial run is discarded and replayed with the answer, exactly like any other effect.
  // ---------------------------------------------------------------------------------------
  H.payRestDon = function (s, ctx, op) {
    var p = s.players[ctx.ctrl];
    if (p.donActive < op.n) throw new Error('payRestDon: cannot pay, should have been checked');
    p.donActive -= op.n; p.donRested += op.n;                      // CR 8-3-1-5
    NS.log.push(s, 'cost.restDon', { seat: ctx.ctrl, n: op.n });
  };

  // CR 8-3-1-6 — "DON!! −X": the PLAYER selects X DON!! cards from their Leader area, Character
  // area and cost area and returns them to the DON!! deck. One card at a time, through the
  // choice door, and asked even when only one source is left (PLAN.md D8). The engine used to
  // pick for the player, and the choice matters: stripping a given DON!! can switch off a
  // [DON!! xN] effect, and returning an active one costs a play this turn.
  H.payDonMinus = function (s, ctx, op) {
    var p = s.players[ctx.ctrl];
    for (var k = 0; k < op.n; k++) {
      var opts = [];
      if (p.donActive > 0) opts.push({ v: '__active', label: 'An ACTIVE DON!! in your cost area (' + p.donActive + ')' });
      if (p.donRested > 0) opts.push({ v: '__rested', label: 'A RESTED DON!! in your cost area (' + p.donRested + ')' });
      [p.leader].concat(p.chars).forEach(function (u) {
        if (u.don > 0) opts.push({ v: u.uid, uid: u.uid, label: 'A DON!! given to ' + S.card(u.id).name + ' (' + u.don + ')' });
      });
      if (!opts.length) break;
      var got = E.offerChoice(s, { kind: 'donMinus', ctrl: ctx.ctrl, source: ctx.self, cardId: ctx.cardId,
                                   prompt: 'Return a DON!! card to your DON!! deck (' + (k + 1) + ' of ' + op.n + ')',
                                   options: opts, min: 1, max: 1 })[0];
      if (got === '__active') p.donActive -= 1;
      else if (got === '__rested') p.donRested -= 1;
      else { var gu = S.findUnit(s, got); if (gu && gu.don > 0) gu.don -= 1; else throw new Error('payDonMinus: no DON!! on ' + got); }
      p.donDeck += 1;
      NS.log.push(s, 'cost.donMinus', { seat: ctx.ctrl, n: 1, from: got.charAt(0) === '_' ? got.slice(2) : got });
    }
  };

  H.payRestSelf = function (s, ctx) {
    var u = S.findUnit(s, ctx.self);
    if (u) { u.rested = true; NS.log.push(s, 'cost.restSelf', { uid: u.uid }); }
  };

  // "trash 1 card (with a [Trigger]) from your hand" as a cost.
  H.payTrashHand = function (s, ctx, op) {
    E.trashFromHand(s, ctx.ctrl, op.n, op.withTrigger ? E.hasTrigger : null);
  };

  // "rest 1 of your cards" (OP14-020 Mihawk) — Leader, Character, Stage, or an active DON!!.
  H.payRestOwn = function (s, ctx, op) {
    var p = s.players[ctx.ctrl];
    for (var r = 0; r < op.n; r++) {
      var pool = [p.leader].concat(p.chars, p.stage ? [p.stage] : [])
        .filter(function (x) { return !x.rested; })
        .map(function (x) { return { v: x.uid, label: S.card(x.id).name, uid: x.uid }; });
      if (p.donActive > 0) pool.push({ v: '__don', label: 'an active DON!! card' });
      var got = E.offerChoice(s, { kind: 'cost', ctrl: ctx.ctrl, source: ctx.self,
                                   prompt: 'Rest one of your cards to pay for this',
                                   options: pool, min: 1, max: 1 })[0];
      var restedId = null;
      if (got === '__don') { p.donActive -= 1; p.donRested += 1; }
      else { var pu = S.findUnit(s, got); if (pu) { pu.rested = true; restedId = pu.id; } }
      NS.log.push(s, 'cost.restOwn', { seat: ctx.ctrl, id: restedId });
    }
  };

  // THE ONE COST DOOR — CR 8-3-1. Every activation cost is paid through this op at the front of
  // its effect's invocation, so paying can ask questions and a declined or unpayable cost stops
  // the effect after the colon (CR 8-3-1-3, 8-3-1-4). Before it existed, Event, Counter and
  // Trigger costs were never paid at all, and "You may" costs on auto effects were taken
  // without asking.
  var COST_TEXT = {
    restDon: function (c) { return 'rest ' + c.n + ' DON!!'; },
    donMinus: function (c) { return 'return ' + c.n + ' DON!! to your DON!! deck'; },
    restSelf: function () { return 'rest this card'; },
    trashHand: function (c) { return 'trash ' + c.n + ' card' + (c.n === 1 ? '' : 's') + (c.withTrigger ? ' with a [Trigger]' : '') + ' from your hand'; },
    restOwn: function (c) { return 'rest ' + c.n + ' of your cards'; }
  };
  H.cost = function (s, ctx, op) {
    var u = S.findUnit(s, ctx.self);
    if (!E.canAfford(s, ctx.ctrl, u || { rested: true }, { cost: op.costs })) { ctx.stop = true; return; }
    if (op.optional) {
      var yes = E.offerChoice(s, {
        kind: 'confirm', ctrl: ctx.ctrl, source: ctx.self, cardId: ctx.cardId,
        prompt: 'Pay the cost? (' + op.costs.map(function (c) { return COST_TEXT[c.k](c); }).join(', ') + ')',
        options: [{ v: 'yes', label: 'Pay: ' + op.costs.map(function (c) { return COST_TEXT[c.k](c); }).join(', ') },
                  { v: 'no', label: 'Decline' }],
        min: 1, max: 1
      })[0];
      if (yes !== 'yes') {
        ctx.stop = true;
        // CR 8-3-1-4 — declining means the effect was not activated, so a [Once Per Turn]
        // effect is still available (OP17-058 Kaido may pay on the NEXT attack instead).
        if (ctx.onceKey && u) u.onceUsed[ctx.onceKey] = false;
        NS.log.push(s, 'cost.declined', { seat: ctx.ctrl, id: ctx.cardId });
        return;
      }
    }
    op.costs.forEach(function (c) {
      if (c.k === 'restDon') H.payRestDon(s, ctx, c);
      else if (c.k === 'donMinus') H.payDonMinus(s, ctx, c);
      else if (c.k === 'restSelf') H.payRestSelf(s, ctx, c);
      else if (c.k === 'trashHand') H.payTrashHand(s, ctx, c);
      else if (c.k === 'restOwn') H.payRestOwn(s, ctx, c);
      else throw new Error('cost: unknown activation cost "' + c.k + '"');
    });
  };

  // =======================================================================================
  // Describers — CLAUDE.md hard rule 7. js/text.js renders these; the auditor diffs the
  // result against the printed text. A describer that returns nothing is a thrown error.
  // =======================================================================================
  var D = {};
  var N = NS.names;

  function selText(sel) {
    sel = sel || {};
    if (sel.prevTarget) return 'that card';
    if (sel.anyOf) {
      // The branches share the outer selector's side, kind and filters; only the identity
      // differs, so the prose names the identities and then the shared filter once.
      var alts = sel.anyOf.map(function (a) {
        if (a.names) return '[' + a.names.join('] or [') + ']';
        if (a.typeIncludes) return 'with a type including "' + a.typeIncludes + '"';
        return 'matching';
      }).join(' or ');
      var rest = Object.assign({}, sel); delete rest.anyOf;
      return selText(rest).replace(/(Characters?|Leaders?)/, alts + ' $1');
    }
    var min = sel.min === undefined ? 1 : sel.min, max = sel.max === undefined ? min : sel.max;
    var qty = sel.all ? 'all' : min === 0 ? 'up to ' + max : max > 1 ? max : '1';
    var who = sel.side === 'you' ? 'your' : sel.side === 'opp' ? "your opponent's" : '';
    var what = (sel.of || ['character']).map(function (k) {
      return k === 'leader' ? 'Leader' : k === 'stage' ? 'Stage' : 'Character';
    }).join(' or ');
    var bits = [];
    if (sel.state) bits.push(sel.state);
    if (sel.type) bits.push('{' + sel.type + '}' + ' type');
    if (sel.names) bits.push(sel.names.map(function (n) { return '[' + n + ']'; }).join(' and '));
    if (sel.typeIncludes) bits.push('with a type including "' + sel.typeIncludes + '"');
    if (sel.anyOf) {
      bits.push(sel.anyOf.map(function (a) {
        return a.names ? a.names.map(function (n) { return '[' + n + ']'; }).join(' and ')
                       : 'with a type including "' + a.typeIncludes + '"';
      }).join(' or '));
    }
    var tail = [];
    if (sel.costMax !== undefined) tail.push('with a cost of ' + sel.costMax + ' or less');
    if (sel.powerMax !== undefined) tail.push('with ' + sel.powerMax + ' power or less');
    if (sel.powerMin !== undefined) tail.push('with ' + sel.powerMin + ' power or more');
    if (sel.basePowerMin !== undefined) tail.push('with ' + sel.basePowerMin + ' base power or more');
    if (sel.basePowerMax !== undefined) tail.push('with ' + sel.basePowerMax + ' base power or less');
    if (sel.costMin !== undefined) tail.push('with a cost of ' + sel.costMin + ' or more');
    if (sel.notSelf) tail.push('other than this card');
    return (qty + ' of ' + who + ' ' + bits.join(' ') + ' ' + what + (max > 1 || sel.all ? 's' : '') +
            (tail.length ? ' ' + tail.join(' ') : '')).replace(/\s+/g, ' ').trim();
  }

  var DUR = { turn: 'during this turn', battle: 'during this battle',
              oppEnd: "until the end of your opponent's next End Phase" };

  D.power = function (op) {
    var sign = op.n >= 0 ? '+' : '−';
    return 'Give ' + selText(op.sel) + ' ' + sign + Math.abs(op.n) + ' power ' + (DUR[op.until] || DUR.turn);
  };
  D.ko = function (op) { return 'K.O. ' + selText(op.sel); };
  D.rest = function (op) { return 'Rest ' + selText(op.sel); };
  D.setActive = function (op) { return 'Set ' + selText(op.sel) + ' as active'; };
  D.draw = function (op) { return 'Draw ' + op.n + ' card' + (op.n === 1 ? '' : 's'); };
  D.giveDon = function (op) {
    return 'Give ' + selText(op.sel || { side: 'you', of: ['leader', 'character'], min: 0, max: 1 }) +
           ' up to ' + op.n + ' ' + (op.from === 'rested' ? 'rested ' : '') + 'DON!! card' + (op.n === 1 ? '' : 's');
  };
  D.setDonActive = function (op) { return 'Set up to ' + op.n + ' of your DON!! cards as active'; };
  D.restOppDon = function (op) { return "Rest up to " + op.n + " of your opponent's DON!! cards"; };
  D.trashHand = function (op) { return 'Trash ' + op.n + ' card' + (op.n === 1 ? '' : 's') + ' from your hand'; };
  D.playSelf = function () { return 'Play this card'; };
  D.noBlocker = function (op) {
    return 'Your opponent cannot activate ' +
      (op.powerMin ? 'a [Blocker] Character that has ' + op.powerMin + ' or more power' : '[Blocker]') +
      ' ' + (DUR[op.scope] || DUR.battle);
  };
  D.gainKw = function (op) {
    // A describer that drops its selector is a describer that lies, and the auditor caught this
    // one: OP16-001 grants [Rush] to a chosen Character with 8000 power or more, and this used
    // to render "This Character gains [Rush]" regardless (hard rule 7).
    var sel = op.sel || {};
    var subject = sel.onlySelf ? 'This Character' : selText(sel);
    var dur = op.until === 'battle' ? ' during this battle'
            : op.until === 'turn' ? ' during this turn' : '';
    return subject + ' gains [' + NS.names.keyword(op.kw) + ']' + dur;
  };
  D.lookAdd = function (op) {
    return 'Look at ' + op.n + ' cards from the top of your deck; reveal up to ' + (op.add || 1) +
      ' ' + (op.type ? '{' + op.type + '} type ' : '') + 'card and add it to your hand. ' +
      'Then, place the rest at the bottom of your deck in any order';
  };
  D.playCard = function (op) { return 'Play ' + op.id; };
  D.lifeToHand = function (op) {
    return 'Add ' + op.n + ' card' + (op.n === 1 ? '' : 's') + ' from the top of your Life cards to your hand';
  };
  D.lockPlay = function (op) {
    return 'You cannot play ' + (op.what === 'CHARACTER' ? 'Character' : op.what) + ' cards during this turn';
  };
  D.revealTop = function (op) {
    return 'Reveal ' + op.n + ' card from the top of your deck. If the revealed card\u2019s type includes "' +
           op.typeIncludes + '", draw ' + op.thenDraw + ' card' + (op.thenDraw === 1 ? '' : 's');
  };
  D.donDeckSize = function (op) {
    return 'Under the rules of this game, your DON!! deck consists of ' + op.n + ' cards';
  };
  D.bounce = function (op) {
    var where = op.to === 'hand' ? "the owner's hand"
      : op.to === 'top' ? "the top of the owner's deck" : "the bottom of the owner's deck";
    return 'Return ' + selText(op.sel) + ' to ' + where;
  };
  D.addDon = function (op) {
    return 'Add up to ' + op.n + ' DON!! card' + (op.n === 1 ? '' : 's') +
           ' from your DON!! deck and set it as active';
  };
  D.markNoBlocker = function (op) {
    return 'Select ' + selText(op.sel) +
           '. Your opponent cannot activate [Blocker] if that card attacks during this turn';
  };
  D.ifThen = function (op) {
    return NS.text.condPhrase(op.cond) + ' ' +
           op.ops.map(function (o) { return describe(o); }).join('. Then, ');
  };
  D.payRestDon = function (op) { return 'rest ' + op.n + ' DON!! card' + (op.n === 1 ? '' : 's'); };
  D.payDonMinus = function (op) { return 'DON!! \u2212' + op.n; };
  D.payRestSelf = function () { return 'rest this card'; };
  D.payTrashHand = function (op) { return 'trash ' + op.n + ' card' + (op.n === 1 ? '' : 's') + ' from your hand'; };
  D.payRestOwn = function (op) { return 'rest ' + op.n + ' of your cards'; };
  D.cost = function (op) {
    return (op.optional ? 'You may ' : '') + op.costs.map(function (c) { return COST_TEXT[c.k](c); }).join(' and ');
  };
  D.playFromHand = function (op) {
    return 'Play up to ' + (op.n || 1) + ' ' + (op.type ? '{' + op.type + '} type ' : '') +
      'card' + (op.costMax !== undefined ? ' with a cost of ' + op.costMax + ' or less' : '') + ' from your hand';
  };

  // =======================================================================================
  function run(s, ctx, ops) {
    if (!S) bind();
    for (var i = 0; i < ops.length; i++) {
      if (ctx.stop) break;                       // a cost was declined or could not be paid
      var op = ops[i];
      var h = H[op.k];
      if (!h) throw new Error('ops.run: no handler for op "' + op.k + '"');
      h(s, ctx, op);
    }
    return s;
  }

  function describe(op) {
    var d = D[op.k];
    if (!d) throw new Error('ops.describe: no describer for op "' + op.k + '" — hard rule 7');
    var t = d(op);
    if (!t) throw new Error('ops.describe: describer for "' + op.k + '" returned nothing');
    return t;
  }

  function known(k) { return !!H[k]; }

  NS.ops = { run: run, describe: describe, known: known, candidates: candidates,
             handlers: H, describers: D, selText: selText };
}(window.OP = window.OP || {}));
