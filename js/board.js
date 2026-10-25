// js/board.js — draws a state onto the mat. Pure rendering: it reads the state and never changes
// one. Every zone is rebuilt from scratch on every frame, which is what lets js/fx.js compare
// the frame before with the frame after.
//
// The mat and its zone boxes belong to js/boardart.js; this file only fills them.
(function (NS) {
  'use strict';

  function el(t, c, x) { return NS.render.el(t, c, x); }
  function zone(id) {
    var z = document.getElementById(id);
    if (!z) throw new Error('board: index.html is missing #' + id);
    z.textContent = '';
    return z;
  }

  function unitNode(s, u, size) {
    var card = NS.state.card(u.id);
    var n = NS.render.render(card, size, { uid: u.uid });
    NS.render.decorate(n, s, u);
    return n;
  }

  function count(n, cls) { return el('div', 'zone-count' + (cls ? ' ' + cls : ''), String(n)); }

  // A face-down pile whose visible depth follows its size.
  function pile(n, backFn) {
    var w = el('div', 'pile');
    var depth = n ? Math.min(4, 1 + Math.floor(n / 12)) : 0;
    for (var i = depth - 1; i >= 0; i--) {
      var b = backFn();
      b.style.setProperty('--d', String(i));
      w.appendChild(b);
    }
    if (!n) w.appendChild(el('div', 'pile-empty'));
    return w;
  }

  // CR 3-10 — the Life area: face-down cards, the top of the stack (index 0) nearest the
  // centre line. The count is the number that decides the game, so it is the big one.
  function lifeZone(z, p) {
    var stack = el('div', 'life-stack');
    stack.style.setProperty('--n', String(Math.max(1, p.life.length)));
    for (var i = p.life.length - 1; i >= 0; i--) {
      var b = NS.render.back('');
      b.classList.add('life-card');
      stack.appendChild(b);
    }
    z.appendChild(stack);
    z.appendChild(count(p.life.length, 'life-count'));
    z.title = p.life.length + ' ' + NS.names.term('life') + ' card' + (p.life.length === 1 ? '' : 's');
  }

  // CR 3-9 — the Cost Area: every DON!! card, active upright and rested turned sideways.
  function costZone(z, p) {
    var row = el('div', 'don-row');
    for (var i = 0; i < p.donActive; i++) row.appendChild(NS.render.don(false));
    for (var j = 0; j < p.donRested; j++) row.appendChild(NS.render.don(true));
    z.appendChild(row);
    var total = p.donActive + p.donRested;
    z.appendChild(el('div', 'zone-pill', p.donActive + ' / ' + total + ' active'));
  }

  function sideNodes(s, seat, mine) {
    var p = s.players[seat];
    var pre = mine ? 'my-' : 'enemy-';

    lifeZone(zone(pre + 'life'), p);

    zone(pre + 'leader').appendChild(unitNode(s, p.leader, 'board'));

    var ch = zone(pre + 'chars');
    p.chars.forEach(function (u) { ch.appendChild(unitNode(s, u, 'board')); });

    var st = zone(pre + 'stage');
    if (p.stage) st.appendChild(unitNode(s, p.stage, 'board'));

    var dk = zone(pre + 'deck');
    dk.appendChild(pile(p.deck.length, function () { return NS.render.back(''); }));
    dk.appendChild(count(p.deck.length));
    dk.title = p.deck.length + ' card' + (p.deck.length === 1 ? '' : 's') + ' in ' + (mine ? 'your' : "the opponent's") + ' ' + NS.names.term('deck');

    // CR 3-5-2 — the trash is an OPEN area: either player may view either trash at any time.
    // The whole zone is the control; the top card is face up, so it can also be hovered.
    var tr = zone(pre + 'trash');
    tr.classList.add('trash-view');
    tr.dataset.seat = String(seat);
    tr.title = 'Look at every card in ' + (mine ? 'your' : "the opponent's") + ' ' + NS.names.term('trash');
    if (p.trash.length) {
      var top = NS.render.render(NS.state.card(p.trash[p.trash.length - 1]), 'board', {});
      top.classList.add('pile-top');
      tr.appendChild(top);
    } else tr.appendChild(el('div', 'pile-empty'));
    tr.appendChild(count(p.trash.length));

    var dd = zone(pre + 'dondeck');
    dd.appendChild(pile(p.donDeck, function () { return NS.render.don(false, true); }));
    dd.appendChild(count(p.donDeck));
    dd.title = p.donDeck + ' card' + (p.donDeck === 1 ? '' : 's') + ' left in the ' + NS.names.term('don') + ' ' + NS.names.term('deck');

    costZone(zone(pre + 'cost'), p);
  }

  function handNode(s, seat) {
    var p = s.players[seat];
    var w = document.getElementById('hand');
    w.textContent = '';
    p.hand.forEach(function (id, ix) {
      var n = NS.render.render(NS.state.card(id), 'hand', {});
      n.dataset.handIx = String(ix);
      w.appendChild(n);
    });
    // Wide hands overlap rather than shrink — spec §12, remove content, don't shrink it.
    if (p.hand.length > 7) w.style.setProperty('--overlap', String(Math.min(9, p.hand.length - 7)));
    else w.style.removeProperty('--overlap');
    return w;
  }

  // The opponent's hand: the near edge of each card back, and how many there are.
  function enemyHand(s, seat) {
    var p = s.players[seat];
    var w = document.getElementById('enemy-hand');
    w.textContent = '';
    for (var i = 0; i < p.hand.length; i++) w.appendChild(NS.render.back(''));
    w.appendChild(el('span', 'enemy-hand-count', p.hand.length + ' in ' + NS.names.term('hand')));
  }

  function draw(root, s, youSeat) {
    NS.boardArt.init(document.getElementById('mat'));
    sideNodes(s, 1 - youSeat, false);
    sideNodes(s, youSeat, true);
    enemyHand(s, 1 - youSeat);
    handNode(s, youSeat);
    root.classList.toggle('their-turn', s.active !== youSeat);
    return root;
  }

  NS.board = { draw: draw, unitNode: unitNode };
}(window.OP = window.OP || {}));
