// Per-card behaviour: every card in a registered deck that prints an effect is put on a board
// and made to do exactly what its printed text says. Written 2026-09-27 from a literal reading
// of data/printed.js, one test per card (the look-at cards share one table-driven test).
//
// The harness plays through apply() only, the same door the UI and the AI use.

function G(t, o) {
  const { OP } = t;
  o = o || {};
  let s = OP.engine.newGame({ seed: 7, first: 0, decks: [t.deckFor('st01'), t.deckFor('st02')] });
  s = OP.engine.apply(s, { t: 'keepHand' });
  s = OP.engine.apply(s, { t: 'keepHand' });
  s.turn = 4; s.phase = 'main'; s.queue = []; s.active = o.active === undefined ? 0 : o.active;
  for (const p of s.players) {
    p.chars = []; p.hand = []; p.trash = []; p.stage = null;
    p.donActive = 10; p.donRested = 0; p.donDeck = 0;
    p.leader.don = 0; p.leader.rested = false;
    // A deck of vanilla filler, so a draw or a look never runs dry by accident.
    p.deck = Array(20).fill('OP01-036');
    p.life = ['OP01-036', 'OP01-036', 'OP01-036', 'OP01-036'];
  }
  return s;
}
const H = {
  leader(t, s, seat, id) { s.players[seat].leaderId = id; s.players[seat].leader = t.OP.state.unit('L', id); },
  put(t, s, seat, id, over) {
    const u = t.OP.state.unit(id.startsWith('S') && t.OP.state.card(id).category === 'STAGE' ? 'S' : 'C', id);
    u.playedOn = -1; Object.assign(u, over || {});
    if (t.OP.state.card(id).category === 'STAGE') s.players[seat].stage = u; else s.players[seat].chars.push(u);
    return u;
  },
  // Answer every parked question with `pick`, which sees the head and its actions.
  settle(t, s, pick) {
    for (let guard = 0; guard < 60 && s.queue.length && s.queue[0].k === 'choice'; guard++) {
      const acts = t.OP.engine.legalActions(s);
      const a = (pick && pick(s.queue[0], acts)) || acts.find((x) => x.v !== '__done' && x.v !== 'no') || acts[0];
      s = t.OP.engine.apply(s, a);
    }
    return s;
  },
  act(t, s, a, pick) { return H.settle(t, t.OP.engine.apply(s, a), pick); },
  play(t, s, id, pick) {
    s.players[s.active].hand.push(id);
    const c = t.OP.state.card(id);
    return H.act(t, s, { t: c.category === 'EVENT' ? 'event' : 'play', id, ix: s.players[s.active].hand.length - 1, cost: c.cost }, pick);
  },
  // Run an attack through every window: the defender neither blocks nor counters unless told.
  attack(t, s, uid, target, o) {
    o = o || {};
    s = H.act(t, s, { t: 'attack', uid, target }, o.pick);
    for (let guard = 0; guard < 40 && s.queue.length; guard++) {
      const h = s.queue[0];
      const acts = t.OP.engine.legalActions(s);
      let a;
      if (h.k === 'choice') a = (o.pick && o.pick(h, acts)) || acts.find((x) => x.v !== '__done' && x.v !== 'no') || acts[0];
      else if (h.k === 'block') a = (o.block && acts.find((x) => x.uid === o.block)) || acts.find((x) => x.t === 'noBlock');
      else if (h.k === 'counter') a = (o.counter && acts.find((x) => x.id === o.counter)) || acts.find((x) => x.t === 'noCounter');
      else if (h.k === 'trigger') a = acts.find((x) => x.t === (o.useTrigger ? 'useTrigger' : 'takeLife'));
      if (o.counter && a.id === o.counter) o = Object.assign({}, o, { counter: null });
      s = t.OP.engine.apply(s, a);
    }
    return s;
  },
  activate(t, s, uid, pick) {
    const a = t.OP.engine.legalActions(s).find((x) => x.t === 'activate' && x.uid === uid);
    if (!a) throw new Error('no activate action for ' + uid);
    return H.act(t, s, a, pick);
  },
  canActivate(t, s, uid) { return t.OP.engine.legalActions(s).some((x) => x.t === 'activate' && x.uid === uid); },
  pw(t, s, u) { return t.OP.state.power(s, t.OP.state.findUnit(s, u.uid) || u); },
  find(t, s, u) { return t.OP.state.findUnit(s, u.uid); },
  // Pick the option whose card id / uid matches.
  choose(want) { return (h, acts) => acts.find((a) => a.cardId === want || a.uid === want || a.v === want); },
  decline() { return (h, acts) => acts.find((a) => a.v === 'no') || acts.find((a) => a.v === '__done'); }
};

// ---------------------------------------------------------------------------------------
// Look at N, reveal up to 1 matching card, add it, rest to the bottom — one table, 18 cards.
// ---------------------------------------------------------------------------------------
const LOOKS = [
  // id, n, a card that matches, a card that must NOT be offered (wrong type, excluded name, cost)
  ['EB04-037', 5, 'OP07-076', 'OP01-036'],
  ['OP01-016', 5, 'ST01-002', 'OP01-016'],          // other than [Nami]
  ['OP01-041', 5, 'OP01-036', 'ST01-002'],          // Land of Wano; activate
  ['OP04-041', 5, 'OP04-041', 'ST01-002'],          // East Blue; trash 2 cost
  ['OP04-051', 5, 'OP01-104', 'OP04-051'],          // AKP other than [Who's.Who]
  ['OP05-015', 5, 'OP13-004', 'OP05-015'],          // Revolutionary Army other than [Belo Betty]
  ['OP06-050', 5, 'OP02-097', 'OP06-050'],          // Navy other than [Tashigi]
  ['OP07-046', 5, 'OP14-020', 'OP02-097'],          // Seven Warlords
  ['OP09-002', 5, 'ST23-005', 'ST01-002'],          // Red-Haired Pirates
  ['OP10-004', 5, 'OP10-005', 'OP10-004'],          // Punk Hazard other than [Vergo]
  ['OP14-013', 5, 'ST02-007', 'OP14-013'],          // Supernovas other than [Monkey.D.Luffy]
  ['OP15-040', 3, 'OP15-053', 'OP01-036'],          // Dressrosa
  ['OP15-053', 3, 'OP15-040', 'OP01-036'],
  ['OP17-113', 3, 'OP17-109', 'OP01-036'],          // Big Mom Pirates
  ['ST34-003', 3, 'OP17-109', 'OP01-036'],
  ['ST02-007', 5, 'ST02-005', 'OP01-036'],          // Supernovas; activate
  ['ST28-005', 5, 'OP12-023', 'OP01-036'],          // Land of Wano, cost 2 or more (Otsuru is cost 1)
];

