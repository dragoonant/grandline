// js/audio.js — one module owns every audio decision.
//
// THE AUDIO LAYER RIDES THE STRUCTURED LOG: the engine tags events and a tag with no voice is
// simply ignored, so adding a sound never means touching the engine. One AudioContext. Autoplay
// refusal is "wait", not an error. Mute persists, and a muted reload creates no context at all.
//
// THE REPO CARRIES NO THIRD-PARTY AUDIO. The kit is synthesised here and the score is written by
// this file at run time on a minor pentatonic, scheduled on the AUDIO clock — never setTimeout,
// which drifts whenever the main thread is busy.
//
// The trap, restated because it costs a commit every time nobody restates it: a sound tagged on
// a MECHANISM that fires more often than the PICTURE does will drive the player out of the room.
// don.given fires up to ten times a turn, so it is rate-limited; life.taken is the clock and is
// allowed to escalate.
(function (NS) {
  'use strict';

  var ctx = null, master = null, musicGain = null, sfxGain = null;
  var muted = false, started = false, seen = 0, lastAt = {};
  var scheduler = null, nextNote = 0, step = 0;

  try { muted = localStorage.getItem('op.muted') === '1'; } catch (e) { muted = false; }

  function ensure() {
    if (muted) return null;                       // a muted reload creates no context at all
    if (ctx) return ctx;
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
    return ctx;
  }

  function resume() {
    var c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume();      // refusal is "wait", not an error
    if (!started) { started = true; startScore(); }
  }

  // ---------------------------------------------------------------------------------------
  // The synth kit
  // ---------------------------------------------------------------------------------------
  function tone(opts) {
    var c = ensure(); if (!c) return;
    var t = c.currentTime + (opts.delay || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(opts.f0, t);
    if (opts.f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.f1), t + opts.dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain || 0.3, t + (opts.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    o.connect(g); g.connect(opts.bus === 'music' ? musicGain : sfxGain);
    o.start(t); o.stop(t + opts.dur + 0.02);
  }

  function noise(opts) {
    var c = ensure(); if (!c) return;
    var t = c.currentTime + (opts.delay || 0);
    var len = Math.floor(c.sampleRate * opts.dur);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = opts.filter || 'bandpass';
    f.frequency.value = opts.freq || 1200; f.Q.value = opts.q || 1;
    var g = c.createGain(); g.gain.value = opts.gain || 0.25;
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  // ---------------------------------------------------------------------------------------
  // The tag table. A tag with no voice is ignored — that is the whole point of riding the log.
  // ---------------------------------------------------------------------------------------
  var VOICE = {
    'card.played':   function () { noise({ dur: 0.16, freq: 2200, gain: 0.16, filter: 'highpass' }); },
    'stage.played':  function () { tone({ f0: 180, f1: 260, dur: 0.3, type: 'triangle', gain: 0.22 }); },
    'event.played':  function () { tone({ f0: 520, f1: 900, dur: 0.22, type: 'triangle', gain: 0.2 }); },
    'card.drawn':    function () { noise({ dur: 0.1, freq: 3000, gain: 0.1, filter: 'highpass' }); },
    'don.given':     function () { tone({ f0: 640, f1: 880, dur: 0.1, type: 'square', gain: 0.1 }); },
    'battle.declared': function () {
      tone({ f0: 320, f1: 140, dur: 0.22, type: 'sawtooth', gain: 0.24 });
      noise({ dur: 0.18, freq: 900, gain: 0.16 });
    },
    'battle.blocked': function () {
      tone({ f0: 240, f1: 200, dur: 0.14, type: 'square', gain: 0.22 });
      noise({ dur: 0.12, freq: 600, gain: 0.2, filter: 'lowpass' });
    },
    // A parry: a bright metallic hit with a fast second strike under it.
    'counter.played': function () {
      tone({ f0: 1750, f1: 1150, dur: 0.16, type: 'triangle', gain: 0.3 });
      tone({ f0: 2600, f1: 1900, dur: 0.1, type: 'sine', gain: 0.18, delay: 0.02 });
      noise({ dur: 0.1, freq: 5200, gain: 0.16, filter: 'highpass' });
    },
    'counterEvent.played': function () { VOICE['counter.played'](); },
    'char.ko': function () {
      tone({ f0: 220, f1: 60, dur: 0.4, type: 'sawtooth', gain: 0.26 });
      noise({ dur: 0.3, freq: 420, gain: 0.22, filter: 'lowpass' });
    },
    // The clock. It escalates as Life runs down, the way project 5's convoy tick did.
    'life.taken': function (e) {
      var left = e.data.left === undefined ? 3 : e.data.left;
      var urgency = Math.max(0, 5 - left);
      tone({ f0: 150 + urgency * 26, f1: 70, dur: 0.5 + urgency * 0.06, type: 'sine',
             gain: 0.3 + urgency * 0.04 });
      noise({ dur: 0.35, freq: 260 + urgency * 60, gain: 0.2, filter: 'lowpass' });
      if (left <= 1) tone({ f0: 1200, f1: 400, dur: 0.6, type: 'sine', gain: 0.16, delay: 0.1 });
    },
    'life.banished': function (e) { VOICE['life.taken'](e); },
    'trigger.used': function () {
      tone({ f0: 900, f1: 1800, dur: 0.24, type: 'triangle', gain: 0.26 });
      tone({ f0: 1350, f1: 2400, dur: 0.2, type: 'sine', gain: 0.16, delay: 0.06 });
    },
    'game.over': function (e) {
      var win = e.data.winner === (NS.ui ? NS.ui.you : 0);
      [0, 0.16, 0.34].forEach(function (d, i) {
        tone({ f0: win ? [392, 523, 659][i] : [330, 262, 196][i], dur: 0.6,
               type: 'triangle', gain: 0.3, delay: d, bus: 'music' });
      });
    }
  };

  // Rate limits, in ms, for tags that fire far more often than the picture changes.
  var LIMIT = { 'don.given': 110, 'card.drawn': 90, 'power.mod': 160 };

  function play(e) {
    if (muted) return;
    var v = VOICE[e.tag];
    if (!v) return;
    var lim = LIMIT[e.tag];
    if (lim) {
      var now = Date.now();
      if (lastAt[e.tag] && now - lastAt[e.tag] < lim) return;
      lastAt[e.tag] = now;
    }
    try { v(e); } catch (err) { /* a sound must never break a game */ }
  }

  // Called with every new state; voices only what is NEW since the last call.
  function follow(s) {
    if (!s || !s.log) return;
    if (s.log.length < seen) seen = 0;                 // a new game
    for (var i = seen; i < s.log.length; i++) play(s.log[i]);
    seen = s.log.length;
  }

  // ---------------------------------------------------------------------------------------
  // The original score. A lookahead scheduler on the AUDIO clock, a chord pad and a pulse layer
  // on a minor pentatonic, so a derived sequence cannot land on a wrong note.
  // ---------------------------------------------------------------------------------------
  var PENT = [0, 3, 5, 7, 10];                         // minor pentatonic
  var ROOT = 146.83;                                   // D3
  var CHORDS = [[0, 3, 7], [0, 3, 7], [5, 8, 12], [-2, 3, 7]];
  var BPM = 78, LOOKAHEAD = 0.2;

  function hz(semi) { return ROOT * Math.pow(2, semi / 12); }

  function startScore() {
    var c = ensure(); if (!c || scheduler) return;
    nextNote = c.currentTime + 0.1;
    scheduler = setInterval(function () {
      if (muted || !ctx) return;
      var spb = 60 / BPM / 2;
      while (nextNote < ctx.currentTime + LOOKAHEAD) {
        schedule(step, nextNote);
        nextNote += spb;
        step++;
      }
    }, 60);
  }

  function schedule(i, when) {
    var c = ctx; if (!c) return;
    var bar = Math.floor(i / 8) % CHORDS.length;
    var chord = CHORDS[bar];
    if (i % 8 === 0) {
      chord.forEach(function (semi, k) {
        pad(hz(semi), when, 2.4, 0.055 - k * 0.008);
      });
    }
    // A pulse on the pentatonic, so any derived sequence is consonant by construction.
    if (i % 2 === 0) {
      var deg = PENT[(i * 3 + bar * 2) % PENT.length] + (i % 16 < 8 ? 12 : 19);
      pluck(hz(deg + chord[0]), when, 0.34, 0.05);
    }
  }

  function pad(f, when, dur, gain) {
    var c = ctx;
    var o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.value = 760;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(lp); lp.connect(g); g.connect(musicGain);
    o.start(when); o.stop(when + dur + 0.05);
  }

  function pluck(f, when, dur, gain) {
    var c = ctx;
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(musicGain);
    o.start(when); o.stop(when + dur + 0.02);
  }

  function setMuted(v) {
    muted = !!v;
    try { localStorage.setItem('op.muted', muted ? '1' : '0'); } catch (e) {}
    if (muted) {
      if (scheduler) { clearInterval(scheduler); scheduler = null; }
      if (ctx) { ctx.close(); ctx = null; started = false; }
    } else { resume(); }
    return muted;
  }
  function isMuted() { return muted; }

  NS.audio = { follow: follow, resume: resume, setMuted: setMuted, isMuted: isMuted,
               play: play, VOICE: VOICE };
}(window.OP = window.OP || {}));
