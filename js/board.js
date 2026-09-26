// js/board.js — draws a state. Pure rendering: it reads the state and never changes one.
// The board rebuilds from scratch on every frame, which is what lets js/anim.js use FLIP.
(function (NS) {
  'use strict';

  var R;
  function el(t, c, x) { return NS.render.el(t, c, x); }

  function lifePips(n) {
    var w = el('div', 'life-pips');
    for (var i = 0; i < n; i++) w.appendChild(el('span', 'life-pip'));
    return w;
  }

  function donRow(active, rested) {
    var w = el('div', 'don-row');
    for (var i = 0; i < active; i++) w.appendChild(el('span', 'don-chip'));
    for (var j = 0; j < rested; j++) w.appendChild(el('span', 'don-chip rested'));
    return w;
  }

  function rail(s, seat, mine) {
    var p = s.players[seat];
    var w = el('div', 'rail');
    w.appendChild(el('div', null, mine ? 'You' : 'Opponent'));
    var life = el('div', null);
    life.appendChild(el('span', null, NS.names.term('life') + ' '));
    life.appendChild(el('b', null, String(p.life.length)));
    w.appendChild(life);
    w.appendChild(lifePips(p.life.length));
    var hand = el('div', null, NS.names.term('hand') + ': ' + p.hand.length +
                  '   ' + NS.names.term('deck') + ': ' + p.deck.length);
    w.appendChild(hand);
    w.appendChild(el('div', null, NS.names.term('don') + ' ' + p.donActive + '/' +
                     (p.donActive + p.donRested) + '  (deck ' + p.donDeck + ')'));
    w.appendChild(donRow(p.donActive, p.donRested));
    w.appendChild(el('div', null, NS.names.term('trash') + ': ' + p.trash.length));
    return w;
  }

  function unitNode(s, u, size) {
    var card = NS.state.card(u.id);
    var n = NS.render.render(card, size, { uid: u.uid });
    NS.render.decorate(n, s, u);
    return n;
  }

  function sideNode(s, seat, mine) {
    var p = s.players[seat];
    var side = el('div', 'side ' + (mine ? 'mine' : 'enemy'));

    var left = el('div', 'zone leader');
    left.appendChild(unitNode(s, p.leader, 'board'));
    if (p.stage) {
      var st = unitNode(s, p.stage, 'board');
      st.classList.add('stage-slot');
      left.appendChild(st);
    }

    var mid = el('div', 'zone chars');
    if (!p.chars.length) mid.appendChild(el('div', 'empty-note', ''));
    p.chars.forEach(function (u) { mid.appendChild(unitNode(s, u, 'board')); });

    side.appendChild(mine ? left : rail(s, seat, mine));
    side.appendChild(mid);
    side.appendChild(mine ? rail(s, seat, mine) : left);
    return side;
  }

  function handNode(s, seat, faceUp) {
    var p = s.players[seat];
    var w = el('div', null);
    w.id = 'hand';
    p.hand.forEach(function (id, ix) {
      var n;
      if (faceUp) {
        n = NS.render.render(NS.state.card(id), 'hand', {});
        n.dataset.handIx = String(ix);
      } else {
        n = NS.render.back('');
        n.classList.add('card-hand');
      }
      w.appendChild(n);
    });
    // Narrow hands overlap rather than shrink — spec §12, remove content, don't shrink it.
    if (p.hand.length > 8 && faceUp) {
      var over = Math.min(34, (p.hand.length - 8) * 5);
      [].forEach.call(w.children, function (c, i) {
        if (i) c.style.marginLeft = '-' + over + 'px';
      });
    }
    return w;
  }

  function draw(root, s, youSeat) {
    root.textContent = '';
    var b = el('div', 'board');
    b.appendChild(sideNode(s, 1 - youSeat, false));

    var mid = el('div', 'midline');
    var prompt = el('div', null, '');
    prompt.id = 'prompt';
    mid.appendChild(prompt);
    b.appendChild(mid);

    b.appendChild(sideNode(s, youSeat, true));
    root.appendChild(b);
    root.appendChild(handNode(s, youSeat, true));
    return root;
  }

  NS.board = { draw: draw, unitNode: unitNode, rail: rail };
}(window.OP = window.OP || {}));