test('Cards · look at N: only matching cards are offered, one is added, the rest go to the bottom', (t) => {
  const { OP } = t;
  for (const [id, n, hit, miss] of LOOKS) {
    let s = G(t);
    const p = s.players[0];
    // miss on top, hit second, then filler; a card beyond N must never be seen.
    p.deck = [miss, hit].concat(Array(n - 2).fill('OP01-036')).concat([hit, 'OP01-036', 'OP01-036']);
    const before = p.deck.length;
    const card = OP.state.card(id);
    let offered = null;
    const pick = (h, acts) => {
      if (h.q.kind === 'deckpick') { offered = acts.filter((a) => a.v !== '__done').map((a) => a.cardId); return acts.find((a) => a.cardId === hit); }
      return null;
    };
    if (id === 'EB04-037') {
      // [On Play] If your Leader has the {Foxy Pirates} type — ST01's Luffy does not, so nothing.
      s = H.play(t, s, id, pick);
      t.eq(offered, null, id + ': no Foxy Pirates Leader, so no look');
      continue;
    }
    if (card.abilities.some((a) => a.when === 'activateMain')) {
      const u = H.put(t, s, 0, id);
      if (id === 'OP04-041') p.hand = ['OP01-036', 'OP01-036'];
      s = H.activate(t, s, u.uid, pick);
    } else {
      if (id === 'OP04-041') p.hand = ['OP01-036', 'OP01-036'];
      s = H.play(t, s, id, pick);
    }
    t.ok(offered, id + ': a pick was offered');
    t.ok(offered.includes(hit), id + ': the matching card is offered');
    t.ok(!offered.includes(miss), id + ': the non-matching card is not offered');
    const q = s.players[0];
    t.ok(q.hand.includes(hit), id + ': the chosen card is in hand');
    t.eq(q.deck.length, before - 1, id + ': exactly one card left the deck');
    t.eq(q.deck[0], hit, id + ': the card beyond N is now on top (the looked-at ones went to the bottom)');
  }
});

test('Cards · look at N: the player sees EVERY looked-at card, not only the ones they may take (CR 8-4-4-4)', (t) => {
  const { OP } = t;
  let s = G(t);
  s.players[0].deck = ['OP01-036', 'ST01-002', 'OP02-097', 'OP01-036', 'OP01-036', 'OP01-036'];
  s.players[0].hand = ['OP01-016'];
  s = OP.engine.apply(s, { t: 'play', id: 'OP01-016', ix: 0, cost: 1 });
  const h = s.queue[0];
  t.eq(h && h.k, 'choice', 'Nami parks a pick');
  t.ok(Array.isArray(h.q.seen), 'the question carries the looked-at cards');
  t.eq(h.q.seen.length, 5, 'all five of them');
});

// ---------------------------------------------------------------------------------------
// One test per card with its own text.
// ---------------------------------------------------------------------------------------
test('EB01-015 Scratchmen Apoo: [On Play] rest up to 1 opp Character with cost 2 or less', (t) => {
  let s = G(t);
  const cheap = H.put(t, s, 1, 'ST02-004');       // cost 1
  const dear = H.put(t, s, 1, 'ST02-006');        // cost 4
  let offered;
  s = H.play(t, s, 'EB01-015', (h, a) => { offered = a.map((x) => x.uid); return a.find((x) => x.uid === cheap.uid); });
  t.ok(!offered.includes(dear.uid), 'cost 4 is not a legal target');
  t.ok(H.find(t, s, cheap).rested, 'the cost-1 Character is rested');
});

test('EB01-016 Bingoh: [Activate: Main] rest self: K.O. up to 1 opp rested Character cost 1 or less', (t) => {
  let s = G(t);
  const b = H.put(t, s, 0, 'EB01-016');
  const r = H.put(t, s, 1, 'ST02-004', { rested: true });
  H.put(t, s, 1, 'ST02-012');                     // active, cost 1 — not a target
  s = H.activate(t, s, b.uid);
  t.ok(H.find(t, s, b).rested, 'Bingoh rested as the cost');
  t.ok(!H.find(t, s, r), 'the rested cost-1 Character is K.O.d');
  t.eq(s.players[1].chars.length, 1, 'the active one survives');
});

test('OP01-006 Otama: [On Play] up to 1 opp Character −2000 this turn', (t) => {
  let s = G(t);
  const v = H.put(t, s, 1, 'ST02-006');
  s = H.play(t, s, 'OP01-006');
  t.eq(H.pw(t, s, v), 4000, '6000 − 2000');
});

test('OP01-022 Brook: [DON!! x1] [When Attacking] up to 2 opp Characters −2000', (t) => {
  let s = G(t);
  const b = H.put(t, s, 0, 'OP01-022', { don: 1 });
  const x = H.put(t, s, 1, 'ST02-006'), y = H.put(t, s, 1, 'ST02-002');
  s = H.attack(t, s, b.uid, s.players[1].leader.uid, { pick: (h, a) => a.find((z) => z.v !== '__done') });
  t.eq(H.pw(t, s, x) + H.pw(t, s, y), 6000 + 5000 - 4000, 'both lost 2000');
});

test('OP01-106 Basil Hawkins: [On Play] add 1 DON!! rested; [Trigger] play this card', (t) => {
  let s = G(t);
  s.players[0].donDeck = 3;
  const rested = s.players[0].donRested;
  s = H.play(t, s, 'OP01-106');
  t.eq(s.players[0].donDeck, 2, 'one DON!! came out of the DON!! deck');
  t.eq(s.players[0].donRested, rested + 4 + 1, 'the play cost (4) plus the new one, rested');
});

test('[Trigger] Play this card: the card is played and NOT also put in the trash (CR 10-1-5-3)', (t) => {
  const { OP } = t;
  for (const id of ['OP01-104', 'OP01-106', 'OP02-104', 'ST01-002', 'ST02-005', 'OP17-071', 'OP17-107']) {
    let s = G(t, { active: 1 });
    s.players[0].life = [id];
    s = H.attack(t, s, s.players[1].leader.uid, s.players[0].leader.uid, { useTrigger: true });
    const p = s.players[0];
    t.ok(p.chars.some((u) => u.id === id), id + ' is on the field');
    t.ok(!p.trash.includes(id), id + ' is not also in the trash');
  }
  // Moby Dick is a Stage.
  let s = G(t, { active: 1 });
  s.players[0].life = ['OP02-024'];
  s = H.attack(t, s, s.players[1].leader.uid, s.players[0].leader.uid, { useTrigger: true });
  t.eq(s.players[0].stage && s.players[0].stage.id, 'OP02-024', 'Moby Dick is in the Stage area');
  t.ok(!s.players[0].trash.includes('OP02-024'), 'and not in the trash');
});

test('OP01-109 Who\'s.Who: [DON!! x1] [Your Turn] 8+ DON!! on field: +1000', (t) => {
  let s = G(t);
  const w = H.put(t, s, 0, 'OP01-109', { don: 1 });
  s.players[0].donActive = 7;                     // 7 + 1 given = 8
  t.eq(H.pw(t, s, w), 3000 + 1000 + 1000, 'base + given DON!! + effect');
  s.players[0].donActive = 6;
  t.eq(H.pw(t, s, w), 3000 + 1000, 'seven on the field is not enough');
});

test('OP02-001 Edward.Newgate: [End of Your Turn] add 1 top Life card to hand', (t) => {
  let s = G(t);
  H.leader(t, s, 0, 'OP02-001');
  s.players[0].life = ['ST01-003', 'OP01-036'];
  s = H.act(t, s, { t: 'endTurn' });
  t.eq(s.players[0].life.length, 1, 'one Life card left');
  t.ok(s.players[0].hand.includes('ST01-003'), 'the TOP Life card went to hand');
});

test('OP02-024 Moby Dick: [Your Turn] 1 or less Life: your [Edward.Newgate] and "Whitebeard Pirates" Characters +2000', (t) => {
  let s = G(t);
  H.leader(t, s, 0, 'OP02-001');
  H.put(t, s, 0, 'OP02-024');
  const ace = H.put(t, s, 0, 'P-028');            // Whitebeard Pirates
  const oars = H.put(t, s, 0, 'OP02-020');        // "Whitebeard Pirates Allies" — type includes it
  const ww = H.put(t, s, 0, 'OP12-002');          // Edward.Newgate Character
  const other = H.put(t, s, 0, 'ST01-003');
  s.players[0].life = ['OP01-036'];
  t.eq(H.pw(t, s, s.players[0].leader), 8000, 'Leader Edward.Newgate +2000');
  t.eq(H.pw(t, s, ace), 8000, 'Whitebeard Pirates Character +2000');
  t.eq(H.pw(t, s, oars), 11000, 'type INCLUDING Whitebeard Pirates +2000');
  t.eq(H.pw(t, s, ww), 8000, 'Edward.Newgate Character +2000');
  t.eq(H.pw(t, s, other), 3000, 'Karoo unchanged');
  s.players[0].life = ['OP01-036', 'OP01-036'];
  t.eq(H.pw(t, s, ace), 6000, 'two Life: no bonus');
});

