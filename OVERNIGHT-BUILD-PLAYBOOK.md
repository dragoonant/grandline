# The overnight build playbook

**How to hand an agent a game at bedtime and have something you can actually play in the
morning.** Written at Anthony's request after the RIVALFORGE overnight run (2026-09-23), which
produced a playable card game with art, sound, an AI and four balanced decks in one session.

This is a **process** document. `CARD-GAME-LESSONS.md` through `-4.md` are about *card games*.
This one is about *the method*, and it applies to any project of the shape "build me something
playable while I sleep". Copy it into every future repo.

---

## 0. The one-sentence version

**Front-load the decisions that only you can make, order the work so every stage ends in
something that runs, make every convention a tool that fails the build, and measure instead of
arguing.** Everything below is detail on those four.

---

## 1. The question round is the highest-leverage twenty minutes

The overnight run began with two batches of questions and nothing else. That is what made the
rest of it unsupervised-able.

**The test for whether a question is worth asking:** *would a wrong guess cost rework, or just
a different-but-fine outcome?* Only the first kind goes to the owner. Everything else gets
decided and **stated as a default so it can be corrected in one word**.

Asked (each one would have caused rework):

- Real names or an original theme — touches every data file and the entire IP posture.
- Which objective mode — determines the whole engine shape.
- How much real money may be spent — cannot be undone.
- Board size — control maths, AI search, UI layout all hang off it.
- Art direction — 59 renders are one decision, and regenerating is paying twice.
- Which factions — determines what gets authored.

Not asked, decided, and listed as defaults in the reply: deck size, card counts, turn structure,
respawn timing, economy shape, test framework, file layout, commit cadence, deployment.

**Two batches, not one.** The first round's answers changed what the second round should ask.
Four questions is about the limit before the owner starts answering carelessly.

**Then write the defaults down in the reply, in a list, before starting.** The owner reads six
lines and either says "go" or corrects one. That is a thirty-second review of an eight-hour run.

### The anti-pattern

Asking questions with obvious answers ("should I write tests?"), asking for permission to
proceed, or asking anything you could determine by reading the repo. Every one of those wastes
the owner's last minutes before sleep and buys nothing.

---

## 2. Order the work so every stage ends in something that runs

Not "engine, then content, then UI, then art" — that gives you nothing until the very end, and
if the night runs short you have nothing at all.

The order that worked:

```
.gitignore alone
  -> rights/licence findings recorded
  -> CLAUDE.md with the regime decisions
  -> the RULEBOOK (authority doc), before any content
  -> engine spine + one test suite
  -> content pack
  -> AI + measurement harness
  -> INTERFACE (now it is playable — this is the milestone that matters)
  -> art
  -> sound
  -> registers, handoff docs
```

**Every arrow is a commit, and every commit leaves the thing runnable.** If the session dies at
any arrow, the owner still has something.

**Hedge the scope bet explicitly.** The brief was four decks; the safe milestone was two. The
reply said: *"two decks playable first, then the other two, so a short night ends in a finished
two-deck game rather than four half-authored ones."* Say which half you would cut, before you
start.

---

## 3. Write the authority document before the content

For a game that does not exist yet, **the rulebook is written first and the cards are written
against it.** `docs/rules.md` — 14 numbered sections — existed before a single card.

Why it pays:

- 56 cards got authored in one pass with no contradictions, because there was one place to look.
- The engine cites section numbers in comments (`// rules.md §8.4`), so a future reader can find
  the reason for any line.
- When a rule turned out to be wrong, **the rulebook was edited first and the engine second**,
  which keeps them from drifting.
- Numbered sections make test names meaningful: `test('rules §7.1: a Vanguard counts double')`.

**The same trick works for anything with content**: an API doc before the endpoints, a schema
before the migrations, a style guide before the components.

---

## 4. Every convention becomes a tool that fails the build

A convention in a document is a suggestion. **A convention a tool can check is a rule.**

Built during the run, each one earning its place:

