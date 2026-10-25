// js/screens.js — menu, deck picker, how to play, the art check, and the disclaimer the player
// actually sees. NOTICE.md is in the repo; §18 of the day-one checklist says it must also be on
// a screen a human opens, so it is on the menu.
(function (NS) {
  'use strict';

  function el(t, c, x) { return NS.render.el(t, c, x); }
  // Deck picks survive a game, so "New game" offers the same matchup again. A slot left on
  // random is rolled at Start and forgotten afterwards.
  var chosen = { you: null, them: null }, splashDone = false, splashTimer = null;
  var SPLASH_MS = 4000;

  function show(name) {
    [].forEach.call(document.querySelectorAll('.screen'), function (s) { s.classList.remove('open'); });
    var s = document.getElementById('screen-' + name);
    if (!s) throw new Error('screens.show: no screen "' + name + '"');
    s.classList.add('open');
    if (name === 'menu') { if (splashDone) picker(s); else splash(s); }
    if (name === 'decks') throw new Error('screens.show: the deck chooser opens from a picker slot');
    if (name === 'help') help(s);
    if (name === 'art') artCheck(s);
  }
  function hide() {
    [].forEach.call(document.querySelectorAll('.screen'), function (s) { s.classList.remove('open'); });
  }

  // ---- the scene ---------------------------------------------------------------------------
  // A sunset sea with a ship under sail, drawn rather than generated: the backdrop for every
  // screen. Original throughout — a generic three-master and a plain skull flag, no crest,
  // figurehead or sail mark from anywhere.
  var SCENE = (function () {
    var waves = '', i, y;
    for (i = 0; i < 9; i++) {
      y = 640 + i * 30 + i * i * 2;
      waves += '<path class="sc-wave" style="--i:' + i + '" d="M-80 ' + y +
        ' q40 -' + (5 + i) + ' 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0"/>';
    }
    var glints = '';
    for (i = 0; i < 14; i++) {
      y = 600 + i * 16 + i * i;
      glints += '<rect class="sc-glint" style="--i:' + i + '" x="' + (800 - 30 - i * 9) + '" y="' + y + '" width="' + (60 + i * 18) + '" height="' + (2 + i * 0.3) + '" rx="2"/>';
    }
    return '<svg class="scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#0b1838"/><stop offset=".45" stop-color="#3b2d5c"/>' +
          '<stop offset=".72" stop-color="#c0566a"/><stop offset=".9" stop-color="#f29b5a"/><stop offset="1" stop-color="#ffd38a"/>' +
        '</linearGradient>' +
        '<linearGradient id="sc-sea" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#3a3f6e"/><stop offset=".25" stop-color="#1c3558"/><stop offset="1" stop-color="#06121f"/>' +
        '</linearGradient>' +
        '<radialGradient id="sc-sun" cx=".5" cy=".5" r=".5">' +
          '<stop offset="0" stop-color="#fff4d0"/><stop offset=".35" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#ff9a5a" stop-opacity="0"/>' +
        '</radialGradient>' +
      '</defs>' +
      '<rect width="1600" height="620" fill="url(#sc-sky)"/>' +
      '<circle cx="800" cy="612" r="260" fill="url(#sc-sun)" opacity=".75"/>' +
      '<circle cx="800" cy="612" r="74" fill="#ffe7a8"/>' +
      '<g class="sc-clouds">' +
        '<path d="M120 260 q60 -50 130 -10 q50 -40 110 0 q60 -10 70 30 z" />' +
        '<path d="M1100 200 q50 -40 110 -6 q40 -36 100 -2 q55 -6 64 26 z" />' +
        '<path d="M520 380 q40 -30 90 -6 q30 -24 70 0 q40 -4 46 20 z" />' +
        '<path d="M1240 420 q40 -30 90 -6 q30 -24 70 0 q40 -4 46 20 z" />' +
      '</g>' +
      '<path class="sc-isle" d="M0 620 L0 588 q60 -40 120 -22 q50 -46 110 -10 q40 10 70 32 L300 620 z"/>' +
      '<path class="sc-isle far" d="M1180 620 q40 -26 90 -18 q60 -52 130 -14 q50 -10 90 20 q40 -6 110 12 L1600 620 z"/>' +
      '<rect y="612" width="1600" height="288" fill="url(#sc-sea)"/>' + glints + waves +
      '<g class="sc-gulls"><path d="M380 210 q14 -12 26 0 q12 -12 26 0"/><path d="M440 250 q10 -9 20 0 q10 -9 20 0"/>' +
        '<path d="M1010 300 q12 -10 22 0 q10 -10 22 0"/></g>' +
      '<g class="sc-ship" transform="translate(1040 452)">' +
        '<path class="sc-hull" d="M-150 150 q20 40 70 46 l180 0 q50 -6 84 -52 l24 -30 l-30 6 q-10 22 -40 26 L-120 146 z"/>' +
        '<path class="sc-hull" d="M-150 150 l-26 -26 l20 -2 z"/>' +
        '<rect class="sc-mast" x="-72" y="-60" width="7" height="212"/>' +
        '<rect class="sc-mast" x="20" y="-110" width="8" height="262"/>' +
        '<rect class="sc-mast" x="110" y="-40" width="7" height="190"/>' +
        '<path class="sc-sail" d="M-122 -40 q50 -10 108 0 q10 50 0 100 q-54 -10 -108 0 q-10 -50 0 -100 z"/>' +
        '<path class="sc-sail" d="M-116 72 q46 -8 100 0 q8 34 0 64 q-50 -8 -100 0 q-8 -32 0 -64 z"/>' +
        '<path class="sc-sail" d="M-36 -90 q60 -12 128 0 q12 60 0 118 q-64 -12 -128 0 q-12 -58 0 -118 z"/>' +
        '<path class="sc-sail" d="M-30 40 q56 -10 116 0 q10 44 0 86 q-58 -10 -116 0 q-10 -42 0 -86 z"/>' +
        '<path class="sc-sail" d="M72 -20 q42 -8 84 0 q8 40 0 80 q-42 -8 -84 0 q-8 -40 0 -80 z"/>' +
        '<path class="sc-rig" d="M-68 -60 L-176 124 M24 -110 L-68 -60 M24 -110 L114 -40 M114 -40 L196 118"/>' +
        '<g class="sc-flag" transform="translate(28 -110)"><path class="sc-flag-cloth" d="M0 0 q24 -6 46 2 q-4 14 0 30 q-22 -8 -46 -2 z"/>' +
          '<circle cx="22" cy="12" r="6" class="sc-skull"/><path class="sc-bones" d="M12 22 L32 28 M32 22 L12 28"/></g>' +
      '</g>' +
      '<rect class="sc-mist" y="560" width="1600" height="120"/>' +
    '</svg>';
  }());
  function scene(s, dim) {
    var sc = el('div', 'scene' + (dim ? ' is-dim' : ''));
    sc.innerHTML = SCENE;
    s.appendChild(sc);
  }

  var NOTICE =
    '<b>This is an unofficial, non-commercial, fan-made implementation.</b> It is not ' +
    'affiliated with, endorsed by or approved by Bandai, Bandai Namco, Eiichiro Oda, Shueisha ' +
    'or Toei Animation. ONE PIECE and the ONE PIECE CARD GAME belong to their rights holders, ' +
    'and are named here once to say what this software implements. ' +
    'Printed card text is reproduced from Bandai’s official card list so the cards read ' +
    'correctly. Every illustration in this build is generated for this project in an original ' +
    'style — <b>no official art, photograph, music or voice appears anywhere in it</b>, and ' +
    'every sound you hear is synthesised by the program as it runs. Nothing here is sold or ' +
    'monetised. See NOTICE.md and docs/takedown.md in the repository.';
  function notice(s) {
    var n = el('div', 'notice');
    n.innerHTML = NOTICE;
    s.appendChild(n);
  }

  function inner(s, cls) {
    s.textContent = '';
    scene(s, true);
    var w = el('div', 'screen-inner' + (cls ? ' ' + cls : ''));
    s.appendChild(w);
    return w;
  }

  // ---- the title splash --------------------------------------------------------------------
  function splash(s) {
    s.textContent = '';
    s.classList.add('is-splash');
    scene(s, false);
    var t = el('div', 'splash');
    t.appendChild(el('div', 'splash-kicker', 'an unofficial ONE PIECE CARD GAME'));
    t.appendChild(el('h1', 'splash-title', 'GRAND LINE'));
    t.appendChild(el('div', 'splash-rule'));
    t.appendChild(el('div', 'splash-tag',
      'Bandai’s Comprehensive Rules, every card exactly as printed — you against the computer.'));
    t.appendChild(el('div', 'splash-go', 'Click to set sail'));
    s.appendChild(t);
    notice(s);
    function go() {
      if (splashDone) return;
      splashDone = true;
      clearTimeout(splashTimer);
      s.removeEventListener('click', go);
      document.removeEventListener('keydown', go);
      NS.audio.resume();
      s.classList.remove('is-splash');
      picker(s);
    }
    s.addEventListener('click', go);
    document.addEventListener('keydown', go);
    splashTimer = setTimeout(go, SPLASH_MS);
  }

  // ---- the picker --------------------------------------------------------------------------
  function deckMeta(d) {
    var leader = NS.state.card(d.leader);
    return (d.colors || leader.color.join('/')) + ' · ' + leader.life + ' ' + NS.names.term('life');
  }
  function tier(d) {
    return d.tier && d.tier !== '—' ? el('span', 'tierbadge ' + d.tier, d.tier) : null;
  }
  function randomDeck() { return NS.decks[Math.floor(Math.random() * NS.decks.length)]; }

  function slot(side, label) {
    var wrap = el('div', 'pick-field');
    wrap.appendChild(el('label', 'pick-label', label));
    var row = el('div', 'pick-row');
    var b = el('button', 'pick-slot');
    var d = chosen[side];
    if (d) {
      var thumb = NS.render.render(NS.state.card(d.leader), 'tiny', {});
      b.appendChild(thumb);
      var txt = el('span', 'pick-text');
      var nm = el('span', 'pick-name');
      var tb = tier(d);
      if (tb) nm.appendChild(tb);
      nm.appendChild(document.createTextNode(d.name));
      txt.appendChild(nm);
      txt.appendChild(el('span', 'pick-meta', deckMeta(d)));
      b.appendChild(txt);
    } else {
      b.classList.add('is-random');
      b.appendChild(el('span', 'pick-text', '? A random deck'));
    }
    b.title = 'Choose from the twelve decks';
    b.onclick = function () { chooser(side); };
    row.appendChild(b);
    var dice = el('button', 'pick-dice', '⚄');
    dice.title = 'Leave it to chance — rolled when you set sail';
    dice.setAttribute('aria-label', 'Random deck');
    dice.onclick = function () { chosen[side] = null; picker(document.getElementById('screen-menu')); };
    row.appendChild(dice);
    wrap.appendChild(row);
    return wrap;
  }

  function picker(s) {
    var w = inner(s, 'picker-wrap');
    var p = el('div', 'panel picker');
    p.appendChild(el('div', 'picker-kicker', 'an unofficial ONE PIECE CARD GAME'));
    p.appendChild(el('h1', 'picker-title', 'GRAND LINE'));
    p.appendChild(slot('you', 'Your deck'));
    p.appendChild(slot('them', 'Opponent’s deck'));
    p.appendChild(el('div', 'pick-note',
      'Ten archetypes from onepiece.gg’s OP17 Standard tier list (captured 2026-09-26) and ' +
      'Bandai’s two starter decks. The opponent is the computer.'));
    var go = el('button', 'primary big', 'Set sail');
    go.onclick = function () { NS.audio.resume(); start(); };
    p.appendChild(go);
    var row = el('div', 'row picker-row');
    var hb = el('button', null, 'How to play');
    hb.onclick = function () { show('help'); };
    row.appendChild(hb);
    var ab = el('button', null, 'Art check');
    ab.onclick = function () { show('art'); };
    row.appendChild(ab);
    var mb = el('button', null, NS.audio.isMuted() ? 'Sound: off' : 'Sound: on');
    mb.onclick = function () { mb.textContent = NS.audio.setMuted(!NS.audio.isMuted()) ? 'Sound: off' : 'Sound: on'; };
    row.appendChild(mb);
    p.appendChild(row);
    w.appendChild(p);
    notice(s);
  }

  // ---- the deck chooser --------------------------------------------------------------------
  function poster(d, onPick) {
    var c = el('div', 'poster');
    c.tabIndex = 0;
    var art = el('div', 'poster-art');
    art.appendChild(NS.render.render(NS.state.card(d.leader), 'board', {}));
    c.appendChild(art);
    var body = el('div', 'poster-body');
    var head = el('div', 'dname');
    var tb = tier(d);
    if (tb) head.appendChild(tb);
    head.appendChild(document.createTextNode(d.name));
    body.appendChild(head);
    body.appendChild(el('div', 'dmeta', deckMeta(d) + ' · ' + d.leader));
    body.appendChild(el('div', 'dblurb', d.blurb));

    // PLAN.md D5 — the provenance split is shown, never hidden.
    var total = d.list.reduce(function (a, x) { return a + x[1]; }, 0);
    var meas = d.list.filter(function (x) { return x[2] === 'measured'; })
                     .reduce(function (a, x) { return a + x[1]; }, 0);
    var prov = d.kind === 'starter'
      ? 'All 50 slots inferred — Bandai publishes the product’s 16 cards but not its quantities.'
      : meas + ' of ' + total + ' slots from onepiece.gg’s measured table; ' +
        (total - meas) + ' chosen here to complete a legal 50.';
    body.appendChild(el('div', 'provenance', prov));
    c.appendChild(body);
    c.onclick = function () { onPick(d); };
    c.onkeydown = function (e) { if (e.key === 'Enter') onPick(d); };
    return c;
  }

  function chooser(side) {
    var s = document.getElementById('screen-decks');
    [].forEach.call(document.querySelectorAll('.screen'), function (x) { x.classList.remove('open'); });
    s.classList.add('open');
    var w = inner(s, 'chooser-wrap');
    w.appendChild(el('h1', 'chooser-title', side === 'you' ? 'Choose your deck' : 'Choose the opponent’s deck'));
    w.appendChild(el('p', 'chooser-sub',
      'Ten archetypes from onepiece.gg’s OP17 Standard tier list, captured 2026-09-26 over ' +
      '758 placed decks from 34 events, plus the two Bandai starter decks the engine was proven ' +
      'on. Hover a Leader to read it.'));
    var grid = el('div', 'deckgrid');
    NS.decks.forEach(function (d) {
      grid.appendChild(poster(d, function (picked) { chosen[side] = picked; show('menu'); }));
    });
    w.appendChild(grid);
    var row = el('div', 'row');
    var back = el('button', null, 'Back');
    back.onclick = function () { show('menu'); };
    row.appendChild(back);
    var rnd = el('button', null, 'Leave it to chance');
    rnd.onclick = function () { chosen[side] = null; show('menu'); };
    row.appendChild(rnd);
    w.appendChild(row);
  }

  function listOf(d) {
    var out = [];
    d.list.forEach(function (x) { for (var i = 0; i < x[1]; i++) out.push(x[0]); });
    return out;
  }

  function start() {
    var you = chosen.you || randomDeck(), them = chosen.them || randomDeck();
    var seed = Math.floor(Math.random() * 2147483647);
    var s = NS.engine.newGame({
      seed: seed, first: Math.random() < 0.5 ? 0 : 1,
      decks: [
        { key: you.key, leader: you.leader, cards: listOf(you) },
        { key: them.key, leader: them.leader, cards: listOf(them) }
      ]
    });
    NS.bugreport.begin(s, { you: 0 });
    hide();
    NS.audio.resume();
    NS.ui.init({ state: s, you: 0 });
  }

  function help(s) {
    var w = inner(s, 'panel page');
    w.appendChild(el('h1', null, 'How to play'));
    var body = [
      ['The goal', 'Your opponent loses when their Leader takes damage and they have no Life cards left, or when they run out of deck. Losing is being <b>damaged with no Life left</b>, not Life reaching zero (CR 1-2-1-1).'],
      ['Your turn', 'Refresh (everything stands up and your DON!! comes back), Draw, take 2 DON!!, then the Main Phase where you do everything, then End. The player going first skips their first draw and takes only 1 DON!! — that is Bandai’s answer to first-player advantage, and it works.'],
      ['DON!!', 'DON!! pays for cards, and you can also <b>give</b> one to your Leader or a Character to add +1000 power for the turn. Given DON!! comes back at your next Refresh. Some cards read [DON!! x2], which means they need that many attached.'],
      ['Attacking', 'Rest a Leader or Character to attack. You may attack the opponent’s Leader, or one of their <b>rested</b> Characters — an active Character cannot be attacked. A card played this turn cannot attack unless it has [Rush].'],
      ['The attacker wins ties', 'If the attacker’s power is <b>greater than or equal to</b> the defender’s, the attack succeeds. Against a Leader that is 1 damage; against a Character it is a K.O.'],
      ['Blocking', 'When you are attacked, a Character with [Blocker] may rest to become the new target of that attack instead. It is your best way to save a Life card, and it costs you that Character standing up.'],
      ['Countering', 'Then comes the Counter Step, and you may use it <b>as many times as you like</b>. Trash a Character from your hand for the Counter value in its bottom corner, or play an Event with [Counter]. Every point stacks on the defender for that battle only.'],
      ['Triggers', 'When you take damage, the Life card you turn over may have a [Trigger]. Use it and the card is trashed afterwards; decline it and the card goes to your hand. Taking damage is how you draw cards in this game — Life is a resource as well as a clock.'],
      ['Reading a card', 'Hover any card to see it large, with its full printed text and what its keywords do. Numbers turn green when an effect has raised them and red when something has lowered them.']
    ];
    body.forEach(function (b) {
      w.appendChild(el('h3', 'page-h', b[0]));
      var p = el('p', null, '');
      p.innerHTML = b[1];
      w.appendChild(p);
    });
    var row = el('div', 'row');
    var back = el('button', 'primary', 'Back');
    back.onclick = function () { show('menu'); };
    row.appendChild(back);
    w.appendChild(row);
  }

  // lessons-5 §5.3 — build the self-diagnostic WITH the feature, not after the bug report.
  // This probes every declared image in the real browser and prints the failing URLs.
  function artCheck(s) {
    var w = inner(s, 'panel page');
    w.appendChild(el('h1', null, 'Art check'));
    var st = NS.art.stats();
    w.appendChild(el('p', null,
      st.cards + ' cards in the registry. ' + st.withArt + ' have a generated render; ' +
      st.placeholder + ' are drawing the procedural placeholder.' +
      (st.meta && st.meta.generated ? ' Renders generated ' + st.meta.generated + '.' : '')));
    var out = el('p', null, 'Probing every declared image in this browser…');
    w.appendChild(out);

    var ids = Object.keys(NS.artManifest);
    if (!ids.length) {
      out.textContent = 'The manifest is empty, so there is nothing to probe. Every card is ' +
        'drawing its procedural placeholder, which is expected before tools/gen-art.mjs has run.';
    } else {
      var bad = [], done = 0;
      ids.forEach(function (id) {
        var img = new Image();
        img.onload = img.onerror = function () {
          if (!img.naturalWidth) bad.push(id + ' → ' + NS.artManifest[id]);
          if (++done === ids.length) {
            out.textContent = bad.length
              ? bad.length + ' declared image(s) failed to load:'
              : 'All ' + ids.length + ' declared images loaded.';
            bad.forEach(function (b) {
              var d = el('div', null, b);
              d.className = 'art-bad';
              w.appendChild(d);
            });
          }
        };
        img.src = NS.artManifest[id];
      });
    }
    var row = el('div', 'row');
    var back = el('button', 'primary', 'Back');
    back.onclick = function () { show('menu'); };
    row.appendChild(back);
    w.appendChild(row);
  }

  NS.screens = { show: show, hide: hide };
}(window.OP = window.OP || {}));