test('OP03-115 Streusen: [On Play] may trash 1 card WITH a [Trigger]: K.O. up to 1 opp cost 1 or less', (t) => {
  let s = G(t);
  const v = H.put(t, s, 1, 'ST02-004');
  s.players[0].hand = ['OP01-036'];               // no Trigger — cannot pay
  s = H.play(t, s, 'OP03-115');
  t.ok(H.find(t, s, v), 'no [Trigger] card in hand: the cost cannot be paid, nothing is K.O.d');
  t.ok(s.players[0].hand.includes('OP01-036'), 'and the non-Trigger card was not trashed');
  s = G(t);
  const v2 = H.put(t, s, 1, 'ST02-004');
  s.players[0].hand = ['OP01-036', 'OP01-104'];   // Speed has a Trigger
  s = H.play(t, s, 'OP03-115');
  t.ok(!H.find(t, s, v2), 'paid with a Trigger card: K.O.d');
  t.ok(s.players[0].trash.includes('OP01-104'), 'the Trigger card was the one trashed');
});

test('"You may" costs on auto effects are the player\'s choice (CR 8-3-1-4)', (t) => {
  let s = G(t);
  const v = H.put(t, s, 1, 'ST02-004');
  s.players[0].hand = ['OP01-104'];
  s = H.play(t, s, 'OP03-115', H.decline());
  t.ok(s.players[0].hand.includes('OP01-104'), 'declined: the card stays in hand');
  t.ok(H.find(t, s, v), 'and nothing is K.O.d');
  // DON!! −X is also optional: "You may return…" (CR 8-3-1-6 with the printed reminder).
  s = G(t);
  const d0 = s.players[0].donActive;
  s = H.play(t, s, 'ST04-005', H.decline());      // Queen [On Play] DON!! −1: draw 2, trash 1
  t.eq(s.players[0].donActive + s.players[0].donRested, d0, 'declined DON!! −1: nothing returned');
  t.eq(s.players[0].hand.length, 0, 'and nothing drawn');
});

test('OP04-016 Bad Manners Kick Course: [Counter] may trash 1: +3000; [Trigger] opp −3000', (t) => {
  let s = G(t, { active: 1 });
  s.players[0].hand = ['OP04-016', 'OP01-036'];
  s = H.attack(t, s, s.players[1].leader.uid, s.players[0].leader.uid, { counter: 'OP04-016' });
  t.ok(s.players[0].trash.includes('OP01-036'), 'the trash-1 cost was paid');
  t.eq(s.players[0].life.length, 4, '5000 + 3000 beat 5000: no damage');
  // Without a card to trash, the cost cannot be paid and there is no +3000.
  s = G(t, { active: 1 });
  s.players[0].hand = ['OP04-016'];
  s = H.attack(t, s, s.players[1].leader.uid, s.players[0].leader.uid, { counter: 'OP04-016' });
  t.eq(s.players[0].life.length, 3, 'unpaid: no power, the attack connects');
});

test('OP05-010 Nico Robin: [On Play] K.O. up to 1 opp Character with 1000 power or less', (t) => {
  let s = G(t);
  const weak = H.put(t, s, 1, 'ST02-004');        // 1000
  const strong = H.put(t, s, 1, 'ST02-012');      // 3000
  s = H.play(t, s, 'OP05-010');
  t.ok(!H.find(t, s, weak), '1000 power K.O.d');
  t.ok(H.find(t, s, strong), '3000 survives');
});

test('OP05-077 Gamma Knife: [Main] DON!! −1: opp Character −5000; [Trigger] add 1 active DON!!', (t) => {
  let s = G(t);
  const v = H.put(t, s, 1, 'ST02-006');
  const total = () => s.players[0].donActive + s.players[0].donRested;
  const before = total();
  s = H.play(t, s, 'OP05-077');
  t.eq(H.pw(t, s, v), 1000, '6000 − 5000');
  t.eq(total(), before - 1, 'DON!! −1 was paid');
});

test('OP07-034 Roronoa Zoro: [When Attacking] 3+ Characters: +2000', (t) => {
  let s = G(t);
  const z = H.put(t, s, 0, 'OP07-034');
  H.put(t, s, 0, 'ST01-003'); H.put(t, s, 0, 'ST01-003');
  s = H.act(t, s, { t: 'attack', uid: z.uid, target: s.players[1].leader.uid });
  t.eq(H.pw(t, s, z), 4000, '2000 + 2000');
});

test('OP07-054 Marguerite: [Blocker]; [On Play] draw 1', (t) => {
  let s = G(t);
  const h0 = s.players[0].hand.length;
  s = H.play(t, s, 'OP07-054');
  t.eq(s.players[0].hand.length, h0 + 1, 'drew 1');
  t.ok(t.OP.state.hasKeyword(s, s.players[0].chars[0], 'blocker'), 'has [Blocker]');
});

test('OP07-058 Island of Women: activate — trash 1 and rest: Kuja Leader returns Amazon Lily/Kuja Character', (t) => {
  let s = G(t);
  const st = H.put(t, s, 0, 'OP07-058');
  H.put(t, s, 0, 'OP07-054');
  s.players[0].hand = ['OP01-036', 'OP01-036'];
  t.ok(!H.canActivate(t, s, st.uid), 'ST01 Luffy is not {Kuja Pirates}: no effect to activate');
});

test('OP07-076 Slow-Slow Beam Sword: [Counter] DON!! −1: +2000, then rest up to 1 opp Character', (t) => {
  let s = G(t, { active: 1 });
  const atk = H.put(t, s, 1, 'ST02-006');
  s.players[0].hand = ['OP07-076'];
  s.players[0].donActive = 3;
  s = H.attack(t, s, atk.uid, s.players[0].leader.uid, { counter: 'OP07-076' });
  const p = s.players[0];
  t.eq(p.donActive + p.donRested, 2, 'the DON!! −1 was returned (3 − 1; the cost of 2 only rests)');
  t.eq(p.life.length, 4, '5000 + 2000 beat 6000');
});

test('OP08-061 Charlotte Oven: [When Attacking] DON!! −1: K.O. up to 1 opp cost 3 or less', (t) => {
  let s = G(t);
  const o = H.put(t, s, 0, 'OP08-061');
  const v = H.put(t, s, 1, 'ST02-002');           // cost 3
  s = H.attack(t, s, o.uid, s.players[1].leader.uid, { pick: (h, a) => a.find((x) => x.v === 'yes') || a.find((x) => x.uid === v.uid) });
  t.ok(!H.find(t, s, v), 'K.O.d');
});

test('OP08-085 Jinbe: [DON!! x1] [When Attacking] you have a cost 8+ Character: K.O. up to 1 opp cost 4 or less', (t) => {
  let s = G(t);
  const j = H.put(t, s, 0, 'OP08-085', { don: 1 });
  const v = H.put(t, s, 1, 'ST02-006');
  s = H.attack(t, s, j.uid, s.players[1].leader.uid);
  t.ok(H.find(t, s, v), 'no cost 8 Character: nothing');
  s = G(t);
  const j2 = H.put(t, s, 0, 'OP08-085', { don: 1 });
  H.put(t, s, 0, 'ST14-012');                     // cost 8
  const v2 = H.put(t, s, 1, 'ST02-006');
  s = H.attack(t, s, j2.uid, s.players[1].leader.uid);
  t.ok(!H.find(t, s, v2), 'with one: K.O.d');
});

