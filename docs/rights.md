# Rights findings

**What Bandai actually publishes, read and recorded before any code**, per
`CARD-GAME-LESSONS-5.md` §7.1. Every line carries the date it was checked and the URL, so a
later session can tell a policy that changed from a policy nobody looked for.

All findings below were checked on **2026-09-26**.

## Three rights holders, not one

| Holder | What they hold |
|---|---|
| **Bandai** (Card Games Division) | the ONE PIECE CARD GAME — card designs, printed text, the rules documents, the card database |
| **Eiichiro Oda / Shueisha** | the ONE PIECE manga — characters, names, likenesses |
| **Toei Animation** | the ONE PIECE anime |

## What Bandai publishes

| Document | URL | Version / date seen |
|---|---|---|
| Comprehensive Rules | `https://en.onepiece-cardgame.com/pdf/rule_comprehensive.pdf` | **v1.2.1, last updated 2026-08-28** |
| Official Rule Manual | `https://en.onepiece-cardgame.com/pdf/rule_manual.pdf` | fetched 2026-09-26 |
| Floor Rules | `https://en.onepiece-cardgame.com/pdf/floor_rule.pdf` | fetched 2026-09-26 |
| Official card list | `https://en.onepiece-cardgame.com/cardlist/` | 60 series, through OP-17 / ST-36 / EB-03 / PRB-02 |

All four are in gitignored `scratch/`. Nothing from them is committed except the generated
`data/printed.js` (see NOTICE.md).

## The IP protection notice

`https://en.onepiece-cardgame.com/news/02_382.html`, dated **2026-07-10**, from BANDAI Card
Games Division. Its two operative prohibitions, quoted:

> "No cards, accessory items, or other goods derived from or copied from card designs released
> or sold by Bandai without authorization may be sold or distributed."

> "No cards, accessory items, or other goods that incorporate characters or similar aspects
> related to the ONE PIECE franchise without authorization are to be sold or distributed"

**Both prohibitions are about selling and distributing goods.** The notice gives no contact
address and no enforcement mechanism beyond a general "CONTACT US" link.

## What was searched for and NOT found

Recorded because "searched on this date, found none" is a finding and stops the next session
assuming a policy exists in either direction.

- **No fan-content or fan-game policy.** Searched the official site and the web on 2026-09-26.
  `https://en.onepiece-cardgame.com/terms/` returns **404**.
- **No published permission for non-commercial software, simulators or fan projects**, and
  equally **no published prohibition of them**. The 2026-07-10 notice is silent on software.
- **No official developer API or documented data feed.** The card list is a public web page.

## Where this project sits, honestly

- It is **not sold, monetised or advertised**, so the two quoted prohibitions — both of which
  turn on selling or distributing goods — are not engaged.
- It **does reproduce printed card text**, which is Bandai's copyrighted expression. This is the
  real exposure and it is not covered by any published permission. It is confined to one
  generated file (`data/printed.js`) built from gitignored scrapes, and the game is playable
  without it because the generated describer is the fallback.
- It **does use character names**, which are Oda/Shueisha's. One names file makes the entire
  game renameable by flipping one constant.
- It carries **no official image or audio at all**. Every illustration is generated in an
  original style; every sound is generated or synthesised.

If Bandai, Shueisha or Toei ask for it to come down, `docs/takedown.md` has the commands.
