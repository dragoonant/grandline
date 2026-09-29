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
    NS.render.installZoom();                  // hover zoom on every face-up card, everywhere

    // The log panel used to cover the very button that opened it, with no close control and
    // only an unadvertised L key to dismiss it. It now has a Close button, Esc closes it, and it
    // opens below the top bar so the Log button stays reachable as a toggle.
    function toggleLog(open) {
      var sb = document.getElementById('sidebar');
      var on = open === undefined ? !sb.classList.contains('open') : open;
      sb.classList.toggle('open', on);
      document.getElementById('btn-log').classList.toggle('on', on);
    }
    document.getElementById('btn-log').onclick = function () { toggleLog(); };
    document.getElementById('btn-log-close').onclick = function () { toggleLog(false); };
    document.getElementById('btn-menu').onclick = function () { NS.screens.show('menu'); };
    document.getElementById('btn-sound').onclick = function (e) {
      e.target.textContent = NS.audio.setMuted(!NS.audio.isMuted()) ? '🔇' : '🔊';
    };
    document.getElementById('btn-sound').textContent = NS.audio.isMuted() ? '🔇' : '🔊';
    document.getElementById('btn-trace').onclick = function () { NS.bugreport.download(); };

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (document.getElementById('sidebar').classList.contains('open')) { toggleLog(false); return; }
        NS.ui.cancel();
      }
      if (e.key === 'l' || e.key === 'L') toggleLog();
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