test('OP08-104 Charlotte Poire: [Trigger] may trash 1: play this card, then draw 1', (t) => {
  let s = G(t, { active: 1 });
  s.players[0].life = ['OP08-104'];
  s.players[0].hand = ['OP01-036'];
  s = H.attack(t, s, s.players[1].leader.uid, s.players[0].leader.uid, { useTrigger: true });
  const p = s.players[0];
  t.ok(p.chars.some((u) => u.id === 'OP08-104'), 'Poire is on the field');
  t.ok(p.trash.includes('OP01-036'), 'the trash-1 cost was paid');
  t.eq(p.hand.length, 1, 'then drew 1');
});

test('OP09-062 Nico Robin (Leader): [Banish]; [When Attacking] may trash a Trigger card: add 1 DON!! rested', (t) => {
  let s = G(t);
  H.leader(t, s, 0, 'OP09-062');
  s.players[0].donDeck = 2;
  s.players[0].hand = ['OP01-036'];               // no Trigger
  s = H.attack(t, s, s.players[0].leader.uid, s.players[1].leader.uid);
  t.eq(s.players[0].donDeck, 2, 'cannot pay with a non-Trigger card');
  t.eq(s.players[1].trash.length, 1, '[Banish]: the Life card is trashed, not added to hand');
});

test('OP10-005 Sanji: [Your Turn] +3000; [On K.O.] draw 1', (t) => {
  let s = G(t);
  const u = H.put(t, s, 0, 'OP10-005');
  t.eq(H.pw(t, s, u), 6000, 'your turn');
  s.active = 1;
  t.eq(H.pw(t, s, u), 3000, 'opponent turn');
  s.active = 0;
  const a = H.put(t, s, 1, 'ST02-006');
  u.rested = true;
  s.active = 1;
  const h0 = s.players[0].hand.length;
  s = H.attack(t, s, a.uid, u.uid);
  t.eq(s.players[0].hand.length, h0 + 1, 'K.O.d: drew 1');
});

test('OP10-066 Giolla: [On Your Opponent\'s Attack] [Once Per Turn] may rest 2 DON!!: rest up to 1 opp cost 4 or less', (t) => {
  let s = G(t, { active: 1 });
  H.put(t, s, 0, 'OP10-066');
  const a = H.put(t, s, 1, 'ST02-006');
  const other = H.put(t, s, 1, 'ST02-002');
  s = H.attack(t, s, a.uid, s.players[0].leader.uid, { pick: (h, acts) => acts.find((x) => x.v === 'yes') || acts.find((x) => x.uid === other.uid) });
  t.ok(H.find(t, s, other).rested, 'rested');
  t.eq(s.players[0].donRested, 2, 'two DON!! rested to pay');
});

test('OP10-076 Baby 5: [On Play] may trash 1: Donquixote Leader: add 1 active DON!!', (t) => {
  let s = G(t);
  s.players[0].donDeck = 2;
  s.players[0].hand = ['OP01-036'];
  s = H.play(t, s, 'OP10-076');
  t.eq(s.players[0].donDeck, 2, 'ST01 Luffy is not Donquixote: nothing');
  t.ok(s.players[0].hand.includes('OP01-036'), 'and no card was trashed for nothing');
});

test('OP10-077 Bellamy: [Blocker]; [On Block] may rest 2 DON!!: add 1 active DON!!', (t) => {
  let s = G(t, { active: 1 });
  const b = H.put(t, s, 0, 'OP10-077');
  s.players[0].donDeck = 2; s.players[0].donActive = 3;
  const a = H.put(t, s, 1, 'ST02-002');
  s = H.attack(t, s, a.uid, s.players[0].leader.uid, { block: b.uid, pick: (h, acts) => acts.find((x) => x.v === 'yes') || acts[0] });
  t.eq(s.players[0].donDeck, 1, 'a DON!! was added');
  t.eq(s.players[0].donActive, 2, '3 − 2 rested + 1 new active');
});

test('OP11-007 Tashigi: activate rest self: Navy Leader: up to 1 Navy Character +2000', (t) => {
  let s = G(t);
  const u = H.put(t, s, 0, 'OP11-007');
  t.ok(!H.canActivate(t, s, u.uid), 'ST01 Luffy is not Navy');
});

test('OP13-004 Sabo (Leader): 4+ Life: −1000; [DON!! x1] you have cost 8+: Leader and Characters +1000', (t) => {
  let s = G(t);
  H.leader(t, s, 0, 'OP13-004');
  const L = s.players[0].leader;
  t.eq(H.pw(t, s, L), 4000, '4 Life: 5000 − 1000');
  s.players[0].life = ['OP01-036'];
  t.eq(H.pw(t, s, L), 5000, '1 Life: no penalty');
  L.don = 1;
  const big = H.put(t, s, 0, 'ST14-012');
  t.eq(H.pw(t, s, L), 5000 + 1000 + 1000, 'DON!! + effect');
  t.eq(H.pw(t, s, big), 11000, 'Characters too');
});

test('OP13-043 Otama: [On Play] 3 or less Life: draw 2, trash 1', (t) => {
  let s = G(t);
  s = H.play(t, s, 'OP13-043');
  t.eq(s.players[0].hand.length, 0, '4 Life: nothing');
  s = G(t); s.players[0].life = ['OP01-036'];
  s = H.play(t, s, 'OP13-043');
  t.eq(s.players[0].hand.length, 1, 'drew 2 trashed 1');
});

test('OP14-005 Killer / ST01-007 Nami / ST23-005 Yasopp: [Once Per Turn] give up to 1 rested DON!!', (t) => {
  for (const id of ['OP14-005', 'ST01-007', 'ST23-005']) {
    let s = G(t);
    const u = H.put(t, s, 0, id);
    s.players[0].donRested = 2;
    s = H.activate(t, s, u.uid, (h, a) => a.find((x) => x.uid === s.players[0].leader.uid) || a[0]);
    t.eq(s.players[0].donRested, 1, id + ': a rested DON!! was given');
    t.ok(!H.canActivate(t, s, u.uid), id + ': once per turn');
  }
});

test('OP14-013 Monkey.D.Luffy / OP14-015 Zoro: [When Attacking] up to 1 opp Character −1000', (t) => {
  for (const id of ['OP14-013', 'OP14-015']) {
    let s = G(t);
    const u = H.put(t, s, 0, id);
    const v = H.put(t, s, 1, 'ST02-006');
    s = H.attack(t, s, u.uid, s.players[1].leader.uid);
    t.eq(H.pw(t, s, v), 5000, id);
  }
});

test('OP14-020 Dracule Mihawk (Leader): vs <Slash> +1000; activate rest 1 card: there is a cost 5+ Character: 3 DON!! active, no Characters', (t) => {
  let s = G(t);
  H.leader(t, s, 0, 'OP14-020');
  H.leader(t, s, 1, 'ST01-001');                  // Strike
  t.eq(H.pw(t, s, s.players[0].leader), 5000, 'Strike Leader: no bonus');
  H.leader(t, s, 1, 'OP14-020');                  // Slash
  t.eq(H.pw(t, s, s.players[0].leader), 6000, 'Slash Leader: +1000');
  // "If there is a Character" — the OPPONENT's cost 5 Character counts.
  H.put(t, s, 1, 'ST02-009');                     // Law, cost 5
  s.players[0].donActive = 2; s.players[0].donRested = 5;
  const c = H.put(t, s, 0, 'ST01-003');
  t.ok(H.canActivate(t, s, s.players[0].leader.uid), 'an opponent\'s cost 5 Character satisfies "there is"');
  s = H.activate(t, s, s.players[0].leader.uid, H.choose(c.uid));
  t.ok(H.find(t, s, c).rested, 'Karoo rested as the cost');
  t.eq(s.players[0].donActive, 5, '2 + 3 set active');
  s.players[0].hand = ['ST01-003'];
  t.ok(!t.OP.engine.legalActions(s).some((a) => a.t === 'play'), 'no Character may be played this turn');
});

