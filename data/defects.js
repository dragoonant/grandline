// data/defects.js — content that does not behave as it reads.
//
// This register is WIRED INTO THE DECK PICKER: a card listed here cannot reach the player, and
// deleting its entry is the whole of putting it back. Empty is the goal state.
//
// It is NOT the other registers. Rules the engine does not keep go in DEVIATIONS.md; wanted
// improvements go in TODO.md; project decisions go in PLAN.md.
//
//   'OP01-016': 'the [On Play] draws before the cost is paid, so an empty deck loses the game'
(function (NS) {
  'use strict';
  NS.defects = {};
}(window.OP = window.OP || {}));
