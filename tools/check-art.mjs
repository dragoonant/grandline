#!/usr/bin/env node
// tools/check-art.mjs — refuse a declared image that is missing, zero-length, truncated, the
// wrong case, or untracked by git.
//
// macOS is case-insensitive and a Linux server is not: a manifest entry that differs from the
// file only in case works here and 404s there. That is why the case check exists and why it
// compares against the real directory listing rather than just stat()ing the path.
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT } from './lib/load.mjs';

const run = promisify(execFile);
let fails = 0;
const fail = (m) => { console.error('FAIL  ' + m); fails++; };

const src = await readFile(join(ROOT, 'art', 'manifest.js'), 'utf8');
const w = {};
new Function('window', src)(w);
const manifest = w.OP.artManifest;
const ids = Object.keys(manifest);
console.log(`${ids.length} declared renders`);

// Real listings, per directory, for the exact-case check.
const listings = new Map();
async function listing(dir) {
  if (!listings.has(dir)) {
    try { listings.set(dir, new Set(await readdir(join(ROOT, dir)))); }
    catch { listings.set(dir, new Set()); }
  }
  return listings.get(dir);
}

// WebP magic: "RIFF" .... "WEBP"
function isWebp(buf) {
  return buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' &&
         buf.toString('ascii', 8, 12) === 'WEBP';
}

let tracked = new Set();
try {
  const { stdout } = await run('git', ['ls-files', 'art/cards'], { cwd: ROOT, maxBuffer: 1 << 24 });
  tracked = new Set(stdout.split('\n').filter(Boolean));
} catch { console.warn('warn  git ls-files failed; the tracked check is skipped'); }

let okCount = 0, bytes = 0;
for (const id of ids) {
  const rel = manifest[id];
  if (rel.startsWith('/')) { fail(`${id}: "${rel}" is root-relative and will 404 from file://`); continue; }
  const abs = join(ROOT, rel);
  let st;
  try { st = await stat(abs); } catch { fail(`${id}: ${rel} does not exist`); continue; }
  if (st.size === 0) { fail(`${id}: ${rel} is zero length`); continue; }
  if (st.size < 1000) fail(`${id}: ${rel} is only ${st.size} bytes — probably truncated`);

  const names = await listing(dirname(rel));
  if (!names.has(basename(rel))) fail(`${id}: ${rel} differs in CASE from the file on disk`);

  const buf = await readFile(abs);
  if (!isWebp(buf)) { fail(`${id}: ${rel} is not a WebP (bad magic bytes)`); continue; }
  if (tracked.size && !tracked.has(rel)) fail(`${id}: ${rel} exists but git does not track it`);

  okCount++; bytes += st.size;
}

// A card in a registered deck with no render is not a failure — it draws the procedural
// placeholder — but it IS worth printing, because it is the number that tells you the art pass
// is incomplete.
const dsrc = await readFile(join(ROOT, 'data', 'decks.js'), 'utf8');
const dw = {}; new Function('window', dsrc)(dw);
const need = new Set();
for (const d of dw.OP.decks) { need.add(d.leader); d.list.forEach(([i]) => need.add(i)); }
const missing = [...need].filter((i) => !manifest[i]);

console.log(`${okCount} verified, ${(bytes / 1048576).toFixed(1)} MB`);
console.log(`${need.size} cards are reachable in a registered deck; ${missing.length} of them have no render` +
            (missing.length ? ` (${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''})` : ''));
console.log(`\n${fails} failures`);
process.exit(fails ? 1 : 0);
