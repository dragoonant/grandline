// js/screens.js — menu, deck picker, how to play, the art check, and the disclaimer the player
// actually sees. NOTICE.md is in the repo; §18 of the day-one checklist says it must also be on
// a screen a human opens, so it is on the menu.
(function (NS) {
  'use strict';

  function el(t, c, x) { return NS.render.el(t, c, x); }
  var host, chosen = { you: null, them: null };

  function show(name) {
    [].forEach.call(document.querySelectorAll('.screen'), function (s) { s.classList.remove('open'); });
    var s = document.getElementById('screen-' + name);
    if (!s) throw new Error('screens.show: no screen "' + name + '"');
    s.classList.add('open');
    if (name === 'menu') menu(s);
    if (name === 'decks') decks(s);
    if (name === 'help') help(s);
    if (name === 'art') artCheck(s);
  }
  function hide() {
    [].forEach.call(document.querySelectorAll('.screen'), function (s) { s.classList.remove('open'); });
  }

  function inner(s) {
    s.textContent = '';
    var w = el('div', 'screen-inner');
    s.appendChild(w);
    return w;
  }

  function menu(s) {
    var w = inner(s);
    var h = el('h1', null, 'GRAND LINE');
    h.insertBefore(el('span', 'sub', 'an unofficial ONE PIECE CARD GAME'), h.firstChild);
    w.appendChild(h);
    w.appendChild(el('p', null,
      'Bandai’s ONE PIECE CARD GAME, played against a computer opponent. The rules are ' +
      'Bandai’s Comprehensive Rules v1.2.1 and the cards say exactly what they say in print.'));

    var row = el('div', 'row');
    var play = el('button', 'primary', 'Choose decks and play');
    play.onclick = function () { NS.audio.resume(); show('decks'); };
    row.appendChild(play);
    var hb = el('button', null, 'How to play');
    hb.onclick = function () { show('help'); };
    row.appendChild(hb);
    var ab = el('button', null, 'Art check');
    ab.onclick = function () { show('art'); };
    row.appendChild(ab);
    var mb = el('button', null, NS.audio.isMuted() ? 'Sound: off' : 'Sound: on');
    mb.onclick = function () { mb.textContent = NS.audio.setMuted(!NS.audio.isMuted()) ? 'Sound: off' : 'Sound: on'; };
    row.appendChild(mb);
    w.appendChild(row);

    var n = el('div', 'notice');
    n.innerHTML =
      '<b>This is an unofficial, non-commercial, fan-made implementation.</b> It is not ' +
      'affiliated with, endorsed by or approved by Bandai, Bandai Namco, Eiichiro Oda, Shueisha ' +
      'or Toei Animation. ONE PIECE and the ONE PIECE CARD GAME belong to their rights holders, ' +
      'and are named here once to say what this software implements.<br><br>' +
      'Printed card text is reproduced from Bandai’s official card list so the cards read ' +
      'correctly. Every illustration in this build is generated for this project in an original ' +
      'style — <b>no official art, photograph, music or voice appears anywhere in it</b>, and ' +
      'every sound you hear is synthesised by the program as it runs. Nothing here is sold or ' +
      'monetised. See NOTICE.md and docs/takedown.md in the repository.';
    w.appendChild(n);
  }

  function deckCard(d, onPick) {
    var c = el('div', 'deckcard');
    var head = el('div', 'dname');
    if (d.tier && d.tier !== '—') {
      var t = el('span', 'tierbadge ' + d.tier, d.tier);
      head.appendChild(t);
    }
    head.appendChild(document.createTextNode(d.name));
    c.appendChild(head);
    c.appendChild(el('div', 'dmeta',
      (d.colors || NS.state.card(d.leader).color.join('/')) + ' · ' + d.leader +
      ' · ' + NS.state.card(d.leader).life + ' Life'));
    c.appendChild(el('div', 'dblurb', d.blurb));

    // PLAN.md D5 — the provenance split is shown, never hidden.
    var total = d.list.reduce(function (a, x) { return a + x[1]; }, 0);
    var meas = d.list.filter(function (x) { return x[2] === 'measured'; })
                     .reduce(function (a, x) { return a + x[1]; }, 0);
    var prov = d.kind === 'starter'
      ? 'All 50 slots inferred — Bandai publishes the product’s 16 cards but not its quantities.'
      : meas + ' of ' + total + ' slots from onepiece.gg’s measured table; ' +
        (total - meas) + ' chosen here to complete a legal 50.';
    c.appendChild(el('div', 'provenance', prov));
    c.onclick = function () { onPick(d, c); };
    return c;
  }

  function decks(s) {
    var w = inner(s);
    w.appendChild(el('h1', null, 'Choose the decks'));
    w.appendChild(el('p', null,
      'Ten archetypes from onepiece.gg’s OP17 Standard tier list, captured 2026-09-26 over ' +
      '758 placed decks from 34 events, plus the two Bandai starter decks the engine was proven ' +
      'on. Pick yours, then your opponent’s.'));

    var stage = el('div', null);
    var label = el('p', null, '');
    w.appendChild(label);
    w.appendChild(stage);

    function paint() {
      stage.textContent = '';
      label.innerHTML = chosen.you
        ? 'You: <b>' + chosen.you.name + '</b>. Now choose your opponent’s deck.'
        : 'Choose <b>your</b> deck.';
      var grid = el('div', 'deckgrid');
      NS.decks.forEach(function (d) {
        grid.appendChild(deckCard(d, function (picked) {
          if (!chosen.you) { chosen.you = picked; paint(); }
          else { chosen.them = picked; start(); }
        }));
      });
      stage.appendChild(grid);
      var row = el('div', 'row');
      var back = el('button', null, 'Back');
      back.onclick = function () { chosen = { you: null, them: null }; show('menu'); };
      row.appendChild(back);
      if (chosen.you) {
        var r = el('button', null, 'Change my deck');
        r.onclick = function () { chosen.you = null; paint(); };
        row.appendChild(r);
        var rnd = el('button', 'primary', 'Random opponent');
        rnd.onclick = function () {
          chosen.them = NS.decks[Math.floor(Math.random() * NS.decks.length)];
          start();
        };
        row.appendChild(rnd);
      }
      stage.appendChild(row);
    }
    paint();
  }

  function listOf(d) {
    var out = [];
    d.list.forEach(function (x) { for (var i = 0; i < x[1]; i++) out.push(x[0]); });
    return out;
  }

  function start() {
    var seed = Math.floor(Math.random() * 2147483647);
    var s = NS.engine.newGame({
      seed: seed, first: Math.random() < 0.5 ? 0 : 1,
      decks: [
        { key: chosen.you.key, leader: chosen.you.leader, cards: listOf(chosen.you) },
        { key: chosen.them.key, leader: chosen.them.leader, cards: listOf(chosen.them) }
      ]
    });
    NS.bugreport.begin(s, { you: 0 });
    hide();
    NS.audio.resume();
    NS.ui.init({ state: s, you: 0 });
    chosen = { you: null, them: null };
  }

  function help(s) {
    var w = inner(s);
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
      var h = el('h3', null, b[0]);
      h.style.cssText = 'margin:1.3rem 0 .2rem;color:var(--gold);font-size:1.05rem';
      w.appendChild(h);
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
    var w = inner(s);
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
              d.style.cssText = 'font-family:ui-monospace,monospace;font-size:.75rem;color:#ff9b91';
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
