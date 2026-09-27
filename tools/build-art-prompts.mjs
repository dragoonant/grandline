#!/usr/bin/env node
// tools/build-art-prompts.mjs — build tools/art-prompts.json, and LINT IT.
//
// The lint REFUSES TO WRITE THE FILE when a prompt breaks a rule. On project 5 that caught six
// real violations across two runs, all of them before any money was spent (lessons-5 §7.6).
// Validation that refuses to run beats a test that reports.
//
// Rules, each one a thing that actually goes wrong:
//   - text-magnet nouns (sign, banner, label, scroll…) make the model render letters, and the
//     first constant is that no text is ever rendered in an image
//   - a count above two renders unreliably
//   - negations summon the thing they negate ("no text" puts text in the frame)
//   - a named artist, studio or franchise is an IP violation and a prompt-level one
//   - the STYLE constant must be present byte-identical, or the set stops reading as one set
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WHO, CARDS } from './art-identity.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ===========================================================================================
// THE STYLE CONSTANT. PLAN.md D3, the owner's call — revised 2026-09-27 to candidate E of a
// ten-style audition on ST01-001. Byte-identical on every prompt; changing it means paying for
// every render again. The 2026-09-26 painterly brief ended "original character design" and
// described nobody by name, and the owner could not tell who anyone was.
// ===========================================================================================
export const STYLE =
  'premium trading card game anime illustration, polished cel shading, thick clean ink outlines, ' +
  'energetic effects, glowing aura, explosive dynamic composition, vivid saturated colour';

const BANNED_NOUNS = /\b(sign|signage|banner|poster|logo|label|text|lettering|letters|words|title|caption|subtitle|newspaper|book|page|scroll|placard|billboard|nameplate|watermark|signature|inscription)\b/i;
const NEGATIONS = /\b(no|not|without|never|avoid|exclude|absent|free of|lacking)\b/i;
const NAMED = /\b(one piece|oda|eiichiro|toei|bandai|shueisha|studio ghibli|disney|pixar|marvel|artstation|greg rutkowski|makoto shinkai|akira toriyama|in the style of|style of)\b/i;
// A count is a QUANTITY the model has to render, and it renders more than two unreliably. A
// capitalised one is part of a proper name — "The Four Emperors" is a crew, not four of
// anything — so the number words are matched lower-case only, while the genuinely crowd-forming
// words stay case-insensitive.
const BIG_COUNT = /\b(three|four|five|six|seven|eight|nine|ten|dozen)\b/;
const CROWD = /\b(many|crowd|group of|several)\b/i;

function lint(id, prompt) {
  const errs = [];
  let m;
  if ((m = prompt.match(BANNED_NOUNS))) errs.push(`text-magnet noun "${m[0]}" — the model will render letters`);
  if ((m = prompt.match(NEGATIONS))) errs.push(`negation "${m[0]}" — negations summon what they negate`);
  if ((m = prompt.match(NAMED))) errs.push(`names a real work, artist or studio: "${m[0]}"`);
  if ((m = prompt.match(BIG_COUNT))) errs.push(`count above two ("${m[0]}") renders unreliably`);
  if ((m = prompt.match(CROWD))) errs.push(`crowd word "${m[0]}" — the subject stops being readable at 34px`);
  if (!prompt.includes(STYLE)) errs.push('the STYLE constant is missing or altered');
  if (prompt.length > 900) errs.push(`prompt is ${prompt.length} chars, over the 900 cap`);
  return errs.map((e) => `${id}: ${e}`);
}

const load = async (rel) => {
  const src = await readFile(join(ROOT, rel), 'utf8');
  const w = {};
  new Function('window', src)(w);
  return w.OP;
};
const P = await load('data/printed.js');
const D = await load('data/decks.js');
const BY_ID = new Map(P.printed.map((c) => [c.id, c]));

// The deck registry decides the pool: only cards a player can actually meet get a render.
const ids = new Set();
for (const d of D.decks) { ids.add(d.leader); d.list.forEach(([id]) => ids.add(id)); }

const prompts = [];
const missing = [];
for (const id of [...ids].sort()) {
  const c = BY_ID.get(id);
  const card = CARDS[id];
  const who = WHO[c.name];
  // No derived fallback: a card with no entry is a hole in the table, and the build refuses.
  if (!card || (!card.subject && !who)) { missing.push(`${id} ${c.name}`); continue; }
  const stage = c.category === 'STAGE';
  let subject = card.subject || who;
  if (card.with) subject += ', with ' + card.with;
  if (card.act) subject += ', ' + card.act;
  const frame = stage ? 'the place itself is the subject'
    : card.with || card.pair || /\bbeside\b|side by side/.test(subject)
      ? 'both figures filling the frame, faces clearly visible'
      : c.category === 'EVENT' ? 'the action filling the frame'
        : 'dynamic action pose, the figure filling the frame, face clearly visible';
  const prompt = `${subject}. ${frame}. ${card.scene}. ${STYLE}.`;
  prompts.push({ id, name: c.name, category: c.category, color: c.color[0] || 'Blue', prompt });
}
if (missing.length) {
  console.error(`${missing.length} card(s) have no entry in tools/art-identity.mjs:\n  ` + missing.join('\n  '));
  process.exit(1);
}

const errs = prompts.flatMap((p) => lint(p.id, p.prompt));
if (errs.length) {
  console.error(`LINT FAILED — ${errs.length} violation(s). tools/art-prompts.json was NOT written.\n`);
  errs.slice(0, 40).forEach((e) => console.error('  ' + e));
  process.exit(1);
}

await writeFile(join(ROOT, 'tools', 'art-prompts.json'),
  JSON.stringify({ style: STYLE, built: new Date().toISOString().slice(0, 10),
                   model: 'black-forest-labs/FLUX.1-schnell', size: '768x1088',
                   count: prompts.length, prompts }, null, 2));

console.log(`${prompts.length} prompts, lint clean.`);
console.log(`  style: ${STYLE.slice(0, 70)}…`);
