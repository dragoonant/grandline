// js/boardart.js — the play surface, DRAWN rather than photographed: a ship's deck of planks
// inside a rope-wrapped rim with brass corner plates, and the Grand Line itself running across
// the middle as a band of sea with a compass rose where the halves meet. ONE geometry table in
// a fixed 2048x1180 board space is used twice: to draw every zone and to place every DOM zone
// by percentage, so a painted outline and the hitbox inside it are the same numbers by
// construction.
//
// Per side, the official playmat's areas (CR 3-1-1):
//   Life | Leader | Character Area (5) | Stage | Deck
//   Life | DON!! deck | Cost Area            | Trash
// The opponent's half is yours rotated 180 degrees about the board centre, so each player
// reads their own side in the same order and the halves cannot drift apart.
(function (NS) {
  'use strict';

  var W = 2048, H = 1180;
  var SVGNS = 'http://www.w3.org/2000/svg';

  var MINE = {
    life:    { x: 40,   y: 614, w: 150,  h: 540 },
    leader:  { x: 210,  y: 614, w: 214,  h: 290 },
    chars:   { x: 444,  y: 614, w: 1168, h: 290 },
    stage:   { x: 1632, y: 614, w: 194,  h: 290 },
    deck:    { x: 1846, y: 614, w: 162,  h: 260 },
    trash:   { x: 1846, y: 894, w: 162,  h: 260 },
    dondeck: { x: 210,  y: 924, w: 170,  h: 230 },
    cost:    { x: 400,  y: 924, w: 1426, h: 230 }
  };
  function mirror(r) { return { x: W - r.x - r.w, y: H - r.y - r.h, w: r.w, h: r.h }; }
  var THEIRS = {};
  Object.keys(MINE).forEach(function (k) { THEIRS[k] = mirror(MINE[k]); });

  // The words on the mat are rules terms, read from js/names.js at draw time (CLAUDE.md
  // regime 4) — the mat holds no themed string of its own.
  function labelFor(k) {
    var t = NS.names.term;
    return {
      life: t('life'), leader: t('leader'), chars: t('characterArea'), stage: t('stage'),
      deck: t('deck'), trash: t('trash'), dondeck: t('don') + ' ' + t('deck'), cost: t('costArea')
    }[k];
  }

  function svgEl(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function grad(d, id, kind, attrs, stops) {
    var g = svgEl(kind, Object.assign({ id: id }, attrs));
    stops.forEach(function (st) {
      var o = svgEl('stop', { offset: st[0], 'stop-color': st[1] });
      if (st[2] !== undefined) o.setAttribute('stop-opacity', st[2]);
      g.appendChild(o);
    });
    d.appendChild(g);
  }
  // A seeded generator so the grain is the same every frame and every game.
  function rand(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function defs() {
    var d = svgEl('defs');
    // Deck planks: two boards per tile, staggered butt joints, a few grain lines and nails.
    var p = svgEl('pattern', { id: 'gl-planks', width: 640, height: 116, patternUnits: 'userSpaceOnUse' });
    p.appendChild(svgEl('rect', { width: 640, height: 58, fill: '#5e3d24' }));
    p.appendChild(svgEl('rect', { y: 58, width: 640, height: 58, fill: '#553620' }));
    var r = rand(7);
    for (var i = 0; i < 14; i++) {
      var y = (i < 7 ? 6 : 64) + r() * 46, x0 = r() * 200;
      p.appendChild(svgEl('path', { class: 'gl-grain',
        d: 'M' + x0.toFixed(1) + ',' + y.toFixed(1) + ' q 120,' + (r() * 8 - 4).toFixed(1) + ' 240,0 t 240,0',
        opacity: (0.18 + r() * 0.25).toFixed(2) }));
    }
    p.appendChild(svgEl('rect', { y: 0, width: 640, height: 3, fill: '#2a170b', opacity: 0.85 }));
    p.appendChild(svgEl('rect', { y: 58, width: 640, height: 3, fill: '#2a170b', opacity: 0.85 }));
    [[230, 0], [520, 58]].forEach(function (j) {
      p.appendChild(svgEl('rect', { x: j[0], y: j[1], width: 3, height: 58, fill: '#2a170b', opacity: 0.8 }));
      [[-12, 14], [-12, 44], [15, 14], [15, 44]].forEach(function (n) {
        p.appendChild(svgEl('circle', { cx: j[0] + n[0], cy: j[1] + n[1], r: 3.2, class: 'gl-nail' }));
      });
    });
    d.appendChild(p);

    grad(d, 'gl-vignette', 'radialGradient', { cx: '50%', cy: '50%', r: '72%' },
      [['0%', '#000', 0], ['62%', '#000', 0.12], ['100%', '#000', 0.62]]);
    grad(d, 'gl-rim', 'linearGradient', { x1: '0', y1: '0', x2: '0', y2: '1' },
      [['0%', '#3a2414'], ['50%', '#22140a'], ['100%', '#3a2414']]);
    grad(d, 'gl-brass', 'linearGradient', { x1: '0', y1: '0', x2: '1', y2: '1' },
      [['0%', '#fff1c4'], ['35%', '#e8c46a'], ['70%', '#a87a2c'], ['100%', '#f3d68c']]);
    grad(d, 'gl-sea', 'linearGradient', { x1: '0', y1: '0', x2: '0', y2: '1' },
      [['0%', '#0b2a44'], ['50%', '#1f5f8c'], ['100%', '#0b2a44']]);
    grad(d, 'gl-sea-fade', 'linearGradient', { x1: '0', y1: '0', x2: '1', y2: '0' },
      [['0%', '#000', 0.55], ['12%', '#000', 0], ['88%', '#000', 0], ['100%', '#000', 0.55]]);
    grad(d, 'gl-zone', 'radialGradient', { cx: '50%', cy: '50%', r: '75%' },
      [['0%', '#0c2133', 0.34], ['100%', '#050d16', 0.6]]);
    var f = svgEl('filter', { id: 'gl-glow', x: '-40%', y: '-40%', width: '180%', height: '180%' });
    f.appendChild(svgEl('feGaussianBlur', { stdDeviation: 6, result: 'b' }));
    var m = svgEl('feMerge');
    m.appendChild(svgEl('feMergeNode', { in: 'b' }));
    m.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
    f.appendChild(m);
    d.appendChild(f);
    return d;
  }

  // A brass corner plate: a quarter-round with two rivets, mirrored into each corner.
  function plate(x, y, sx, sy, size) {
    var g = svgEl('g', { class: 'gl-plate', transform: 'translate(' + x + ' ' + y + ') scale(' + sx + ' ' + sy + ')' });
    var s = size;
    g.appendChild(svgEl('path', { d: 'M0,0 H' + s + ' Q' + (s * 0.55) + ',' + (s * 0.55) + ' 0,' + s + ' Z', fill: 'url(#gl-brass)' }));
    g.appendChild(svgEl('path', { d: 'M0,0 H' + s + ' Q' + (s * 0.55) + ',' + (s * 0.55) + ' 0,' + s + ' Z', class: 'gl-plate-line' }));
    [[s * 0.22, s * 0.12], [s * 0.12, s * 0.22], [s * 0.42, s * 0.1], [s * 0.1, s * 0.42]].forEach(function (c) {
      g.appendChild(svgEl('circle', { cx: c[0], cy: c[1], r: s * 0.035, class: 'gl-rivet' }));
    });
    return g;
  }

  // A zone: a recessed panel with a brass hairline and a small rope knot at each corner.
  function frame(rect, cls) {
    var g = svgEl('g', { class: 'gl-zone ' + cls });
    var rx = 16;
    g.appendChild(svgEl('rect', { x: rect.x, y: rect.y, width: rect.w, height: rect.h, rx: rx, class: 'gl-zone-fill' }));
    g.appendChild(svgEl('rect', { x: rect.x + 1, y: rect.y + 1, width: rect.w - 2, height: rect.h - 2, rx: rx, class: 'gl-zone-edge' }));
    g.appendChild(svgEl('rect', { x: rect.x + 8, y: rect.y + 8, width: rect.w - 16, height: rect.h - 16, rx: rx - 7, class: 'gl-zone-inner' }));
    [[rect.x + 8, rect.y + 8], [rect.x + rect.w - 8, rect.y + 8], [rect.x + 8, rect.y + rect.h - 8], [rect.x + rect.w - 8, rect.y + rect.h - 8]]
      .forEach(function (c) {
        g.appendChild(svgEl('circle', { cx: c[0], cy: c[1], r: 6.5, class: 'gl-knot' }));
        g.appendChild(svgEl('circle', { cx: c[0], cy: c[1], r: 2.4, class: 'gl-knot-eye' }));
      });
    return g;
  }

  function watermark(text, x, y, size) {
    var t = svgEl('text', { x: x, y: y, class: 'gl-watermark', 'text-anchor': 'middle' });
    t.style.fontSize = size + 'px';
    t.textContent = text;
    return t;
  }

  // The compass rose at the centre of the Grand Line.
  function compass(cx, cy, r) {
    var g = svgEl('g', { class: 'gl-compass', transform: 'translate(' + cx + ' ' + cy + ')' });
    g.appendChild(svgEl('circle', { r: r, class: 'gl-compass-ring' }));
    g.appendChild(svgEl('circle', { r: r, class: 'gl-compass-rope' }));
    g.appendChild(svgEl('circle', { r: r * 0.8, class: 'gl-compass-face' }));
    var k = r * 0.72, n = r * 0.14;
    g.appendChild(svgEl('path', { class: 'gl-compass-star', filter: 'url(#gl-glow)',
      d: 'M0,' + (-k) + ' L' + n + ',' + (-n) + ' L' + k + ',0 L' + n + ',' + n + ' L0,' + k +
         ' L' + (-n) + ',' + n + ' L' + (-k) + ',0 L' + (-n) + ',' + (-n) + ' Z' }));
    g.appendChild(svgEl('path', { class: 'gl-compass-needle', d: 'M0,' + (-k) + ' L' + n + ',' + (-n) + ' L0,0 L' + (-n) + ',' + (-n) + ' Z' }));
    g.appendChild(svgEl('circle', { r: r * 0.1, class: 'gl-compass-hub' }));
    return g;
  }

  // The Grand Line: a band of sea across the centre, waves rolling along it, warm gold at your
  // end and steel blue at theirs so it reads as the middle of the table.
  function grandLine() {
    var g = svgEl('g', { class: 'gl-line' });
    var y = H / 2, h = 40, x0 = 26, x1 = W - 26;
    var clip = svgEl('clipPath', { id: 'gl-line-clip' });
    clip.appendChild(svgEl('rect', { x: x0, y: y - h / 2, width: x1 - x0, height: h }));
    g.appendChild(clip);
    var sea = svgEl('g', { 'clip-path': 'url(#gl-line-clip)' });
    g.appendChild(sea);
    sea.appendChild(svgEl('rect', { x: x0, y: y - h / 2, width: x1 - x0, height: h, fill: 'url(#gl-sea)' }));
    function wave(dy) {
      var d = 'M' + (x0 - 56) + ',' + (y + dy);
      for (var x = x0 - 56; x < x1 + 56; x += 56) d += ' q14,-9 28,0 t28,0';
      return d;
    }
    sea.appendChild(svgEl('path', { d: wave(-8), class: 'gl-wave is-back' }));
    sea.appendChild(svgEl('path', { d: wave(6), class: 'gl-wave' }));
    sea.appendChild(svgEl('rect', { x: x0, y: y - h / 2, width: x1 - x0, height: h, fill: 'url(#gl-sea-fade)' }));
    g.appendChild(svgEl('rect', { x: x0, y: y - h / 2 - 3, width: x1 - x0, height: 3, class: 'gl-line-edge is-theirs' }));
    g.appendChild(svgEl('rect', { x: x0, y: y + h / 2, width: x1 - x0, height: 3, class: 'gl-line-edge is-mine' }));
    g.appendChild(compass(W / 2, y, 46));
    return g;
  }

  function build() {
    var svg = svgEl('svg', { id: 'board-svg', viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false',
      preserveAspectRatio: 'none' });
    svg.appendChild(defs());
    svg.appendChild(svgEl('rect', { width: W, height: H, rx: 30, fill: 'url(#gl-rim)' }));
    // The rope: a tan core with a dark twist laid along it, then a highlight.
    svg.appendChild(svgEl('rect', { x: 13, y: 13, width: W - 26, height: H - 26, rx: 22, class: 'gl-rope' }));
    svg.appendChild(svgEl('rect', { x: 13, y: 13, width: W - 26, height: H - 26, rx: 22, class: 'gl-rope-twist' }));
    var P = 26;
    svg.appendChild(svgEl('rect', { x: P, y: P, width: W - P * 2, height: H - P * 2, rx: 14, fill: 'url(#gl-planks)' }));
    svg.appendChild(svgEl('rect', { x: P, y: P, width: W - P * 2, height: H - P * 2, rx: 14, fill: 'url(#gl-vignette)' }));
    svg.appendChild(grandLine());
    [['mine', MINE], ['theirs', THEIRS]].forEach(function (pair) {
      var side = pair[0], R = pair[1];
      var g = svgEl('g', { class: 'gl-row gl-' + side });
      Object.keys(R).forEach(function (k) { g.appendChild(frame(R[k], 'gl-' + k)); });
      // Watermarks, upright for the viewer, visible while a zone is empty.
      [['chars', 64], ['cost', 54], ['stage', 34]].forEach(function (z) {
        var rr = R[z[0]];
        g.appendChild(watermark(labelFor(z[0]).toUpperCase(), rr.x + rr.w / 2, rr.y + rr.h / 2 + z[1] * 0.35, z[1]));
      });
      // Pile and Life captions ride on the zone's inner edge, toward the centre line.
      ['deck', 'trash', 'dondeck', 'life'].forEach(function (k) {
        var rr = R[k];
        var cy = side === 'mine' ? rr.y + 30 : rr.y + rr.h - 14;
        var t = watermark(labelFor(k), rr.x + rr.w / 2, cy, 22);
        t.setAttribute('class', 'gl-caption');
        g.appendChild(t);
      });
      svg.appendChild(g);
    });
    [[P - 4, P - 4, 1, 1], [W - P + 4, P - 4, -1, 1], [P - 4, H - P + 4, 1, -1], [W - P + 4, H - P + 4, -1, -1]]
      .forEach(function (c) { svg.appendChild(plate(c[0], c[1], c[2], c[3], 96)); });
    return svg;
  }

  function pct(v, total) { return (v / total * 100) + '%'; }

  NS.boardArt = {
    layout: { w: W, h: H, mine: MINE, theirs: THEIRS },
    // Draw the mat once and pin every zone to its painted slot. Idempotent.
    init: function (mat) {
      if (mat.querySelector('#board-svg')) return;
      mat.insertBefore(build(), mat.firstChild);
      [['mine', 'my-'], ['theirs', 'enemy-']].forEach(function (pair) {
        Object.keys(MINE).forEach(function (k) {
          var node = document.getElementById(pair[1] + k);
          if (!node) throw new Error('boardArt: index.html is missing zone #' + pair[1] + k);
          var r = (pair[0] === 'mine' ? MINE : THEIRS)[k];
          node.style.left = pct(r.x, W); node.style.top = pct(r.y, H);
          node.style.width = pct(r.w, W); node.style.height = pct(r.h, H);
        });
      });
    }
  };
}(window.OP = window.OP || {}));
