# Lessons from RIVALFORGE — starter guide for the One Piece card game

Distilled from building **RIVALFORGE**: an *original* objective-control card game designed from
scratch, using **Marvel Rivals** for flavour and roster identity, played against an AI, with
original art and a generated score. This is the **fifth** document in the series.
`CARD-GAME-LESSONS.md` (MegaRobotWar), `-2.md` (Starbound Legions / Star Wars: Unlimited),
`-3.md` (Crystal Wars / FFTCG) and `-4.md` (BreachForge / Riftbound) came first. Every rule in
all four still applies unless this file says otherwise; where they disagree, **the later
document wins, because it is the later evidence** — with one enormous exception, which is §1.

There is also `OVERNIGHT-BUILD-PLAYBOOK.md`, which is **not** about card games at all. It is the
method for running an unsupervised build so that it produces something playable. Copy it too,
and read it before the first question you ask the owner.

---

# 1. READ THIS BEFORE ANYTHING ELSE: the regime flips BACK

`CARD-GAME-LESSONS-4.md` opens with a section titled *"The regime change: nothing is printed, so
design is the product"*. It exists because project 5 was an **original design** — there was no
printed card, no rulebook, no card dump, and the whole fidelity apparatus had nothing to point
at. That document spends its §7 explaining what to build *instead* of an auditor.

**Project 6 is a reproduction again.** The One Piece Card Game is a published Bandai product
with printed cards, an official **Comprehensive Rules PDF**, an official Q&A rules PDF, a
searchable card database, a tournament scene and thousands of public decklists.

So **every reversal in `-4.md` §7.1 reverses back**:

| Question | `-4.md` said (original design) | **Project 6 (reproduction)** |
|---|---|---|
| What is the standard? | Kit fidelity — a *flavour* standard | **Fidelity is the product.** A divergence from printed behaviour is a defect to fix, never a design choice. |
| What is `docs/rules.md`? | Your own rulebook, written before the cards | **A citation index** into Bandai's Comprehensive Rules. Every engine rule names the section it implements. |
| What goes on the card face? | Generated prose (nothing to paraphrase) | **Printed text, verbatim.** Generated prose survives only as the *auditor* and as the test harness's fallback. |
| What does the audit tool diff against? | A hand-written kit table | **The printed text pack.** This is what the tool was always for. |
| Who owns balance? | You do — `BALANCE.md` is the primary instrument | **Bandai does.** `BALANCE.md` is retired. The fuzzer goes back to being a crash gate and **not** a balance readout. |
| What does the deck matrix measure? | Deck strength | **Crashes. Only crashes.** `-4.md` §7.4 reversed project 3's rule; reverse it back. |

**Concretely, do not do these things on project 6:**

- Do not write your own rulebook. Read Bandai's and cite it.
- Do not create `BALANCE.md`. If a deck looks strong, that is because it *is* strong in the real
  game, and "fixing" it is a fidelity defect.
- Do not tune printed numbers. Ever. A card that says 5000 Power says 5000 Power.
- Do not read `-4.md` §7's design advice as guidance. It is excellent advice *for designing a
  game* and actively wrong for reproducing one.

**What survives from project 5 regardless of regime** is §4 and §5 of this document: the
engineering, the measurement discipline, the AI lessons, the asset gates, and the playbook.
Those are regime-independent and they are why this file exists.

---

# 2. The calibration numbers

| | SW:U (2) | FFTCG (3) | Riftbound (4) | **RIVALFORGE (5)** |
|---|---|---|---|---|
| Days / commits | 10 / 149 | 6 / 71 | 3 / 89 | **2 / 15** |
| Regime | reproduction | reproduction | reproduction | **original design** |
| Content | 2,277 reg / 412 authored | 406 authored | 264 authored, 20 decks | **150 authored, 36 heroes, 6 decks** |
| Tests | 252 | 444 | 90 | **34** |
| Engine code | ~43,000 | ~12,200 js | 10,824 js | **4,647 js · 1,108 data** |
| Tooling | — | — | — | **1,745 lines, 11 tools** |
| Grammar | — | ~120 ops | ~180 ops | **25 ops, all with describers** |
| Art | 800+ | 406 | 265 | **153 renders** |
| Audio | gen SFX + 5 tiers | 4 CC0, no SFX | synth + 15 one-shots + 4 CC0 | **synth kit + an original procedural score, zero third-party audio** |
| AI | 760-game runs | never measured | arena run, 81% of 42 decisive | **arena run; 3 real balance defects and 2 AI defects found** |
| Registers | — | — | DEVIATIONS + TODO | **DEVIATIONS 3 · TODO 7 · BALANCE 16 · defects 0** |
| Playtested by a human? | yes | no | no | **YES — and it changed four core rules** |

