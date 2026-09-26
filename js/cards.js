// js/cards.js — the card registry. One card object per card number, made by merging the
// printed pack (data/printed.js) with the compiled grammar (data/abilities.js).
//
// CLAUDE.md hard rule 11: no silent fallbacks. Both packs must be on the page; a missing one
// throws on the first frame rather than degrading to a game with no card text.
(function (NS) {
  'use strict';

  var index = null;

  function build() {
    if (!NS.printed) throw new Error('cards: data/printed.js is not on the page (hard rule 11)');
    if (!NS.abilities) throw new Error('cards: data/abilities.js is not on the page (hard rule 11)');

    index = Object.create(null);
    for (var i = 0; i < NS.printed.length; i++) {
      var p = NS.printed[i];
      var a = NS.abilities[p.id];
      if (!a) throw new Error('cards: ' + p.id + ' has printed text but no compiled entry');
      var c = {
        id: p.id, name: p.name, category: p.category, rarity: p.rarity,
        cost: p.cost, power: p.power, counter: p.counter, life: p.life,
        color: p.color, attribute: p.attribute, types: p.types,
        text: p.text, triggerText: p.trigger, set: p.set, arts: p.arts,
        keywords: a.keywords || [],
        abilities: a.abilities || [],
        unimplemented: a.unimplemented || null
      };
      // Hard rule 7: validation rejects an op with no handler, at load, not at play.
      for (var j = 0; j < c.abilities.length; j++) {
        var ops = c.abilities[j].ops;
        for (var k = 0; k < ops.length; k++) {
          if (!NS.ops.known(ops[k].k)) {
            throw new Error('cards: ' + c.id + ' uses op "' + ops[k].k + '" with no handler');
          }
        }
      }
      index[p.id] = c;
    }
    return index;
  }

  function get(id) {
    if (!index) build();
    var c = index[id];
    if (!c) throw new Error('cards.get: unknown card "' + id + '"');
    return c;
  }

  function has(id) { if (!index) build(); return !!index[id]; }
  function all() { if (!index) build(); return Object.keys(index).map(function (k) { return index[k]; }); }

  // A card is playable only if the grammar can express all of it AND it is not in the defects
  // register. data/defects.js is wired here so a broken card cannot reach the player
  // (CLAUDE.md regime 6).
  function playable(id) {
    var c = get(id);
    if (c.unimplemented) return false;
    if (NS.defects && NS.defects[id]) return false;
    return true;
  }

  function whyNotPlayable(id) {
    var c = get(id);
    if (NS.defects && NS.defects[id]) return 'defect: ' + NS.defects[id];
    if (c.unimplemented) return 'unimplemented: ' + c.unimplemented;
    return null;
  }

  NS.cards = { get: get, has: has, all: all, build: build, playable: playable,
               whyNotPlayable: whyNotPlayable };
}(window.OP = window.OP || {}));