| Tool | What it refuses |
|---|---|
| `test.mjs` | the suite, named by rulebook section |
| `check-pages.mjs` | two entry points loading different files; **greps for every bypass that has actually happened** |
| `stamp-assets.mjs --check` | a stale cache-busting hash |
| `check-art.mjs` | a declared image that is missing, zero-length, truncated, wrong-case or untracked |
| load-time validation | an op with no handler, an op with no describer, a skeleton default, a card whose text would render blank |
| the art-prompt lint | a prompt that breaks a prompt rule — **before** the money is spent |

**The greps are the important part, and the rule is: add a grep the first time a bypass costs an
hour.** On its very first run `check-pages` found two real defects — an op clearing damage
around the damage door, and a themed word hardcoded where the name-pack swap could not reach it.

**Validation that refuses to run beats a test that reports.** The art-prompt lint caught four
real violations on its first execution and refused to write the file. That is four renders not
paid for twice.

---

## 5. Measure instead of arguing — and know what a fake number looks like

Every significant decision in the overnight run has a number attached, and the numbers found
things no amount of reasoning would have.

- **The fuzzer found a design hole, not a crash.** 84 of 96 random games hit the round cap with
  zero combat, because recall was free and unlimited so both sides emptied the board every turn.
  Fixed in the *rulebook* first. Result: 95 of 96 games now end properly.
- **The arena found three balance defects**, including the structural one — removal was material
  rather than tempo, so whoever won the first fight won every later one.
- **Two rounds of stat tuning that moved a deck 0 → 0** is what proved the problem was
  structural rather than numeric. *A fix that changes nothing is information.*
- **The AI defect was found by measuring behaviour, not outcomes**: "what fraction of its turns
  does it take zero actions?" 9%. That is a one-line metric that should have existed from the
  start.

### The three rules for not fooling yourself

1. **Play both seats.** An earlier project's arena reported a clear, stable, entirely fictional
   signal because it was measuring first-player bias. Every pairing runs in both seat orders and
   only **decisive** results — where the same side wins from both seats — count.
2. **Hold changes to a holdout.** A charge-weight change that looked like a clear peak measured
   **exactly 50.0%** head-to-head against the old weights. It was applied anyway, but labelled
   in the code as a *feel* decision and not a strength one.
3. **Record the neighbours, not just the winner.** Every swept constant carries a comment with
   the values that measured *worse in both directions*. That comment is the difference between
   a number and a decision, and it stops the next session re-running the same sweep.

**A negative result is a result and it gets committed.** "This is not stronger, do not re-run
this sweep hoping for strength" is worth more than silence.

---

## 6. Spend money in a sample first

Generation costs real money and the budget was agreed in advance. The pattern:

1. `--dry-run` that makes **zero network calls** and prints the entire plan.
2. **Generate three.** Look at them. Confirm the style is right.
3. Then the batch, with `--limit` available to cap it.
4. **Idempotent by default** — an id that already has its file is skipped and never re-spent.
5. Superseded files go to a gitignored archive; the repo carries delivery encodes only.

Three renders is enough to know whether the style constant is right. Fifty-nine is not the time
to find out.

---

## 7. Verify in the real thing, not just in the suite

**Green tests plus a broken page is the most common failure in this series.** Everything that
mattered on the interface was found by opening a browser:

- The affiliation name overflowed the card face.
- Gear rules text leaked onto hand cards.
- Every card rendered at the body font size, because `em` cascades from font-size and not width.
- **And the big one**: `art/manifest.js` was generated but never added to the page, and the
  loader read `RF.artManifest || {}` — so the page silently drew placeholder art for **59 paid
  renders and said nothing at all.**

That last one is the general lesson and it is worth stating as a rule:

> **A missing dependency must throw on the first frame. A silent fallback is a bug that ships
> verified and green.**

The defensive `|| {}` looked like robustness. It cost an entire art pass, and it was found only
because a human looked at the screen.

**Corollary: a build should be able to report its own broken state.** The art check that lists
every failed image and its resolved URL should have existed on day one, not after a report of
"some of the images were missing".

