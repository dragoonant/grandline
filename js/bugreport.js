// js/bugreport.js — the black box. Built BEFORE the first playtest, not after the first report.
//
// It records the seed, the decks and every action applied, so tools/replay-report.mjs can replay
// a real browser game headlessly and report ILLEGAL / THREW / DIVERGED. On project 5 this
// replayed a 74-action game CLEAN on the first try, which is the only reason a bug report from a
// human was worth anything.
(function (NS) {
  'use strict';

  var tape = null;

  function begin(s, meta) {
    tape = {
      version: 1,
      when: new Date().toISOString(),
      seed: s.seed, first: s.first, decks: s.decks.slice(),
      you: meta && meta.you !== undefined ? meta.you : 0,
      actions: [], crash: null
    };
    return tape;
  }

  function push(action) { if (tape) tape.actions.push(action); }

  function record(s, action, err) {
    if (!tape) return;
    tape.crash = {
      at: tape.actions.length, action: action || null,
      message: err && err.message, stack: err && err.stack,
      turn: s && s.turn, phase: s && s.phase,
      head: s && s.queue[0] ? s.queue[0].k : null
    };
  }

  function get() { return tape; }
  function json() { return JSON.stringify(tape, null, 2); }

  function download() {
    var blob = new Blob([json()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'grandline-trace-' + (tape ? tape.seed : 'none') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  }

  NS.bugreport = { begin: begin, push: push, record: record, get: get, json: json,
                   download: download };
}(window.OP = window.OP || {}));
