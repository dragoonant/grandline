#!/usr/bin/env node
// tools/fetch-cardlist.mjs — fetch every set page of Bandai's official card list
// into gitignored scratch/cards/. Raw HTML only; nothing here crosses into the
// repo. tools/build-printed.mjs turns these into data/printed.js.
//
// Idempotent: a series whose file already exists is skipped unless --force.
// Politeness: one request at a time with a delay, a real UA, and it stops on
// the first non-200 rather than hammering.
import { writeFile, readFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'scratch', 'cards');
const BASE = 'https://en.onepiece-cardgame.com/cardlist/';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const DELAY_MS = 900;
const force = process.argv.includes('--force');
const dry = process.argv.includes('--dry-run');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The index page carries every series as an <option>; we read the list from the
// site itself rather than hardcoding it, so a new set appears without an edit.
async function seriesList() {
  const indexPath = join(OUT, 'cardlist_index.html');
  let html;
  try { html = await readFile(indexPath, 'utf8'); }
  catch {
    const res = await fetch(BASE, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`index HTTP ${res.status}`);
    html = await res.text();
    await writeFile(indexPath, html);
  }
  const out = [];
  const re = /<option value="(\d+)"[^>]*>([^<]*(?:<br class="spInline">[^<]*)*)/g;
  let m;
  while ((m = re.exec(html))) {
    const label = m[2]
      .replace(/&lt;br class=&quot;spInline&quot;&gt;/g, ' ')
      .replace(/<br class="spInline">/g, ' ')
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
      .replace(/\s+/g, ' ').trim();
    if (m[1] === '') continue;
    out.push({ series: m[1], label });
  }
  return out;
}

const list = await seriesList();
console.log(`${list.length} series on the official card list`);
await mkdir(OUT, { recursive: true });

if (dry) {
  for (const s of list) console.log(`  ${s.series}  ${s.label}`);
  console.log('\n--dry-run: no requests made.');
  process.exit(0);
}

let fetched = 0, skipped = 0;
for (const s of list) {
  const path = join(OUT, `series-${s.series}.html`);
  if (!force) {
    try { const st = await stat(path); if (st.size > 2000) { skipped++; continue; } } catch {}
  }
  const url = `${BASE}?series=${s.series}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) { console.error(`FAIL ${s.series} HTTP ${res.status} — stopping`); process.exit(1); }
  const html = await res.text();
  await writeFile(path, html);
  const cards = (html.match(/class="modalCol"/g) || []).length;
  console.log(`  ${s.series}  ${cards.toString().padStart(4)} cards  ${s.label}`);
  fetched++;
  await sleep(DELAY_MS);
}
console.log(`\nfetched ${fetched}, skipped ${skipped} (already present)`);
