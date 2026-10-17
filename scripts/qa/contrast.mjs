#!/usr/bin/env node
// WCAG contrast of this store's palette: reads the :root (light) and .dark token blocks in src/index.css
// and prints the ratio for every standard pair (text 4.5:1, form borders and focus rings 3:1).
// Phase 3 runs it after editing the tokens. Exits 1 if any pair fails, so it can gate a commit.
//
//   node scripts/qa/contrast.mjs [path/to/index.css]
//   node scripts/qa/contrast.mjs docs/look/home-mockup.html     (an HTML page: reads its <style> tags)
//
// The maths and the pair list are in scripts/lib/contrast.mjs (tests/contrast.test.ts covers them).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPalette, extractStyles, PAIRS, parseTokenBlocks, themeTokens } from '../lib/contrast.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../../..');
const file = process.argv[2] ? resolve(process.argv[2]) : resolve(root, 'src/index.css');

let css;
try {
  css = readFileSync(file, 'utf8');
} catch (e) {
  console.error(`Cannot read ${file}: ${e.message}`);
  process.exit(2);
}

const isPage = /\.html?$/i.test(file);
const parsed = parseTokenBlocks(isPage ? extractStyles(css) : css);
if (!Object.keys(parsed.light).length) {
  console.error(`No colour tokens found in the :root block of ${file}.`);
  process.exit(2);
}

// A mockup page carries only the tokens it draws with, so pairs it has no tokens for are skipped there.
const rows = checkPalette(themeTokens(parsed), { skipMissing: isPage });
const skipped = isPage ? 2 * PAIRS.length - rows.length : 0;
// Floor, not round: 4.499 must not print as 4.50 next to a FAIL.
const fmt = (n) => (Math.floor(n * 100) / 100).toFixed(2);
const width = Math.max(...rows.map((r) => r.label.length));

for (const theme of ['light', 'dark']) {
  console.log(`\n${theme.toUpperCase()} (${file})`);
  for (const r of rows.filter((x) => x.theme === theme)) {
    const ratio = r.ratio === null ? ' n/a ' : `${fmt(r.ratio)}:1`;
    const verdict = r.pass ? 'ok  ' : 'FAIL';
    const why = r.ratio === null ? '  token missing' : '';
    console.log(`  ${verdict} ${r.label.padEnd(width)}  ${ratio.padStart(8)}  needs ${r.min}:1${why}`);
  }
}

const failed = rows.filter((r) => !r.pass);
console.log(`\n${rows.length - failed.length} of ${rows.length} pairs pass.${skipped ? ` (${skipped} skipped: the page has no tokens for them.)` : ''}`);
if (failed.length) {
  console.log(`\n${failed.length} FAILED:`);
  for (const r of failed) {
    console.log(`  ${r.theme}: ${r.label} ${r.ratio === null ? 'token missing' : `${fmt(r.ratio)}:1`}, needs ${r.min}:1`);
  }
  process.exit(1);
}