**Read the commit count, not the line count.** Fifteen commits in two days produced a smaller,
better-gated codebase than project 2's 149, because the engine surface was a copy and the
novelty was concentrated. Project 6 should be smaller still on the engine and **much** larger on
the import.

**And read the last row.** Project 5 is the first in the series where a human actually played it
and reported back. Everything in §5 of this document came out of that one conversation, not out
of any test.

---

# 3. The owner's standing instructions

Carried from `-4.md` §2, confirmed again, plus what project 5 added.

1. **Playable first, not endless tests.** In the owner's global preferences, and it is still the
   most important scheduling instruction. RIVALFORGE had a clickable board with an AI opponent
   before it had art, sound, or a second deck.
2. **Fidelity is the product** — and for project 6 this is live again in its original meaning.
3. **Nothing playable contains content that does not work correctly.** `data/defects.js` plus a
   deck-picker filter, built on day one, empty and wired.
4. **Show the player the real thing.** Printed text verbatim on the face; printed icons rendered
   as icons; no generated paraphrase. **Live again for project 6.**
5. **Verify in the real app, not just in the suite.** Every UI commit message ends with what was
   checked in a browser on the real code path.
6. **The interface should be beautiful and explained.** Painted art everywhere, music, a
   how-to-play sheet, a readable log, a visible chain, a zoom that puts the text beside the card.
7. **Commit messages describe the mechanism, by id.** The history reads as a bug diary.
8. **Art direction is the owner's call, recorded, not re-litigated.** For project 5 it was
   "gritty chibi hero-shooter key art, recognisable at 34px". **Decide again** (§7.6).
9. **State a concern once, in writing, then build what was asked.** Scaling the project down is
   the owner's call, not yours.
10. **One agent per worktree**, at a path outside any synced folder.
11. **NEW — ask the question round before he sleeps, and only the questions that matter.** See
    `OVERNIGHT-BUILD-PLAYBOOK.md` §1. The test: *would a wrong guess cost rework, or just a
    different-but-fine outcome?* Only the first kind goes to him. Everything else gets decided
    and **stated as a default in the reply**, so he can correct one line in one word.
12. **NEW — his design instincts have been right every time he has overruled a measurement.**
    On project 5 he called the Vanguard control rule skewed before any data existed; measurement
    then put the skew at +7.3, the largest of four candidates. He called uncapped Ultimate charge
    a future problem before it bit; it would have made "never move this hero" correct. **When he
    says a rule feels wrong, measure that rule first, not last.**

---

# 4. What five projects have now confirmed — repeat without re-arguing

Everything in `-4.md` §3 held again. The short form:

- **No build step.** Plain browser JS, IIFEs on one namespace, script order declared in
  `index.html`. Runs from `file://` and from a 40-line dev server.
- **The engine surface is exactly `legalActions` / `apply` (immutable) / `isTerminal`**, plus
  `whoActs(state)` as the one answer to "whose input is needed". `apply` deep-copies and nobody
  has regretted it in five projects. Measured on project 5: **0.71 ms per apply** on a 44 KB
  state with twelve objects on the board, and **13.6 ms per AI decision** over 21 candidates.
  That is fast enough; do not optimise it away and lose immutability.
- **Every UI affordance derives from `legalActions`.** The UI cannot invent a rule.
- **One resolution queue is the whole control flow.** A pending head owns the turn; only its
  choices are legal; `legalActions` throws on a head that offers nothing.
- **Cards are pure data; abilities are data.** New vocabulary goes into extension files wired
  through hook tables, never by editing the core. **New op = handler + describer + test**, with
  validation rejecting an op with no handler and the describer throwing on an op with no prose.
- **An ability the grammar cannot express fails authoring loudly** (`{ unimplemented: 'why' }`),
  rejected from any registered deck by validation. Biggest quality lever in the series, still
  free.
- **A default that a real value would replace must fail validation.**
- **Load-time content validation, seeded RNG with every shuffle inside `apply`, one names file,
  structured log entries with `data` and automatic `via`, deck registry decides the pool.**
- **The black box** (`js/bugreport.js` + `tools/replay-report.mjs --selftest`) reporting
  ILLEGAL / THREW / DIVERGED, built before the first playtest. On project 5 it replayed a real
  74-action browser game CLEAN on the first try.
