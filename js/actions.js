// js/actions.js — legalActions / apply / isTerminal / whoActs, attached to OP.engine.
// CLAUDE.md hard rule 2: this is the entire engine surface. Hard rule 3: every UI affordance
// derives from legalActions, so the UI cannot invent a rule. Hard rule 4: a pending queue head
// OWNS the turn and legalActions THROWS on a head that offers nothing.
(function (NS) {
  'use strict';

  var S = NS.state, E = NS.engine;
  if (!S || !E) throw new Error('actions: js/state.js and js/engine.js must load first (hard rule 11)');
  function bind() { return S; }

  // =======================================================================================
  // whoActs — the one answer to "whose input is needed". The reactive window works because a
  // Block/Counter/Trigger step carries ctrl for the OTHER seat and this reads it (CR 7-1-2).
  // =======================================================================================
  function whoActs(s) {
    if (s.winner !== null) return null;
    var h = s.queue[0];
    if (h && h.ctrl !== undefined && h.ctrl !== null) return h.ctrl;
    return s.active;
  }

  function isTerminal(s) { return s.winner !== null; }

  // =======================================================================================
  function legalActions(s) {
    bind();
    if (s.winner !== null) return [];
    var h = s.queue[0];
    var acts = h ? headActions(s, h) : mainActions(s);
    if (!acts.length) {
      throw new Error('legalActions: head "' + (h ? h.k : 'main') +
                      '" offers nothing — hard rule 4');
    }
    return acts;
  }

  function headActions(s, h) {
    switch (h.k) {
      case 'mulligan':                                          // CR 5-2-1-6
        return [{ t: 'keepHand' }, { t: 'redraw' }];

      case 'choice': {
        var acts = h.q.options.map(function (o) {
          return { t: 'choose', v: o.v, label: o.label, uid: o.uid, cardId: o.cardId };
        });
        if (h.q.canStop) acts.push({ t: 'choose', v: '__done', label: 'Done' });
        return acts;
      }

      case 'block': {                                           // CR 7-1-2
        var out = E.blockers(s).map(function (u) {
          return { t: 'block', uid: u.uid, label: S.card(u.id).name, power: S.power(s, u) };
        });
        out.push({ t: 'noBlock', label: 'Do not block' });
        return out;
      }

      case 'counter': {                                         // CR 7-1-3
        var opts = E.counterOptions(s).map(function (o) {
          return { t: 'counter', kind: o.kind, id: o.id, ix: o.ix, n: o.n,
                   cost: o.cost, label: o.name };
        });
        opts.push({ t: 'noCounter', label: 'Done countering' });
        return opts;
      }

      case 'trigger':                                           // CR 10-1-5-2
        return [{ t: 'useTrigger', cardId: h.cardId, label: S.card(h.cardId).name },
                { t: 'takeLife', cardId: h.cardId, label: 'Add it to your hand' }];

      default:
        throw new Error('headActions: unknown queue head "' + h.k + '"');
    }
  }

  // CR 6-5-2 — Main Phase actions: play a card, activate an effect, give DON!!, battle.
  function mainActions(s) {
    var seat = s.active, p = s.players[seat], out = [];

    p.hand.forEach(function (id, ix) {
      var c = S.card(id);
      if (c.cost === null || c.cost > p.donActive) return;      // CR 2-7-2
      // CR 1-3-3 — a prohibiting effect always takes precedence.
      if ((s.lockPlay || []).some(function (l) { return l.seat === seat && l.category === c.category; })) return;
      if (c.category === 'CHARACTER' || c.category === 'STAGE') {
        out.push({ t: 'play', id: id, ix: ix, cost: c.cost, label: c.name });
      } else if (c.category === 'EVENT' &&
                 (c.abilities || []).some(function (a) { return a.when === 'main'; })) {
        out.push({ t: 'event', id: id, ix: ix, cost: c.cost, label: c.name });
      }
    });

    // CR 6-5-4-1 — the turn player may activate [Activate: Main] and [Main] effects.
    [p.leader].concat(p.chars, p.stage ? [p.stage] : []).forEach(function (u) {
      (S.card(u.id).abilities || []).forEach(function (ab, i) {
        if (ab.when !== 'activateMain') return;
        if (ab.once && u.onceUsed['activateMain' + i]) return;  // CR 10-2-13
        if (!E.condsMet(s, u, ab)) return;
        if (!canPayCost(s, seat, u, ab)) return;                // CR 8-3-1-3
        out.push({ t: 'activate', uid: u.uid, i: i, label: S.card(u.id).name });
      });
    });

    // CR 6-5-5 — give 1 active DON!! to your Leader or a Character.
    if (p.donActive > 0) {
      [p.leader].concat(p.chars).forEach(function (u) {
        out.push({ t: 'giveDon', uid: u.uid, label: S.card(u.id).name });
      });
    }

    // CR 6-5-6 / 7-1. Neither player can battle on their first turn (CR 6-5-6-1).
    if (s.turn > 1) {
      attackers(s, seat).forEach(function (a) {
        targetsFor(s, seat, a).forEach(function (tg) {
          out.push({ t: 'attack', uid: a.uid, target: tg.uid,
                     label: S.card(a.id).name + ' → ' + S.card(tg.id).name });
        });
      });
    }

    out.push({ t: 'endTurn', label: 'End turn' });
    return out;
  }

  function attackers(s, seat) {
    var p = s.players[seat];
    var out = [];
    if (!p.leader.rested) out.push(p.leader);                   // CR 7-1-1-1
    p.chars.forEach(function (u) {
      if (u.rested) return;
      // CR 3-7-4 — a card played this turn cannot attack unless it has [Rush] (CR 10-1-1).
      var sick = u.playedOn >= s.turn;
      if (sick && !S.hasKeyword(s, u, 'rush') && !S.hasKeyword(s, u, 'rushCharacter')) return;
      out.push(u);
    });
    return out;
  }

  // CR 7-1-1-2 — the target is the opponent's Leader, or one of their RESTED Characters.
  function targetsFor(s, seat, attacker) {
    var o = s.players[1 - seat];
    var sick = attacker.playedOn >= s.turn;
    // CR 10-1-6 — [Rush: Character] may attack Characters on the turn it was played, but not
    // the Leader; a plain [Rush] card may attack either.
    var charOnly = sick && !S.hasKeyword(s, attacker, 'rush') &&
                   S.hasKeyword(s, attacker, 'rushCharacter');
    var out = charOnly ? [] : [o.leader];
    return out.concat(o.chars.filter(function (u) { return u.rested; }));
  }

  // One affordability check for every kind of effect: js/engine.js canAfford. This file had its
  // own copy, and its own payCost that asked questions OUTSIDE an invocation — any cost with a
  // choice in it (ST02-001 Kid's trash-1, OP14-020 Mihawk's rest-1) threw OP_NEED_CHOICE out of
  // apply() and froze the game.
  function canPayCost(s, seat, u, ab) { return E.canAfford(s, seat, u, ab); }

  // =======================================================================================
  // apply — deep-copies and returns a new state. Never mutates. CLAUDE.md hard rule 2.
  // =======================================================================================
  function apply(state, action) {
    bind();
    var s = E.clone(state);
    s.acts = (s.acts || 0) + 1;
    var h = s.queue[0];

    if (h) return applyToHead(s, h, action);
    return applyMain(s, action);
  }

  function applyToHead(s, h, a) {
    switch (h.k) {
      case 'mulligan': {
        var seat = h.ctrl, p = s.players[seat];
        if (a.t === 'redraw') {                                 // CR 5-2-1-6-1
          p.deck = p.deck.concat(p.hand); p.hand = [];
          NS.rng.shuffle(s, p.deck);
          E.draw(s, seat, 5);
          p.redrew = true;
          NS.log.push(s, 'mulligan.redraw', { seat: seat });
        } else {
          NS.log.push(s, 'mulligan.keep', { seat: seat });
        }
        s.queue.shift();
        if (!s.queue.length) return startPlay(s);
        return s;
      }

      case 'choice': {
        var inv = h.inv;
        inv.answers = (inv.answers || []).concat([a.v]);
        s.queue.shift();
        var out = E.execute(s, inv);
        return resumeAfterEffect(out);
      }

      case 'block': {
        s.queue.shift();
        if (a.t === 'block') {
          var b = S.findUnit(s, a.uid);
          b.rested = true;                                      // CR 10-1-4-1
          s.battle.target = a.uid;
          s.battle.blocked = true;
          NS.log.push(s, 'battle.blocked', { blocker: a.uid, id: b.id });
          var s2 = E.fireAuto(s, 'onBlock', { unit: b, seat: S.seatOf(s, a.uid) }); // CR 7-1-2-2
          if (E.gone(s2)) return E.endBattle(s2);               // CR 7-1-2-3
          return E.openCounterStep(s2);
        }
        NS.log.push(s, 'battle.unblocked', {});
        return E.openCounterStep(s);
      }

      case 'counter': {
        if (a.t === 'noCounter') { s.queue.shift(); return E.damageStep(s); }
        var defSeat = 1 - s.battle.seat, dp = s.players[defSeat];
        var id = a.id, at = dp.hand.indexOf(id);
        if (at < 0) throw new Error('counter: ' + id + ' is not in hand');
        dp.hand.splice(at, 1);

        if (a.kind === 'counterCard') {                         // CR 7-1-3-1-1
          dp.trash.push(id);
          // The Counter value goes on the defending card; with a blocker the blocker IS the
          // defender, so the target is always s.battle.target.
          var d = S.findUnit(s, s.battle.target);
          d.mods.push({ stat: 'power', n: a.n, until: 'battle', src: 'counter' });
          NS.log.push(s, 'counter.played', { id: id, n: a.n, onto: d.uid });
          // The step re-offers itself: the defender may counter as many times as they wish.
          if (!E.counterOptions(s).length) { s.queue.shift(); return E.damageStep(s); }
          return s;
        }

        // CR 7-1-3-1-2 — an Event with [Counter]: pay its cost, trash it, activate the effect.
        dp.donActive -= (a.cost || 0); dp.donRested += (a.cost || 0);
        dp.trash.push(id);
        NS.log.push(s, 'counterEvent.played', { id: id, cost: a.cost || 0 });
        var c = S.card(id);
        var ab = (c.abilities || []).filter(function (x) { return x.when === 'counter'; })[0];
        s.queue.shift();
        var after = E.execute(s, { ctrl: defSeat, self: s.battle.target, cardId: id,
                                   src: null, ops: E.costOps(ab, true).concat(ab.ops), answers: [] });
        // The loop re-offers itself — BEHIND any question the Event parked (CR 8-6-1). It was
        // unshifted in front, so "Done countering" ran the Damage Step before the Event's own
        // target was chosen, and a Counter Event with a target never saved anything.
        E.enqueue(after, { k: 'counter', ctrl: defSeat });
        return resumeAfterEffect(after);
      }

      case 'trigger': {
        var tSeat = h.ctrl, tp = s.players[tSeat], cardId = h.cardId, more = h.more;
        s.queue.shift();
        if (a.t === 'useTrigger') {                             // CR 10-1-5-1
          var tc = S.card(cardId);
          var tab = (tc.abilities || []).filter(function (x) { return x.when === 'trigger'; })[0];
          NS.log.push(s, 'trigger.used', { id: cardId });
          var st = E.execute(s, { ctrl: tSeat, self: null, cardId: cardId, src: null,
                                  ops: E.costOps(tab, true).concat(tab.ops), answers: [] });
          // CR 10-1-5-3 — after the [Trigger] resolves, trash the card unless told otherwise.
          // "Play this card" is told otherwise, and only when it actually ran (a declined cost
          // on OP08-104 Poire leaves the card to be trashed).
          if (!st.queue.length || st.queue[0].k !== 'choice') {
            var kept = st._playedSelf === cardId; delete st._playedSelf;
            if (!kept) st.players[tSeat].trash.push(cardId);
            if (more > 0) return E.dealLeaderDamage(st, tSeat, more, h.banish);
            return E.endBattle(st);
          }
          st._afterTrigger = { seat: tSeat, cardId: cardId, more: more, banish: h.banish };
          return st;
        }
        tp.hand.push(cardId);                                   // CR 10-1-5-2
        NS.log.push(s, 'trigger.declined', { id: cardId });
        if (more > 0) return E.dealLeaderDamage(s, tSeat, more, h.banish);
        return E.endBattle(s);
      }

      default: throw new Error('apply: unknown queue head "' + h.k + '"');
    }
  }

  // After an effect finishes (no more parked questions), pick up whatever it interrupted.
  function resumeAfterEffect(s) {
    if (s.queue.length && s.queue[0].k === 'choice') return s;
    if (s._afterTrigger) {
      var t = s._afterTrigger; delete s._afterTrigger;
      var kept = s._playedSelf === t.cardId; delete s._playedSelf;
      if (!kept) s.players[t.seat].trash.push(t.cardId);
      if (t.more > 0) return E.dealLeaderDamage(s, t.seat, t.more, t.banish);
      return E.endBattle(s);
    }
    if (s.battle && s.battle.step === 'counter' && !s.queue.length) return E.damageStep(s);
    return E.checkDefeat(s);
  }

  function applyMain(s, a) {
    var seat = s.active, p = s.players[seat];
    switch (a.t) {
      case 'play': {
        var c = S.card(a.id);
        var at = p.hand.indexOf(a.id);
        if (at < 0) throw new Error('play: ' + a.id + ' is not in hand');
        p.hand.splice(at, 1);
        p.donActive -= c.cost; p.donRested += c.cost;           // CR 2-7-2
        NS.log.push(s, 'card.played', { seat: seat, id: a.id, cost: c.cost });
        // Through execute(), not directly: playing may ask a question (CR 3-7-6-1, a full
        // Character area) and every question must be parkable on the queue.
        return resumeAfterEffect(E.execute(s, { ctrl: seat, self: null, cardId: a.id,
                                                src: null, ops: [{ k: 'playCard', id: a.id }],
                                                answers: [] }));
      }

      case 'event': {                                           // CR 2-7-3
        var ec = S.card(a.id);
        var eat = p.hand.indexOf(a.id);
        if (eat < 0) throw new Error('event: ' + a.id + ' is not in hand');
        p.hand.splice(eat, 1);
        p.donActive -= ec.cost; p.donRested += ec.cost;
        p.trash.push(a.id);                                     // trashed BEFORE it resolves
        NS.log.push(s, 'event.played', { seat: seat, id: a.id, cost: ec.cost });
        var eab = (ec.abilities || []).filter(function (x) { return x.when === 'main'; })[0];
        // CR 8-4-1-3 — the Event's own activation cost (OP05-077 DON!! −1, OP17-056 rest 5) is
        // paid through the one cost door. It used to be skipped and the effect was free.
        return resumeAfterEffect(E.execute(s, { ctrl: seat, self: null, cardId: a.id,
                                                src: null, ops: E.costOps(eab, true).concat(eab.ops), answers: [] }));
      }

      case 'activate': {
        var u = S.findUnit(s, a.uid);
        var ab = S.card(u.id).abilities[a.i];
        if (ab.once) u.onceUsed['activateMain' + a.i] = true;
        NS.log.push(s, 'ability.activated', { uid: u.uid, id: u.id, i: a.i });
        // CR 8-4-1-3 — the cost is paid INSIDE the invocation, so a cost that asks (which card
        // to trash, which card to rest) parks its question like any other.
        return resumeAfterEffect(E.execute(s, { ctrl: seat, self: u.uid, cardId: u.id,
                                                src: u.uid, ops: E.costOps(ab, false).concat(ab.ops), answers: [] }));
      }

      case 'giveDon': {                                         // CR 6-5-5-1
        var gu = S.findUnit(s, a.uid);
        p.donActive -= 1; gu.don += 1;
        NS.log.push(s, 'don.given', { uid: gu.uid, n: 1, from: 'active' });
        // CR 10-2-9 — [DON!! xN] is a condition, and giving may now satisfy it.
        return E.checkDefeat(s);
      }

      case 'attack':
        return E.declareAttack(s, a.uid, a.target);

      case 'endTurn':
        return E.endTurn(s);

      default: throw new Error('applyMain: unknown action "' + a.t + '"');
    }
  }

  // =======================================================================================
  // Game setup — CR 5-2.
  // =======================================================================================
  function newGame(opts) {
    bind();
    S.resetUid(0);
    var seed = typeof opts.seed === 'number' ? opts.seed : NS.rng.seedFrom(String(opts.seed || 'grandline'));
    var s = {
      seed: seed, rng: seed, turn: 1, active: 0, first: 0, phase: 'setup',
      players: [], queue: [], log: [], winner: null, battle: null, noBlock: [], lockPlay: [], acts: 0,
      decks: [opts.decks[0].key, opts.decks[1].key]
    };

    for (var i = 0; i < 2; i++) {
      var d = opts.decks[i];
      var p = S.newPlayer(d.leader);
      // CR 8-1-3-3-3 — a Leader may change the deck-construction rules "under the rules of this
      // game", and that is valid before the game begins. Enel's DON!! deck is 6, not 10.
      (S.card(d.leader).abilities || []).forEach(function (ab) {
        if (ab.when !== 'static') return;
        (ab.ops || []).forEach(function (o) { if (o.k === 'donDeckSize') p.donDeck = o.n; });
      });
      p.deck = d.cards.slice();
      NS.rng.shuffle(s, p.deck);                                 // CR 5-2-1-2, inside apply-land
      s.players.push(p);
    }
    s.first = opts.first === undefined ? 0 : opts.first;
    s.active = s.first;

    NS.log.push(s, 'game.start', { seed: seed, first: s.first,
                                   decks: [opts.decks[0].key, opts.decks[1].key] });

    for (var j = 0; j < 2; j++) E.draw(s, j, 5);                 // CR 5-2-1-6

    // CR 5-2-1-6 — beginning with the player going first, each MAY redraw once.
    s.queue.push({ k: 'mulligan', ctrl: s.first });
    s.queue.push({ k: 'mulligan', ctrl: 1 - s.first });
    return s;
  }

  // After both mulligans: set Life, then the first player starts their turn. CR 5-2-1-7/8.
  function startPlay(s) {
    for (var i = 0; i < 2; i++) {
      var p = s.players[i];
      var life = S.card(p.leaderId).life;
      if (life === null || life === undefined) {
        throw new Error('startPlay: Leader ' + p.leaderId + ' has no Life value (CR 2-9-1)');
      }
      // CR 2-9-2-1 — the card at the top of the deck goes to the BOTTOM of the Life area, so
      // the last one dealt is the first one taken.
      for (var k = 0; k < life; k++) p.life.unshift(p.deck.shift());
      NS.log.push(s, 'life.set', { seat: i, n: p.life.length });
    }
    return E.beginTurn(s);
  }

  NS.engine.whoActs = whoActs;
  NS.engine.isTerminal = isTerminal;
  NS.engine.legalActions = legalActions;
  NS.engine.apply = apply;
  NS.engine.newGame = newGame;
  NS.engine.startPlay = startPlay;
  NS.engine.attackers = attackers;
  NS.engine.targetsFor = targetsFor;
  NS.engine.canPayCost = canPayCost;
}(window.OP = window.OP || {}));
