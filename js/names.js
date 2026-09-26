// js/names.js — every player-visible word, read at RENDER time.
//
// PLAN.md D1: real names are the default. Flipping NAME_PACK to 'original' renames the entire
// game — cards, log lines, prompts and keyword help — because nothing anywhere holds a themed
// string of its own. docs/takedown.md Level 2 is that one edit.
(function (NS) {
  'use strict';

  var NAME_PACK = 'characters';

  // Rules vocabulary. These are the game's own words for its parts and they do not change with
  // the name pack — they are rules terms, not character names.
  var TERMS = {
    leader: 'Leader', character: 'Character', event: 'Event', stage: 'Stage',
    don: 'DON!!', life: 'Life', trash: 'Trash', deck: 'Deck', hand: 'Hand',
    costArea: 'Cost Area', characterArea: 'Character Area',
    active: 'Active', rested: 'Rested', power: 'Power', counter: 'Counter', cost: 'Cost',
    refresh: 'Refresh Phase', draw: 'Draw Phase', donPhase: 'DON!! Phase',
    main: 'Main Phase', end: 'End Phase',
    attackStep: 'Attack Step', blockStep: 'Block Step',
    counterStep: 'Counter Step', damageStep: 'Damage Step'
  };

  var KEYWORDS = {
    blocker: 'Blocker', rush: 'Rush', rushCharacter: 'Rush: Character',
    doubleAttack: 'Double Attack', banish: 'Banish', unblockable: 'Unblockable',
    trigger: 'Trigger', counter: 'Counter'
  };

  var KEYWORD_HELP = {
    blocker: 'After your opponent declares an attack, you may rest this card to make it the new target of the attack.',
    rush: 'This card can attack on the turn in which it is played.',
    rushCharacter: "This card can attack your opponent's Characters on the turn in which it is played.",
    doubleAttack: "When this card's attack deals damage to a Leader, it deals 2 damage instead of 1.",
    banish: "When this card's attack deals damage to a Leader, the Life card is trashed instead of going to hand, and its [Trigger] does not activate.",
    unblockable: 'Your opponent cannot activate [Blocker] against this card.',
    trigger: 'When this card is taken as damage from your Life area, you may reveal it and activate this effect instead of adding it to your hand.',
    counter: 'This can be used from your hand during your opponent’s Counter Step.'
  };

  var COLOR_HEX = {
    Red: '#d0362f', Green: '#2f8f5b', Blue: '#2a6fb5',
    Purple: '#7a4aa8', Black: '#3a3a42', Yellow: '#d6a520'
  };

  // The original pack. Used by docs/takedown.md Level 2 and by nothing else. A card with no
  // entry falls back to a rules-shaped description of itself, never to the real name.
  var ORIGINAL = {
    prefix: 'Crew',
    rename: function (card) {
      var role = card.category === 'LEADER' ? 'Captain'
        : card.category === 'EVENT' ? 'Manoeuvre'
        : card.category === 'STAGE' ? 'Berth' : 'Crewmate';
      var col = (card.color[0] || 'Grey');
      return col + ' ' + role + ' ' + card.id.split('-')[1];
    }
  };

  function cardName(card) {
    return NAME_PACK === 'characters' ? card.name : ORIGINAL.rename(card);
  }

  // Printed text is shown verbatim under the 'characters' pack (PLAN.md D1). Under the
  // 'original' pack the face falls back to js/text.js, which writes the ability data out in the
  // project's own words and reproduces nothing.
  function cardText(card) {
    if (NAME_PACK === 'characters') return card.text || '';
    return NS.text.describeCard(card);
  }

  function cardTrigger(card) {
    if (NAME_PACK === 'characters') return card.triggerText || '';
    return NS.text.describeTrigger(card);
  }

  function keyword(k) {
    var v = KEYWORDS[k];
    if (!v) throw new Error('names.keyword: no name for keyword "' + k + '"');
    return v;
  }

  function help(k) { return KEYWORD_HELP[k] || ''; }
  function term(k) {
    var v = TERMS[k];
    if (!v) throw new Error('names.term: no term for "' + k + '"');
    return v;
  }
  function colorHex(c) { return COLOR_HEX[c] || '#666'; }
  function pack() { return NAME_PACK; }

  NS.names = { cardName: cardName, cardText: cardText, cardTrigger: cardTrigger,
               keyword: keyword, help: help, term: term, colorHex: colorHex, pack: pack,
               KEYWORDS: KEYWORDS, TERMS: TERMS, COLOR_HEX: COLOR_HEX };
}(window.OP = window.OP || {}));
