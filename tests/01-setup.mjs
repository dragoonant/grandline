// Game setup and deck construction — Comprehensive Rules 5.
test('CR 5-1-2: every registered deck is exactly 50 cards, 4-of, colour-matched', (t) => {
  const { OP } = t;
  for (const d of OP.decks) {
    const list = [];
    d.list.forEach(([id, n]) => { for (let i = 0; i < n; i++) list.push(id); });
    const errs = OP.state.checkDeck(d.leader, list);
    t.eq(errs.join(' | '), '', `deck ${d.key} (${d.leader})`);
  }
});

test('CR 5-1-2: a 49-card deck is rejected', (t) => {
  const { OP } = t;
  const d = t.deckFor('st01');
  const errs = OP.state.checkDeck(d.leader, d.cards.slice(0, 49));
  t.ok(errs.some((e) => /must be 50/.test(e)), 'reports the wrong size');
});

test('CR 5-1-2-3: a 5th copy of one card number is rejected', (t) => {
  const { OP } = t;
  const d = t.deckFor('st01');
  const list = d.cards.slice(0, 45).concat(Array(5).fill('ST01-003'));
  const errs = OP.state.checkDeck(d.leader, list);
  t.ok(errs.some((e) => /exceeds 4/.test(e)), 'reports the 4-of limit');
});

test('CR 5-1-2-2: a card sharing no colour with the Leader is rejected', (t) => {
  const { OP } = t;
  const d = t.deckFor('st01');                     // Red leader
  const list = d.cards.slice(0, 49).concat(['ST02-002']);   // Green
  const errs = OP.state.checkDeck(d.leader, list);
  t.ok(errs.some((e) => /shares no colour/.test(e)), 'reports the colour rule');
});

test('CR 5-2-1-6: both players draw 5 and are each offered a redraw', (t) => {
  const { OP } = t;
  const s = OP.engine.newGame({ seed: 7, decks: [t.deckFor('st01'), t.deckFor('st02')] });
  t.eq(s.players[0].hand.length, 5, 'seat 0 opening hand');
  t.eq(s.players[1].hand.length, 5, 'seat 1 opening hand');
  t.eq(s.queue.length, 2, 'two mulligan steps');
  t.eq(OP.engine.whoActs(s), s.first, 'the player going first decides first');
});

test('CR 2-9-2-1 / 5-2-1-7: Life is set from the Leader, last card dealt on top', (t) => {
  const { OP } = t;
  let s = OP.engine.newGame({ seed: 7, decks: [t.deckFor('st01'), t.deckFor('st02')] });
  s = OP.engine.apply(s, { t: 'keepHand' });
  s = OP.engine.apply(s, { t: 'keepHand' });
  t.eq(s.players[0].life.length, OP.cards.get('ST01-001').life, 'seat 0 Life equals the Leader value');
  t.eq(s.players[1].life.length, OP.cards.get('ST02-001').life, 'seat 1 Life equals the Leader value');
});

test('CR 6-3-1 / 6-4-1: the player going first skips their draw and gets 1 DON!!', (t) => {
  const { OP } = t;
  let s = OP.engine.newGame({ seed: 7, first: 0, decks: [t.deckFor('st01'), t.deckFor('st02')] });
  s = OP.engine.apply(s, { t: 'keepHand' });
  s = OP.engine.apply(s, { t: 'keepHand' });
  t.eq(s.active, 0, 'seat 0 is the turn player');
  t.eq(s.players[0].hand.length, 5, 'no draw on the first turn for the player going first');
  t.eq(s.players[0].donActive, 1, 'one DON!! on the first turn');
  t.eq(s.phase, 'main', 'we are in the Main Phase');
});

test('CR 6-5-6-1: neither player can battle on their first turn', (t) => {
  const { OP } = t;
  let s = OP.engine.newGame({ seed: 7, decks: [t.deckFor('st01'), t.deckFor('st02')] });
  s = OP.engine.apply(s, { t: 'keepHand' });
  s = OP.engine.apply(s, { t: 'keepHand' });
  t.ok(!OP.engine.legalActions(s).some((a) => a.t === 'attack'), 'no attack is offered on turn 1');
});

test('the same seed produces the same game', (t) => {
  const { OP } = t;
  const mk = () => {
    let s = OP.engine.newGame({ seed: 99, decks: [t.deckFor('st01'), t.deckFor('st02')] });
    s = OP.engine.apply(s, { t: 'keepHand' });
    s = OP.engine.apply(s, { t: 'keepHand' });
    return s;
  };
  t.eq(JSON.stringify(mk().players[0].hand), JSON.stringify(mk().players[0].hand), 'identical hands');
});