- **Two entry points, one script list**, asserted by a tool. **No defensive `if (!NS.x)` in UI
  code.** (Project 5 found a second form of this — see §5.3.)
- **The three UI specs are binding and have now held for four projects**:
  `CARD-PRESENTATION-SPEC.md`, `CARD-LOG-AND-TARGETING-SPEC.md`, `CARD-FANNING-SPEC.md`.

---

# 5. What project 5 added — the regime-independent lessons

These are the ones worth the read. Every one cost something.

## 5.1 Measure the AI's *behaviour*, not only its win rate

The owner reported: *"AI seems retarded by comparison and didn't play correctly. There were
rounds where nothing was played by AI."*

Measured before touching anything: the AI took **zero actions on 6–9% of its turns**, wasting up
to 120 Momentum across twelve games — and it got **worse at higher difficulty**, which is what
proved it was a defect rather than tuning. Less jitter meant less chance of being knocked off
the wrong answer.

**The cause was a horizon asymmetry in the one-ply search, and it will recur in any turn-based
game.** `pass` was scored like every other action — but applying `pass` resolves the entire end
of turn/round: combat, triggers, scoring. That windfall was worth more than any single action
could ever be. Caught in the act: holding the objective **18–0 with 7 Momentum in hand**, the AI
scored `pass` at +4.4 against its best real action at +1.6, and passed.

The asymmetry was never that passing is good. **Every** action gets the same windfall, because
the round resolves either way. The fix is to score candidates against the **do-nothing baseline
at the same horizon** and make `pass` the *fallback* rather than a candidate: keep taking the
best improving action, then end the turn. Empty turns went 9% → 2%.

**Build this metric on day one:** *what fraction of its turns does the AI take zero actions on?*
It is one counter and it catches a class of defect that win rate cannot see, because both sides
have the same bug.

**One Piece warning:** this game has a **reactive** window (§7.3). The same asymmetry will
appear in the counter step — "decline to counter" resolves the rest of the battle and everything
after it. Score countering against not-countering at the same horizon, or the AI will never
counter and you will not find out from its win rate.

## 5.2 Measuring a rule with an evaluator blind to that rule measures the evaluator

The first measurement of a new mechanic (flanking fire) showed **no change at all** — 19.6% of
deployments before, 19.7% after. It looked like a clean null result and would have killed the
feature.

It was not a null result. The AI's evaluator had **no term for the mechanic**, so it could not
*see* the thing it was being asked to value. Adding one weight took the same measurement from
19.7% to **35.9%**, and the feature was obviously correct.

**Before measuring any new rule with the AI, ask whether the evaluator can perceive it.** If the
rule adds a new kind of value to the board and no weight references it, you are measuring your
own weight table.

## 5.3 A silent fallback hid 59 paid renders, and the gate did not catch it

`art/manifest.js` was generated but never added to `index.html`, and `js/art.js` read
`RF.artManifest || {}`. The page silently drew procedural placeholder art for **59 renders that
had been paid for**, and said nothing. It was found by a human looking at the screen.

Two lessons:

1. **`|| {}` is the same sin as `if (!NS.x)`.** Hard rule 3 banned the `if` form; the `||` form
   walked straight past it. `tools/check-pages.mjs` now greps for both. **Add a grep the first
   time a bypass costs an hour** — that rule has now paid off four times.
2. **Wire every asset pipeline empty and failing loudly, before you fill it.** The manifest
   should have been declared on the page while it was still an empty object, so the first
   missing entry threw instead of degrading.

**And build the self-diagnostic with the feature, not after the bug report.** When the owner
later reported missing images on another machine, there was no way to ask the build which ones.
`tools/check-art.mjs` (presence, zero-length, WebP magic bytes, truncation against the declared
header length, exact case — macOS is case-insensitive and a Linux server is not — root-relative
paths, and whether git actually tracks the file) plus an in-app **Art check** screen that probes
every declared image in the real browser and prints the failing URLs. Copy both on day one.

## 5.4 Hold every change to a holdout — a real peak can still be worthless

Sweeping the AI's charge weights produced a textbook peak: Ultimates fired per game went 3.96 →
4.79 → **5.06** → 4.44, worse in both directions. Every instinct said ship it.

Head-to-head against the old weights over 128 games in both seats, it measured **exactly 50.0%**.
It fires 28% more Ultimates and wins no more often.

It was applied anyway — but labelled **in the code comment** as a *feel* decision and explicitly
not a strength one, so nobody re-runs that sweep hoping to find strength in it. **A peak on a
proxy metric is not a peak on the thing you care about.**

