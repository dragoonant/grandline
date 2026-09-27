// js/ui.js — the controller. CLAUDE.md hard rule 3: every affordance here derives from
// legalActions, so the UI cannot invent a rule and cannot miss one.
//
// CARD-LOG-AND-TARGETING-SPEC.md §16: ALWAYS SAY WHAT THE GAME IS WAITING FOR. That matters most
// in the reactive window, because a silent "opponent is thinking" during your own attack is the
// worst possible time to be vague. PLAN.md D4: each reactive prompt names what is being decided,
// shows the power arithmetic, and says what happens if you decline.
(function (NS) {
  'use strict';

  var S, E;
  var state = null, you = 0, busy = false, pendingAttacker = null;
  var root, promptEl, logEl, modalEl, previewEl;
  var AI_DELAY = 480;

  function el(t, c, x) { return NS.render.el(t, c, x); }

  function init(opts) {
    S = NS.state; E = NS.engine;
    root = document.getElementById('table');
    logEl = document.getElementById('log');
    modalEl = document.getElementById('modal');
    previewEl = document.getElementById('preview');
    you = opts.you === undefined ? 0 : opts.you;
    setState(opts.state);
  }

  function setState(s) {
    state = s;
    render();
    NS.audio.follow(s);
    step();
  }

  // ---------------------------------------------------------------------------------------
  function render() {
    // The board is rebuilt from scratch every frame, so the node the preview was following is
    // gone. Without this the last hovered card stays on screen and, being z-index 60, sits on
    // top of the modal — found by looking at the screen during a Counter prompt.
    hidePreview();
    NS.board.draw(root, state, you);
    promptEl = document.getElementById('prompt');
    renderLog();
    renderTop();
    wireTrash();
    wire();
    if (state.winner !== null) showResult();
  }

  function renderTop() {
    var t = document.getElementById('turnbadge');
    if (!t) return;
    var who = E.whoActs(state);
    t.textContent = 'Turn ' + state.turn + ' · ' +
      (state.active === you ? 'your turn' : "opponent's turn") +
      (who === you ? '' : ' · waiting');
  }

  // CARD-LOG-AND-TARGETING-SPEC §2 — log by player index, translate to second person last.
  var LOGLINE = {
    'game.start': function () { return 'The game begins.'; },
    'mulligan.redraw': function (e) { return who(e.seat) + ' redrew.'; },
    'mulligan.keep': function (e) { return who(e.seat) + ' kept the opening hand.'; },
    'life.set': function (e) { return who(e.seat) + ' set ' + e.data.n + ' Life.'; },
    'phase.main': function (e) { return '─ Turn ' + e.data.turn + ', ' + who(e.data.seat) + ' ─'; },
    'phase.don': function (e) { return who(e.data.seat) + ' took ' + e.data.n + ' DON!!.'; },
    'card.drawn': function (e) { return who(e.data.seat) + ' drew ' + e.data.n + '.'; },
    'card.played': function (e) { return who(e.data.seat) + ' played ' + nm(e.data.id) + ' for ' + e.data.cost + '.'; },
    'event.played': function (e) { return who(e.data.seat) + ' activated ' + nm(e.data.id) + '.'; },
    'stage.played': function (e) { return who(e.data.seat) + ' played the Stage ' + nm(e.data.id) + '.'; },
    'don.given': function (e) { return 'DON!! ×' + e.data.n + ' given to ' + unm(e.data.uid) + '.'; },
    'battle.declared': function (e) { return nm(e.data.attackerId) + ' attacks ' + nm(e.data.targetId) + '.'; },
    'battle.blocked': function (e) { return nm(e.data.id) + ' blocks.'; },
    'battle.unblocked': function () { return 'No blocker.'; },
    'counter.played': function (e) { return nm(e.data.id) + ' countered for +' + e.data.n + '.'; },
    'counterEvent.played': function (e) { return nm(e.data.id) + ' played as a Counter.'; },
    'battle.damage': function (e) { return 'Power ' + e.data.attackPower + ' vs ' + e.data.defendPower + '.'; },
    'battle.lost': function () { return 'The attack failed.'; },
    'char.ko': function (e) { return nm(e.data.id) + ' was K.O.’d.'; },
    'char.returned': function (e) { return nm(e.data.id) + ' returned to the ' + e.data.to + '.'; },
    'life.taken': function (e) { return who(e.data.seat) + ' took 1 damage — ' + e.data.left + ' Life left.'; },
    'life.banished': function (e) { return who(e.data.seat) + '’s Life card was banished — ' + e.data.left + ' left.'; },
    'trigger.used': function (e) { return 'Trigger! ' + nm(e.data.id) + '.'; },
    'trigger.declined': function () { return 'The Trigger was declined.'; },
    // What a player reveals or trashes is public (CR 3-5-2, 2-7-2), so the log names it.
    'deck.looked': function (e) {
      var r = (e.data.revealed || []).map(nm);
      return who(e.data.seat) + ' looked at ' + e.data.n + ' cards' +
        (r.length ? ', revealed ' + r.join(', ') + ' and added it to hand' : ' and took none') + '.';
    },
    'deck.revealed': function (e) { return who(e.data.seat) + ' revealed ' + e.data.ids.map(nm).join(', ') + ' from the top of the deck.'; },
    'card.trashed': function (e) { return who(e.data.seat) + ' trashed ' + nm(e.data.id) + ' from hand.'; },
    'cost.declined': function (e) { return who(e.data.seat) + ' chose not to pay for ' + nm(e.data.id) + '.'; },
    'life.toHand': function (e) { return who(e.data.seat) + ' added a Life card to hand — ' + e.data.left + ' Life left.'; },
    'don.added': function (e) { return who(e.data.seat) + ' added ' + e.data.n + ' DON!!' + (e.data.rested ? ' (rested)' : '') + '.'; },
    'ability.activated': function (e) { return nm(e.data.id) + ' activated its effect.'; },
    'power.mod': function (e) { return unm(e.data.uid) + ' ' + (e.data.n >= 0 ? '+' : '−') + Math.abs(e.data.n) + ' power.'; },
    'unit.rested': function (e) { return unm(e.data.uid) + ' was rested.'; },
    'unit.active': function (e) { return unm(e.data.uid) + ' was set active.'; },
    'leader.lethal': function (e) { return who(e.data.seat) + ' has no Life left.'; },
    'game.over': function (e) { return e.data.winner === you ? 'You win.' : 'You lose.'; }
  };
  function who(seat) { return seat === you ? 'You' : 'The opponent'; }
  function nm(id) { try { return NS.names.cardName(S.card(id)); } catch (e) { return id; } }
  function unm(uid) { var u = S.findUnit(state, uid); return u ? nm(u.id) : 'a card'; }

  function renderLog() {
    if (!logEl) return;
    logEl.textContent = '';
    var start = Math.max(0, state.log.length - 220);
    for (var i = start; i < state.log.length; i++) {
      var e = state.log[i];
      var f = LOGLINE[e.tag];
      if (!f) continue;
      var line;
      try { line = f(e); } catch (err) { continue; }
      var d = el('div', 'entry ' + (e.seat === you ? 'you' : 'them'), line);
      if (/^─|win|lose|K\.O|Life left/.test(line)) d.classList.add('big');
      logEl.appendChild(d);
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  // ---------------------------------------------------------------------------------------
  // Affordances. Everything below reads legalActions and nothing else.
  // ---------------------------------------------------------------------------------------

  // Some actions are clicked ON a card; the rest need a button. This decides which is which by
  // asking the ACTION rather than from a hand-written list of buttons, so a legal action can
  // never again exist in the rules with nowhere to click.
  //
  // End Turn had no control at all. legalActions offered it from the first commit, the AI used
  // it every turn, 25 tests exercised it — and no human could press it, because every one of
  // those paths goes through apply() and none of them goes through the screen. This is
  // CLAUDE.md hard rule 15 in one bug: green tests plus a page you cannot play.
  var CARD_BOUND = { play: 1, event: 1, attack: 1, giveDon: 1, activate: 1, choose: 1 };

  var ACTION_LABEL = {
    endTurn: 'End turn',
    noBlock: 'Do not block',
    noCounter: 'Done countering',
    keepHand: 'Keep this hand',
    redraw: 'Redraw'
  };

  function renderActionBar(acts) {
    var bar = document.getElementById('actions');
    if (!bar) return;
    bar.textContent = '';
    acts.filter(function (a) { return !CARD_BOUND[a.t]; }).forEach(function (a) {
      var b = el('button', a.t === 'endTurn' ? 'primary' : null,
                 ACTION_LABEL[a.t] || a.label || a.t);
      if (a.t === 'endTurn') b.title = 'End your turn  (E, or Space)';
      b.onclick = function () { commit(a); };
      bar.appendChild(b);
    });
  }

  function clearActionBar() {
    var bar = document.getElementById('actions');
    if (bar) bar.textContent = '';
  }

  function myActions() {
    if (state.winner !== null) return [];
    if (E.whoActs(state) !== you) return [];
    try { return E.legalActions(state); } catch (e) { return []; }
  }

  // CR 3-5-2 — both trash piles are open information, available whatever else is going on.
  // Closing the viewer re-renders, which re-opens any prompt that was waiting underneath.
  function wireTrash() {
    [].forEach.call(root.querySelectorAll('.trash-view'), function (b) {
      b.onclick = function () { viewTrash(+b.dataset.seat); };
    });
  }

  function viewTrash(seat) {
    var p = state.players[seat];
    var box = el('div', 'modal-box');
    box.appendChild(el('div', 'modal-title', (seat === you ? 'Your' : 'The opponent’s') + ' trash — ' +
                       p.trash.length + ' card' + (p.trash.length === 1 ? '' : 's')));
    box.appendChild(el('div', 'modal-sub', p.trash.length
      ? 'Newest first. The trash is face-up: either player may look at it at any time.'
      : 'Nothing has been trashed yet.'));
    var o = el('div', 'modal-opts trash-grid');
    p.trash.slice().reverse().forEach(function (id) {
      var wrap = el('div', 'opt-card');
      var n = NS.render.render(S.card(id), 'board', {});
      hover(n);
      wrap.appendChild(n);
      o.appendChild(wrap);
    });
    box.appendChild(o);
    var close = el('button', 'primary', 'Close');
    close.onclick = function () { closeModal(); render(); };
    var row = el('div', 'row'); row.appendChild(close); box.appendChild(row);
    openModal(box);
  }

  function wire() {
    var acts = myActions();
    var head = state.queue[0];

    clearActionBar();
    if (head) { promptEl.textContent = headPrompt(head, acts); if (E.whoActs(state) === you) showModal(head, acts); return; }
    if (E.whoActs(state) !== you) { promptEl.textContent = 'The opponent is taking their turn…'; return; }

    closeModal();
    if (pendingAttacker) return wireAttack(acts);

    promptEl.textContent = 'Your Main Phase — play a card, give DON!!, attack, or end the turn.';
    renderActionBar(acts);

    // Hand: a card you can pay for is actable; any card can be inspected.
    var handCards = root.querySelectorAll('#hand .card[data-card-id]');
    [].forEach.call(handCards, function (n, ix) {
      var a = acts.filter(function (x) { return (x.t === 'play' || x.t === 'event') && x.ix === ix; })[0];
      hover(n);
      if (a) { n.classList.add('actable'); n.onclick = function () { commit(a); }; }
      else { n.onclick = function () { inspect(n.dataset.cardId); }; }
    });

    // Your Leader, Characters and Stage: a click opens the menu of what that card may do.
    [].forEach.call(root.querySelectorAll('.side.mine .card[data-uid]'), function (n) {
      var uid = n.dataset.uid;
      var mine = acts.filter(function (x) { return x.uid === uid; });
      hover(n);
      if (mine.length) { n.classList.add('actable'); n.onclick = function () { unitMenu(uid, mine); }; }
      else n.onclick = function () { inspect(n.dataset.cardId); };
    });
    [].forEach.call(root.querySelectorAll('.side.enemy .card[data-uid]'), function (n) {
      hover(n); n.onclick = function () { inspect(n.dataset.cardId); };
    });
  }

  function wireAttack(acts) {
    var opts = acts.filter(function (a) { return a.t === 'attack' && a.uid === pendingAttacker; });
    var src = root.querySelector('.card[data-uid="' + pendingAttacker + '"]');
    if (src) src.classList.add('is-source');
    promptEl.textContent = 'Choose what ' + unm(pendingAttacker) + ' attacks — the opponent’s ' +
      NS.names.term('leader') + ', or a rested ' + NS.names.term('character') + '. Esc to cancel.';
    opts.forEach(function (a) {
      var n = root.querySelector('.card[data-uid="' + a.target + '"]');
      if (!n) return;
      n.classList.add('targetable');
      n.onclick = function () { pendingAttacker = null; commit(a); };
    });
  }

  function unitMenu(uid, acts) {
    var attacks = acts.filter(function (a) { return a.t === 'attack'; });
    var others = acts.filter(function (a) { return a.t !== 'attack'; });
    var box = el('div', 'modal-box');
    box.appendChild(el('div', 'modal-title', unm(uid)));
    var sub = el('div', 'modal-sub', 'What should it do?');
    box.appendChild(sub);
    var opts = el('div', 'modal-opts');
    if (attacks.length) {
      var b = el('button', 'primary', 'Attack…');
      b.onclick = function () { closeModal(); pendingAttacker = uid; render(); };
      opts.appendChild(b);
    }
    others.forEach(function (a) {
      var label = a.t === 'giveDon' ? 'Give 1 DON!!'
        : a.t === 'activate' ? 'Activate its effect' : a.t;
      var bb = el('button', null, label);
      bb.onclick = function () { closeModal(); commit(a); };
      opts.appendChild(bb);
    });
    var insp = el('button', null, 'Look at it');
    var u = S.findUnit(state, uid);
    insp.onclick = function () { closeModal(); inspect(u.id); };
    opts.appendChild(insp);
    var cancel = el('button', null, 'Cancel');
    cancel.onclick = closeModal;
    opts.appendChild(cancel);
    box.appendChild(opts);
    openModal(box);
  }

  // ---------------------------------------------------------------------------------------
  // The reactive window. PLAN.md D4 — name the decision, show the maths, say what declining does.
  // ---------------------------------------------------------------------------------------
  function battleMaths() {
    if (!state.battle) return null;
    var a = S.findUnit(state, state.battle.attacker);
    var d = S.findUnit(state, state.battle.target);
    if (!a || !d) return null;
    return { a: a, d: d, ap: S.power(state, a), dp: S.power(state, d),
             wins: S.power(state, a) >= S.power(state, d) };
  }

  function headPrompt(head, acts) {
    var m = battleMaths();
    switch (head.k) {
      case 'mulligan':
        return head.ctrl === you ? 'Keep this opening hand, or redraw once?'
                                 : 'The opponent is deciding on their opening hand…';
      case 'block':
        if (head.ctrl !== you) return 'The opponent may block…';
        return 'Block Step — ' + nm(m.a.id) + ' (' + m.ap + ') is attacking ' + nm(m.d.id) + ' (' + m.dp + ').';
      case 'counter':
        if (head.ctrl !== you) return 'The opponent may play Counters…';
        return 'Counter Step — you need ' + Math.max(0, m.ap - m.dp + 1) + ' more power to survive.';
      case 'trigger':
        return head.ctrl === you ? 'You took damage — that Life card has a Trigger.'
                                 : 'The opponent is resolving a Trigger…';
      case 'choice':
        return head.ctrl === you ? (head.q.prompt || 'Make a choice.')
                                 : 'The opponent is choosing…';
      default: return '';
    }
  }

  function showModal(head, acts) {
    var box = el('div', 'modal-box');
    var m = battleMaths();

    if (head.k === 'mulligan') {
      box.appendChild(el('div', 'modal-title', 'Opening hand'));
      box.appendChild(el('div', 'modal-sub',
        'You may return this hand to the deck and draw five new cards. You get one redraw only, and only now.'));
      var hand = el('div', 'modal-opts');
      state.players[you].hand.forEach(function (id) {
        hand.appendChild(NS.render.render(S.card(id), 'hand', {}));
      });
      box.appendChild(hand);
      box.appendChild(buttons([
        ['Keep this hand', 'primary', { t: 'keepHand' }],
        ['Redraw', null, { t: 'redraw' }]
      ]));
      return openModal(box);
    }

    if (head.k === 'block') {
      box.appendChild(el('div', 'modal-title', 'Block?'));
      var sub = el('div', 'modal-sub');
      sub.innerHTML = nm(m.a.id) + ' is attacking ' + nm(m.d.id) +
        ' — <span class="maths">' + m.ap + ' vs ' + m.dp + '</span>. ' +
        (m.wins
          ? (S.isLeader(state, m.d)
              ? '<b>If you do not block you will take 1 damage.</b>'
              : '<b>If you do not block, ' + nm(m.d.id) + ' is K.O.’d.</b>')
          : 'The attack would fail as it stands.') +
        ' A blocker rests and becomes the new target of this attack.';
      box.appendChild(sub);
      var opts = el('div', 'modal-opts');
      acts.filter(function (a) { return a.t === 'block'; }).forEach(function (a) {
        var u = S.findUnit(state, a.uid);
        var wrap = el('div', 'opt-card');
        wrap.appendChild(NS.render.render(S.card(u.id), 'board', {}));
        wrap.appendChild(el('div', 'cap', 'Power ' + a.power +
          (a.power > m.ap ? ' — survives' : ' — would be K.O.’d')));
        wrap.onclick = function () { commit(a); };
        opts.appendChild(wrap);
      });
      box.appendChild(opts);
      box.appendChild(buttons([['Do not block', null, { t: 'noBlock' }]]));
      return openModal(box);
    }

    if (head.k === 'counter') {
      var need = Math.max(0, m.ap - m.dp + 1);
      box.appendChild(el('div', 'modal-title', 'Counter?'));
      var s2 = el('div', 'modal-sub');
      s2.innerHTML = nm(m.a.id) + ' at <span class="maths">' + m.ap + '</span> against ' +
        nm(m.d.id) + ' at <span class="maths">' + m.dp + '</span>. You need ' +
        '<span class="maths">+' + need + '</span> to survive. ' +
        (S.isLeader(state, m.d)
          ? '<b>If you stop here you take 1 damage.</b>'
          : '<b>If you stop here ' + nm(m.d.id) + ' is K.O.’d.</b>') +
        ' You may play as many Counters as you like.';
      box.appendChild(s2);
      var o2 = el('div', 'modal-opts');
      acts.filter(function (a) { return a.t === 'counter'; }).forEach(function (a) {
        var wrap = el('div', 'opt-card');
        wrap.appendChild(NS.render.render(S.card(a.id), 'board', {}));
        wrap.appendChild(el('div', 'cap', a.kind === 'counterCard'
          ? '+' + a.n + ' power' : 'Event · cost ' + a.cost));
        wrap.onclick = function () { commit(a); };
        o2.appendChild(wrap);
      });
      box.appendChild(o2);
      box.appendChild(buttons([['Stop countering', null, { t: 'noCounter' }]]));
      return openModal(box);
    }

    if (head.k === 'trigger') {
      var c = S.card(head.cardId);
      box.appendChild(el('div', 'modal-title', 'Trigger'));
      box.appendChild(el('div', 'modal-sub',
        'You took damage and the Life card you turned over has a Trigger. Use it and the card is ' +
        'trashed afterwards; decline and it goes to your hand instead.'));
      var o3 = el('div', 'modal-opts');
      o3.appendChild(NS.render.render(c, 'preview', {}));
      box.appendChild(o3);
      box.appendChild(buttons([
        ['Use the Trigger', 'primary', { t: 'useTrigger', cardId: head.cardId }],
        ['Add it to my hand', null, { t: 'takeLife', cardId: head.cardId }]
      ]));
      return openModal(box);
    }

    if (head.k === 'choice') {
      box.appendChild(el('div', 'modal-title', head.q.prompt || 'Choose'));
      box.appendChild(el('div', 'modal-sub',
        head.q.kind === 'confirm' ? 'The card says "you may" — paying is your choice. Decline and its effect does not happen.'
          : head.q.min === 0 ? 'You may choose none.' : 'You must choose.'));
      // Whose effect is asking. A yes/no about a cost means nothing without the card.
      var srcId = head.q.cardId || (head.q.source && S.findUnit(state, head.q.source) && S.findUnit(state, head.q.source).id);
      if (head.q.kind === 'confirm' && srcId) {
        var so = el('div', 'modal-opts');
        so.appendChild(NS.render.render(S.card(srcId), 'preview', {}));
        box.appendChild(so);
      }
      // CR 8-4-4-4 — a "look at N" shows the player every card's face, not only the takeable ones.
      if (head.q.seen && head.q.seen.length) {
        var takeable = {};
        acts.forEach(function (a) { if (a.cardId) takeable[a.cardId] = true; });
        box.appendChild(el('div', 'modal-sub', 'You looked at these ' + head.q.seen.length +
          ' cards from the top of your deck. Dimmed cards do not qualify; the rest go to the bottom.'));
        var sn = el('div', 'modal-opts seen-row');
        head.q.seen.forEach(function (id) {
          var w = el('div', 'opt-card' + (takeable[id] ? '' : ' dim'));
          var n = NS.render.render(S.card(id), 'board', {});
          hover(n);
          w.appendChild(n);
          sn.appendChild(w);
        });
        box.appendChild(sn);
        box.appendChild(el('div', 'modal-sub', 'Choose the card to add to your hand:'));
      }
      var o4 = el('div', 'modal-opts');
      acts.filter(function (a) { return a.t === 'choose' && a.v !== '__done'; }).forEach(function (a) {
        var wrap = el('div', 'opt-card');
        var cid = a.cardId || (a.uid && S.findUnit(state, a.uid) && S.findUnit(state, a.uid).id);
        if (cid) wrap.appendChild(NS.render.render(S.card(cid), 'board', {}));
        else wrap.appendChild(el('div', 'cap', a.label));
        wrap.appendChild(el('div', 'cap', a.label));
        wrap.onclick = function () { commit(a); };
        o4.appendChild(wrap);
      });
      box.appendChild(o4);
      var done = acts.filter(function (a) { return a.t === 'choose' && a.v === '__done'; })[0];
      if (done) box.appendChild(buttons([['Done', null, done]]));
      return openModal(box);
    }
  }

  function buttons(list) {
    var row = el('div', 'row');
    list.forEach(function (x) {
      var b = el('button', x[1] || null, x[0]);
      b.onclick = function () { commit(x[2]); };
      row.appendChild(b);
    });
    return row;
  }

  function openModal(box) {
    hidePreview();
    modalEl.textContent = ''; modalEl.appendChild(box); modalEl.classList.add('open');
  }
  function closeModal() { modalEl.classList.remove('open'); modalEl.textContent = ''; }

  // ---------------------------------------------------------------------------------------
  function commit(action) {
    if (busy) return;
    closeModal();
    pendingAttacker = null;
    busy = true;
    var next;
    try { next = E.apply(state, action); }
    catch (err) { busy = false; NS.bugreport.record(state, action, err); throw err; }
    NS.bugreport.push(action);
    busy = false;
    setState(next);
  }

  // Hand the turn to the AI when it is the AI's input that is needed.
  function step() {
    if (state.winner !== null) return;
    if (E.whoActs(state) === you) return;
    setTimeout(function () {
      if (state.winner !== null || E.whoActs(state) === you) return;
      var a;
      try { a = NS.ai.choose(state); }
      catch (err) { NS.bugreport.record(state, null, err); throw err; }
      var next;
      try { next = E.apply(state, a); }
      catch (err) { NS.bugreport.record(state, a, err); throw err; }
      NS.bugreport.push(a);
      setState(next);
    }, AI_DELAY);
  }

  // ---------------------------------------------------------------------------------------
  function hover(node) {
    node.onmouseenter = function () { showPreview(node); };
    node.onmouseleave = hidePreview;
  }
  function showPreview(node) {
    var id = node.dataset.cardId;
    if (!id) return;
    previewEl.textContent = '';
    previewEl.appendChild(NS.render.render(S.card(id), 'preview', {}));
    previewEl.classList.add('open');
    var r = node.getBoundingClientRect();
    var w = previewEl.offsetWidth, h = previewEl.offsetHeight;
    var x = Math.min(window.innerWidth - w - 12, Math.max(12, r.right + 12));
    if (r.right + w + 24 > window.innerWidth) x = Math.max(12, r.left - w - 12);
    previewEl.style.left = x + 'px';
    previewEl.style.top = Math.min(window.innerHeight - h - 12, Math.max(12, r.top - 40)) + 'px';
  }
  function hidePreview() { previewEl.classList.remove('open'); }

  function inspect(cardId) {
    var box = el('div', 'modal-box');
    box.appendChild(NS.render.render(S.card(cardId), 'preview', {}));
    var b = el('button', null, 'Close');
    b.onclick = closeModal;
    box.appendChild(b);
    openModal(box);
  }

  function showResult() {
    var box = el('div', 'modal-box');
    box.appendChild(el('div', 'modal-title', state.winner === you ? 'You win.' : 'You lose.'));
    box.appendChild(el('div', 'modal-sub',
      'Turn ' + state.turn + '. Seed ' + state.seed + ' — the same seed replays the same game.'));
    var row = el('div', 'row');
    var again = el('button', 'primary', 'Play again');
    again.onclick = function () { NS.screens.show('menu'); closeModal(); };
    row.appendChild(again);
    box.appendChild(row);
    openModal(box);
  }

  function cancel() { if (pendingAttacker) { pendingAttacker = null; render(); } else closeModal(); }

  // E, or Space. js/main.js binds them; this is the only thing that decides whether ending is
  // legal right now, so the shortcut cannot end a turn the rules would not.
  function endTurn() {
    var end = myActions().filter(function (a) { return a.t === 'endTurn'; })[0];
    if (end) commit(end);
  }

  NS.ui = { init: init, setState: setState, render: render, cancel: cancel, endTurn: endTurn,
            get state() { return state; }, get you() { return you; } };
}(window.OP = window.OP || {}));
