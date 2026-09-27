# Lessons from GRAND LINE — the sixth card game

Written at the GRAND LINE handoff, 2026-09-26, after one overnight unsupervised run that
produced a playable ONE PIECE CARD GAME against an AI, with twelve decks, 147 original
illustrations and a generated score.

This is the **sixth** document in the series. `CARD-GAME-LESSONS.md` (MegaRobotWar), `-2.md`
(Starbound Legions), `-3.md` (Crystal Wars), `-4.md` (BreachForge) and `-5.md` (RIVALFORGE)
came first, and `OVERNIGHT-BUILD-PLAYBOOK.md` is the method. **Everything in all five still
applies unless this file says otherwise.**

`-5.md` was written *for* this project and it was right about almost everything. This document
is mostly about the handful of things it could not have known, and one class of defect that is
new to the series.

---

# 1. What `-5.md` predicted correctly, so nobody re-argues it

Stated plainly because confirming a prediction is worth as much as finding a surprise.

- **The reactive window is a queue step whose `ctrl` is the other seat, and nothing else was
  needed.** §7.3 said "do not build a second control-flow mechanism" and that was exactly
  right. `whoActs(state)` returned the defender, and the UI, the AI and the replayer all routed
  correctly without knowing anything new. The Counter Step re-offers itself until the defender
  declines, which is `min: 0` plus an explicit decline, as predicted.
- **The AI's horizon asymmetry appeared in the counter step**, exactly where §5.1 said it would.
  Scoring counters against the *same horizon* (roll every candidate forward to the end of the
  battle, and the baseline too) was the fix, and it was needed before the first measurement
  meant anything.
- **The evaluator was blind to a rule and therefore measured itself.** §5.2 again, word for
  word: the arena reported **0 block windows in 32 games** because the weight table had no term
  for `[Blocker]`. Adding one took block windows 0 → 59 and empty AI turns 5.5% → 0.0%. Build
  the two behaviour counters on day one; win rate cannot see either.
- **Bandai's answer to first-player advantage reproduces exactly.** §5.5 said "reproduce
  Bandai's answer and do not invent your own". No draw and one DON!! on turn one (CR 6-3-1,
  6-4-1) landed at **~50% over 32 games in both seats, with zero tuning**. Project 5 had to
  sweep a continuous correction to reach 43.8% on a game it designed itself.
- **The art-prompt lint paid for itself before any money was spent** — see §5 below, where it
  caught the STYLE constant.

---

# 2. The calibration numbers

| | FFTCG (3) | Riftbound (4) | RIVALFORGE (5) | **GRAND LINE (6)** |
|---|---|---|---|---|
| Days / commits | 6 / 71 | 3 / 89 | 2 / 15 | **1 night / 11** |
| Regime | reproduction | reproduction | original design | **reproduction** |
| Printed cards imported | 406 | 264 | n/a | **2,785 (142 Leaders)** |
| Cards the grammar expresses | all authored | all authored | all authored | **32.6%, and the rest is refused** |
| Decks | 20 | 20 | 6 | **12** |
| Tests | 444 | 90 | 34 | **25** |
| Engine code | ~12,200 js | 10,824 js | 4,647 js | **3,715 js** |
| Tooling | — | — | 1,745 / 11 tools | **2,110 / 15 tools** |
| Art | 406 | 265 | 153 | **147** |
| Audio | 4 CC0 | synth + CC0 | synth + original score | **synth + original score, zero third-party** |
| Auditor findings on first run | 65 | — | 7 | **7** |

**The new row is "cards the grammar expresses".** It is the number this project turns on and
§3 is about why.

---

# 3. THE BIG ONE: importing thousands of printed cards is a *compiler* problem

Projects 2–5 **authored** their content: a human wrote each ability as data. Project 6 has 2,785
printed cards and authoring them is not possible in a night. So `tools/build-abilities.mjs`
**parses printed text into the effect grammar**, and everything downstream changes shape.

## 3.1 The coverage number is the project

One number decides how good the game is: what fraction of printed cards the compiler can read.
It gates which cards may be in a deck, which decides how much of a "real" decklist is real.

