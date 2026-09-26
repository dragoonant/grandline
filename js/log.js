// js/log.js — structured log. Every entry carries a tag, a data object and an automatic `via`
// (what was resolving when it happened). js/audio.js rides this table: the engine tags events
// and a tag with no voice is simply ignored.
(function (NS) {
  'use strict';

  function push(s, tag, data) {
    s.log.push({
      n: s.log.length,
      turn: s.turn,
      seat: s.active,
      tag: tag,
      data: data || {},
      via: s._via || null
    });
    return s;
  }

  // Wrap a run so everything it logs is attributed to it. Not a try/finally: the caller is
  // inside apply(), which works on a copy, so a throw discards the state anyway.
  function via(s, what, fn) {
    var prev = s._via;
    s._via = what;
    var r = fn();
    s._via = prev;
    return r;
  }

  NS.log = { push: push, via: via };
}(window.OP = window.OP || {}));
