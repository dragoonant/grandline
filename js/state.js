// js/state.js — the state shape and every read of it. Nothing outside this file computes a
// power value or decides what is in play. Section numbers are Bandai's Comprehensive Rules
// v1.2.1 (2026-08-28); see docs/rules.md.
(function (NS) {
  'use strict';

  var COLORS = ['Red', 'Green', 'Blue', 'Purple', 'Black', 'Yellow'];          // CR 2-3-3
  var ATTRS = ['Slash', 'Strike', 'Ranged', 'Special', 'Wisdom', '?'];         // CR 2-5-2
  var PHASES = ['refresh', 'draw', 'don', 'main', 'end'];                      // CR 6-1-1
  var MAX_CHARS = 5;                                                           // CR 3-7-6
  var MAX_STAGE = 1;                                                           // CR 3-8-5
  var DECK_SIZE = 50;                                                          // CR 5-1-2
  var DON_DECK = 10;                                                           // CR 5-1-2
  var MAX_COPIES = 4;                                                          // CR 2-14-2 / 5-1-2-3

  function newPlayer(leaderId) {
    return {
      leaderId: leaderId,
      leader: unit('L', leaderId),
      chars: [],
      stage: null,
      hand: [],
      deck: [],
      trash: [],
      life: [],          // index 0 is the TOP of the Life stack — taken first (CR 3-10-2)
      donDeck: DON_DECK, // CR 3-3
      donActive: 0,      // active DON!! in the cost area (CR 3-9)
      donRested: 0,      // rested DON!! in the cost area
      redrew: false
    };
  }

  var _uid = 0;
  function unit(kind, cardId) {
    return {
      uid: kind + (++_uid),
      id: cardId,
      rested: false,       // CR 4-4-1
      don: 0,              // DON!! cards given to this card (CR 6-5-5-1)
      mods: [],            // {stat:'power', n, until:'turn'|'battle'|'opponentEndPhase', src}
      keywords: [],        // keywords granted by effect, on top of the printed ones
      playedOn: -1,        // turn number it entered the Character area (CR 3-7-4)
      onceUsed: {}         // [Once Per Turn] markers (CR 10-2-13)
    };
  }
  function resetUid(n) { _uid = n || 0; }

  // ---------------------------------------------------------------------------------------
  // Card lookup. js/cards.js owns the registry; this is the only reader.
  // ---------------------------------------------------------------------------------------
  function card(id) { return NS.cards.get(id); }

  // ---------------------------------------------------------------------------------------
  // Zones
  // ---------------------------------------------------------------------------------------
  function seatOf(s, uid) {
    for (var i = 0; i < 2; i++) {
      if (s.players[i].leader.uid === uid) return i;
      if (s.players[i].stage && s.players[i].stage.uid === uid) return i;
      for (var j = 0; j < s.players[i].chars.length; j++) {
        if (s.players[i].chars[j].uid === uid) return i;
      }
    }
    return -1;
  }

  function findUnit(s, uid) {
    for (var i = 0; i < 2; i++) {
      var p = s.players[i];
      if (p.leader.uid === uid) return p.leader;
      if (p.stage && p.stage.uid === uid) return p.stage;
      for (var j = 0; j < p.chars.length; j++) if (p.chars[j].uid === uid) return p.chars[j];
    }
    return null;
  }

  function isLeader(s, u) { return s.players[0].leader.uid === u.uid || s.players[1].leader.uid === u.uid; }

  // Every Leader and Character on the field, both seats. CR 3-1-2 "the field".
  function allUnits(s) {
    var out = [];
    for (var i = 0; i < 2; i++) {
      out.push(s.players[i].leader);
      out = out.concat(s.players[i].chars);
    }
    return out;
  }

  // ---------------------------------------------------------------------------------------
  // THE ONE POWER DOOR — CR 2-6, 6-5-5-2. Nothing else adds up a power value.
  // tools/check-pages.mjs greps for `.power +` outside this file.
  // ---------------------------------------------------------------------------------------
  function power(s, u) {
    var c = card(u.id);
    var n = c.power === null ? 0 : c.power;

    // CR 6-5-5-2: a Leader or Character gains 1000 power for each DON!! given to it, DURING
    // YOUR TURN. Outside your turn the attached DON!! is still there and still counts for a
    // [DON!! xN] condition (CR 8-3-2-3) but grants no power.
    var owner = seatOf(s, u.uid);
    if (owner === s.active) n += u.don * 1000;

    for (var i = 0; i < u.mods.length; i++) {
      if (u.mods[i].stat === 'power') n += u.mods[i].n;
    }
    // CR 8-1-3-3 — permanent effects are recomputed, never stored. js/statics.js guards its own
    // re-entrancy, so this call is a no-op while a static is already being evaluated.
    n += NS.statics.power(s, u);
    // CR 1-3-6-1: power may go negative and the card is not trashed for it.
    return n;
  }

  // CR 2-10: a Character card's Counter value, used from hand in the Counter Step.
  function counterValue(id) {
    var c = card(id);
    return c.counter === null ? 0 : c.counter;
  }

  function hasKeyword(s, u, kw) {
    var c = card(u.id);
    if (c.keywords && c.keywords.indexOf(kw) >= 0) return true;   // printed
    if (u.keywords.indexOf(kw) >= 0) return true;                 // granted by a one-shot
    return NS.statics.grants(s, u, kw);                           // granted by a permanent effect
  }

  function colorsOf(id) { return card(id).color; }
  function typesOf(id) { return card(id).types; }

  // ---------------------------------------------------------------------------------------
  // Deck construction — CR 5-1-2. The cheapest fidelity check in the game, so it runs at load
  // time and again when a deck is registered.
  // ---------------------------------------------------------------------------------------
  function checkDeck(leaderId, list) {
    var errs = [];
    var lead = card(leaderId);
    if (!lead) return ['leader ' + leaderId + ' is not a known card'];
    if (lead.category !== 'LEADER') errs.push(leaderId + ' is not a Leader card');
    if (list.length !== DECK_SIZE) errs.push('deck has ' + list.length + ' cards, must be ' + DECK_SIZE + ' (CR 5-1-2)');

    var counts = {};
    list.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    Object.keys(counts).forEach(function (id) {
      var c = card(id);
      if (!c) { errs.push(id + ' is not a known card'); return; }
      if (c.category === 'LEADER') errs.push(id + ' is a Leader and cannot be in the deck (CR 5-1-2-1)');
      if (counts[id] > MAX_COPIES) errs.push(counts[id] + 'x ' + id + ' exceeds 4 of one card number (CR 5-1-2-3)');
      // CR 5-1-2-2 — only cards sharing a colour with the Leader may be in the deck.
      var shared = c.color.some(function (col) { return lead.color.indexOf(col) >= 0; });
      if (!shared) errs.push(id + ' (' + c.color.join('/') + ') shares no colour with ' + leaderId + ' (' + lead.color.join('/') + ') (CR 5-1-2-2)');
    });
    return errs;
  }

  NS.state = {
    COLORS: COLORS, ATTRS: ATTRS, PHASES: PHASES,
    MAX_CHARS: MAX_CHARS, MAX_STAGE: MAX_STAGE,
    DECK_SIZE: DECK_SIZE, DON_DECK: DON_DECK, MAX_COPIES: MAX_COPIES,
    newPlayer: newPlayer, unit: unit, resetUid: resetUid,
    card: card, seatOf: seatOf, findUnit: findUnit, isLeader: isLeader, allUnits: allUnits,
    power: power, counterValue: counterValue, hasKeyword: hasKeyword,
    colorsOf: colorsOf, typesOf: typesOf, checkDeck: checkDeck
  };
}(window.OP = window.OP || {}));
