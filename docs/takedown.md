# Takedown

The exact commands, so a request can be honoured in minutes rather than discussed.

## Level 1 — remove the printed card text (Bandai's expression)

The game stays playable: `js/text.js` generates prose from the ability data and is the declared
fallback, so every card still reads correctly in the project's own words.

```bash
git rm data/printed.js
printf '// data/printed.js removed on request. js/text.js is the describer.\n(function(NS){NS.printed=[];NS.printedMeta={removed:true};}(window.OP=window.OP||{}));\n' > data/printed.js
git add data/printed.js && git commit -m "takedown: remove printed card text"
```

Then confirm nothing reaches for it outside the fallback:

```bash
node tools/check-pages.mjs && node tools/test.mjs --quiet
```

## Level 2 — remove the character names (Oda / Shueisha)

`js/names.js` carries two packs and one switch. Flip the constant; every player-visible string
is read at render time, so cards, log lines, prompts and keyword help all change at once.

```bash
sed -i '' "s/NAME_PACK = 'characters'/NAME_PACK = 'original'/" js/names.js
node tools/test.mjs --quiet && git commit -am "takedown: switch to the original name pack"
```

## Level 3 — remove everything

```bash
git rm -r --cached . && rm -rf .git
```

## Contact

Open an issue, or reach the author at the address in the repository's git history.