## 5.5 A compounding advantage cannot be fixed by a one-off correction

First-player advantage was tuned once for a three-hero board. When the board grew to six, it
broke completely: 76.6% first-player. Re-swept:

- One point of permanent starting resource was worth **34 points of win rate**.
- Even a **one-time** +1 on turn 1 moved it 23 points.
- Nothing landed near 50%, in either direction.

The reason: the advantage **compounds**. Whoever develops first takes the objective, and the
objective then scores *every round*, so the lead feeds itself. **A one-off correction cannot
answer a compounding advantage.** The fix was a continuous one — extra resource while you are
behind — which pushes back at the same rate the lead grows, and landed at 43.8%.

Raising the draw rate made it **worse** (37.5%), because an extra card is worth more to whoever
acts first: it fed the thing it was meant to fix. *Negative result, recorded, do not re-try.*

**One Piece relevance:** the real game has this problem solved already (the first player does not
draw on turn one and gets fewer DON!!). **Reproduce Bandai's answer exactly and do not invent
your own.** If your first-player win rate is off, your engine is wrong, not their game.

## 5.6 A fix that changes nothing is information

Two rounds of stat tuning moved a losing deck from **0 wins to 0 wins**. That is what proved the
problem was *structural* rather than numeric — every other deck's captain was a role that counted
double for the objective and this one's was not, so it began every game down a fixed amount.

**When a plausible fix produces no movement at all, stop tuning and go looking for the
structural reason.** Two null results in a row is a signal, not a failure.

## 5.7 Run sweeps in a sandbox copy of the repo

The first sweeps rewrote `js/state.js` in place and restored it in a `finally`. That works alone
and is a menace the moment anything else is happening:

- A test run during the sweep read a half-swept engine and reported a failure that was not real.
- A `git checkout js/state.js` to tidy up **silently reverted an unrelated uncommitted change**.

`tools/sweep.mjs` now copies the repo to a scratch directory and runs there. The working tree is
never modified. Copy it.

## 5.8 The playtest is the specification, and a small first pool is what makes that affordable

Project 5 deliberately shipped **20 heroes across four decks** rather than the full roster. The
first human playtest then changed: the board size (3 → 6), the objective-control rule, the
captain's opening, and the entire purpose of the second location.

**Every one of those would have invalidated a hundred cards.** The pool was widened to 150 cards
*after* the rules settled, and the expansion was then almost entirely mechanical.

`-4.md` §7.4 said *"a hundred cards designed against an unplayed engine is a hundred cards to
redesign"*. Project 5 is the evidence.

**For project 6 this is less acute** — Bandai has already playtested the cards — but the *engine*
has not been played. Ship one starter deck pairing, play it, and only then import the set.

---

# 6. What project 5 got wrong

## 6.1 The audit tool was specified, documented as existing, and not written for two days

`docs/kits.md` stated in writing that `tools/audit-kits.mjs` diffs generated card prose against
the kit table. **For most of the project that tool did not exist.** The document described
something that had never been written — exactly the failure `-4.md` §6.3 warns about
(*"a grep against `ls` is a document review"*), committed by the very session that quoted it.

It was caught at handoff only because writing *this* file prompted an `ls` of every path it
names. **That check found it in about four seconds and should have run on day one.**

It is now built, and the delay was expensive in a way worth recording: **on its first run it
found seven real content defects** in a set that had passed 34 tests, a content validator and
two human playtests. All seven were the same class — the kit *described* an ability but never
*named* it, so the card's name for it had no counterpart in the source of truth and nobody could
tell whether the card had invented it. Cheap to fix, invisible to every other gate.

**Three instructions for project 6:**
1. **Check every doc's claims against the filesystem before committing it.** If a doc names a
   tool, `ls` it.
2. **Build the auditor early.** In a reproduction it is not optional — it is the only automated
   way to catch a clause silently dropped for want of a primitive, because a test cannot see it:
   both sides of a test come from the same ability data. It found 65 real defects on project 3
   and 7 on project 5 the moment it existed.
3. **Give its findings a severity, and get the split right.** The first version reported 40
   findings and would have been ignored within a day. Most were not defects: a card legitimately
   *compresses* a five-ability video-game kit into two, and Team-Ups are a design axis that no
   kit describes. Separating FAIL from WARN took it to **0 defects and 27 notes**, which is a
   number someone will actually read. *An auditor that cries wolf is worse than no auditor.*

## 6.2 Balance work crowded out content on day one

A great deal of project 5's second session went into measuring and fixing balance, which was
correct *for an original design* and would have been **entirely wasted effort on a reproduction**.
Know which regime you are in before you spend a day on an instrument.