test('OP14-023 Kikunojo / ST02-013 Kid: [End of Your Turn] set this Character as active', (t) => {
  let s = G(t);
  const k = H.put(t, s, 0, 'OP14-023', { rested: true });
  const kid = H.put(t, s, 0, 'ST02-013', { rested: true, don: 1 });
  s = H.act(t, s, { t: 'endTurn' });
  t.ok(!H.find(t, s, k).rested, 'Kikunojo active');
  t.ok(!H.find(t, s, kid).rested, 'Kid (DON!! x1) active');
});

test('OP14-026 Kouzuki Oden: [Opponent\'s Turn] if rested +2000', (t) => {
  let s = G(t, { active: 1 });
  const o = H.put(t, s, 0, 'OP14-026', { rested: true });
  t.eq(H.pw(t, s, o), 7000, 'rested on opponent turn');
  o.rested = false;
  t.eq(H.pw(t, s, o), 5000, 'active: no bonus');
});

test('OP14-071 Pica / OP14-074 Monet / OP16-068 Law / OP14-075 Lao.G: DON!! adders', (t) => {
  let s = G(t);
  s.players[0].donDeck = 5;
  s = H.play(t, s, 'OP16-068');
  t.eq(s.players[0].donDeck, 4, 'Law [On Play]: +1 active DON!!');
  s = G(t); s.players[0].donDeck = 5;
  s = H.play(t, s, 'OP14-074');
  t.eq(s.players[0].donDeck, 5, 'Monet [On Play] needs a Donquixote Leader');
  s = G(t); s.players[0].donDeck = 5;
  H.put(t, s, 0, 'OP14-071');
  s = H.act(t, s, { t: 'endTurn' });
  t.eq(s.players[0].donDeck, 5, 'Pica needs a Donquixote Leader');
  // Lao.G [On K.O.]: add 1 rested DON!!, then opp Character −2000
  s = G(t, { active: 1 });
  s.players[0].donDeck = 5;
  const lao = H.put(t, s, 0, 'OP14-075', { rested: true });
  const a = H.put(t, s, 1, 'ST02-006');
  s = H.attack(t, s, a.uid, lao.uid);
  t.eq(s.players[0].donDeck, 4, 'Lao.G K.O.d: a DON!! came out');
  t.eq(H.pw(t, s, a), 4000, 'and the attacker took −2000');
});

test('OP14-074 Monet: [On K.O.] draw 2, trash 1, then add 2 DON!! rested', (t) => {
  let s = G(t, { active: 1 });
  s.players[0].donDeck = 5;
  const m = H.put(t, s, 0, 'OP14-074', { rested: true });
  const a = H.put(t, s, 1, 'OP10-013');           // 7000
  s = H.attack(t, s, a.uid, m.uid);
  t.eq(s.players[0].hand.length, 1, 'drew 2, trashed 1');
  t.eq(s.players[0].donDeck, 3, 'two DON!! added');
});

test('OP15-053 Rebecca: [DON!! x1] gains [Blocker]', (t) => {
  let s = G(t);
  const r = H.put(t, s, 0, 'OP15-053');
  t.ok(!t.OP.state.hasKeyword(s, r, 'blocker'), 'no DON!!');
  r.don = 1;
  t.ok(t.OP.state.hasKeyword(s, r, 'blocker'), 'with 1 DON!!');
});

test('OP15-058 Enel (Leader): DON!! deck of 6; activate: 2nd turn+: 1 active, 4 rested, give up to 4 rested to 1 Character', (t) => {
  const { OP } = t;
  const d = t.deckFor('op15-058');
  let s = OP.engine.newGame({ seed: 3, first: 0, decks: [d, t.deckFor('st02')] });
  t.eq(s.players[0].donDeck, 6, 'six DON!!');
  s = G(t);
  H.leader(t, s, 0, 'OP15-058');
  s.players[0].donDeck = 6; s.players[0].donActive = 0; s.players[0].donRested = 0;
  const c = H.put(t, s, 0, 'ST01-003');
  s = H.activate(t, s, s.players[0].leader.uid);
  t.eq(s.players[0].donActive, 1, 'one active');
  t.eq(H.find(t, s, c).don, 4, 'four rested given to the Character');
  t.eq(s.players[0].donDeck, 1, 'five came out');
});

test('OP16-001 Portgas.D.Ace (Leader): give [Rush] to a Luffy or Whitebeard Character with 8000+', (t) => {
  let s = G(t);
  H.leader(t, s, 0, 'OP16-001');
  const k = H.put(t, s, 0, 'OP17-006', { playedOn: 4 });   // Kingdew 8000 Whitebeard
  const small = H.put(t, s, 0, 'P-028', { playedOn: 4 });  // 6000
  s = H.activate(t, s, s.players[0].leader.uid, (h, a) => a.find((x) => x.uid === k.uid));
  const atk = t.OP.engine.legalActions(s).filter((a) => a.t === 'attack').map((a) => a.uid);
  t.ok(atk.includes(k.uid), 'Kingdew may attack the turn it was played');
  t.ok(!atk.includes(small.uid), 'Ace (6000) was not a legal target');
});

test('OP16-070 Donquixote Rosinante: [Blocker]; [On Play] may rest 2 DON!!: Navy Leader: add 1 rested', (t) => {
  let s = G(t);
  s.players[0].donDeck = 3;
  s = H.play(t, s, 'OP16-070');
  t.eq(s.players[0].donDeck, 3, 'not a Navy Leader: nothing, and no DON!! rested for nothing');
});

test('OP16-081 Otama: activate rest self: you have cost 8+: opp Character −2000', (t) => {
  let s = G(t);
  const o = H.put(t, s, 0, 'OP16-081');
  t.ok(!H.canActivate(t, s, o.uid), 'no cost 8 Character');
  H.put(t, s, 0, 'ST14-012');
  const v = H.put(t, s, 1, 'ST02-006');
  s = H.activate(t, s, o.uid);
  t.eq(H.pw(t, s, v), 4000, '−2000');
});

test('OP16-090 Tony Tony.Chopper: [On Play] draw 2, trash 2, then K.O. up to 1 opp cost 1 or less', (t) => {
  let s = G(t);
  const v = H.put(t, s, 1, 'ST02-004');
  s = H.play(t, s, 'OP16-090');
  t.eq(s.players[0].hand.length, 0, 'drew 2 trashed 2');
  t.ok(!H.find(t, s, v), 'K.O.d');
});

test('OP17-017 Ga Ha Ha Ha!!: [Counter] Whitebeard +2000, then opp Leader/Character −2000', (t) => {
  let s = G(t, { active: 1 });
  H.leader(t, s, 0, 'OP02-001');
  s.players[0].hand = ['OP17-017'];
  const a = H.put(t, s, 1, 'OP10-013');           // 7000
  s = H.attack(t, s, a.uid, s.players[0].leader.uid, { counter: 'OP17-017', pick: (h, acts) => acts.find((x) => x.uid === a.uid) || acts.find((x) => x.v !== '__done') });
  t.eq(s.players[0].life.length, 4, '6000+2000 vs 7000−2000');
});

