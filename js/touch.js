// js/touch.js — the touch model (PLAN.md D10), after the way a phone card game plays: a TAP
// reads (the card full height, its legal actions as buttons), a DRAG commits (a hand card onto
// your Character area, a Leader or Character onto the rival it attacks, a DON!! onto the card it
// powers up), a HOLD peeks (the card for as long as the finger stays down). On a phone the hand
// rests as a fan of card tops along the bottom edge; a tap raises it. Recent plays run down the
// left edge. Nothing here decides a rule: every drop target is a legal action js/ui.js handed in.
(function (NS) {
  'use strict';

  var DRAG_PX = 8, HOLD_MS = 450, HOLD_SLOP = 10, CLICK_GRACE = 350, HISTORY_MAX = 7;
  var coarse = window.matchMedia('(pointer: coarse)');
  var lastTouch = coarse.matches;
  document.addEventListener('pointerdown', function (e) { lastTouch = e.pointerType !== 'mouse'; }, true);

  function $(id) { return document.getElementById(id); }
  function el(t, c, x) { return NS.render.el(t, c, x); }

  // ---- phone / portrait classes -------------------------------------------------------------
  function classify() {
    var h = document.documentElement, W = window.innerWidth, H = window.innerHeight;
    var phone = coarse.matches && Math.min(W, H) <= 540;
    h.classList.toggle('is-coarse', coarse.matches);
    h.classList.toggle('is-phone', phone);
    h.classList.toggle('is-portrait', H > W);
    if (!phone) lowerHand();
  }

  // ---- the resting hand and the raised hand ---------------------------------------------------
  var raisedAt = 0;
  function handRaised() { return document.body.classList.contains('hand-raised'); }
  function raiseHand() { raisedAt = Date.now(); document.body.classList.add('hand-raised'); }
  function lowerHand() { document.body.classList.remove('hand-raised'); }

  // ---- the follow-up click ---------------------------------------------------------------------
  // A finger's tap is followed by a click hit-tested where the finger WAS — on the sheet or scrim
  // the tap just opened, which would close it at once. After a touch tap or a drag, swallow it.
  function swallowClick() {
    function swallow(e) { e.stopPropagation(); e.preventDefault(); document.removeEventListener('click', swallow, true); }
    document.addEventListener('click', swallow, true);
    setTimeout(function () { document.removeEventListener('click', swallow, true); }, CLICK_GRACE);
  }

  // ---- the arrow -------------------------------------------------------------------------------
  var SVGNS = 'http://www.w3.org/2000/svg';
  function arrowLayer() {
    var svg = $('drag-arrow');
    if (!svg) throw new Error('touch: index.html is missing #drag-arrow');
    return svg;
  }
  function centre(n) { var r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function drawArrow(from, to, hot) {
    var svg = arrowLayer();
    svg.textContent = '';
    var bow = Math.min(120, Math.abs(to.y - from.y) * 0.4) + 20;
    var mx = (from.x + to.x) / 2, my = Math.min(from.y, to.y) - bow * 0.35;
    var p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', 'M' + from.x + ',' + from.y + ' Q' + mx + ',' + my + ' ' + to.x + ',' + to.y);
    p.setAttribute('class', 'drag-arrow-line' + (hot ? ' is-hot' : ''));
    var head = document.createElementNS(SVGNS, 'circle');
    head.setAttribute('cx', to.x); head.setAttribute('cy', to.y); head.setAttribute('r', hot ? 13 : 9);
    head.setAttribute('class', 'drag-arrow-head' + (hot ? ' is-hot' : ''));
    svg.appendChild(p); svg.appendChild(head);
  }
  function clearArrow() { var svg = $('drag-arrow'); if (svg) svg.textContent = ''; }

  // ---- the drag --------------------------------------------------------------------------------
  // spec: { kind: 'hand' | 'unit' | 'don', targets: [{ el: function () -> node, act }],
  //         onDrop: function (act), onTap: function (wasTouch) }
  var live = null, lastDragEnd = 0;
  function press(node, spec) {
    node.classList.toggle('is-draggable', spec.targets.length > 0);
    node.onpointerdown = function (e) {
      if (e.button !== 0) return;
      begin(node, e, spec);
    };
  }
  function begin(node, e, spec) {
    if (live) finish(false);
    live = { node: node, spec: spec, x: e.clientX, y: e.clientY, moved: false, touch: e.pointerType !== 'mouse' };
    try { node.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerup', onUp);
    node.addEventListener('pointercancel', onCancel);
  }
  function onMove(e) {
    if (!live) return;
    var dx = e.clientX - live.x, dy = e.clientY - live.y;
    if (!live.moved) {
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_PX) return;
      live.moved = true;
      NS.render.hideZoom();
      if (!live.spec.targets.length) return;          // nothing to drop on: the gesture is a no-op
      live.spec.targets.forEach(function (t) { var n = t.el(); if (n) n.classList.add('drop-ok'); });
      if (live.spec.kind === 'hand') {
        lowerHand();                                  // the drop targets are under a raised hand
        var c = live.node.cloneNode(true);
        c.classList.add('drag-clone');
        c.style.width = live.node.offsetWidth + 'px';
        document.body.appendChild(c);
        live.clone = c;
        live.node.classList.add('is-drag-source');
      } else live.arrow = true;
    }
    if (!live.spec.targets.length) return;
    if (live.clone) {
      live.clone.style.left = (e.clientX - live.clone.offsetWidth / 2) + 'px';
      live.clone.style.top = (e.clientY - live.clone.offsetHeight * 0.85) + 'px';
    }
    var hot = findDrop(e.clientX, e.clientY);
    document.querySelectorAll('.drop-hot').forEach(function (n) { n.classList.remove('drop-hot'); });
    if (hot) { var hn = hot.el(); if (hn) hn.classList.add('drop-hot'); }
    if (live.arrow) drawArrow(centre(live.node), { x: e.clientX, y: e.clientY }, !!hot);
  }
  function onUp(e) {
    if (!live) return;
    var L = live;
    if (L.moved) {
      var drop = L.spec.targets.length ? findDrop(e.clientX, e.clientY) : null;
      lastDragEnd = Date.now();
      swallowClick();
      finish(false);
      if (drop) L.spec.onDrop(drop.act);
      return;
    }
    finish(true);
  }
  function onCancel() { finish(false); }
  function finish(wasTap) {
    if (!live) return;
    var L = live;
    live = null;
    L.node.removeEventListener('pointermove', onMove);
    L.node.removeEventListener('pointerup', onUp);
    L.node.removeEventListener('pointercancel', onCancel);
    L.node.classList.remove('is-drag-source');
    if (L.clone) L.clone.remove();
    clearArrow();
    document.querySelectorAll('.drop-ok, .drop-hot').forEach(function (n) { n.classList.remove('drop-ok', 'drop-hot'); });
    if (wasTap && L.spec.onTap) {
      if (L.touch) swallowClick();
      L.spec.onTap(L.touch);
    }
  }
  function findDrop(x, y) {
    var under = document.elementFromPoint(x, y);
    if (!under || !live) return null;
    var best = null, bestDepth = -1;
    live.spec.targets.forEach(function (t) {
      var n = t.el();
      if (!n || !(n === under || n.contains(under))) return;
      var depth = 0, p = n; while (p) { depth++; p = p.parentElement; }
      if (depth > bestDepth) { best = t; bestDepth = depth; }
    });
    return best;
  }

  // ---- hold to peek ----------------------------------------------------------------------------
  // Touch and pen only; distance beats time, so a drag that starts before the hold lands stays a
  // drag. Once the peek is up it stays until the finger lifts, and the lift answers nothing.
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') return;
    var t = e.target && e.target.closest ? e.target.closest('.card[data-card-id]') : null;
    if (!t || t.closest('#peek')) return;
    var sx = e.clientX, sy = e.clientY, peeking = false;
    var timer = setTimeout(function () {
      finish(false);
      swallowClick();
      peeking = true;
      peek(t.dataset.cardId);
    }, HOLD_MS);
    function moved(ev) {
      if (peeking) return;
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.sqrt(dx * dx + dy * dy) > HOLD_SLOP) end();
    }
    function end() {
      clearTimeout(timer);
      document.removeEventListener('pointermove', moved, true);
      document.removeEventListener('pointerup', end, true);
      document.removeEventListener('pointercancel', end, true);
      if (peeking) unpeek();
    }
    document.addEventListener('pointermove', moved, true);
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);
  }, true);
  document.addEventListener('contextmenu', function (e) {
    if (e.target && e.target.closest && e.target.closest('.card') && lastTouch) e.preventDefault();
  });
  function peek(cardId) {
    var box = $('peek');
    if (!box) throw new Error('touch: index.html is missing #peek');
    box.textContent = '';
    box.appendChild(NS.render.render(NS.state.card(cardId), 'preview', {}));
    box.classList.add('open');
  }
  function unpeek() { var box = $('peek'); if (box) box.classList.remove('open'); }

  // ---- recent plays down the left edge ---------------------------------------------------------
  var PLAYED = { 'card.played': 1, 'event.played': 1, 'stage.played': 1, 'counterEvent.played': 1 };
  function renderHistory(s, you, inspect) {
    var node = $('history');
    if (!node) return;
    node.textContent = '';
    var n = 0;
    for (var i = s.log.length - 1; i >= 0 && n < HISTORY_MAX; i--) {
      var e = s.log[i];
      if (!PLAYED[e.tag] || !e.data || !e.data.id) continue;
      n++;
      (function (id, seat) {
        var w = el('div', 'history-card ' + (seat === you ? 'mine' : 'theirs'));
        w.appendChild(NS.render.render(NS.state.card(id), 'board', {}));
        w.onclick = function () { inspect(id); };
        node.appendChild(w);
      }(e.data.id, e.data.seat));
    }
  }

  function init() {
    classify();
    window.addEventListener('resize', classify);
    window.addEventListener('orientationchange', classify);
    var scrim = $('hand-scrim');
    if (!scrim) throw new Error('touch: index.html is missing #hand-scrim');
    scrim.addEventListener('click', function () { if (Date.now() - raisedAt > CLICK_GRACE) lowerHand(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  NS.touch = {
    active: function () { return lastTouch; },
    phone: function () { return document.documentElement.classList.contains('is-phone'); },
    handRaised: handRaised, raiseHand: raiseHand, lowerHand: lowerHand,
    press: press, justDragged: function () { return Date.now() - lastDragEnd < CLICK_GRACE; },
    renderHistory: renderHistory
  };
}(window.OP = window.OP || {}));