## 6.3 Three presentation bugs were invisible outside a browser

The affiliation name overflowed the card face; gear rules text leaked onto hand cards; and every
card rendered at the body's font size because **`em` cascades from font-size, not from width** —
so "all typography in `em`" does not scale a card with its container unless each size class sets
its own base. All three were found by looking at the screen.

## 6.4 No animation layer for four projects running — closed, and it took an hour

It shipped in project 5 and took about an hour once someone decided to, exactly as `-4.md`
predicted when sound closed the same way. **Just build it.** FLIP, because the board rebuilds
from scratch each frame; force a synchronous layout read rather than waiting on
`requestAnimationFrame`, which does not fire in a background tab and will strand an animation
whose end state is set in its callback.

---

# 7. The One Piece project

## 7.1 IP posture — and it is the most enforced property in the series so far

Three rights holders, not one: **Bandai** (the card game), **Eiichiro Oda / Shueisha** (the
manga), and **Toei Animation** (the anime). One Piece is among the best-selling manga ever
published and its rights are actively and vigorously enforced.

`-3.md` §10 is the standing posture and does not change: two places for published words only; no
official image or audio ever in the repo; nothing sold, monetised or advertised; a `NOTICE.md`
naming the source once to identify what is implemented, stating non-affiliation and giving a
takedown address; the same disclaimer on a screen the player actually sees; `.gitignore`
committed alone before the first tool.

**Day one, before any code:** read what Bandai actually publishes and write it down with the date
and the URL, exactly as project 4 did with Riot's policies and project 5 did with NetEase's.
Bandai publishes an official site with a **Comprehensive Rules PDF**, a **Q&A rules PDF** and a
card database; those are also your rules citations (§7.2). Record honestly where the project sits
against their terms. **"Searched on <date>, found none" is a finding** and it stops the next
session assuming a policy exists in either direction.

**The exposure profile is the worst of both previous shapes.** Project 4 had a large rules-text
surface and small name surface; project 5 was the reverse. One Piece has **both**: thousands of
printed card texts *and* several hundred instantly recognisable character names and likenesses.
Plan for both levers:

- **Printed text**: it lives in one generated pack (`data/printed.js`), gitignored source, and
  the game is playable without it because the generated describer is the fallback.
- **Names**: one names file with a switchable pack, as project 5 built. Flipping one constant
  renames the entire game — cards, log lines, prompts and keyword help — because every
  player-visible string is read at render time.

Recommend the original-theme pack as the default and the character pack as a switch; record the
owner's answer in `PLAN.md` with the date and never re-open it. *(His pattern across five
projects is to choose the real thing, and he has been right every time. What matters is that the
engineering makes either answer cost nothing.)*

## 7.2 `docs/rules.md` becomes a citation index again — and this time the citations are good

Bandai publishes **numbered Comprehensive Rules**. That is better than anything this series has
had: project 3 reconstructed rules from card behaviour, project 4 cited a community wiki.

**Every engine rule names the comprehensive-rules section it implements, in a comment**, exactly
as project 5 did with its own rulebook (`// rules.md §8.4` appears throughout that engine and it
is the single most useful commenting convention in the series). Same convention, real source.

When a card and the engine disagree, **there is a third party to appeal to now**. Read the rule,
read the Q&A PDF, and fix the engine. Do not decide.

## 7.3 What is genuinely novel — and it is one thing, but it is big

**Almost the entire engine is a copy.** The three-function surface, immutable `apply`, the
resolution queue and `whoActs`, the parked-target step and its three UIs, the effect grammar with
hook-table extensions, structured logging with `via`, the names file, load-time validation, the
coverage tool, the test harness and Node runner, the fuzzer, the black box and its replayer, the
card renderer and all three UI specs, the defects gate, the art and audio pipelines, the AI
machine and the arena. A hand is a hand.

**The novel work is the reactive window, and you should design it on day one.**

Every previous project in this series has been *"your turn, your actions"*. Even project 5's
simultaneous combat asked both players for assignments inside a single resolution step. One Piece
has a genuine **priority window during the opponent's turn**:

```
Attack step   attacker declares: a rested-able Leader/Character attacks a Leader/Character
Block step    DEFENDER may rest a [Blocker] Character to redirect the attack onto itself
Counter step  DEFENDER may play any number of [Counter] cards from hand, and Counter events
Damage step   compare Power; resolve; if the Leader was hit, take a Life card (and its [Trigger])
```