Do not treat it as a score to maximise. **Treat it as a queue.** `build-abilities.mjs` prints
the failing clause shapes largest-first on every run, and that list is the work order. Four
hours of pattern work moved it from 14.7% to 32.6%, always by taking the top of that list.

## 3.2 A coverage number that goes DOWN after a fix is good news

The compiler reported 33.4%. After one strictness fix it reported **31.0%**, and that was the
single most valuable change of the night: **67 cards had been compiling *wrongly*.**

The bug is worth stating exactly, because every pattern compiler has this shape somewhere:

```
'Give up to 2 of your opponent's Characters -3000 power during this turn.
 Then, if your Leader's type includes "Whitebeard Pirates", this Character gains [Rush]...'
```

matched `^Give (.+?) ([+-])(\d+) power (.+)$`, and the duration test asked whether the tail
**contained** "during this turn". It did. **The second sentence was swallowed and the card
compiled clean.**

> **Rule: every tail group in a pattern compiler must be anchored to what it is allowed to be,
> never merely tested for what it contains.** A greedy group that spans a sentence boundary is a
> silent drop, and a silent drop is the exact failure hard rule 8 exists to prevent.

**A lower honest number beats a higher dishonest one, every time.**

## 3.3 Refusal is not a deviation, and say so in writing

1,876 of 2,785 cards carry `unimplemented` and cannot enter a deck. That is **not** a rules
divergence — the engine never does the wrong thing, it declines to offer the card. `-5.md` did
not need this distinction because everything was authored. `DEVIATIONS.md` now has a section
headed *"Not deviations, recorded so they are not mistaken for one"*, and the next session
should keep it.

## 3.4 A refused card cannot always be hidden

`data/defects.js` hides a broken card from the deck picker, and that works for Characters and
Events. **It does not work for a Leader**: hiding a Leader deletes the deck. Four of the seven
first-run audit findings were Leaders of registered meta decks, so each had to be *fixed*
rather than disclosed. **Budget for that**: in a set with a small number of very visible cards,
the gate has no answer and the compiler must actually win.

---

# 4. The auditor, and the two ways a gate lies to you

`-5.md` §6.1 said build the auditor early because it is the only automated way to catch a clause
silently dropped — a test cannot see it, since both sides of a test come from the same ability
data. It found **7 real defects on its first run**, on a set that had already passed 21 tests, a
content validator, load-time validation and a browser playtest. Build it early. It is right.

Two new lessons came out of *operating* it.

## 4.1 An auditor that cries wolf gets fixed into an auditor that is blind

`-5.md` warned about false positives and it was right: three of the seven were noise.
`[Trigger]` inside *"trash 1 card with a `[Trigger]` from your hand"* names a property of a card
in hand, not this card's timing.

The lesson is what happened **next**. Fixing it meant letting the auditor use the compiled
ability as evidence — and each compiled ability carries its **printed text** for traceability.
So the check matched the printed sentence against itself and **silently started passing**. The
finding count fell and I nearly believed it.

> **Rule: after loosening a gate, prove it still fails on a case you know is bad.** A gate that
> stops reporting looks exactly like a gate that has nothing to report. I caught this only
> because two findings I *knew* were real vanished in the same run.

## 4.2 Severity split, confirmed

0 FAIL and 9 WARN is a number someone reads. The split that worked: a FAIL is a printed
**number**, **keyword tag** or **named zone** that appears nowhere in the compiled ability. A
WARN is a wording difference, which is expected — the describer writes the project's own prose
and is not trying to match Bandai's sentence.

---

# 5. Chains: one fix exposing the next

The most instructive hour of the night was a single auditor finding that unwound into four bugs.
Each was invisible until the one before it was fixed.