test('OP17-022 Shanks: [Rush]; [On Play] set 2 DON!! active, then rest ALL opp Characters', (t) => {
  let s = G(t);
  const a = H.put(t, s, 1, 'ST02-006'), b = H.put(t, s, 1, 'ST02-002'), c = H.put(t, s, 1, 'ST02-004');
  s = H.play(t, s, 'OP17-022');
  t.ok([a, b, c].every((u) => H.find(t, s, u).rested), 'all three rested');
  t.eq(s.players[0].donActive, 2, '10 − 10 cost + 2 set active');
});

test('OP17-039 Rocks.D.Xebec (Leader): [When Attacking] may trash 1: reveal top; Rocks Pirates: draw 2', (t) => {
  let s = G(t);
  H.leader(t, s, 0, 'OP17-039');
  s.players[0].hand = ['OP01-036'];
  s.players[0].deck = ['OP17-046', 'OP01-036', 'OP01-036'];
  s = H.attack(t, s, s.players[0].leader.uid, s.players[1].leader.uid, { pick: (h, a) => a.find((x) => x.v === 'yes') || a[0] });
  t.eq(s.players[0].hand.length, 2, 'trashed 1, drew 2');
  t.ok(s.log.some((e) => e.tag === 'deck.revealed' && e.data.ids[0] === 'OP17-046'), 'the reveal is logged with the card');
});

test('OP17-046 Gloriosa: [Blocker]; [On Play] up to 1 Character cost 5 or less to the bottom of its owner\'s deck', (t) => {
  let s = G(t);
  const v = H.put(t, s, 1, 'ST02-009');
  s = H.play(t, s, 'OP17-046', H.choose(v.uid));
  t.ok(!H.find(t, s, v), 'gone');
  t.eq(s.players[1].deck[s.players[1].deck.length - 1], 'ST02-009', 'bottom of the OWNER\'s deck');
});

test('OP17-056 Rocks Pirates: [Main] may rest 5 DON!!: return up to 1 cost 6 or less; [Counter] Rocks +2000', (t) => {
  let s = G(t);
  const v = H.put(t, s, 1, 'ST02-009');
  s.players[0].donActive = 5;
  s = H.play(t, s, 'OP17-056');
  t.ok(!H.find(t, s, v), 'returned to hand');
  t.eq(s.players[0].donActive, 0, 'five DON!! rested to pay');
  t.ok(s.players[1].hand.includes('ST02-009'), 'in its owner\'s hand');
});

test('OP17-057 Fullalead: [On Your Opponent\'s Attack] may rest this Stage and trash 1: Rocks +1000', (t) => {
  let s = G(t, { active: 1 });
  H.leader(t, s, 0, 'OP17-039');
  const st = H.put(t, s, 0, 'OP17-057');
  s.players[0].hand = ['OP01-036'];
  const a = H.put(t, s, 1, 'ST02-006');           // 6000 vs 5000
  s = H.attack(t, s, a.uid, s.players[0].leader.uid, { pick: (h, acts) => acts.find((x) => x.v === 'yes') || acts.find((x) => x.v !== '__done') });
  t.ok(H.find(t, s, st).rested, 'the Stage rested');
  t.ok(s.players[0].trash.includes('OP01-036'), 'a card trashed');
});

test('OP17-058 Kaido (Leader): [When Attacking]/[On Your Opponent\'s Attack] [Once Per Turn] DON!! −1: opp −2000', (t) => {
  let s = G(t);
  H.leader(t, s, 0, 'OP17-058');
  const v = H.put(t, s, 1, 'ST02-006');
  s = H.attack(t, s, s.players[0].leader.uid, s.players[1].leader.uid, { pick: (h, a) => a.find((x) => x.v === 'yes') || a.find((x) => x.uid === v.uid) });
  t.eq(H.pw(t, s, v), 4000, '−2000');
});

test('CR 8-3-1-4: declining an optional cost does not spend [Once Per Turn]', (t) => {
  let s = G(t, { active: 1 });
  H.leader(t, s, 0, 'OP17-058');
  const v = H.put(t, s, 1, 'ST02-006'), w = H.put(t, s, 1, 'ST02-002');
  s = H.attack(t, s, v.uid, s.players[0].leader.uid, { pick: H.decline() });
  t.ok(s.log.some((e) => e.tag === 'cost.declined'), 'declined on the first attack');
  s = H.attack(t, s, w.uid, s.players[0].leader.uid, { pick: (h, a) => a.find((x) => x.v === 'yes') || a.find((x) => x.uid === w.uid) });
  t.eq(H.pw(t, s, w), 3000, 'still available on the second attack: −2000');
});

test('OP17-064 King / OP17-072 Black Maria: [On Your Opponent\'s Attack] [Once Per Turn] may trash 1: +2000/+1000', (t) => {
  let s = G(t, { active: 1 });
  H.put(t, s, 0, 'OP17-064');
  s.players[0].hand = ['OP01-036'];
  const a = H.put(t, s, 1, 'ST02-006');           // 6000 vs 5000
  s = H.attack(t, s, a.uid, s.players[0].leader.uid, { pick: (h, acts) => acts.find((x) => x.v === 'yes') || acts.find((x) => x.uid === s.players[0].leader.uid) || acts[0] });
  t.eq(s.players[0].life.length, 4, 'King made the Leader 7000');
});

test('OP17-066 Orochi / OP17-067 Kanjuro / OP17-071 Who\'s.Who / ST04-005 Queen: DON!! −1 [On Play]', (t) => {
  let s = G(t);
  const tot = () => s.players[0].donActive + s.players[0].donRested;
  let before = tot();
  s = H.play(t, s, 'OP17-066');
  t.eq(tot(), before, 'Orochi: no cost 10 Character — nothing paid');
  s = G(t);
  const a = H.put(t, s, 1, 'ST02-004'), b = H.put(t, s, 1, 'ST02-012'), c = H.put(t, s, 1, 'ST02-006');
  before = tot();
  s = H.play(t, s, 'OP17-071', (h, acts) => acts.find((x) => x.v === 'yes') || acts.find((x) => x.v !== '__done'));
  t.ok(!H.find(t, s, a) && !H.find(t, s, b), 'Who\'s.Who K.O.d both cost-1 Characters');
  t.ok(H.find(t, s, c), 'cost 4 survives');
  t.eq(tot(), before - 1, 'one DON!! returned');
  s = G(t);
  before = tot();
  s = H.play(t, s, 'ST04-005', (h, acts) => acts.find((x) => x.v === 'yes') || null);
  t.eq(s.players[0].hand.length, 1, 'Queen: drew 2 trashed 1');
  t.eq(tot(), before - 1, 'one DON!! returned');
});

test('OP17-079 Monkey.D.Luffy (Leader): your cost 12+ Characters gain [Blocker]', (t) => {
  const { OP } = t;
  let s = G(t);
  H.leader(t, s, 0, 'OP17-079');
  const small = H.put(t, s, 0, 'ST14-012');
  t.ok(!OP.state.hasKeyword(s, small, 'blocker'), 'cost 8: no');
});

test('OP17-082 Sanji / OP17-087 Robin / OP17-090 Franky: "If there is" a cost 12+ Character — either side', (t) => {
  const twelve = Object.values(t.OP.cards.all()).find((c) => c.category === 'CHARACTER' && c.cost >= 12);
  if (!twelve) return;                              // no such card printed yet: nothing to check
  let s = G(t);
  const san = H.put(t, s, 0, 'OP17-082');
  H.put(t, s, 1, twelve.id);
  t.eq(H.pw(t, s, san), 5000, 'the OPPONENT\'s cost 12 Character counts');
});

test('OP17-109 Charlotte Pudding: [On Play] may trash a Trigger card: draw 3', (t) => {
  let s = G(t);
  s.players[0].hand = ['OP01-036'];
  s = H.play(t, s, 'OP17-109');
  t.eq(s.players[0].hand.length, 1, 'no Trigger card: cannot pay, nothing drawn');
});

