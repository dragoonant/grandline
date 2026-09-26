// js/rng.js — seeded RNG. CLAUDE.md hard rule 10: every shuffle happens inside apply(), so a
// game is a pure function of its seed and its action list. That is what the black box replays.
(function (NS) {
  'use strict';

  // mulberry32 — small, fast, and its state is one uint32 that lives in the game state.
  function next(s) {
    s.rng = (s.rng + 0x6D2B79F5) | 0;
    var t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(s, n) { return Math.floor(next(s) * n); }

  // Fisher-Yates, in place, consuming from the state's stream.
  function shuffle(s, arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = int(s, i + 1);
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // A printable seed the player can read back and replay.
  function seedFrom(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h | 0;
  }

  NS.rng = { next: next, int: int, shuffle: shuffle, seedFrom: seedFrom };
}(window.OP = window.OP || {}));