1. The auditor said Kaido's `[When Attacking]/[On Your Opponent's Attack]` had lost half its
   text. **Two printed timings on one effect**; the compiler emitted one ability.
2. Fixed the compiler. Wrote a test to prove it fired. **It did not fire at all** — the engine
   had no site for that timing, and grep found the token only in the *describer*.
3. Added the fire site. It then **fired twice**, because the dispatcher matched both the
   original ability and the one emitted for its second timing.
4. Fixed that, and the test asserting the DON!! cost was paid failed: **auto effects never paid
   their activation costs at all.** `payCost` existed only on the activate path. Every auto cost
   in the entire set had been free.

> **Rule: when you change a compiler to emit something new, grep the engine for the consumer
> before you believe it works.** A token that appears only in the describer is a token nothing
> executes.

> **Rule: assert the side effect, not the resolution.** The test that found the free costs
> asserted *"DON!! left the cost area"*, not *"the effect resolved"*. The weaker assertion
> passed against a completely broken implementation.

And the fix worth copying: **an activation cost compiles to ops that run at the front of the
same invocation.** Cost and effect stay atomic, and a question asked *while paying* discards the
partial run and replays it with the answer, exactly like any other effect. No second mechanism.

---

# 6. Scraping a published card list — the specifics

Recorded because they cost an hour each and are invariant.

- **The official list is clean, server-rendered HTML** at `en.onepiece-cardgame.com/cardlist/`,
  one `<dl class="modalCol">` per printing, every series behind `?series=NNNNNN`. Read the
  series list from the page itself so a new set needs no edit. 60 series, ~90 seconds, polite.
- **The same slot means different things by card type.** The "Cost" field carries **Life** on a
  Leader (CR 2-9-1 vs 2-7-5). Split it by category at import; do not leave every consumer to
  guess.
- **A printed 0 renders as "-".** 23 Events print `-` for cost and their card faces show a 0 in
  the circle. **Verify against the card image rather than assuming** — two of those 23 are in
  meta decks, and treating them as "unknown" would have removed them.
- **Fold parallel arts into the base card number.** 4,844 printings collapse to 2,785 numbers;
  keep the alt-art ids for the art pipeline and nothing else.
- **A community meta site is a source for *which* decks, not *what is in* them.** onepiece.gg's
  tier list and its per-archetype "most played cards" table (with copy counts and inclusion
  rates) are free and enough for ~43 of 50 slots. Its deck browser is behind a bot check, which
  this project did not attempt. **Mark every slot `measured` or `inferred` and show the split on
  the deck screen.** Nothing invented silently.
- **Bandai does not publish starter-deck quantities.** It publishes the sixteen cards and the
  rarity split. Generate the counts by a stated rule and label them inferred.

---

# 7. Art and audio

- **Hugging Face routes image models per provider.** `router.huggingface.co/v1/images/generations`
  404s; `router.huggingface.co/{provider}/v1/images/generations` works. Read
  `/api/models/{id}?expand=inferenceProviderMapping` to find a live provider. `FLUX.1-schnell`
  via `nscale` at `768x1088` is exactly 5:7 and took about fifteen seconds a card.
- **The prompt lint caught the STYLE constant itself.** 160 violations on its first run, and the
  largest single cause was the word *"three-quarter"* inside the style string tripping the
  "no count above two" rule. It refused to write the file, as designed. **The lint is not only
  for the per-card clause — it must see the constant too**, and it found a real problem there
  before 147 paid renders.
- **One identity clause per character, written once**, is what makes a set read as one set. 101
  hand-written clauses covered 134 of 147 cards; the remaining 13 got a clause derived from
  their own card data.
- **Sample three, look at them, then batch.** Confirmed again.
- **The score is written by the program at run time** on a minor pentatonic with a lookahead
  scheduler on the audio clock. The repo carries **no third-party audio at all**, which is a
  cleaner posture than licensing and costs nothing.

---

# 8. What the next session should do first

1. **Raise compiler coverage.** It is the single lever on everything. Run
   `node tools/build-abilities.mjs` and work the printed list of failing shapes top-down.
2. **Play it and report back.** `-5.md` §5.8 is still the most valuable sentence in the series:
   *the playtest is the specification*. Nobody has played this against the AI for more than a
   few turns.
3. **Close `DEVIATIONS.md` D-1**, replacement effects — the largest absent family.
4. **Build the animation layer.** Five projects have now deferred it; project 5 measured it at
   about an hour.


# 9. Added 2026-09-27 — the per-card audit, and the rule this series keeps forgetting

The owner asked for every card in a registered deck to be read literally and made to do exactly
what it says. `tests/04-cards.mjs` puts each of the 150 cards on a board and plays it through
`apply()`. **22 of its first 78 tests failed, on a build whose 25 tests, auditor and page gate
were all green.** Eight of those were engine bugs that touched every deck.

## 9.1 OPEN INFORMATION IS A RULE. Build the viewers on day one. (Owner's note — every project.)

The owner has seen this in every game of the series: **the player is never given a way to look
at what the rules let them look at.** Here the trash was a bare count, a "look at 5" showed only
the cards you were allowed to take, and nothing the opponent revealed or trashed was ever named.
None of it is a UI nicety. Each one is a numbered rule, and a game that hides open information
plays differently from the real one.

Before the first playable build, go through the rules' zone list and give every zone its viewer:

| What | Rule (OPTCG) | What the player must be able to do |
|---|---|---|
| Both trash piles | CR 3-5-2 open | open either one, any time, even mid-prompt |
| Card counts in every zone | CR 3-1-4 | see hand, deck, Life, DON!! deck and trash counts for both sides |
| "Look at N cards" | CR 8-4-4-4 | see **all N** faces, with the ones that do not qualify dimmed |
| A card revealed by an effect | CR 2-7-2, 10-1-5 | have it named (log) and visible; this includes the opponent's |
| A card trashed as a cost | CR 3-5-2 | have it named, and findable in the trash afterwards |
| The opponent's hand, deck and Life | CR 3-4-3, 3-2-2, 3-10-2 | see **nothing** except counts, unless an effect says otherwise |

And write the grep: an effect that says "look at", "reveal" or "your opponent's hand" must
render its cards, and the gate should fail a question with a `seen` list that the UI ignores.
The same list, with the zone names changed, applies to every card game this series will build.

## 9.2 One cost door, or costs quietly stop being paid

Costs were paid in three different places and missed in four more. Events paid only the DON!!
printed in the corner, so `DON!! −1` on OP05-077 and "rest 5 DON!!" on OP17-056 were free;
[Counter] and [Trigger] costs were never paid; "You may" costs on auto effects were taken without
asking (CR 8-3-1-4); and a cost with a choice in it (which card to trash) ran OUTSIDE an
invocation and froze the game. The fix was one `cost` op, run at the front of the effect's own
invocation, that checks affordability, asks "pay this?" when the card says *may*, and stops the
effect after the colon when declined. **Every effect-kind now goes through it.** Add a grep for
any `ab.ops` executed without `costOps(ab)` in front of it.

## 9.3 A describer that writes the right words for the wrong condition hides a merge

"If you have a Character" and "If there is a Character" compiled to ONE condition (yours only).
The auditor never saw it because the describer for that condition said *"If there is"*, which
matched every print that says "there is". Mihawk's Leader could not be activated off the
opponent's cost-5 Character. **When two phrasings compile to one op, the describer can only be
right for one of them — the auditor needs a check that each op's prose is unique.**

## 9.4 The rest of what the per-card tests found

- **[Trigger] "Play this card" put the card in two places**: on the field and in the trash. Nine
  cards in the pool.
- **[On K.O.] never fired.** The engine asked where the card was *after* it had left the field.
- **Counter Events with a target resolved after the damage.** The Counter step was re-queued in
  front of the Event's own question (CR 8-6-1).
- **Stages were skipped by every timing loop**, so OP17-057 Fullalead did nothing.
- **"All of" was stripped as filler**: OP17-022 Shanks rested one Character, not all of them.
- **Two alternative identities parsed as one selector** matched nothing: OP02-024 Moby Dick.
- **"with a [Trigger]" was dropped from a cost**, so any card paid it.

The pattern across all of them: *both sides of an existing test came from the same ability data*
(§4), and no test had ever put the printed card on a board and checked the outcome. **Write one
behaviour test per printed card before calling a card pool done.**

---

*(Written at handoff; see §9 for the 2026-09-27 audit — suite now 103 tests.)* *Suite green at 25 tests; `check-pages` clean; `check-art` clean at 147 entries;
`audit-cards` at 0 FAIL / 9 WARN; `data/defects.js` empty; all twelve decks legal and offered.*

*And the line that matters most, carried forward for a sixth time: **get something playable in
front of the owner early, and let what he says about playing it be the specification.** This
project had a clickable board with an AI opponent before it had art, sound, or a second deck,
and every one of the interface bugs that mattered was found by looking at the screen.*
