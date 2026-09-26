# TODO

**Wanted improvements to things that already work.** Not bugs — a rule the engine gets wrong
goes in `DEVIATIONS.md`, a card that misbehaves goes in `data/defects.js`, a decision goes in
`PLAN.md`.

Ordered by what a player would notice first.

---

## Interface

- [ ] **An animation layer.** The board rebuilds from scratch every frame, which is exactly what
      FLIP wants. Four projects in this series put it off and project 5 found it took about an
      hour. Force a synchronous layout read rather than waiting on `requestAnimationFrame`,
      which does not fire in a background tab and will strand an animation whose end state is
      set in its callback.
- [ ] **Drag to commit.** Tap currently inspects and a menu commits. `CARD-PRESENTATION-SPEC.md`
      §10's drag-to-commit is the better feel and the spec has the mechanics.
- [ ] **An attack arrow**, so aiming and resolution are the same picture
      (`CARD-LOG-AND-TARGETING-SPEC.md` §14).
- [ ] **A "recently played" strip.** The log scrolls away; a durable row of the last few cards
      is what players actually look at (`CARD-LOG-AND-TARGETING-SPEC.md` §7).
- [ ] **Show the DON!! cost area as real cards** rather than chips, so giving DON!! reads as a
      physical action.
- [ ] **A concede button.** CR 1-2-3 allows it at any point and there is nowhere to click.

## Content

- [ ] **Raise compiler coverage.** 32.6% of the set compiles. The remaining shapes are counted
      by `tools/build-abilities.mjs` on every run, largest first — that list is the work queue.
      Every point of coverage turns filler slots in a meta deck into the measured list.
- [ ] **A deck builder**, so a deck is not limited to the twelve registered ones.
- [ ] **Import full decklists** if a source that publishes complete 50-card lists becomes
      readable; onepiece.gg's deck browser is behind a bot check that this project will not try
      to defeat (see `docs/rights.md`).

## Engine

- [ ] Close the entries in `DEVIATIONS.md`, D-1 first — replacement effects are the largest
      missing family.
- [ ] **An `--explain <cardId>` flag on `tools/build-abilities.mjs`.** Debugging a compile
      failure currently means adding a print statement.

## Measurement

- [ ] **Sweep the AI's evaluator weights.** Only `charCount` and `blocker` have been swept, and
      only over sixteen seeds. Record the neighbours, not just the winner.
- [ ] **Measure how often a human's Counter Step decision changes the outcome.** If it rarely
      does, the prompt is interrupting for nothing and should auto-skip more aggressively.
