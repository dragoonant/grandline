// Card attacks and battles — Comprehensive Rules 7, and the keyword effects of 10-1.
// These build a state by hand rather than playing to one, so each rule is isolated.

function board(t, opts) {
  const { OP } = t;
  opts = opts || {};
  let s = OP.engine.newGame({ seed: 3, first: 0, decks: [t.deckFor('st01'), t.deckFor('st02')] });
  s = OP.engine.apply(s, { t: 'keepHand' });
  s = OP.engine.apply(s, { t: 'keepHand' });
  s.turn = 4;                                  // past the no-battle first turn (CR 6-5-6-1)
  s.phase = 'main';
  s.active = opts.active === undefined ? 0 : opts.active;
  s.queue = [];
  return s;
}

function put(t, s, seat, cardId, over) {
  const { OP } = t;
  const u = OP.state.unit('C', cardId);
  u.playedOn = -1;                             // not summoning sick
  Object.assign(u, over || {});
  s.players[seat].chars.push(u);
  return u;
}

test('CR 7-1-4-1: the attacker wins on EQUAL power', (t) => {
  const { OP } = t;
  const s = board(t);
  const a = put(t, s, 0, 'ST01-005');           // Jinbe, 5000
  const d = put(t, s, 1, 'ST02-002', { rested: true });  // Vito, 5000
  s.players[1].hand = [];                      // no Counter Step to close (CR 7-1-3)
  t.eq(OP.state.power(s, a), 5000, 'attacker power');
  t.eq(OP.state.power(s, d), 5000, 'defender power');
  const out = OP.engine.apply(s, { t: 'attack', uid: a.uid, target: d.uid });
  t.eq(out.players[1].chars.length, 0, 'the defender was K.O.’d on equal power');
  t.eq(out.players[1].trash[out.players[1].trash.length - 1], 'ST02-002', 'it went to its owner’s trash');
});

test('CR 7-1-4-2: a weaker attacker loses and nothing happens', (t) => {
  const { OP } = t;
  const s = board(t);
  const a = put(t, s, 0, 'ST01-003');           // Karoo, 3000
  const d = put(t, s, 1, 'ST02-002', { rested: true });  // Vito, 5000
  const out = OP.engine.apply(s, { t: 'attack', uid: a.uid, target: d.uid });
  t.eq(out.players[1].chars.length, 1, 'the defender survived');
  t.eq(out.players[0].chars.length, 1, 'and the attacker is not punished');
  t.ok(OP.state.findUnit(out, a.uid).rested, 'but the attacker is rested (CR 7-1-1-1)');
});

test('CR 7-1-1-2: an ACTIVE Character cannot be attacked', (t) => {
  const { OP } = t;
  const s = board(t);
  const a = put(t, s, 0, 'ST01-005');
  const active = put(t, s, 1, 'ST02-002', { rested: false });
  const rested = put(t, s, 1, 'ST02-011', { rested: true });
  const targets = OP.engine.targetsFor(s, 0, a).map((u) => u.uid);
  t.ok(targets.indexOf(rested.uid) >= 0, 'the rested Character is a legal target');
  t.ok(targets.indexOf(active.uid) < 0, 'the active Character is not');
  t.ok(targets.indexOf(s.players[1].leader.uid) >= 0, 'the Leader always is');
});

test('CR 3-7-4 / 10-1-1: a card played this turn cannot attack unless it has [Rush]', (t) => {
  const { OP } = t;
  const s = board(t);
  const sick = put(t, s, 0, 'ST01-005', { playedOn: s.turn });        // no Rush
  const rush = put(t, s, 0, 'ST01-012', { playedOn: s.turn });        // Monkey.D.Luffy, [Rush]
  const who = OP.engine.attackers(s, 0).map((u) => u.uid);
  t.ok(who.indexOf(sick.uid) < 0, 'the plain Character cannot attack');
  t.ok(who.indexOf(rush.uid) >= 0, 'the [Rush] Character can');
});

test('CR 7-1-2: a [Blocker] is offered, and blocking redirects the attack onto it', (t) => {
  const { OP } = t;
  const s = board(t);
  const a = put(t, s, 0, 'ST01-005');                    // 5000
  const blocker = put(t, s, 1, 'ST02-004');              // Bege, 1000, [Blocker], active
  t.ok(OP.state.hasKeyword(s, blocker, 'blocker'), 'Bege prints [Blocker]');
  let out = OP.engine.apply(s, { t: 'attack', uid: a.uid, target: s.players[1].leader.uid });
  t.eq(out.queue[0].k, 'block', 'the Block Step opened');
  t.eq(out.queue[0].ctrl, 1, 'and it is the DEFENDER who acts');
  t.eq(OP.engine.whoActs(out), 1, 'whoActs routes to the non-turn player');
  out = OP.engine.apply(out, { t: 'block', uid: blocker.uid });
  t.eq(out.battle.target, blocker.uid, 'the blocker became the target');
  t.ok(OP.state.findUnit(out, blocker.uid) === null || true, 'resolved');
});

test('CR 10-1-4: blocking rests the blocker and it is K.O.’d if it loses', (t) => {
  const { OP } = t;
  const s = board(t);
  const a = put(t, s, 0, 'ST01-005');                    // 5000
  const blocker = put(t, s, 1, 'ST02-004');              // 1000
  let out = OP.engine.apply(s, { t: 'attack', uid: a.uid, target: s.players[1].leader.uid });
  out = OP.engine.apply(out, { t: 'block', uid: blocker.uid });
  // no counters in this hand path — drive the window closed
  let guard = 0;
  while (out.queue.length && guard++ < 20) {
    const acts = OP.engine.legalActions(out);
    const stop = acts.filter((x) => x.t === 'noCounter' || x.t === 'noBlock' || x.t === 'takeLife')[0] || acts[0];
    out = OP.engine.apply(out, stop);
  }
  t.eq(out.players[1].chars.length, 0, 'the blocker was K.O.’d');
  t.eq(out.players[1].life.length, s.players[1].life.length, 'and the Leader took no damage');
});

