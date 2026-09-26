// js/statics.js — permanent effects (CR 8-1-3-3). A permanent effect constantly affects the
// game while it is valid, so it is never "applied" to a card; it is recomputed every time
// anyone asks for a power value or a keyword.
//
// Re-entrancy: a selector may filter on power ("Characters with 6000 power or less") and power
// consults statics, so evaluating a static could ask for a power that needs statics. While a
// static evaluation is in flight, power filters fall back to BASE power. That is also the
// reading the rules want — CR 8-1-3-3-5 resolves permanent effects against each other by
// repeated application, and base power is the fixed point this engine takes.
(function (NS) {
  'use strict';

  var S, E;
  function bind() { if (!S) { S = NS.state; E = NS.engine; } }
  var inFlight = false;

  function staticsOf(u) {
    var c = S.card(u.id);
    return (c.abilities || []).filter(function (a) { return a.when === 'static'; });
  }

  // Does `u` fall inside `sel` as written on `src`?
  function hits(s, src, sel, u) {
    var ctrl = S.seatOf(s, src.uid);
    if (ctrl < 0) return false;
    var ctx = { ctrl: ctrl, self: src.uid };
    var cands = NS.ops.candidates(s, ctx, sel);
    for (var i = 0; i < cands.length; i++) if (cands[i].uid === u.uid) return true;
    return false;
  }

  function scan(s, u, fn) {
    bind();
    if (inFlight) return;
    inFlight = true;
    try {
      var all = S.allUnits(s);
      for (var i = 0; i < 2; i++) if (s.players[i].stage) all.push(s.players[i].stage);
      for (var a = 0; a < all.length; a++) {
        var src = all[a];
        var abs = staticsOf(src);
        for (var b = 0; b < abs.length; b++) {
          var ab = abs[b];
          if (!E.condsMet(s, src, ab)) continue;
          for (var o = 0; o < ab.ops.length; o++) fn(src, ab.ops[o]);
        }
      }
    } finally { inFlight = false; }
  }

  // Sum of every permanent power change that reaches `u`.
  function power(s, u) {
    var n = 0;
    scan(s, u, function (src, op) {
      if (op.k !== 'power') return;
      if (hits(s, src, op.sel, u)) n += op.n;
    });
    return n;
  }

  // Keywords granted by a permanent effect, e.g. "[DON!! x2] This Character gains [Rush]."
  function grants(s, u, kw) {
    var found = false;
    scan(s, u, function (src, op) {
      if (found || op.k !== 'gainKw' || op.kw !== kw) return;
      if (hits(s, src, op.sel, u)) found = true;
    });
    return found;
  }

  function evaluating() { return inFlight; }

  NS.statics = { power: power, grants: grants, evaluating: evaluating };
}(window.OP = window.OP || {}));
