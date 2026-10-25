// js/fx.js — the effects layer. View only: it never reads legalActions and never changes a
// state. js/ui.js calls before() just ahead of each board redraw and after() once the new board
// is on screen; after() looks at the log entries that arrived since the last frame and plays a
// short effect for each — a turn ribbon, the opponent's played card in the spotlight, an attack
// arrow, hit and K.O. bursts, floating power numbers.
//
// Two rules from CARD-PRESENTATION-SPEC.md §7C and §14: start states are flushed with a forced
// layout read, never requestAnimationFrame (which does not fire in a background tab), and every
// transient node is removed by a timer rather than by animationend, so nothing can strand when
// animations are off (prefers-reduced-motion).
(function (NS) {
  'use strict';

  var prevRects = {}, hadUnits = false;
  var seen = { seed: null, n: 0 };
  var spotTimer = null, bannerTimer = null;

  function el(t, c, x) { return NS.render.el(t, c, x); }
  function layer() {
    var l = document.getElementById('fx-layer');
    if (!l) throw new Error('fx: #fx-layer is missing from index.html');
    return l;
  }
  function nodeFor(uid) { return document.querySelector('#mat .card[data-uid="' + uid + '"]'); }
  function later(ms, fn) { return setTimeout(fn, ms); }
  function centre(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  // ---- primitives --------------------------------------------------------------------------
  function floatText(rect, text, cls, k) {
    if (!rect) return;
    var c = centre(rect);
    var f = el('div', 'fx-float ' + (cls || ''), text);
    f.style.left = c.x + 'px';
    f.style.top = (c.y - (k || 0) * 26) + 'px';
    layer().appendChild(f);
    later(1300, function () { f.remove(); });
  }

  function burst(rect, cls) {
    if (!rect) return;
    var c = centre(rect);
    var b = el('div', 'fx-burst ' + (cls || ''));
    b.style.left = c.x + 'px'; b.style.top = c.y + 'px';
    b.style.setProperty('--size', Math.max(rect.width, rect.height) * 1.25 + 'px');
    for (var i = 0; i < 10; i++) {
      var s = el('span', 'fx-shard');
      s.style.setProperty('--a', (i * 36 + (i % 2) * 14) + 'deg');
      b.appendChild(s);
    }
    layer().appendChild(b);
    later(900, function () { b.remove(); });
  }

  function pulse(node, cls, ms) {
    if (!node) return;
    node.classList.add(cls);
    later(ms || 700, function () { node.classList.remove(cls); });
  }

  // The attack, drawn as one picture from attacker to target (CARD-LOG-AND-TARGETING-SPEC §14).
  function arrow(fromNode, toNode, theirs) {
    if (!fromNode || !toNode) return;
    var a = centre(fromNode.getBoundingClientRect()), b = centre(toNode.getBoundingClientRect());
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'fx-arrow' + (theirs ? ' is-theirs' : ''));
    svg.setAttribute('width', window.innerWidth); svg.setAttribute('height', window.innerHeight);
    var mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.18, my = (a.y + b.y) / 2 - (b.x - a.x) * 0.18;
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M' + a.x + ',' + a.y + ' Q' + mx + ',' + my + ' ' + b.x + ',' + b.y);
    path.setAttribute('class', 'fx-arrow-path');
    svg.appendChild(path);
    var ang = Math.atan2(b.y - my, b.x - mx), L = 22;
    var head = document.createElementNS(ns, 'path');
    head.setAttribute('d', 'M' + b.x + ',' + b.y +
      ' L' + (b.x - L * Math.cos(ang - 0.45)) + ',' + (b.y - L * Math.sin(ang - 0.45)) +
      ' L' + (b.x - L * Math.cos(ang + 0.45)) + ',' + (b.y - L * Math.sin(ang + 0.45)) + ' Z');
    head.setAttribute('class', 'fx-arrow-head');
    svg.appendChild(head);
    layer().appendChild(svg);
    later(1100, function () { svg.remove(); });
  }

  function banner(main, sub, mine) {
    var b = document.getElementById('turn-banner');
    if (!b) throw new Error('fx: #turn-banner is missing from index.html');
    clearTimeout(bannerTimer);
    b.className = '';
    b.textContent = '';
    var rib = el('div', 'banner-ribbon ' + (mine ? 'is-mine' : 'is-theirs'));
    rib.appendChild(el('div', 'banner-main', main));
    rib.appendChild(el('div', 'banner-sub', sub));
    b.appendChild(rib);
    void b.offsetWidth;                         // flush the start state (spec §7C)
    b.className = 'show';
    bannerTimer = later(1500, function () { b.className = ''; });
  }

  // CARD-PRESENTATION-SPEC §7C — the card the opponent just played, at full size in the centre.
  // Pointer-transparent, below the hover preview, and a second play replaces the first.
  function spotlight(cardId) {
    var box = document.getElementById('spotlight');
    if (!box) throw new Error('fx: #spotlight is missing from index.html');
    clearTimeout(spotTimer);
    box.className = '';
    box.textContent = '';
    box.appendChild(NS.render.render(NS.state.card(cardId), 'preview', {}));
    void box.getBoundingClientRect();           // flush the start state, not rAF (spec §14)
    box.className = 'show';
    spotTimer = later(1500, function () {
      box.className = 'fade';
      spotTimer = later(260, function () { box.className = ''; box.textContent = ''; });
    });
  }

  // ---- the frame hooks -------------------------------------------------------------------
  function before() {
    prevRects = {};
    hadUnits = false;
    [].forEach.call(document.querySelectorAll('#mat .card[data-uid]'), function (n) {
      prevRects[n.dataset.uid] = n.getBoundingClientRect();
      hadUnits = true;
    });
  }

  function after(s, you) {
    // A new game (new seed, or a log shorter than the one we last saw) starts a fresh baseline.
    if (seen.seed !== s.seed || s.log.length < seen.n) { seen.seed = s.seed; seen.n = s.log.length; return; }
    var fresh = s.log.slice(seen.n);
    seen.n = s.log.length;
    if (!fresh.length) return;

    if (hadUnits) {
      [].forEach.call(document.querySelectorAll('#mat .card[data-uid]'), function (n) {
        if (!prevRects[n.dataset.uid]) pulse(n, 'fx-enter', 600);
      });
    }

    var floats = {};                            // stack several numbers on one card
    function stackOn(uid) { floats[uid] = (floats[uid] || 0) + 1; return floats[uid] - 1; }
    function rectOf(uid) { var n = nodeFor(uid); return n ? n.getBoundingClientRect() : prevRects[uid]; }
    function leaderOf(seat) { return nodeFor(s.players[seat].leader.uid); }
    function lifeZoneOf(seat) { return document.getElementById(seat === you ? 'my-life' : 'enemy-life'); }

    fresh.forEach(function (e) {
      var d = e.data, seat = d.seat !== undefined ? d.seat : e.seat;
      switch (e.tag) {
        case 'phase.main':
          banner(seat === you ? 'Your turn' : 'Opponent’s turn', 'Turn ' + d.turn, seat === you);
          break;
        case 'card.played': case 'event.played': case 'stage.played':
          if (seat !== you) spotlight(d.id);
          break;
        case 'battle.declared':
          arrow(nodeFor(d.attacker), nodeFor(d.target), seat !== you);
          pulse(nodeFor(d.attacker), 'fx-attacker', 650);
          pulse(nodeFor(d.target), 'fx-target', 900);
          break;
        case 'battle.blocked':
          pulse(nodeFor(d.blocker), 'fx-block', 800);
          floatText(rectOf(d.blocker), 'Block!', 'is-block', stackOn(d.blocker));
          break;
        case 'counter.played':
          floatText(rectOf(d.onto), '+' + d.n, 'is-counter', stackOn(d.onto));
          break;
        case 'power.mod':
          floatText(rectOf(d.uid), (d.n >= 0 ? '+' : '−') + Math.abs(d.n), d.n >= 0 ? 'is-up' : 'is-down', stackOn(d.uid));
          break;
        case 'don.given':
          pulse(nodeFor(d.uid), 'fx-don', 600);
          floatText(rectOf(d.uid), NS.names.term('don') + (d.n > 1 ? ' ×' + d.n : ''), 'is-don', stackOn(d.uid));
          break;
        case 'life.taken': case 'life.banished':
          pulse(leaderOf(seat), 'fx-hit', 600);
          pulse(lifeZoneOf(seat), 'fx-life-hit', 700);
          var ln = leaderOf(seat);
          if (ln) burst(ln.getBoundingClientRect(), 'is-hit');
          floatText(ln && ln.getBoundingClientRect(), '−1 ' + NS.names.term('life'), 'is-down', 0);
          break;
        case 'char.ko':
          burst(prevRects[d.uid] || rectOf(d.uid), 'is-ko');
          floatText(prevRects[d.uid] || rectOf(d.uid), 'K.O.!', 'is-ko', 0);
          break;
        case 'trigger.used':
          // A Trigger is revealed by the player taking damage — the one not on turn.
          floatText(lifeZoneOf(1 - e.seat).getBoundingClientRect(),
                    NS.names.keyword('trigger') + '!', 'is-trigger', 0);
          break;
      }
    });
  }

  NS.fx = { before: before, after: after, banner: banner };
}(window.OP = window.OP || {}));
