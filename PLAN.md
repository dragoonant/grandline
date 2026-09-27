# PLAN

**This file owns every project decision.** No other file states one; they point here. Rewrite
the Status every session.

---

## Status — 2026-09-26 (overnight run, unsupervised)

**It is playable.** Open `index.html`, or `node tools/serve.mjs`. Twelve decks, an AI opponent,
147 original illustrations, a generated sound kit and a score the program writes as it runs.

**Done**
- `.gitignore` committed alone; secrets ignored from commit zero.
- Rights read and recorded with dates (`docs/rights.md`), `NOTICE.md`, `docs/takedown.md`, and
  the disclaimer on the menu screen the player actually sees.
- Comprehensive Rules v1.2.1, the Rule Manual and the Floor Rules in gitignored `scratch/`;
  `docs/rules.md` is the citation index and the engine cites sections throughout.
- All 60 series of the official card list scraped. `data/printed.js`: **2,785 card numbers,
  142 Leaders**, printed text verbatim.
- Engine: `legalActions` / `apply` (immutable) / `isTerminal` / `whoActs`, one resolution queue,
  seeded RNG inside `apply`, structured log. **The reactive window — Block, Counter and Trigger —
  is a queue step whose `ctrl` is the other seat**, and nothing else was needed for it.
- `tools/build-abilities.mjs` compiles printed text into the grammar; **32.6%** of the set
  compiles and the rest is refused from every deck rather than half-working.
- Twelve registered decks, all legal at 50 / 4-of / colour-matched, each showing its provenance.
- AI with the horizon rule, plus the two behaviour counters from day one.
- Gates: `test.mjs` (25), `check-pages.mjs`, `check-art.mjs` (147), `audit-cards.mjs`
  (**0 FAIL, 9 WARN**), `arena.mjs`, and the black box with its replayer.

**Measured**
- **The player going first wins ~50%** over 32 games in both seats. Bandai's own answer — no
  draw and 1 DON!! on turn one (CR 6-3-1, 6-4-1) — reproduces almost exactly. That is the best
  single piece of evidence that the turn structure is right.
- **Turns on which the AI does nothing: 0.0%.** It was 5.5% before the evaluator was given a
  term for `[Blocker]`, at which point block windows went 0 → 59 in the same measurement. An
  evaluator blind to a rule measures itself (`CARD-GAME-LESSONS-5.md` §5.2).
- **Blocks are never declined; counters are played on about two thirds of windows.** Both seats,
  decisive results only.

**What is not done** — see `TODO.md` for the queue and `DEVIATIONS.md` for the standing bugs.
The largest gaps are compiler coverage (which decides how much of each meta deck is the real
list) and an animation layer.

**The three things to form an opinion on first**
1. **Does the Counter Step feel right?** It is the novel mechanic and the one place the game
   stops and asks you something during the opponent's turn. It currently asks every time you
   have any legal counter at all.
2. **Is the art direction right?** Re-rendered 2026-09-27 in the owner's chosen style (D3). Look
   at a deck's worth before asking for more.
3. **Do the meta decks play like the real ones?** Where a deck is mostly `inferred` slots
   (Enel at 6/50, Rocks.D.Xebec at 8/50) it will not, and the fix is compiler coverage.

---

## Decisions

### D1 — Names and printed text · 2026-09-26 · owner
**Real One Piece names, and Bandai's printed text verbatim on the card face.** `js/names.js`
carries a second `original` pack behind one constant so the whole game renames in one edit;
`docs/takedown.md` Level 2 is that edit. Do not re-open.

### D2 — Budget for paid generation · 2026-09-26 · owner
**Up to $40** across Hugging Face images and ElevenLabs sound effects. Music is written by the
program at runtime and costs nothing. Rules: `--dry-run` makes zero network calls; sample three
and look at them before any batch; idempotent by default; `--limit` caps a paid run.

### D3 — Art direction · revised 2026-09-27 · owner
**Anime trading-card illustration that looks like the show.** Polished cel shading, thick ink
outlines, energetic effects, explosive composition. Chosen as candidate **E** from a ten-style
audition on ST01-001. One byte-identical `STYLE` constant in `tools/build-art-prompts.mjs`.
- **Characters are named, with their recognisable design** (`WHO` in `tools/art-identity.mjs`,
  one clause per character). The 2026-09-26 pass described anonymous "pirate captains" and
  ended "original character design", and nobody on the cards read as themselves.
- **Every card has its own setting, taken from the arc it comes from** (`CARDS` in the same file):
  Wano, Dressrosa, Punk Hazard, Elbaph, Whole Cake, Marineford, Skypiea, Sabaody and so on. The
  first pass put one flat sky per colour behind everything.
- **A card is not limited to one figure.** Events are the move being performed, Stages are the
  place, and a card may carry two characters.
- A card with no table entry fails the build; there is no generic fallback.

Three constants that do not move: no text rendered in an image; no reproduction of a specific
official illustration; never name a real artist, studio or franchise in a prompt.

*Superseded 2026-09-26 brief:* painted tropical-adventure key art.

### D4 — Reactive-window feel · 2026-09-26 · owner
**Ask always, but auto-skip a window where the player has no legal option.** The Block, Counter
and Trigger prompts each say what is being decided, show the power arithmetic, and say what
happens if the player declines. A window with zero legal choices is never shown.

### D5 — Deck pool · 2026-09-26 · agent
Ten archetypes, taken from onepiece.gg's OP17 Standard tier list as captured on 2026-09-26
(758 placed decks from 34 events). Nine are its rated archetypes; the tenth, Edward.Newgate
(OP02-001), is its largest unrated archetype at 15 placed decks.

| # | Tier | Archetype | Colours | Leader |
|---|---|---|---|---|
| 1 | S | Dracule Mihawk | Green | OP14-020 |
| 2 | A | Nico Robin | Purple/Yellow | OP09-062 |
| 3 | B | Sabo | Red/Black | OP13-004 |
| 4 | B | Rocks.D.Xebec | Blue | OP17-039 |
| 5 | B | Luffy & Ace | Red/Green | ST30-001 |
| 6 | C | Monkey.D.Luffy | Black | OP17-079 |
| 7 | C | Kaido | Purple | OP17-058 |
| 8 | C | Enel | Purple | OP15-058 |
| 9 | D | Portgas.D.Ace | Red | OP16-001 |
| 10 | — | Edward.Newgate | Red | OP02-001 |

**Provenance is recorded per slot.** onepiece.gg's free tier publishes only the twelve
most-played cards per archetype, which covers roughly 43 of 50 slots. Every deck entry is
marked `measured` (onepiece.gg's table, with its copy count and inclusion rate) or `inferred`
(chosen here to complete a legal 50). The deck screen shows the split. Nothing is invented
silently.

### D6 — Repository location · 2026-09-26 · agent
The repo is the OneDrive project folder itself, so the playable build is where the owner
expects it. Single agent, so no worktree contention. `scratch/` is gitignored but still synced;
that is acceptable for scrapes and PDFs.

### D7 — First playable is two starter decks, not ten · 2026-09-26 · agent
ST-01 Straw Hat Crew against ST-02 Worst Generation, both complete 51-card products, exercising
Leader / Character / Event / Stage, DON!!, blockers, counters, triggers and life. The engine is
proven on those before a meta deck is authored. **If the night runs short the cut is deck
count, never quality** — a finished four-deck game beats ten half-authored ones.
