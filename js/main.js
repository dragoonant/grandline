// js/main.js — boot. Nothing here decides a rule; it wires the page and opens the menu.
(function (NS) {
  'use strict';

  function boot() {
    // Hard rule 11: a missing dependency throws on the first frame.
    ['rng', 'log', 'names', 'state', 'statics', 'ops', 'text', 'engine', 'cards',
     'decks', 'defects', 'ai', 'art', 'render', 'board', 'ui', 'audio', 'screens',
     'bugreport'].forEach(function (k) {
      if (!NS[k]) throw new Error('boot: OP.' + k + ' is missing — check the script list in index.html');
    });
    NS.cards.build();

    document.getElementById('btn-log').onclick = function () {
      document.getElementById('sidebar').classList.toggle('open');
    };
    document.getElementById('btn-menu').onclick = function () { NS.screens.show('menu'); };
    document.getElementById('btn-sound').onclick = function (e) {
      e.target.textContent = NS.audio.setMuted(!NS.audio.isMuted()) ? '🔇' : '🔊';
    };
    document.getElementById('btn-sound').textContent = NS.audio.isMuted() ? '🔇' : '🔊';
    document.getElementById('btn-trace').onclick = function () { NS.bugreport.download(); };

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') NS.ui.cancel();
      if (e.key === 'l' || e.key === 'L') document.getElementById('sidebar').classList.toggle('open');
      if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
        if (e.target && /INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)) return;
        e.preventDefault();
        NS.ui.endTurn();
      }
    });
    // Any first gesture satisfies the autoplay policy; refusal before that is "wait".
    ['pointerdown', 'keydown'].forEach(function (ev) {
      document.addEventListener(ev, function once() {
        NS.audio.resume();
        document.removeEventListener(ev, once);
      });
    });

    NS.screens.show('menu');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}(window.OP = window.OP || {}));
