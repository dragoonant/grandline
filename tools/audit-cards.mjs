#!/usr/bin/env node
// tools/audit-cards.mjs — the auditor. It diffs what js/text.js WRITES from the compiled
// grammar against what Bandai PRINTED, for every card in a registered deck.
//
// This is the only automated way to catch a clause silently dropped for want of a primitive,
// because a test cannot see it: both sides of a test come from the same ability data. On
// project 3 the equivalent tool found 65 real defects and on project 5 it found 7, in sets that
// had already passed a suite, a content validator and human playtests.
//
// SEVERITY IS THE WHOLE DESIGN. The first version of project 5's auditor reported 40 findings
// and would have been ignored within a day. A FAIL is a number, a keyword or a named zone that
// appears in print and nowhere in the compiled ability — something the engine will get wrong.
// A WARN is a wording difference, which is expected: the describer writes the project's own
// prose and is not trying to match Bandai's sentence.
//
//   --all     audit every card, not only the ones reachable in a registered deck
//   --warn    print the warnings too
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, loadEngine } from './lib/load.mjs';

const args = process.argv.slice(2);
const ALL = args.includes('--all');
const SHOW_WARN = args.includes('--warn');

const OP = await loadEngine();

const reach = new Set();
for (const d of OP.decks) { reach.add(d.leader); d.list.forEach(([i]) => reach.add(i)); }
const cards = OP.cards.all().filter((c) => ALL || reach.has(c.id));

const norm = (s) => (s || '')
  .replace(/\s*\((?:[^()]|\([^()]*\))*\)\s*/g, ' ')     // CR 2-8-4-1 explanatory notes
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/−/g, '-')
  .replace(/\s+/g, ' ').trim();

const fails = [], warns = [];

for (const c of cards) {
  const printed = norm([c.text, c.triggerText].filter(Boolean).join(' '));
  if (!printed || printed === '-') continue;
  const mine = norm([OP.text.describeCard(c), OP.text.describeTrigger(c)].filter(Boolean).join(' '));

  // The describer renders an ability's OPS as prose but writes its costs and conditions in its
  // own shorthand, so the audit compares against the compiled ability as a whole, not only the
  // sentence. Without this the auditor cried wolf on every card whose only mention of the hand
  // or the trash was in an activation cost.
  // `text` is the PRINTED clause, carried on each ability for traceability. It must be stripped
  // before this is used as evidence, or every check matches the printed sentence against itself
  // and the auditor goes silently blind — which is worse than crying wolf.
  const compiled = JSON.stringify((c.abilities || []).map(function (ab) {
    var copy = Object.assign({}, ab); delete copy.text; return copy;
  })) + ' ' + JSON.stringify(c.keywords || []);
  // Op and cost kinds are camelCase ("trashHand", "lifeToHand"), so split them before the zone
  // words are looked for — otherwise \btrash\b never matches inside "trashHand".
  const compiledWords = compiled.replace(/([a-z])([A-Z])/g, '$1 $2');

  // --- FAIL 1: a number that is printed and is nowhere in the compiled ability. -------------
  // Power values, costs and counts are what the engine actually acts on, so a printed 4000 with
  // no 4000 in the grammar means a clause was dropped or misread.
  const pNums = [...printed.matchAll(/\b\d{3,5}\b/g)].map((m) => m[0]);
  const mNums = new Set([...mine.matchAll(/\b\d{3,5}\b/g)].map((m) => m[0]));
  const lostNums = [...new Set(pNums)].filter((n) => !mNums.has(n));
  if (lostNums.length) {
    fails.push([c.id, c.name, `printed value(s) ${lostNums.join(', ')} appear nowhere in the compiled ability`]);
  }

  // --- FAIL 2: a printed keyword or timing tag that the compiled ability does not carry. -----
  const TAGS = /\[(Blocker|Rush|Rush: Character|Double Attack|Banish|Unblockable|Trigger|Counter|Main|Activate: Main|On Play|When Attacking|On Block|On K\.O\.|End of Your Turn|End of Your Opponent's Turn|Once Per Turn|Your Turn|Opponent's Turn|DON!! ?x\d+|On Your Opponent's Attack)\]/g;
  // "trash 1 card with a [Trigger] from your hand" names a PROPERTY of a card in hand, not this
  // card's own timing. Counting it as a lost timing tag is the auditor crying wolf, and an
  // auditor that cries wolf is worse than no auditor (lessons-5 §6.1).
  const printedForTags = printed.replace(/\bwith an? (\[[^\]]+\])/gi, ' ');
  const pTags = [...new Set([...printedForTags.matchAll(TAGS)].map((m) => m[0].replace(/DON!! ?x/, 'DON!! x')))];
  const mTagsRaw = [...mine.matchAll(TAGS)].map((m) => m[0].replace(/DON!! ?x/, 'DON!! x'));
  const mTags = new Set(mTagsRaw);
  const lostTags = pTags.filter((t) => !mTags.has(t) && !compiled.includes(t.replace(/[[\]]/g, '')));
  if (lostTags.length) {
    fails.push([c.id, c.name, `printed tag(s) ${lostTags.join(' ')} are not in the compiled ability`]);
  }

  // --- FAIL 3: a named zone the printed text acts on that the grammar never mentions. --------
  const ZONES = ['deck', 'trash', 'hand', 'Life'];
  const lostZones = ZONES.filter((z) => {
    const re = new RegExp('\\b' + z + '\\b', 'i');
    return re.test(printed) && !re.test(mine) && !re.test(compiledWords);
  });
  if (lostZones.length) {
    fails.push([c.id, c.name, `printed text acts on the ${lostZones.join(' / ')} and the compiled ability never mentions it`]);
  }

  // --- WARN: wording differences. Expected, and not a defect. --------------------------------
  const words = (s) => new Set(norm(s).toLowerCase().replace(/[^a-z!\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
  const pw = words(printed), mw = words(mine);
  const onlyPrinted = [...pw].filter((w) => !mw.has(w));
  if (onlyPrinted.length > 3) {
    warns.push([c.id, c.name, `${onlyPrinted.length} printed words not in the describer's prose: ${onlyPrinted.slice(0, 8).join(' ')}`]);
  }
}

// Cards the grammar refused outright are not audit findings — they are already excluded from
// every deck by validation, which is the system working. They are counted, not listed.
const refused = OP.cards.all().filter((c) => c.unimplemented).length;

console.log(`audited ${cards.length} card(s)${ALL ? ' (every card)' : ' reachable in a registered deck'}`);
console.log(`${refused} cards across the whole set carry \`unimplemented\` and cannot reach a deck at all\n`);

if (fails.length) {
  console.log(`FAIL — ${fails.length} finding(s): the engine will not do what the card says\n`);
  for (const [id, name, why] of fails) console.log(`  ${id}  ${name}\n      ${why}`);
} else console.log('FAIL — 0 findings.');

console.log(`\nWARN — ${warns.length} note(s) (wording differences; the describer writes its own prose)`);
if (SHOW_WARN) for (const [id, name, why] of warns) console.log(`  ${id}  ${name}\n      ${why}`);
else if (warns.length) console.log('  (run with --warn to list them)');

process.exit(fails.length ? 1 : 0);
