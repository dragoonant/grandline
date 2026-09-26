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
      if (sel.type && c.types.indexOf(sel.type) < 0) return false;
      if (sel.types && !sel.types.some(function (t) { return c.types.indexOf(t) >= 0; })) return false;
      if (sel.color && c.color.indexOf(sel.color) < 0) return false;
      if (sel.attr && c.attribute.indexOf(sel.attr) < 0) return false;
      if (sel.hasKw && !S.hasKeyword(s, u, sel.hasKw)) return false;
      if (sel.name && c.name !== sel.name) return false;
      return true;
    });
  }

  function pick(s, ctx, sel, prompt) {
    var cands = candidates(s, ctx, sel);
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
    return chosen.map(function (uid) { return S.findUnit(s, uid); }).filter(Boolean);
  }

  // =======================================================================================
  // Handlers
  // =======================================================================================
  var H = {};

  // CR 2-6-3 / 8-1-4-2 — a continuous power change for a stated duration.
  H.power = function (s, ctx, op) {
    pick(s, ctx, op.sel, op.prompt || 'Choose a card to modify').forEach(function (u) {
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
      return true;
    });
    var chosen = eligible.length ? E.offerChoice(s, {
      kind: 'deckpick', ctrl: ctx.ctrl, source: ctx.self,
      prompt: 'Add up to ' + (op.add || 1) + ' card to your hand',
      options: eligible.map(function (id, i) { return { v: id + '#' + i, label: S.card(id).name, cardId: id }; }),
      min: 0, max: op.add || 1
    }) : [];
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
    NS.log.push(s, 'deck.looked', { seat: ctx.ctrl, n: op.n, took: taken.length });
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
    pick(s, ctx, op.sel, op.prompt || 'Choose a Character to return').forEach(function (u) {
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
    p.donDeck -= n; p.donActive += n;
    NS.log.push(s, 'don.added', { seat: ctx.ctrl, n: n, donDeck: p.donDeck });
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

  // =======================================================================================
  // Describers — CLAUDE.md hard rule 7. js/text.js renders these; the auditor diffs the
  // result against the printed text. A describer that returns nothing is a thrown error.
  // =======================================================================================
  var D = {};
  var N = NS.names;

  function selText(sel) {
    sel = sel || {};
    var min = sel.min === undefined ? 1 : sel.min, max = sel.max === undefined ? min : sel.max;
    var qty = min === 0 ? 'up to ' + max : max > 1 ? max : '1';
    var who = sel.side === 'you' ? 'your' : sel.side === 'opp' ? "your opponent's" : '';
    var what = (sel.of || ['character']).map(function (k) {
      return k === 'leader' ? 'Leader' : k === 'stage' ? 'Stage' : 'Character';
    }).join(' or ');
    var bits = [];
    if (sel.state) bits.push(sel.state);
    if (sel.type) bits.push('{' + sel.type + '}' + ' type');
    var tail = [];
    if (sel.costMax !== undefined) tail.push('with a cost of ' + sel.costMax + ' or less');
    if (sel.powerMax !== undefined) tail.push('with ' + sel.powerMax + ' power or less');
    if (sel.notSelf) tail.push('other than this card');
    return (qty + ' of ' + who + ' ' + bits.join(' ') + ' ' + what + (max > 1 ? 's' : '') +
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
  D.gainKw = function (op) { return 'This Character gains [' + N.keyword(op.kw) + ']'; };
  D.lookAdd = function (op) {
    return 'Look at ' + op.n + ' cards from the top of your deck; reveal up to ' + (op.add || 1) +
      ' ' + (op.type ? '{' + op.type + '} type ' : '') + 'card and add it to your hand. ' +
      'Then, place the rest at the bottom of your deck in any order';
  };
  D.playCard = function (op) { return 'Play ' + op.id; };
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
  D.playFromHand = function (op) {
    return 'Play up to ' + (op.n || 1) + ' ' + (op.type ? '{' + op.type + '} type ' : '') +
      'card' + (op.costMax !== undefined ? ' with a cost of ' + op.costMax + ' or less' : '') + ' from your hand';
  };

  // =======================================================================================
  function run(s, ctx, ops) {
    if (!S) bind();
    for (var i = 0; i < ops.length; i++) {
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
