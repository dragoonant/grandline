// Timings that belong to the DEFENDING player during the attacker's turn — CR 10-2-16.
// These are the half of the reactive window that is not a prompt: the defender's own auto
// effects, which fire without asking anyone.

function board(t, opts) {
  const { OP } = t;
  opts = opts || {};
  let s = OP.engine.newGame({ seed: 11, first: 0, decks: [t.deckFor('st01'), t.deckFor('st02')] });
  s = OP.engine.apply(s, { t: 'keepHand' });
  s = OP.engine.apply(s, { t: 'keepHand' });
  s.turn = 4; s.phase = 'main'; s.queue = [];
  s.active = opts.active === undefined ? 0 : opts.active;
  return s;
}
function put(t, s, seat, cardId, over) {
  const u = t.OP.state.unit('C', cardId);
  u.playedOn = -1;
  Object.assign(u, over || {});
  s.players[seat].chars.push(u);
  return u;
}

test("CR 10-2-16: [On Your Opponent's Attack] is compiled as its own ability", (t) => {
  const { OP } = t;
  // OP17-058 Kaido prints "[When Attacking]/[On Your Opponent's Attack]" — ONE effect under TWO
  // timings. Emitting only the first silently loses half the card, which is what the auditor
  // caught. The compiler must produce one ability per printed timing.
  const whens = OP.cards.get('OP17-058').abilities.map((a) => a.when);
  t.ok(whens.includes('whenAttacking'), 'the [When Attacking] half compiled');
  t.ok(whens.includes('onOpponentAttack'), "the [On Your Opponent's Attack] half compiled");
});

test("CR 10-2-16-1: the defender's [On Your Opponent's Attack] fires on the attacker's turn", (t) => {
  const { OP } = t;
  const s = board(t);                                   // seat 0 is the turn player
  // Kaido's Leader carries the timing. It belongs to the defending PLAYER, so it fires even
  // though a Character, not the Leader, is the card being attacked.
  s.players[1].leaderId = 'OP17-058';
  s.players[1].leader = OP.state.unit('L', 'OP17-058');
  s.players[1].donActive = 3;
  const a = put(t, s, 0, 'ST01-005');
  put(t, s, 1, 'ST02-002', { rested: true });

  const out = OP.engine.apply(s, { t: 'attack', uid: a.uid, target: s.players[1].chars[0].uid });

  // It fired exactly once. Matching the second timing on BOTH the original ability and the one
  // emitted for it fired the same effect twice.
  const choices = out.queue.filter((q) => q.k === 'choice');
  t.eq(choices.length, 1, 'the effect fired exactly once');
  t.eq(OP.engine.whoActs(out), 1, 'and it handed the decision to the DEFENDER');

  // CR 8-6-1 — the parked question resolves BEFORE the battle continues, so it must sit ahead
  // of the Counter Step rather than behind it.
  t.eq(out.queue[0].k, 'choice', 'the question is ahead of the Counter Step');
  t.ok(out.queue.some((q) => q.k === 'counter'), 'the Counter Step is still queued behind it');
});

test('CR 8-3-1: an AUTO effect pays its activation cost', (t) => {
  const { OP } = t;
  const s = board(t);
  s.players[1].leaderId = 'OP17-058';
  s.players[1].leader = OP.state.unit('L', 'OP17-058');   // DON!! -1 on its auto effect
  s.players[1].donActive = 3;
  const a = put(t, s, 0, 'ST01-005');
  put(t, s, 1, 'ST02-002', { rested: true });

  let out = OP.engine.apply(s, { t: 'attack', uid: a.uid, target: s.players[1].chars[0].uid });
  const before = out.players[1].donActive + out.players[1].donRested;
  // DON!! −1 prints "(You may return ...)", so the defender is asked first (CR 8-3-1-4); then the
  // target. The cost runs at the front of the same invocation.
  t.eq(out.queue[0].q.kind, 'confirm', 'the optional cost is offered, not taken');
  out = OP.engine.apply(out, OP.engine.legalActions(out).find((a) => a.v === 'yes'));
  while (out.queue[0] && out.queue[0].k === 'choice') {
    out = OP.engine.apply(out, OP.engine.legalActions(out).find((a) => a.v !== '__done'));
  }
  const after = out.players[1].donActive + out.players[1].donRested;
  t.eq(after, before - 1, 'DON!! -1 was actually taken (it used to resolve for free)');
  t.ok(out.log.some((e) => e.tag === 'cost.donMinus'), 'and the payment is in the log');
});

test('CR 7-1-1-3: [When Attacking] fires for the attacker before the Block Step', (t) => {
  const { OP } = t;
  const s = board(t);
  // ST01-005 Jinbe: [DON!! x1] [When Attacking] up to 1 of your other cards gains +1000.
  const a = put(t, s, 0, 'ST01-005', { don: 1 });
  put(t, s, 0, 'ST01-003');                              // a second card to receive the buff
  s.players[1].hand = [];
  const out = OP.engine.apply(s, { t: 'attack', uid: a.uid, target: s.players[1].leader.uid });
  const order = out.log.map((e) => e.tag);
  const attacked = order.indexOf('battle.declared');
  const damaged = order.indexOf('battle.damage');
  t.ok(attacked >= 0, 'the attack was declared');
  t.ok(damaged > attacked, 'damage came after the declaration');
});