Two of those four steps hand control to the player whose turn it is not, and the counter step is
a **repeatable** window — the defender may keep adding counters until they stop.

**Design notes, from five projects of queue experience:**

- The queue already supports this. A block/counter window is a queue step whose `ctrl` is the
  *other* seat. `whoActs(state)` returns that seat and everything downstream — the UI, the AI,
  the black box — already routes correctly. **Do not build a second control-flow mechanism.**
- The counter step is a **loop**, so model it as a step that re-offers itself until the defender
  declines. `RF.offerChoice` with `min: 0` and a "done" option is exactly this shape, and
  `-4.md` §4.5 already told you to put `min`/`max` on the target step rather than a single count.
  Project 5 did, and it cost nothing.
- **The defender's prompt must say what is being decided and what happens if they decline.**
  `CARD-LOG-AND-TARGETING-SPEC.md` §16: always say what the game is waiting for. A silent
  "opponent is thinking" during *your* attack is the worst possible time to be vague.
- **This is where the AI's horizon asymmetry will bite** (§5.1). Declining to counter resolves
  the rest of the battle. Score it against the baseline, and build the "how often does the AI
  counter?" counter on day one alongside the "how often does it do nothing?" one.

**The other new zone is Life**, and it is unusual: it is simultaneously the damage track *and* a
source of card advantage, and taking damage can trigger the card you took. Consequences:

