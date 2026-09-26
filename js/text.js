// js/text.js — the describer. Writes an ability out in the project's own words from the
// compiled grammar, never from the printed text.
//
// It has two jobs and they are both important:
//   1. It is the FALLBACK face under the 'original' name pack and after a Level 1 takedown, so
//      the game stays readable with data/printed.js emptied (docs/takedown.md).
//   2. It is the AUDITOR. tools/audit-cards.mjs diffs what this writes against what Bandai
//      printed, and a clause the grammar silently dropped shows up as a difference. A test
//      cannot see that, because both sides of a test come from the same ability data.
(function (NS) {
  'use strict';

  var TIMING = {
    onPlay: '[On Play]', whenAttacking: '[When Attacking]', onBlock: '[On Block]',
    onKO: '[On K.O.]', endOfYourTurn: '[End of Your Turn]',
    endOfOpponentTurn: "[End of Your Opponent's Turn]",
    activateMain: '[Activate: Main]', main: '[Main]', counter: '[Counter]',
    trigger: '[Trigger]', onOpponentAttack: "[On Your Opponent's Attack]",
    whenAttacked: '[When Attacked]', endOfBattle: '', static: '',
    endOfYourTurn: '[End of Your Turn]', whenAttacking: '[When Attacking]',
    onBlock: '[On Block]', main: '[Main]', counter: '[Counter]',
    onOpponentAttack: "[On Your Opponent's Attack]"
  };

  var CONDS = {
    donAtLeast: function (c) { return '[DON!! x' + c.n + ']'; },
    yourTurn: function () { return '[Your Turn]'; },
    opponentTurn: function () { return "[Opponent's Turn]"; },
    charCountAtLeast: function (c) { return 'If you have ' + c.n + ' or more Characters,'; },
    oppCharCountAtLeast: function (c) { return 'If your opponent has ' + c.n + ' or more Characters,'; },
    lifeAtMost: function (c) { return 'If you have ' + c.n + ' or less Life cards,'; },
    oppLifeAtMost: function (c) { return 'If your opponent has ' + c.n + ' or less Life cards,'; },
    selfRested: function () { return 'If this Character is rested,'; },
    oppAttrIs: function (c) { return "If your opponent's Leader has the <" + c.attr + '> attribute,'; },
    leaderType: function (c) { return 'If your Leader has the {' + c.type + '} type,'; },
    donOnFieldAtLeast: function (c) { return 'If you have ' + c.n + ' or more DON!! cards on your field,'; },
    battled: function (c) { return 'If this Character battles your opponent’s ' + (c.what === 'leader' ? 'Leader' : 'Character') + ','; },
    lifeAtLeast: function (c) { return 'If you have ' + c.n + ' or more Life cards,'; },
    haveCharCostAtLeast: function (c) { return 'If there is a Character with a cost of ' + c.n + ' or more,'; },
    haveCharBasePowerAtLeast: function (c) { return 'If you have a Character with ' + c.n + ' base power or more,'; },
    turnAtLeast: function (c) { return 'If it is turn ' + c.n + ' or later,'; }
  };

  var COSTS = {
    restDon: function (c) { return 'rest ' + c.n + ' DON!! card' + (c.n === 1 ? '' : 's'); },
    trashHand: function (c) { return 'trash ' + c.n + ' card' + (c.n === 1 ? '' : 's') + ' from your hand'; },
    restSelf: function () { return 'rest this card'; },
    donMinus: function (c) { return 'DON!! −' + c.n; },
    restOwn: function (c) { return 'rest ' + c.n + ' of your cards'; }
  };

  function describeCond(c) {
    var f = CONDS[c.k];
    if (!f) throw new Error('text: no prose for condition "' + c.k + '"');
    return f(c);
  }

  function describeCost(c) {
    var f = COSTS[c.k];
    if (!f) throw new Error('text: no prose for cost "' + c.k + '"');
    return f(c);
  }

  function describeAbility(ab) {
    var head = [];
    var tag = TIMING[ab.when];
    if (tag === undefined) throw new Error('text: no prose for timing "' + ab.when + '"');

    // Bracket conditions lead, in the printed order: [DON!! xN] [Your Turn] then the timing.
    (ab.conds || []).forEach(function (c) {
      var p = describeCond(c);
      if (p.charAt(0) === '[') head.push(p);
    });
    if (tag) head.push(tag);
    if (ab.once) head.push('[Once Per Turn]');

    var lead = head.join(' ');
    var sentence = [];
    (ab.conds || []).forEach(function (c) {
      var p = describeCond(c);
      if (p.charAt(0) !== '[') sentence.push(p);
    });

    var costs = (ab.cost || []).map(describeCost);
    var body = (ab.ops || []).map(function (o) { return NS.ops.describe(o); }).join('. Then, ');
    if (!body) body = 'nothing happens';

    var tail = costs.length
      ? (ab.optional ? 'You may ' : '') + costs.join(' and ') + ': ' + body
      : body;

    return (lead + ' ' + sentence.join(' ') + ' ' + tail).replace(/\s+/g, ' ').trim() + '.';
  }

  function describeCard(card) {
    var out = [];
    (card.keywords || []).forEach(function (k) { out.push('[' + NS.names.keyword(k) + ']'); });
    (card.abilities || []).forEach(function (ab) {
      if (ab.when === 'trigger') return;                 // the trigger box is rendered separately
      out.push(describeAbility(ab));
    });
    return out.join('\n');
  }

  function describeTrigger(card) {
    var t = (card.abilities || []).filter(function (a) { return a.when === 'trigger'; });
    if (!t.length) return '';
    return '[Trigger] ' + t.map(function (ab) {
      return (ab.ops || []).map(function (o) { return NS.ops.describe(o); }).join('. Then, ') + '.';
    }).join(' ');
  }

  // Exposed so ops.js can render a condition that guards a nested clause (D.ifThen).
  function condPhrase(c) {
    var p = describeCond(c);
    return p.charAt(0) === '[' ? 'While ' + p : p;
  }

  NS.text = { describeCard: describeCard, describeTrigger: describeTrigger, condPhrase: condPhrase,
              describeAbility: describeAbility };
}(window.OP = window.OP || {}));