test('ST01-001 Luffy / ST01-011 Brook: give rested DON!!', (t) => {
  let s = G(t);
  s.players[0].donRested = 3;
  const u = H.put(t, s, 0, 'ST01-003');
  s = H.play(t, s, 'ST01-011', H.choose(u.uid));
  t.eq(H.find(t, s, u).don, 2, 'Brook gave 2 rested DON!! to one card');
});

test('ST01-002 Usopp: [DON!! x2] [When Attacking] opp cannot activate a [Blocker] with 5000+', (t) => {
  let s = G(t);
  const u = H.put(t, s, 0, 'ST01-002', { don: 2 });
  H.put(t, s, 1, 'ST02-013');                     // Kid 7000 blocker
  const small = H.put(t, s, 1, 'ST02-004');       // Bege 1000 blocker
  s = H.act(t, s, { t: 'attack', uid: u.uid, target: s.players[1].leader.uid });
  const bl = t.OP.engine.legalActions(s).filter((a) => a.t === 'block').map((a) => a.uid);
  t.eq(bl.length, 1, 'only the small blocker');
  t.eq(bl[0], small.uid, 'Bege');
});

test('ST01-004 Sanji: [DON!! x2] gains [Rush]; ST01-013 Zoro [DON!! x1] +1000; ST02-003 Urouge', (t) => {
  let s = G(t);
  const sj = H.put(t, s, 0, 'ST01-004', { playedOn: 4, don: 2 });
  t.ok(t.OP.engine.legalActions(s).some((a) => a.t === 'attack' && a.uid === sj.uid), 'Sanji may attack the turn he is played');
  const z = H.put(t, s, 0, 'ST01-013', { don: 1 });
  t.eq(H.pw(t, s, z), 7000, 'Zoro 5000 + 1000 DON!! + 1000');
  const ur = H.put(t, s, 0, 'ST02-003', { don: 1 });
  t.eq(H.pw(t, s, ur), 3000 + 1000 + 2000, 'Urouge with 3 Characters');
});

test('ST01-005 Jinbe: [DON!! x1] [When Attacking] up to 1 OTHER Leader/Character +1000', (t) => {
  let s = G(t);
  const j = H.put(t, s, 0, 'ST01-005', { don: 1 });
  let offered;
  s = H.act(t, s, { t: 'attack', uid: j.uid, target: s.players[1].leader.uid }, (h, a) => { offered = a.map((x) => x.uid); return a.find((x) => x.uid === s.players[0].leader.uid); });
  t.ok(!offered.includes(j.uid), 'not itself');
  t.eq(H.pw(t, s, s.players[0].leader), 6000, 'Leader +1000');
});

test('ST01-012 Luffy: [DON!! x2] [When Attacking] opp cannot activate [Blocker]', (t) => {
  let s = G(t);
  const l = H.put(t, s, 0, 'ST01-012', { don: 2 });
  H.put(t, s, 1, 'ST02-004');
  s = H.act(t, s, { t: 'attack', uid: l.uid, target: s.players[1].leader.uid });
  t.ok(!s.queue.some((q) => q.k === 'block'), 'no block step');
});

test('ST01-014 Guard Point / ST02-015 Scalpel / ST02-016 Repel: [Counter] power', (t) => {
  for (const [id, n] of [['ST01-014', 3000], ['ST02-015', 2000], ['ST02-016', 4000]]) {
    let s = G(t, { active: 1 });
    s.players[0].hand = [id];
    const a = H.put(t, s, 1, 'OP10-013');         // 7000
    s.players[0].leader.mods.push({ stat: 'power', n: 2000 - n + 1, until: 'turn' });
    s = H.attack(t, s, a.uid, s.players[0].leader.uid, { counter: id });
    t.eq(s.players[0].life.length, 4, id + ' +' + n);
  }
});

test('ST01-015 Gum-Gum Jet Pistol: [Main] K.O. up to 1 opp 6000 or less; [Trigger] same', (t) => {
  let s = G(t);
  const v = H.put(t, s, 1, 'ST02-006');           // 6000
  const w = H.put(t, s, 1, 'ST02-013');           // 7000
  let offered;
  s = H.play(t, s, 'ST01-015', (h, a) => { offered = a.map((x) => x.uid); return a.find((x) => x.uid === v.uid); });
  t.ok(!offered.includes(w.uid), '7000 not offered');
  t.ok(!H.find(t, s, v), '6000 K.O.d');
});

test('ST01-016 Diable Jambe: [Main] a Straw Hat attacker cannot be blocked this turn; [Trigger] K.O. a cost 3 or less Blocker', (t) => {
  let s = G(t);
  const z = H.put(t, s, 0, 'ST01-013');
  H.put(t, s, 1, 'ST02-004');
  s = H.play(t, s, 'ST01-016', H.choose(z.uid));
  s = H.act(t, s, { t: 'attack', uid: z.uid, target: s.players[1].leader.uid });
  t.ok(!s.queue.some((q) => q.k === 'block'), 'no block step for Zoro');
});

test('ST01-017 Thousand Sunny: activate rest: up to 1 Straw Hat Leader/Character +1000', (t) => {
  let s = G(t);
  const st = H.put(t, s, 0, 'ST01-017');
  s = H.activate(t, s, st.uid, H.choose(s.players[0].leader.uid));
  t.eq(H.pw(t, s, s.players[0].leader), 6000, '+1000');
  t.ok(H.find(t, s, st).rested, 'Sunny rested');
});

test('ST02-001 Eustass Kid (Leader): [Once Per Turn] ③ may trash 1: set this Leader active', (t) => {
  let s = G(t);
  H.leader(t, s, 0, 'ST02-001');
  s.players[0].leader.rested = true;
  s.players[0].hand = ['OP01-036', 'ST01-003'];
  s = H.activate(t, s, s.players[0].leader.uid, H.choose('ST01-003'));
  t.ok(!s.players[0].leader.rested, 'Leader active');
  t.ok(s.players[0].trash.includes('ST01-003'), 'the chosen card was trashed');
  t.eq(s.players[0].donRested, 3, 'three DON!! rested');
});

test('ST02-005 Killer: [On Play] K.O. up to 1 opp RESTED cost 3 or less', (t) => {
  let s = G(t);
  const act = H.put(t, s, 1, 'ST02-002');
  const res = H.put(t, s, 1, 'ST02-002', { rested: true });
  s = H.play(t, s, 'ST02-005');
  t.ok(H.find(t, s, act), 'active survives');
  t.ok(!H.find(t, s, res), 'rested K.O.d');
});

test('ST02-008 Scratchmen Apoo: [DON!! x1] [When Attacking] rest up to 1 opp DON!!', (t) => {
  let s = G(t);
  const a = H.put(t, s, 0, 'ST02-008', { don: 1 });
  s.players[1].donActive = 3;
  s = H.act(t, s, { t: 'attack', uid: a.uid, target: s.players[1].leader.uid });
  t.eq(s.players[1].donActive, 2, 'one rested');
});

test('ST02-009 Trafalgar Law: [On Play] set up to 1 rested Supernovas/Heart cost 5 or less active', (t) => {
  let s = G(t);
  const b = H.put(t, s, 0, 'ST02-012', { rested: true });
  s = H.play(t, s, 'ST02-009');
  t.ok(!H.find(t, s, b).rested, 'Bepo active');
});

