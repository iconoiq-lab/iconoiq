import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { checkPalette, extractStyles, parseTokenBlocks, themeTokens } from '../scripts/lib/contrast.mjs';

/**
 * docs/template/mockups/home-mockup-starter.html is what every store copies to docs/look/home-mockup.html
 * in Phase 2 and re-skins by editing its one :root / .dark token block. These checks keep it a sound
 * starting point: it uses the template's own role names and current values, its palette passes the same
 * contrast rules as the store, and it carries no invented facts.
 */
const FILE = 'docs/template/mockups/home-mockup-starter.html';
const html = readFileSync(FILE, 'utf8');
const css = extractStyles(html);
const tokens = parseTokenBlocks(css);

// In a client copy src/index.css is re-skinned, so "same values as the template" holds only in the template repo
// (docs/template/client/ exists only there, the same switch tests/progress.test.ts uses).
const inTemplateRepo = existsSync('docs/template/client/PROGRESS.md');

test('the starter palette passes the store contrast rules (4.5:1 text, 3:1 borders) in both themes', () => {
  const rows = checkPalette(themeTokens(tokens), { skipMissing: true });
  assert.ok(rows.length >= 30, `only ${rows.length} pairs were measured`);
  const failed = rows.filter((r: { pass: boolean }) => !r.pass)
    .map((r: any) => `${r.theme}: ${r.label} ${r.ratio.toFixed(2)}:1 (needs ${r.min}:1)`);
  assert.deepEqual(failed, []);
});

test('the token block holds the template\'s current values from src/index.css', { skip: inTemplateRepo ? false : 'client copy: index.css is re-skinned' }, () => {
  const index = readFileSync('src/index.css', 'utf8');
  const real = parseTokenBlocks(index);
  for (const theme of ['light', 'dark'] as const) {
    const names = Object.keys(tokens[theme]);
    assert.ok(names.length >= 15, `${theme}: the starter declares its colour tokens`);
    for (const name of names) {
      assert.equal(tokens[theme][name], real[theme][name], `--${name} (${theme}) differs from src/index.css`);
    }
  }
  // Non-colour tokens: radii and fonts are declared once in index.css; the grain strength twice (light, dark).
  for (const name of ['radius-panel', 'radius-card', 'radius-control', 'radius-chip', 'font-heading', 'font-body']) {
    const want = index.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm'))?.[1].trim();
    const got = css.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm'))?.[1].trim();
    assert.ok(want, `--${name} exists in src/index.css`);
    assert.equal(got, want, `--${name} differs from src/index.css`);
  }
  const grain = (text: string) => [...text.matchAll(/^\s*--grain-opacity:\s*([^;]+);/gm)].map((m) => m[1].trim());
  assert.deepEqual(grain(css), grain(index), '--grain-opacity (light, dark)');
});

test('every var(--name) the page uses is declared in the page', () => {
  const declared = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const used = [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))];
  assert.deepEqual(used.filter((n) => !declared.has(n)), []);
});

test('it shows the blocks a Phase 2 mockup needs, with a theme toggle, ?theme=dark and reduced-motion CSS', () => {
  for (const marker of ['class="site-header"', 'class="hero"', 'class="tiles"', 'class="grid4"', 'class="banner', 'class="news"', 'class="foot"']) {
    assert.ok(html.includes(marker), `missing ${marker}`);
  }
  assert.match(html, /data-theme="dark"/);
  assert.match(html, /get\('theme'\) === 'dark'/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  assert.match(html, /<title>Demo Store /);
});

test('photos are drawn placeholders and every one is marked as such', () => {
  const photos = html.match(/class="ph"/g) ?? [];
  assert.ok(photos.length >= 10, 'hero, tiles, product cards and banner');
  assert.equal((html.match(/role="img" aria-label="Photo placeholder"/g) ?? []).length, photos.length);
  assert.match(css, /\.ph::after\s*\{\s*content: 'Photo placeholder'/);
  assert.ok(!/<img\b/i.test(html), 'no real photos');
});

test('no invented facts: no stars, ratings, reviews, stock, deadlines or discounts', () => {
  const visible = html.replace(/<!--[^]*?-->/g, '').replace(/<style[^]*?<\/style>/gi, '').replace(/<script[^]*?<\/script>/gi, '');
  for (const re of [/★|☆|\bstars?\b/i, /\b\d(?:\.\d)?\s*(?:\/\s*5|out of 5)\b/i, /\b\d+\s+(?:reviews?|ratings?)\b/i, /\bin stock\b|\bonly \d+ left\b|\bselling fast\b/i, /\b\d+\s*% off\b|\bsale\b|\bends (?:in|today)\b/i, /trusted by|as seen in|certified/i]) {
    assert.ok(!re.test(visible), `the page must not contain ${re}`);
  }
  // Prices are obviously fake and facts are markers.
  assert.ok(!/₹\s*[1-9]/.test(visible), 'no real-looking price');
  assert.match(visible, /\[NEED: /);
});
