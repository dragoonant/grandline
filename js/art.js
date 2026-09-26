// js/art.js — card illustration. Two sources and no third:
//   1. a generated render named by art/manifest.js
//   2. a deterministic procedural SVG seeded from the card id
//
// CLAUDE.md hard rule 11: the manifest must be ON THE PAGE. `NS.artManifest || {}` is the exact
// bypass that cost project 5 an entire art pass, so its absence throws here on the first frame.
(function (NS) {
  'use strict';

  if (!NS.artManifest) {
    throw new Error('art: art/manifest.js is not on the page. It must be declared even while ' +
                    'it is empty — see CARD-GAME-LESSONS-5.md §5.3 (hard rule 11).');
  }

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  function rnd(seed) { var s = seed; return function () {
    s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296;
  }; }

  function has(id) { return !!NS.artManifest[id]; }
  function url(id) { return NS.artManifest[id] || null; }

  // A sea-and-sky placeholder, deterministic per card, tinted by the card's colour. It is a
  // placeholder and it should look like one — never close enough to be mistaken for a render.
  function procedural(card) {
    var seed = hash(card.id);
    var r = rnd(seed);
    var base = NS.names.colorHex(card.color[0] || 'Red');
    var horizon = 46 + Math.floor(r() * 16);
    var sun = 18 + Math.floor(r() * 64);
    var isles = [];
    for (var i = 0; i < 3; i++) {
      var x = 8 + r() * 84, w = 10 + r() * 26, h = 4 + r() * 11;
      isles.push('<path d="M' + x + ' ' + horizon + ' q' + (w / 2) + ' -' + h + ' ' + w + ' 0 z" fill="rgba(8,14,26,' + (0.30 + r() * 0.4).toFixed(2) + ')"/>');
    }
    var waves = '';
    for (var j = 0; j < 9; j++) {
      var wy = horizon + 3 + j * ((100 - horizon) / 9);
      var wx = r() * 40;
      waves += '<rect x="' + wx.toFixed(1) + '" y="' + wy.toFixed(1) + '" width="' + (12 + r() * 40).toFixed(1) + '" height="0.7" fill="rgba(255,255,255,' + (0.05 + r() * 0.12).toFixed(2) + ')"/>';
    }
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">' +
      '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + base + '"/>' +
        '<stop offset="55%" stop-color="#f3c98b"/>' +
        '<stop offset="100%" stop-color="#2a4a6b"/>' +
      '</linearGradient>' +
      '<linearGradient id="w" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#2a4a6b"/><stop offset="100%" stop-color="#0d1c30"/>' +
      '</linearGradient></defs>' +
      '<rect width="100" height="100" fill="url(#s)"/>' +
      '<circle cx="' + sun + '" cy="' + (horizon - 12) + '" r="9" fill="rgba(255,240,200,.75)"/>' +
      isles.join('') +
      '<rect y="' + horizon + '" width="100" height="' + (100 - horizon) + '" fill="url(#w)"/>' +
      waves +
      '</svg>');
  }

  function src(card) { return url(card.id) || procedural(card); }
  function isPlaceholder(card) { return !has(card.id); }

  function stats() {
    var all = NS.cards.all();
    var withArt = all.filter(function (c) { return has(c.id); }).length;
    return { cards: all.length, withArt: withArt, placeholder: all.length - withArt,
             meta: NS.artMeta };
  }

  NS.art = { src: src, has: has, url: url, procedural: procedural,
             isPlaceholder: isPlaceholder, stats: stats };
}(window.OP = window.OP || {}));
