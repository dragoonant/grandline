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
import { IDENTITY, derivedClause } from './art-identity.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ===========================================================================================
// THE STYLE CONSTANT. PLAN.md D3, the owner's call on 2026-09-26. Byte-identical on every
// prompt; changing it means paying for every render again.
// ===========================================================================================
// Revised 2026-09-26 on the owner's call: the first pass was painterly Western-fantasy key art
// and the characters did not read as themselves. This is cel animation as a RENDERING
// TECHNIQUE — flat colour, hard shadow terminators, ink linework — which is a broad medium and
// not anyone's property. What it is NOT is an imitation of any particular show's house style,
// and the lint below still refuses any prompt that names a franchise, studio or artist.
export const STYLE =
  'bold cel-shaded anime illustration, clean confident ink linework with varied weight, ' +
  'flat colour blocks and hard-edged cel shadow, bright saturated palette, ' +
  'expressive exaggerated features and strong silhouette, dynamic action pose, ' +
  'dramatic low camera angle, crisp highlights, original character design';

// Flat graphic backdrops, so the figure stays the subject at 34px. Cel shading wants simple
// backgrounds; a busy painterly sky fights the linework.
const SCENE = {
  Red:    'flat burning-orange sky and graphic sunburst rays behind the figure',
  Green:  'flat jade-green sky and stylised wind-bent grass behind the figure',
  Blue:   'flat deep-blue sky and stylised cresting wave shapes behind the figure',
  Purple: 'flat violet sky and graphic lightning forks behind the figure',
  Black:  'flat charcoal sky and hard diagonal rain streaks behind the figure',
  Yellow: 'flat gold sky and stylised radiating cloud bands behind the figure'
};

const BANNED_NOUNS = /\b(sign|signage|banner|poster|logo|label|text|lettering|letters|words|title|caption|subtitle|newspaper|book|page|scroll|placard|billboard|nameplate|watermark|signature|inscription)\b/i;
const NEGATIONS = /\b(no|not|without|never|avoid|exclude|absent|free of|lacking)\b/i;
const NAMED = /\b(one piece|oda|eiichiro|toei|bandai|shueisha|studio ghibli|disney|pixar|marvel|artstation|greg rutkowski|makoto shinkai|akira toriyama|in the style of|style of)\b/i;
const BIG_COUNT = /\b(three|four|five|six|seven|eight|nine|ten|dozen|many|crowd|group of|several)\b/i;

function lint(id, prompt) {
  const errs = [];
  let m;
  if ((m = prompt.match(BANNED_NOUNS))) errs.push(`text-magnet noun "${m[0]}" — the model will render letters`);
  if ((m = prompt.match(NEGATIONS))) errs.push(`negation "${m[0]}" — negations summon what they negate`);
  if ((m = prompt.match(NAMED))) errs.push(`names a real work, artist or studio: "${m[0]}"`);
  if ((m = prompt.match(BIG_COUNT))) errs.push(`count above two ("${m[0]}") renders unreliably`);
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
let named = 0, derived = 0;
for (const id of [...ids].sort()) {
  const c = BY_ID.get(id);
  const clause = IDENTITY[c.name];
  if (clause) named++; else derived++;
  const subject = clause || derivedClause(c);
  const scene = SCENE[c.color[0]] || SCENE.Blue;
  const frame = c.category === 'LEADER'
    ? 'full-length hero shot, the figure filling the frame, face clearly visible'
    : c.category === 'CHARACTER'
      ? 'waist-up hero shot, the figure filling the frame, face clearly visible'
      : 'wide graphic landscape with the horizon low';
  const prompt = `${subject}. ${frame}. ${scene}. ${STYLE}.`;
  prompts.push({ id, name: c.name, category: c.category, color: c.color[0] || 'Blue', prompt });
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
console.log(`  ${named} from the identity table, ${derived} derived from card data.`);
console.log(`  style: ${STYLE.slice(0, 70)}…`);
