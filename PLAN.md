# PLAN

**This file owns every project decision.** No other file states one; they point here. Rewrite
the Status every session.

---

## Status — 2026-09-26

Overnight build in progress, unsupervised. Question round answered before the owner slept; all
four answers were the recommended option.

**Done**
- `.gitignore` committed alone, secrets ignored from commit zero.
- Rights read and recorded with dates (`docs/rights.md`), `NOTICE.md`, `docs/takedown.md`.
- Comprehensive Rules v1.2.1, Rule Manual and Floor Rules in gitignored `scratch/rules/`.
- All 60 series of the official card list scraped; `data/printed.js` built —
  **2,785 distinct card numbers, 142 Leaders**, printed text verbatim.
- The ten meta archetypes captured from onepiece.gg with per-card counts
  (`scratch/decks/onepiece-gg-meta-2026-09-26.json`).

**Next, in order** — every arrow leaves the thing runnable
engine spine + tests → two starter decks playable vs the AI → interface → art → sound →
the ten meta decks → registers and handoff.

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

### D3 — Art direction · 2026-09-26 · owner
**Painted tropical-adventure key art.** Rich painterly digital illustration, sun-bleached seas
and storm skies, bold silhouettes, saturated primaries; readable at 34px, original at 512px.
One byte-identical `STYLE` constant in `tools/gen-art.mjs`. Three constants that do not move:
no text rendered in an image; no reproduction of a specific official illustration; never name a
real artist or studio.

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
