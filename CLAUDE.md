# GRAND LINE — ONE PIECE CARD GAME, played against an AI

A browser implementation of Bandai's **ONE PIECE CARD GAME**, 1v1 against a computer opponent.
Sixth in a series; read `CARD-GAME-LESSONS-5.md` first, and `OVERNIGHT-BUILD-PLAYBOOK.md` for
the method. Both live in this repo.

## The regime — decided, not to be re-litigated

**This is a reproduction, and fidelity is the product.** A divergence from printed behaviour is
a defect to fix, never a design choice.

1. **Bandai owns the rules.** `docs/rules.md` is a citation index into the **Comprehensive Rules
   v1.2.1 (2026-08-28)**, in gitignored `scratch/rules/`. Every engine rule names the section it
   implements in a comment: `// CR 7-1-3-1`. When a card and the engine disagree, read the rule
   and fix the engine. Do not decide.
2. **Bandai owns balance.** There is no `BALANCE.md` and there will not be one. Printed numbers
   are never tuned. If a deck is strong it is because it is strong in the real game.
3. **Printed text on the face, verbatim**, from `data/printed.js`. `js/text.js` generates prose
   from ability data and is the *fallback* and the *auditor*, never the face.
4. **Real names are the default.** `js/names.js` carries a `characters` pack and an `original`
   pack behind one constant; every player-visible string is read at render time. Owner's call,
   2026-09-26. See `PLAN.md`.
5. **1v1 only.** The Comprehensive Rules do not support three or more players (CR 1-1-1).
6. **Nothing playable contains content that does not work correctly.** `data/defects.js` is
   wired into the deck picker: a listed card cannot reach the player. Deleting the entry is the
   whole of putting it back.

## The fifteen hard rules

1. **No build step.** Plain browser JS, IIFEs on one `window.OP` namespace, script order
   declared in `index.html`. Runs from `file://` and from `tools/serve.mjs`.
2. **The engine surface is exactly `legalActions(state)` / `apply(state, action)` /
   `isTerminal(state)`**, plus `whoActs(state)`. `apply` deep-copies and returns a new state.
   Never mutate a state in place.
3. **Every UI affordance derives from `legalActions`.** The UI cannot invent a rule.
4. **One resolution queue is the whole control flow.** A pending head owns the turn; only its
   choices are legal; `legalActions` throws on a head that offers nothing.
5. **The reactive window is a queue step whose `ctrl` is the other seat** — Block, Counter and
   Trigger (CR 7-1-2, 7-1-3, 10-1-5). There is no second control-flow mechanism.
6. **Cards are pure data; abilities are data.** New vocabulary goes in extension files wired
   through hook tables, never by editing the core.
7. **New op = handler + describer + test.** Validation rejects an op with no handler; the
   describer throws on an op with no prose.
8. **An ability the grammar cannot express fails authoring loudly** — `{ unimplemented: 'why' }`
   — and validation rejects it from any registered deck.
9. **A default that a real value would replace must fail validation.**
10. **Seeded RNG, and every shuffle happens inside `apply`.** Same seed, same game.
11. **No silent fallbacks.** Neither `if (!NS.x)` nor `NS.x || {}`. A missing dependency throws
    on the first frame. `tools/check-pages.mjs` greps for both forms.
12. **Every choice goes through `OP.offerChoice`**, with `min`/`max` on the target step.
13. **One door per rule**, with a grep in the gate. Add a grep the first time a bypass costs an
    hour.
14. **Two entry points, one script list** (`index.html`, `tests.html`), asserted by
    `tools/check-pages.mjs`.
15. **Verify in the real browser.** Every UI commit message ends with what was checked on the
    real code path. Green tests plus a broken page is this series' most common failure.

## Registers — four files, each saying it is not the others

| File | Holds |
|---|---|
| `DEVIATIONS.md` | rules the engine does not yet keep — standing bugs |
| `TODO.md` | wanted improvements to things that already work |
| `data/defects.js` | content that does not behave as it reads — **and it hides itself from the player** |
| `PLAN.md` | every project decision, with a dated Status. **No other file states a decision; they point at it.** |

## Layout

```
index.html  tests.html      the two entry points, one script list
js/                         engine, UI, AI, audio, art — see PLAN.md
data/printed.js             GENERATED printed card text (tools/build-printed.mjs)
data/cards.js               ability data, authored against the printed text
data/decks.js               the deck registry — decides the pool
data/defects.js             the gate
docs/rules.md               citation index into Bandai's Comprehensive Rules
docs/rights.md              what Bandai publishes, with dates
tools/                      all .mjs, no dependencies
scratch/                    gitignored: the official PDFs, the card scrapes, raw decklists
```

## Before committing a document

`ls` everything it claims exists. On project 5 a document described a tool that had never been
written and it survived two days. That check takes four seconds.