---

## 8. Commit at checkpoints, and write commit messages that explain mechanisms

**A long autonomous run that ends in a context wall loses everything it has not committed.**
Nine commits, each self-contained and runnable.

The messages describe *the mechanism, by id* — not "fixed AI" but *why* it was broken:

> "`pass` was scored like any other action, but applying it resolves the entire end of round …
> that advance alone is worth a full track node, so `pass` carried a windfall no single action
> could match. Caught in the act: holding the convoy 18–0 with 7 Momentum in hand."

The history reads as a bug diary. **It is the cheapest documentation you will ever write**, and
it is what makes a handoff like this one writable at all.

---

## 9. Four registers, not one

Separate files, each with a header saying it is not the others:

| File | Holds |
|---|---|
| `DEVIATIONS.md` | rules the engine does not yet keep — standing bugs |
| `BALANCE.md` | measured findings, each with its measurement |
| `TODO.md` | wanted improvements to things that already work |
| `data/defects.js` | content that does not behave as it reads — **and it hides itself from the player** |

Conflating them is how a defect register stops being shameful. `defects.js` is the important
one: it is wired into the deck picker, so a broken card **cannot reach the player** — deleting
the entry is the whole of putting it back.

**And one file owns each decision.** `PLAN.md` holds every project decision with a dated Status;
no other file states one, they only point at it. An earlier project shipped three files that
disagreed about its own deployment status. The fix is not "keep them in sync", it is "have one".

---

## 10. What I would do differently next time

Written honestly, because a playbook with no failures in it is marketing.

1. **Declare the asset manifest in the page before generating a single asset.** The wiring
   should exist and fail loudly while it is still empty. This one cost an entire art pass.
2. **Build the self-diagnostic with the feature, not after the bug report.** Anything that can
   silently degrade — images, audio, saved state — needs a screen that says what is broken.
3. **Measure the AI's *behaviour*, not only its win rate.** "Turns where it did nothing: 9%"
   would have caught a defect that shipped to the playtest. Win rate hid it because both sides
   had the same bug.
4. **Do not let a random-play fuzzer stand in for the AI.** The fuzzer proved the engine did not
   crash and said nothing about whether the AI could play. Those are two different harnesses and
   both are needed before a human sees it.
5. **Ask one question about feel, not just about structure.** Every question asked was about
   what to build. None was about how it should *play* — and the first real feedback was "the
   Flank feels worthless", which is a feel answer that a single question could have surfaced
   twelve hours earlier.

---

## 11. The checklist

Print this.

**Before sleep**
- [ ] Ask only the questions where a wrong guess costs rework. Two rounds, ≤4 each.
- [ ] Write every other decision down as a stated default, in a list, in the reply.
- [ ] State the budget for anything that costs money.
- [ ] Say which half of the scope gets cut if the night runs short.
- [ ] Raise any concern **once**, in writing, then build what was asked.

**During**
- [ ] `.gitignore` first, secrets in it, committed alone.
- [ ] Authority document before content.
- [ ] Every stage ends in something that runs; commit at each one.
- [ ] Wire every asset pipeline **empty and failing loudly** before filling it.
- [ ] A grep in the gate the first time a bypass costs an hour.
- [ ] Sample three before buying fifty-nine.
- [ ] Open the actual thing in the actual browser, repeatedly.
- [ ] Measure both seats; report only decisive results; record the neighbours.
- [ ] Commit negative results.

**Before handing back**
- [ ] All gates green, in one command, printing few lines.
- [ ] Dated Status rewritten to what is actually true.
- [ ] Grep the repo for every file restating a decision that moved.
- [ ] Say plainly what was cut, what is unmeasured, and what could not be reproduced.
- [ ] Name the two or three things the owner should form an opinion on first.

---

*The thing that made this work was not speed. It was that the twenty minutes of questions at the
start removed every decision that would have blocked at 3am, and that every convention was a
tool that would fail rather than a paragraph that could be forgotten.*