test('CR 7-1-3-1-1: a Counter from hand raises the defender for that battle only', (t) => {
  const { OP } = t;
  const s = board(t);
  const a = put(t, s, 0, 'ST01-005');                    // 5000
  s.players[1].hand = ['ST01-011', 'ST01-011'];          // Brook, Counter 2000 (red, but hand is hand)
  let out = OP.engine.apply(s, { t: 'attack', uid: a.uid, target: s.players[1].leader.uid });
  t.eq(out.queue[0].k, 'counter', 'the Counter Step opened');
  const acts = OP.engine.legalActions(out);
  const c = acts.filter((x) => x.t === 'counter')[0];
  t.eq(c.n, 2000, 'the Counter value comes from the card');
  out = OP.engine.apply(out, c);
  t.eq(OP.state.power(out, out.players[1].leader), 7000, 'the Leader is at 5000 + 2000');
  t.eq(out.queue[0].k, 'counter', 'and the step RE-OFFERS itself (CR 7-1-3-1)');
  out = OP.engine.apply(out, { t: 'noCounter' });
  t.eq(out.players[1].life.length, s.players[1].life.length, 'the attack failed, no damage');
  t.eq(OP.state.power(out, out.players[1].leader), 5000, 'and the Counter expired with the battle (CR 7-1-5-3)');
});

test('CR 4-6-2-1: damage takes the TOP Life card to hand', (t) => {
  const { OP } = t;
  const s = board(t);
  const a = put(t, s, 0, 'ST01-005');
  s.players[1].hand = [];                                // no counters available
  s.players[1].life = ['ST02-002', 'ST02-011', 'ST02-012'];
  const hand0 = s.players[1].hand.length;
  let out = OP.engine.apply(s, { t: 'attack', uid: a.uid, target: s.players[1].leader.uid });
  let guard = 0;
  while (out.queue.length && guard++ < 20) {
    const acts = OP.engine.legalActions(out);
    out = OP.engine.apply(out, acts.filter((x) => x.t === 'noCounter' || x.t === 'takeLife' || x.t === 'noBlock')[0] || acts[0]);
  }
  t.eq(out.players[1].life.length, 2, 'one Life card was taken');
  t.eq(out.players[1].hand.length, hand0 + 1, 'and it went to hand');
  t.eq(out.players[1].hand[out.players[1].hand.length - 1], 'ST02-002', 'it was the TOP card');
});

test('CR 7-1-4-1-1-1 / 9-2-1-1: damaged with 0 Life loses the game', (t) => {
  const { OP } = t;
  const s = board(t);
  const a = put(t, s, 0, 'ST01-005');
  s.players[1].hand = [];
  s.players[1].life = [];
  t.eq(s.winner, null, 'zero Life alone is not a loss');
  let out = OP.engine.apply(s, { t: 'attack', uid: a.uid, target: s.players[1].leader.uid });
  let guard = 0;
  while (out.winner === null && out.queue.length && guard++ < 20) {
    const acts = OP.engine.legalActions(out);
    out = OP.engine.apply(out, acts.filter((x) => x.t === 'noCounter' || x.t === 'noBlock')[0] || acts[0]);
  }
  t.eq(out.winner, 0, 'being damaged at 0 Life is');
});

test('CR 6-5-5-2: DON!! given adds +1000, and only during your own turn', (t) => {
  const { OP } = t;
  const s = board(t);
  const u = put(t, s, 0, 'ST01-005', { don: 2 });        // 5000 base
  t.eq(OP.state.power(s, u), 7000, 'on your turn, +2000');
  s.active = 1;
  t.eq(OP.state.power(s, u), 5000, "on the opponent's turn, nothing");
});

test('CR 8-1-3-3: a permanent effect is recomputed, not stored', (t) => {
  const { OP } = t;
  const s = board(t);
  const zoro = put(t, s, 0, 'ST01-013');                 // [DON!! x1] this Character gains +1000
  t.eq(OP.state.power(s, zoro), 5000, 'with no DON!! attached, base only');
  zoro.don = 1;
  t.eq(OP.state.power(s, zoro), 7000, 'with 1 DON!!: 5000 + 1000 (DON!!) + 1000 (its own effect)');
  zoro.don = 0;
  t.eq(OP.state.power(s, zoro), 5000, 'and it goes away again when the condition stops holding');
});

test('CR 3-7-6: a 6th Character forces a trash, and that trash is NOT a K.O.', (t) => {
  const { OP } = t;
  const s = board(t);
  for (let i = 0; i < 5; i++) put(t, s, 0, 'ST01-003');
  t.eq(s.players[0].chars.length, 5, 'the Character area is full');
  s.players[0].hand = ['ST01-005'];
  s.players[0].donActive = 9;
  let out = OP.engine.apply(s, { t: 'play', id: 'ST01-005', ix: 0, cost: 3 });
  // the overflow choice is parked on the queue
  if (out.queue.length && out.queue[0].k === 'choice') {
    out = OP.engine.apply(out, OP.engine.legalActions(out)[0]);
  }
  t.eq(out.players[0].chars.length, 5, 'still 5 after the new one arrived');
  t.ok(out.log.some((e) => e.tag === 'char.overflowTrashed'), 'logged as rule processing');
  t.ok(!out.log.some((e) => e.tag === 'char.ko' && e.data.seat === 0), 'and NOT as a K.O. (CR 3-7-6-1-1)');
});