test('ST02-010 Basil Hawkins: [DON!! x1] [Once Per Turn] [Your Turn] battles an opp Character: set active', (t) => {
  let s = G(t);
  const h = H.put(t, s, 0, 'ST02-010', { don: 1 });
  const v = H.put(t, s, 1, 'ST02-004', { rested: true });
  s = H.attack(t, s, h.uid, v.uid);
  t.ok(!H.find(t, s, h).rested, 'set active after battling a Character');
});

test('ST02-014 X.Drake: [DON!! x1] [Your Turn] rested: Supernovas/Navy +1000', (t) => {
  let s = G(t);
  const d = H.put(t, s, 0, 'ST02-014', { don: 1, rested: true });
  const k = H.put(t, s, 0, 'ST02-006');           // Navy
  t.eq(H.pw(t, s, k), 7000, 'Koby +1000');
  t.eq(H.pw(t, s, s.players[0].leader), 6000, 'Supernovas Leader +1000');
});

test('ST02-017 Straw Sword: [Main] rest up to 1 opp Character; [Trigger] play a Supernovas cost 2 or less from hand', (t) => {
  let s = G(t);
  const v = H.put(t, s, 1, 'ST02-006');
  s = H.play(t, s, 'ST02-017');
  t.ok(H.find(t, s, v).rested, 'rested');
});

test('ST14-002 Usopp: [DON!! x1] [When Attacking] you have cost 8+: K.O. up to 1 opp cost 4 or less', (t) => {
  let s = G(t);
  const u = H.put(t, s, 0, 'ST14-002', { don: 1 });
  H.put(t, s, 0, 'ST14-012');
  const v = H.put(t, s, 1, 'ST02-006');
  s = H.attack(t, s, u.uid, s.players[1].leader.uid);
  t.ok(!H.find(t, s, v), 'K.O.d');
});

test('ST14-012 Monkey.D.Luffy: you have cost 10+: gains [Rush]', (t) => {
  let s = G(t);
  const l = H.put(t, s, 0, 'ST14-012', { playedOn: 4 });
  t.ok(!t.OP.state.hasKeyword(s, l, 'rush'), 'no cost 10 Character');
});

test('ST28-005 Yamato: [DON!! x2] [Your Turn] +3000', (t) => {
  let s = G(t);
  const y = H.put(t, s, 0, 'ST28-005', { don: 2 });
  t.eq(H.pw(t, s, y), 0 + 2000 + 3000, 'power 0 + 2 DON!! + 3000');
});

test('ST30-001 Luffy & Ace (Leader): base 7000+ Character: −2000; [Opponent\'s Turn] Ace and Luffy +3000', (t) => {
  let s = G(t);
  H.leader(t, s, 0, 'ST30-001');
  t.eq(H.pw(t, s, s.players[0].leader), 6000, 'no big Character');
  H.put(t, s, 0, 'OP10-013');                     // 7000 base
  t.eq(H.pw(t, s, s.players[0].leader), 4000, '−2000');
  const ace = H.put(t, s, 0, 'P-028');
  s.active = 1;
  t.eq(H.pw(t, s, ace), 9000, 'Ace +3000 on the opponent\'s turn');
});

test('Vanilla cards carry no ability and only their printed keywords', (t) => {
  const { OP } = t;
  const reach = new Set();
  OP.decks.forEach((d) => { reach.add(d.leader); d.list.forEach(([i]) => reach.add(i)); });
  for (const id of reach) {
    const c = OP.state.card(id);
    if (c.text && c.text !== '-') continue;
    if (c.triggerText) continue;
    t.eq((c.abilities || []).length, 0, id + ' has no abilities');
  }
});

// ---------------------------------------------------------------------------------------
// PLAN.md D8 — never assume a choice.
// ---------------------------------------------------------------------------------------
test('D8: a single legal target is still offered, never taken silently', (t) => {
  const { OP } = t;
  let s = G(t);
  const only = H.put(t, s, 1, 'ST02-004');
  s.players[0].hand = ['OP05-010'];                // K.O. up to 1 with 1000 power or less
  s = OP.engine.apply(s, { t: 'play', id: 'OP05-010', ix: 0, cost: 1 });
  t.eq(s.queue[0] && s.queue[0].k, 'choice', 'the one legal target is offered');
  t.eq(s.queue[0].q.options.length, 1, 'exactly one option');
  t.eq(s.queue[0].q.options[0].uid, only.uid, 'and it is that card');
  // A MANDATORY single target ("1 of your Characters", min 1) is asked too.
  s = G(t);
  const c = H.put(t, s, 0, 'ST01-003');
  s.players[0].donRested = 2;
  H.leader(t, s, 0, 'OP15-058');
  s.players[0].donDeck = 6;
  s = OP.engine.apply(s, OP.engine.legalActions(s).find((a) => a.t === 'activate'));
  t.eq(s.queue[0] && s.queue[0].k, 'choice', 'Enel\'s "give to 1 of your Characters" asks with one Character');
  t.eq(s.queue[0].q.options[0].uid, c.uid, 'offering that Character');
});

test('D8: a hand of one is still chosen from when a card must be trashed', (t) => {
  const { OP } = t;
  let s = G(t);
  s.players[0].hand = ['OP16-090'];
  s.players[0].deck = ['ST01-003', 'OP01-036'].concat(s.players[0].deck);
  s = OP.engine.apply(s, { t: 'play', id: 'OP16-090', ix: 0, cost: 3 });   // draw 2, trash 2
  t.eq(s.queue[0].q.kind, 'trash', 'asked which card to trash');
});

test('D8 / CR 8-3-1-6: the player picks WHICH DON!! cards pay DON!! −X', (t) => {
  const { OP } = t;
  let s = G(t);
  const v = H.put(t, s, 1, 'ST02-006');
  const z = H.put(t, s, 0, 'ST01-013', { don: 1 });
  s.players[0].donActive = 2; s.players[0].donRested = 0;
  s.players[0].hand = ['OP05-077'];                // Gamma Knife, cost 2, DON!! −1
  s = OP.engine.apply(s, { t: 'event', id: 'OP05-077', ix: 0, cost: 2 });
  // cost 2 rests both active; the DON!! −1 is offered: pay? then which DON!!.
  s = OP.engine.apply(s, OP.engine.legalActions(s).find((a) => a.v === 'yes'));
  const q = s.queue[0].q;
  t.eq(q.kind, 'donMinus', 'asked which DON!! to return');
  const vs = q.options.map((o) => o.v);
  t.ok(vs.includes('__rested'), 'a rested one from the cost area is offered');
  t.ok(vs.includes(z.uid), 'and the one given to Zoro');
  s = OP.engine.apply(s, OP.engine.legalActions(s).find((a) => a.v === z.uid));
  s = H.settle(t, s, H.choose(v.uid));
  t.eq(H.find(t, s, z).don, 0, 'the DON!! came off Zoro, as chosen');
  t.eq(s.players[0].donRested, 2, 'the cost area was untouched');
  t.eq(H.pw(t, s, v), 1000, 'and the effect resolved');
});

test('D8: a "look at N" with nothing that qualifies still shows the cards', (t) => {
  const { OP } = t;
  let s = G(t);
  s.players[0].deck = Array(8).fill('OP01-036');
  s.players[0].hand = ['OP01-016'];
  s = OP.engine.apply(s, { t: 'play', id: 'OP01-016', ix: 0, cost: 1 });
  t.eq(s.queue[0] && s.queue[0].q.kind, 'deckpick', 'the look is shown');
  t.eq(s.queue[0].q.seen.length, 5, 'with all five cards');
  t.eq(s.queue[0].q.options.length, 0, 'none of them takeable');
  const acts = OP.engine.legalActions(s);
  t.eq(acts.length, 1, 'the only action is to acknowledge');
  s = OP.engine.apply(s, acts[0]);
  t.eq(s.players[0].hand.length, 0, 'nothing added');
});
