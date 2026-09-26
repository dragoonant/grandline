# Rules — a citation index

**This is not a rulebook.** Bandai wrote the rulebook. This file is the index from the engine
into it, so that every rule the engine keeps can be checked against the words that define it.

**Source of truth:** *ONE PIECE CARD GAME Comprehensive Rules, Version 1.2.1, last updated
2026-08-28*, downloaded from `https://en.onepiece-cardgame.com/pdf/rule_comprehensive.pdf` on
2026-09-26 and kept in gitignored `scratch/rules/`. Also there: the official Rule Manual and the
Floor Rules.

**The convention:** every engine rule names the section it implements in a comment — `// CR
7-1-3-1`. That is the single most useful commenting convention in this series, and here the
citations point at a real numbered document rather than a reconstruction.

**When a card and the engine disagree, read the rule and fix the engine. Do not decide.**

---

## Where each rule lives

| Section | What it says | Implemented in |
|---|---|---|
| **1-1-1** | two players only | `PLAN.md` regime; the engine has exactly two seats |
| **1-2-1-1** | the two defeat conditions | `js/engine.js` `checkDefeat` |
| **1-3-6-1** | power may be negative and the card is not trashed for it | `js/state.js` `power` |
| **2-3-3** | the six colours | `js/state.js` `COLORS` |
| **2-5-2** | the six attributes | `js/state.js` `ATTRS` |
| **2-6 / 6-5-5-2** | power, and +1000 per DON!! **during your turn** | `js/state.js` `power` |
| **2-7-2/3/4** | paying a cost rests that many active DON!! | `js/actions.js` `applyMain` |
| **2-9 / 5-2-1-7** | Life comes from the Leader's Life value | `js/actions.js` `startPlay` |
| **2-9-2-1** | the top card of the deck goes to the **bottom** of the Life area | `js/actions.js` `startPlay` |
| **2-10** | the Counter value, used from hand in the Counter Step | `js/engine.js` `counterOptions` |
| **2-14-2 / 5-1-2-3** | at most 4 of one card number | `js/state.js` `checkDeck` |
| **3-7-4** | a card played this turn cannot attack | `js/actions.js` `attackers` |
| **3-7-6-1** | a 6th Character means trashing one first | `js/engine.js` `playCardFree` |
| **3-7-6-1-1** | and that trashing is rule processing, **not** a K.O. | `js/engine.js` `playCardFree` |
| **3-8-5-1** | a new Stage trashes the old one | `js/engine.js` `playCardFree` |
| **3-10-2** | Life is a face-down ordered zone; always take the top | `js/engine.js` `dealLeaderDamage` |
| **4-5** | draw | `js/engine.js` `draw` |
| **4-6** | damage processing | `js/engine.js` `dealLeaderDamage` |
| **5-1-2** | 50 cards, 10 DON!!, colour must match the Leader | `js/state.js` `checkDeck` |
| **5-2-1-6** | draw 5, then each player may redraw once | `js/actions.js` `newGame` |
| **6-1-1** | Refresh, Draw, DON!!, Main, End | `js/engine.js` `beginTurn` / `endTurn` |
| **6-2-3** | given DON!! returns to the cost area, rested | `js/engine.js` `beginTurn` |
| **6-2-4** | everything in your areas stands up | `js/engine.js` `beginTurn` |
| **6-3-1** | the player going first does **not** draw on turn one | `js/engine.js` `beginTurn` |
| **6-4-1** | 2 DON!!, but only 1 for the player going first on turn one | `js/engine.js` `beginTurn` |
| **6-5-2** | the Main Phase actions | `js/actions.js` `mainActions` |
| **6-5-5-1** | giving an active DON!! to a Leader or Character | `js/actions.js` `applyMain` |
| **6-5-5-4** | DON!! on a card that changes area goes back, rested | `js/engine.js` `koUnit`, `js/ops.js` `bounce` |
| **6-5-6-1** | neither player can battle on their first turn | `js/actions.js` `mainActions` |
| **6-6-1-1** | `[End of Your Turn]`, then `[End of Your Opponent's Turn]` | `js/engine.js` `endTurn` |
| **7-1-1** | Attack Step: rest to attack a Leader or a **rested** Character | `js/engine.js` `declareAttack`, `js/actions.js` `targetsFor` |
| **7-1-1-4 / 7-1-2-3 / 7-1-3-1-3** | if either card has left the field, skip to End of Battle | `js/engine.js` `gone` |
| **7-1-2** | Block Step — the defender's window | `js/engine.js` `openBlockStep` |
| **7-1-3** | Counter Step — repeatable, "as many times as they wish" | `js/engine.js` `openCounterStep`, `js/actions.js` |
| **7-1-4-1** | the attacker wins on **greater than or equal** power | `js/engine.js` `damageStep` |
| **7-1-4-1-1-1** | damaged with 0 Life is the loss, not Life reaching 0 | `js/engine.js` `dealLeaderDamage` |
| **7-1-5-2** | "if this … battles" activates at the End of the Battle | `js/engine.js` `endBattle` |
| **8-1-3-1** | auto effects | `js/engine.js` `fireAuto` |
| **8-1-3-3** | permanent effects — recomputed, never stored | `js/statics.js` |
| **8-3-1-5/6** | activation costs, including `DON!! −X` | `js/actions.js` `payCost` |
| **8-3-2-3/4/5** | the `[DON!! xN]`, `[Your Turn]`, `[Opponent's Turn]` conditions | `js/engine.js` `condsMet` |
| **9-2** | defeat judgment | `js/engine.js` `checkDefeat` |
| **10-1-1** | `[Rush]` | `js/actions.js` `attackers` |
| **10-1-2** | `[Double Attack]` | `js/engine.js` `damageStep` |
| **10-1-3** | `[Banish]` — trashed instead of going to hand, and no `[Trigger]` | `js/engine.js` `dealLeaderDamage` |
| **10-1-4** | `[Blocker]` | `js/engine.js` `blockers` |
| **10-1-5** | `[Trigger]` — an optional reveal on damage | `js/engine.js` `dealLeaderDamage`, `js/actions.js` |
| **10-1-5-3** | after a `[Trigger]` resolves, trash that card | `js/actions.js` `applyToHead` |
| **10-1-6** | `[Rush: Character]` — may attack Characters only | `js/actions.js` `targetsFor` |
| **10-1-7** | `[Unblockable]` | `js/engine.js` `blockers` |
| **10-2-1** | K.O. | `js/engine.js` `koUnit` |
| **10-2-13** | `[Once Per Turn]` | `js/engine.js` `fireAuto`, `js/actions.js` |
| **10-2-17** | `[On K.O.]` fires on the field, resolves from the trash | `js/engine.js` `koUnit` |
| **11-3** | looking at a secret area | `js/ops.js` `lookAdd` |

---

## Two facts the card list does not document, verified rather than guessed

Recorded here because a later session will otherwise re-derive them wrongly.

1. **The official card list reuses its "Cost" slot for a Leader's Life.** Only Leaders have Life
   (CR 2-9-3) and only Characters, Events and Stages have cost (CR 2-7-5), so
   `tools/build-printed.mjs` splits the field by category. Checked against OP14-020 (Life 5),
   OP01-002 (Life 4) and OP02-001 (Life 6).
2. **A printed cost of 0 renders as "-" on the list.** The OP04-016 card face shows a 0 in the
   cost circle while the list prints "-", so on a non-Leader "-" is 0 and never "unknown". This
   affected 23 Events, two of which are in meta decks.

## What is NOT implemented

See `DEVIATIONS.md`. The short version: replacement effects (CR 8-1-3-4) and the infinite-loop
procedure (CR 11-1) have no engine support, and any card needing them is marked `unimplemented`
by `tools/build-abilities.mjs` and cannot reach a registered deck.
