# GRAND LINE

An unofficial, non-commercial implementation of Bandai's **ONE PIECE CARD GAME**, played against
a computer opponent in a browser. No build step, no dependencies, no network.

**Please read `NOTICE.md` first.** This is a fan project, it is not affiliated with or endorsed
by Bandai, Eiichiro Oda, Shueisha or Toei Animation, and nothing here is sold or monetised.

## Play it

Open `index.html`, or:

```bash
node tools/serve.mjs
```

then <http://localhost:8181>.

## What is in it

- The rules of the **Comprehensive Rules v1.2.1 (2026-08-28)** — turn structure, DON!!, the
  Attack / Block / Counter / Damage sequence, Life, Triggers and the keyword effects. Every
  engine rule names the section it implements in a comment.
- **2,785 cards** of printed text from Bandai's official card list.
- **Twelve decks**: the ten meta archetypes from onepiece.gg's OP17 Standard tier list as
  captured on 2026-09-26, plus the two Bandai starter decks the engine was proven on. Each deck
  screen shows how much of the list is onepiece.gg's measured data and how much was chosen here
  to complete a legal 50.
- **147 original illustrations**, generated for this project in one style. No official art.
- **Original audio**: a synthesised sound kit and a score the program writes as it runs. There
  is no third-party audio in this repository.

## Gates

```bash
node tools/test.mjs          # the suite, named by the rule each test checks
node tools/check-pages.mjs   # one script list, and the greps for every bypass that has happened
node tools/check-art.mjs     # every declared image is present, non-empty and correctly cased
node tools/audit-cards.mjs   # printed text vs. what the engine will actually do
node tools/arena.mjs         # AI against AI, both seats, with the behaviour counters
```

## Where things are

`CLAUDE.md` is the regime and the fifteen hard rules. `PLAN.md` owns every decision.
`DEVIATIONS.md`, `TODO.md` and `data/defects.js` are the other three registers, and each says
what it is not. `docs/rules.md` is a citation index into Bandai's rules; `docs/rights.md`
records what Bandai publishes, with dates.