- It is a **face-down ordered zone** that the owner may not look at. That is a new inspector rule
  (`-4.md` §4.7: "the deck and the trash are cards on the board, with an inspector for what you
  may look at").
- **[Trigger] is an optional reveal on damage.** Another queue step with `ctrl` on the damaged
  player, during the *attacker's* turn.
- Losing is "damaged with no Life left", not "Life reaches 0". Get the ordering exactly right and
  cite the rule.

**DON!! is a per-object resource, and project 5 built that exact machinery.** Its per-hero
Ultimate Charge — a resource that lives on the unit, spendable only by that unit — is structurally
the same thing as attached DON!!, and `RF.engine.gainCharge` is the "one door" pattern to copy.
Two differences to respect: attached DON!! **returns** at end of turn, and it only counts during
your own turn. Both are printed rules; cite them.

**Do not reinvent:** rest/active is `exhausted`; the Leader is project 5's Squad Captain with a
Life value; Stage cards are a single-slot permanent; Events are one-shots that go to the trash.

## 7.4 Content sourcing — the import is large again

The reverse of project 5. There are thousands of printed cards across OP-xx sets, ST starter
decks, EB and promo sets, plus an official card database and extensive community decklists.

- **Deck registry decides the pool.** A card that is not in a registered deck is not in the game,
  and validation only polices what a player can actually meet. This is what lets you import
  broadly and ship narrowly.
- **Start with two ST starter decks.** They are designed to be played against each other, they
  are small, they are complete, and they exercise Leader / Character / Event / Stage, DON!!,
  blockers, counters, triggers and life — the entire engine — in about forty distinct cards.
  **That is the first playable milestone.** Then import a set.
- **Raw dumps, scrapes and screenshots live in gitignored `scratch/`.** Only the generated pack
  crosses into the repo.
- **Record the set and rules version you built against**, at the top of the printed pack. Bandai
  errata cards and revises the comprehensive rules; in a year nobody will know whether a card is
  wrong or just old. Project 5 recorded "Season 10" for exactly this reason.
- **Deck construction is a real rule here**, unlike project 5's prebuilts: 50 cards, at most 4 of
  any card number, every card must share a colour with the Leader, plus 10 DON!!. Put that in
  validation on day one — it is the cheapest fidelity check in the game.

## 7.5 Balance is Bandai's — but the fuzzer still earns its keep

**The deck matrix goes back to being a crash gate and nothing else.** `-4.md` §7.4 reversed
project 3's rule for an original design; reverse it back.

What the fuzzer is still *excellent* at, proven on project 5: **finding design holes in your
implementation of someone else's rules.** Project 5's fuzzer found that 84 of 96 random games hit
the round cap with zero combat — which turned out to be a rule the engine had implemented too
permissively. For project 6 the equivalent signal is a game that never ends, a life total that
never moves, or a counter step that never fires. **Instrument the fuzzer with a few such
counters and read them.** A crash gate that also reports "0 counters played in 200 games" is
worth ten times one that only reports crashes.

The arena keeps one job: **tuning the AI**, both seats, decisive results only. It is no longer a
design instrument.

## 7.6 Art direction — decide again, and record it

The three constants do not move under any decision: **no text rendered in an image**, **no
reproduction of a specific official illustration** (prompts describe a visual identity in
original prose; never "the art of X", never a named artist or studio), and **an original
rendering style throughout**, carried by one byte-identical STYLE constant.

Project 5's direction was *"gritty chibi hero-shooter key art — recognisable at 34px, never a
copy at 512px"*, and it produced 153 images that read as one set. **Ask the owner again**;
One Piece has an extremely distinctive published style and the temptation to imitate it is the
whole risk, so the brief matters more here than it has before.

**Copy the prompt pipeline wholesale.** `tools/build-art-prompts.mjs` holds an identity table —
one visual clause per character, written once, so a character appearing on several cards is
described identically and only the environment varies — and **a lint that refuses to write the
JSON** when a prompt breaks a rule. On project 5 that lint caught six real violations across two
runs, all of them *before* any money was spent: counts above two (which the model renders
unreliably), text-magnet nouns, and negations, which summon the very thing they negate.

Billing is prepaid. Idempotent by default, `--dry-run` makes zero network calls and prints the
whole plan, `--limit` caps a paid run, `--force` archives first, masters never enter the repo.
**Sample three, look at them, then run the batch.** 153 renders is not when to discover the
style constant is wrong.

## 7.7 Sound

`docs/sound.md` from project 5 is the template. One module owns every audio decision; **the
audio layer rides the structured log**, so the engine tags events and a tag with no voice is
simply ignored; one `AudioContext`; a synthesized Web Audio kit as the floor with generated
one-shots layered over it; autoplay refusal is "wait", not an error; mute persists and a muted
reload creates no context at all.

**The trap, restated because it costs a commit every time nobody restates it:** a sound tagged on
a *mechanism* that fires more often than the *picture* does will drive the player out of the
room. Project 4's siren was the rune sound firing on every payment. Rate-limit the frequent tags
and voice the moment the player **sees**.

**Music: project 5 generated its own** and that is now the recommended default. The plan was CC0
from OpenGameArt; the two tracks that actually suited the game were CC-BY, which needs
attribution and breaks the CC0-only rule. Rather than relax the rule, `js/audio.js` writes an
original procedural score — a lookahead scheduler on the *audio* clock (never `setTimeout`, or
the tempo drifts when the main thread is busy), a chord pad, and a pulse layer on a minor
pentatonic so a derived sequence cannot land on a wrong note. **The repo carries no third-party
audio at all**, which is a cleaner posture than the one it originally promised.

For One Piece the tag set writes itself: a card played, DON!! attached, an attack declared, a
blocker interposing, **a counter played** (this one wants to feel like a parry), a character
KO'd, **a life card taken** (this is the clock — make it escalate as life runs down, the way
project 5's convoy tick did), a trigger revealed, and the Leader's defeat.

## 7.8 Vocabulary to decide before writing any prose

The `terms` table needs the project's own words for everything the theme renames: the resource,
the life zone, the leader, the four card types, the six colours, and every keyword — Blocker,
Counter, Rush, Double Attack, Banish, Trigger, and the timing tags. Everything generated reads
these at render time and the pack swaps them with the names. **Decide once; renaming later
touches every describer.**

---

# 8. Day-one checklist

In order.

1. **`.gitignore` committed alone**, before the first tool: `scratch/`, key files, art masters and
   archives, traces, editor lock files. Project 5 had API tokens loose in the project directory on
   commit zero; they were ignored in the first commit for exactly this reason.
2. **Read and record what Bandai publishes**, with dates and URLs, before any code (§7.1).
3. **`CLAUDE.md` on commit one**, pointing at all five lessons files, the playbook and the three
   UI specs, and stating the regime decisions explicitly: **fidelity is the product**, **printed
   text on the face**, **which name pack is the default**, and **1v1 only**.
4. **Download the Comprehensive Rules and Q&A PDFs into gitignored `scratch/`** and start
   `docs/rules.md` as a citation index.
5. **One agent per worktree**, explicit path outside any synced folder; `main`'s checkout is the
   integration tree that nobody works in.
6. **The script-list equality check** and the **asset-hash stamp**, both in CI, plus greps for
   **both** forms of the silent fallback — `if (!NS.x)` *and* `NS.x || {}` (§5.3).
7. **The defects gate**, empty and wired.
8. **Engine skeleton**: `legalActions` / `apply` (immutable) / `isTerminal`, seeded RNG inside
   `apply`, structured log, the resolution queue, `whoActs`.
9. **The reactive window, designed before the first card** (§7.3) — a queue step whose `ctrl` is
   the other seat, a counter loop with `min: 0` and an explicit decline, and a prompt that says
   what declining does.
10. **The one targeting door before the first ability**, with `min`/`max` on the target step, and
    a gate that greps for ops that pick without it.
11. **Load-time validation** including deck-construction legality (50 / 4-of / colour match / 10
    DON!!) and the `unimplemented` marker that validation rejects from any registered deck.
12. **The test harness and Node runner**, `--quiet` / `--filter` / `--full`.
13. **The black box and its replayer with `--selftest`**, before the first playtest.
14. **Two AI behaviour counters from the start**: turns with zero actions, and counter-steps
    where the AI declined (§5.1).
15. **A playable build: two ST starter decks, one board, an AI opponent** — before importing a
    set (§7.4). This is the milestone the owner actually wants.
16. **The printed-text pack and the audit tool that diffs generated prose against it** (§6.1) —
    **early, with FAIL/WARN severities from the start.** For a reproduction it diffs against
    printed text rather than a kit table, which makes it stricter and more valuable, not less.
17. **`tools/check-art.mjs` and an in-app art diagnostic**, wired before the first render (§5.3).
18. **NOTICE.md, `docs/takedown.md` with the actual commands, and the disclaimer on a screen the
    player sees.**
19. **A dated Status in `PLAN.md`, rewritten every session — and grepped against every other file
    that states the same decision.** One file owns each decision; the others point at it.
20. **Before committing any document, `ls` everything it claims exists** (§6.1).

---

# 9. Files to copy into the new repo

```
CARD-GAME-LESSONS.md          CARD-GAME-LESSONS-2.md        CARD-GAME-LESSONS-3.md
CARD-GAME-LESSONS-4.md        CARD-GAME-LESSONS-5.md (this file)
OVERNIGHT-BUILD-PLAYBOOK.md
CARD-PRESENTATION-SPEC.md     CARD-LOG-AND-TARGETING-SPEC.md  CARD-FANNING-SPEC.md
```

Worth reading in the RIVALFORGE repo rather than copying blind:

- `CLAUDE.md` — fifteen hard rules in their final form; 14 (one door per rule, with greps) and
  15 (every choice through `offerChoice`) are the two that earn their keep fastest.
- `tools/check-pages.mjs` — the bypass greps, including the comment-stripping pass, without which
  the gate fails on its own documentation.
- `tools/audit-kits.mjs` — the auditor, and specifically its **severity split**: what counts as
  a defect, what counts as a note, and why exempting your own design axis is what keeps it
  readable. For project 6 the same shape diffs against `data/printed.js` instead.
- `tools/check-art.mjs`, `tools/sweep.mjs` + `sweep-run.mjs`, `tools/replay-report.mjs`,
  `tools/build-art-prompts.mjs` (the lint), `tools/gen-art.mjs` (the STYLE constant and the
  idempotent paid-run discipline), `tools/arena.mjs` (both seats, decisive only).
- `js/engine.js` — the choice door and the invocation model: an effect runs on a copy, and when
  it needs a decision the partial run is **discarded** and the pre-effect state comes back with
  the question parked. Effects are atomic even though they ask questions in the middle, and RNG
  advances only on the run that survives.
- `js/ai.js` — the horizon rule (§5.1) with the whole story in the comment, and every weight
  carrying its sweep.
- `js/drag.js` and `js/anim.js` — drag-to-commit with all of `CARD-PRESENTATION-SPEC.md` §10's
  mechanics, and the FLIP animation layer.
- `js/audio.js` — the log-riding tag table and the procedural score.
- `BALANCE.md` — **not** as a template (you will not need one) but as an example of what a
  measurement written down properly looks like: what was measured, over how many games, in both
  seats, and how many were decisive.

---

*Written at the RIVALFORGE handoff, 2026-09-25, for the One Piece project that follows it.
Suite green at 34 tests; check-pages clean at 29 scripts; `check-art` clean at 153 entries;
`data/defects.js` empty; all six decks offered; every asset stamp current.*

*And the line that matters most, carried forward for a fifth time and now with better evidence
than ever: **the owner has been right about the shape of these projects every time, including
the times he was argued with.** On project 5 he called two rules broken before any data existed
and measurement agreed with him on both. Get something playable in front of him early, and let
what he says about playing it be the specification.*

*The one thing project 5 would tell you that the others could not: **it is much cheaper to
change a rule than to change a hundred cards, so find out which rules are wrong before you
author the content.** For this project, that means two starter decks and a real game of One
Piece before you import a single set.*
