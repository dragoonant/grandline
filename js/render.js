// js/render.js — ONE renderer, three sizes. CARD-PRESENTATION-SPEC.md §0.4.
//
// Art is the card: the illustration covers the face edge to edge, a gradient scrim darkens only
// the bands that carry text, and the text floats on shadow with no plate behind it. All type is
// in `em` so the same function draws a 34px board card and a 19rem preview — but §6.3 of
// lessons-5: `em` cascades from font-size, not width, so EVERY SIZE CLASS SETS ITS OWN BASE.
(function (NS) {
  'use strict';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  var ATTR_ICON = { Slash: '⚔', Strike: '✊', Ranged: '➳',
                    Special: '✹', Wisdom: '◈', '?': '?' };

  // The colour hexagon of CR 2-3-3, drawn as coloured chips rather than an image.
  function colorChips(card) {
    var w = el('div', 'card-colors');
    card.color.forEach(function (c) {
      var d = el('span', 'color-chip');
      d.style.background = NS.names.colorHex(c);
      d.title = c;
      w.appendChild(d);
    });
    return w;
  }

  // size: 'board' | 'hand' | 'preview' | 'tiny'
  function render(card, size, opts) {
    opts = opts || {};
    var root = el('div', 'card card-' + size);
    root.dataset.cardId = card.id;
    if (opts.uid) root.dataset.uid = opts.uid;
    root.classList.add('cat-' + card.category.toLowerCase());

    var art = el('div', 'card-art');
    var img = document.createElement('img');
    img.className = 'art';
    img.alt = '';
    img.src = NS.art.src(card);
    img.addEventListener('error', function () { img.src = NS.art.procedural(card); });
    art.appendChild(img);
    root.appendChild(art);

    // Corner pips: Life on a Leader (CR 2-9), Cost on everything else (CR 2-7).
    var corners = el('div', 'card-corners');
    if (card.category === 'LEADER') {
      corners.appendChild(el('span', 'pip life', String(card.life)));
    } else {
      corners.appendChild(el('span', 'pip cost', String(card.cost)));
    }
    if (card.attribute.length) {
      corners.appendChild(el('span', 'pip attr', ATTR_ICON[card.attribute[0]] || card.attribute[0]));
    }
    root.appendChild(corners);

    var plate = el('div', 'card-plate');
    plate.appendChild(el('div', 'card-name', NS.names.cardName(card)));

    var type = el('div', 'card-type');
    type.appendChild(el('span', 'type-tag', card.category));
    if (card.types.length) type.appendChild(el('span', 'traits', card.types.join(' / ')));
    plate.appendChild(type);

    if (card.keywords.length) {
      plate.appendChild(el('div', 'card-kw', card.keywords.map(function (k) {
        return '[' + NS.names.keyword(k) + ']';
      }).join('  ·  ')));
    }

    // Full rules text at preview size only — §0.3, identity small, everything large.
    if (size === 'preview') {
      var body = NS.names.cardText(card);
      if (body) {
        var d = el('div', 'card-detail');
        body.split('\n').forEach(function (line) { d.appendChild(el('div', 'ability', line)); });
        plate.appendChild(d);
      }
      var trig = NS.names.cardTrigger(card);
      if (trig) {
        var tb = el('div', 'card-trigger');
        tb.appendChild(el('span', 'trigger-tag', NS.names.keyword('trigger')));
        tb.appendChild(el('span', 'trigger-text', trig.replace(/^\[Trigger\]\s*/, '')));
        plate.appendChild(tb);
      }
      if (card.keywords.length) {
        var help = el('div', 'card-help');
        card.keywords.forEach(function (k) {
          var h = NS.names.help(k);
          if (h) help.appendChild(el('div', 'kwhelp', '[' + NS.names.keyword(k) + '] ' + h));
        });
        plate.appendChild(help);
      }
      var foot = el('div', 'card-foot');
      foot.appendChild(el('span', 'card-id', card.id));
      foot.appendChild(el('span', 'card-set', card.set));
      plate.appendChild(foot);
    }

    var stats = el('div', 'card-stats');
    if (card.power !== null) stats.appendChild(el('span', 'stat power', String(card.power)));
    if (card.counter) stats.appendChild(el('span', 'stat counter', '↺' + card.counter));
    stats.appendChild(colorChips(card));
    plate.appendChild(stats);

    root.appendChild(plate);
    if (NS.art.isPlaceholder(card)) root.classList.add('art-placeholder');
    return root;
  }

  // State-dependent classes and live numbers, kept separate from render() so the same renderer
  // draws a card with no game state behind it (spec §1).
  function decorate(node, s, u) {
    node.classList.toggle('is-rested', !!u.rested);
    var card = NS.state.card(u.id);
    var live = NS.state.power(s, u);
    var cur = node.querySelector('.stat.power');
    if (cur && card.power !== null) {
      cur.textContent = String(live);
      cur.classList.toggle('buffed', live > card.power);
      cur.classList.toggle('debuffed', live < card.power);
    }
    if (u.don > 0) {
      var d = node.querySelector('.don-badge') || el('div', 'don-badge');
      d.textContent = 'DON!! ×' + u.don;
      if (!d.parentNode) node.appendChild(d);
    }
    var kws = [];
    ['blocker', 'rush', 'doubleAttack', 'banish', 'unblockable'].forEach(function (k) {
      if (NS.state.hasKeyword(s, u, k)) kws.push(k);
    });
    node.classList.toggle('has-blocker', kws.indexOf('blocker') >= 0);
    return node;
  }

  function back(label) {
    var n = el('div', 'card card-back');
    n.appendChild(el('div', 'back-mark', label || ''));
    return n;
  }

  NS.render = { render: render, decorate: decorate, back: back, el: el };
}(window.OP = window.OP || {}));
