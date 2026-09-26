# DEVIATIONS

**Rules the engine does not yet keep — standing bugs against Bandai's Comprehensive Rules
v1.2.1.** This file is not the others: wanted improvements go in `TODO.md`, content that does
not behave as it reads goes in `data/defects.js` (which hides it from the player), and project
decisions go in `PLAN.md`.

Every entry names the rule it breaks. Fixing one means deleting its entry.

---

## D-1 — Replacement effects are not implemented · CR 8-1-3-4

Effects denoted by the word "instead" are not modelled at all. The compiler refuses any card
that prints one, so no such card can reach a registered deck — the rule is *absent*, not
*wrong*. The ordering rules of CR 8-1-3-4-2 (the generating card first, then the turn player,
then the non-turn player) would need to exist before the first such card is admitted.

**Consequence:** a family of real cards is unavailable. Nothing misbehaves.

## D-2 — Infinite loops are not detected · CR 11-1

The rules resolve a loop by asking each player how many iterations they want, and by declaring a
draw when neither can stop it. The engine has no loop detection; `tools/arena.mjs` caps turns
instead, and `js/ai.js` caps actions per turn. No card in a registered deck can currently build
a loop, so this has never fired.

## D-3 — "At the start of the game" Leader effects are not processed · CR 5-2-1-5-1

The setup sequence does not look for them. No Leader in the twelve registered decks prints one,
which is why this has not bitten; admitting a Leader that does would silently skip its effect.

## D-4 — [Once Per Turn] is not re-armed on a failed payment · CR 10-2-13-5

If a player begins paying a `[Once Per Turn]` activation cost and becomes unable to finish, the
rules say the effect may not be activated again that turn. The engine marks the ability used
*before* the cost runs, which gives the same outcome for every card currently in a deck, but is
the right answer for the wrong reason and will diverge if a cost ever fails midway.

## D-5 — The order of cards placed into a secret area is not offered · CR 3-1-7

When several cards go to the bottom of the deck at once, the owner may choose the order. The
engine keeps the order they were seen in. `H.lookAdd` carries the note. This is a real
divergence and it is invisible to the player, which is why it is written down here.

## D-6 — Multiple simultaneous auto effects are not ordered by the player · CR 6-6-1-1-3

When several `[End of Your Turn]` effects resolve together the turn player may choose the order.
The engine resolves them in board order. It matters only when two such effects interact.

---

## Not deviations, recorded so they are not mistaken for one

- **1,876 of 2,785 cards carry `unimplemented`** and are refused from every registered deck.
  That is the gate working as designed (CLAUDE.md hard rule 8), not a rules divergence: the
  engine never does the wrong thing, it declines to offer the card at all. Compiler coverage is
  tracked in `PLAN.md`.
- **Starter-deck quantities are inferred.** Bandai publishes the sixteen cards of an ST product
  and its rarity split but not its per-card counts — checked on the official product page on
  2026-09-26, see `docs/rights.md`. `tools/build-decks.mjs` states the rule it uses instead.
- **Meta-deck filler slots are marked, not hidden.** onepiece.gg's free tier publishes only the
  twelve most-played cards per archetype; every remaining slot is labelled `inferred` and the
  deck screen shows the split.
