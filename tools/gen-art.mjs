#!/usr/bin/env node
// tools/gen-art.mjs — the paid run. Billing is prepaid; this spends real money, so:
//
//   --dry-run   makes ZERO network calls and prints the whole plan
//   --limit N   caps a paid run
//   --force     archives the existing render first instead of skipping it
//   default     IDEMPOTENT — an id that already has a file is skipped and never re-spent
//
// SAMPLE THREE, LOOK AT THEM, THEN RUN THE BATCH. 147 renders is not when to discover the STYLE
// constant is wrong (lessons-5 §7.6 / playbook §6).
//
// Masters never enter the repo: art/masters/ is gitignored and only the .webp delivery encodes
// are committed.
import { readFile, writeFile, mkdir, stat, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const DRY = args.includes('--dry-run');
const FORCE = args.includes('--force');
const LIMIT = Number(opt('--limit', '0')) || Infinity;
const ONLY = opt('--only', null);

const ENDPOINT = 'https://router.huggingface.co/nscale/v1/images/generations';

const plan = JSON.parse(await readFile(join(ROOT, 'tools', 'art-prompts.json'), 'utf8'));
const OUT = join(ROOT, 'art', 'cards');
const MASTERS = join(ROOT, 'art', 'masters');
const ARCHIVE = join(ROOT, 'art', 'archive');
await mkdir(OUT, { recursive: true });
await mkdir(MASTERS, { recursive: true });

async function exists(p) { try { const s = await stat(p); return s.size > 1000; } catch { return false; } }

let todo = plan.prompts;
if (ONLY) todo = todo.filter((p) => ONLY.split(',').includes(p.id));

const work = [];
for (const p of todo) {
  const webp = join(OUT, p.id + '.webp');
  if (!FORCE && await exists(webp)) continue;
  work.push(p);
}
const capped = work.slice(0, LIMIT);

console.log(`${plan.prompts.length} in the plan · ${plan.prompts.length - work.length} already rendered · ${work.length} outstanding`);
console.log(`this run would generate ${capped.length}` + (LIMIT !== Infinity ? ` (--limit ${LIMIT})` : ''));
console.log(`model ${plan.model} · size ${plan.size}`);
console.log(`style: ${plan.style}\n`);

if (DRY) {
  capped.forEach((p) => console.log(`  ${p.id}  ${p.name}\n      ${p.prompt.slice(0, 150)}…`));
  console.log(`\n--dry-run: no network calls were made, nothing was spent.`);
  process.exit(0);
}

const TOKEN = (await readFile(join(ROOT, 'hf_token.md'), 'utf8')).trim();
if (!TOKEN.startsWith('hf_')) throw new Error('hf_token.md does not look like a token');

// cwebp if it is here, sips otherwise — macOS ships sips, and neither enters the repo.
async function toWebp(pngPath, webpPath) {
  try { await run('cwebp', ['-q', '82', '-quiet', pngPath, '-o', webpPath]); return 'cwebp'; }
  catch {}
  try { await run('sips', ['-s', 'format', 'webp', '-s', 'formatOptions', '80', pngPath, '--out', webpPath]); return 'sips'; }
  catch (e) { throw new Error('no webp encoder (tried cwebp and sips): ' + e.message); }
}

let ok = 0, failed = 0, bytes = 0;
for (let i = 0; i < capped.length; i++) {
  const p = capped[i];
  process.stdout.write(`[${i + 1}/${capped.length}] ${p.id} ${p.name} … `);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: plan.model, prompt: p.prompt, size: plan.size,
                             response_format: 'b64_json' })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 160));
    const j = await res.json();
    const b64 = j.data && j.data[0] && j.data[0].b64_json;
    if (!b64) throw new Error('no image in the response');
    const buf = Buffer.from(b64, 'base64');
    const png = join(MASTERS, p.id + '.png');
    await writeFile(png, buf);
    const webp = join(OUT, p.id + '.webp');
    if (FORCE && await exists(webp)) {
      await mkdir(ARCHIVE, { recursive: true });
      await rename(webp, join(ARCHIVE, p.id + '.' + Date.now() + '.webp'));
    }
    await toWebp(png, webp);
    const s = await stat(webp);
    bytes += s.size; ok++;
    console.log(`ok  ${(s.size / 1024).toFixed(0)}kb`);
  } catch (e) {
    failed++;
    console.log('FAIL  ' + e.message);
  }
}

console.log(`\n${ok} rendered, ${failed} failed, ${(bytes / 1048576).toFixed(1)} MB of webp`);
if (ok) console.log('now run: node tools/write-manifest.mjs');
