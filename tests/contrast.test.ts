import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseHsl, hslToRgb, contrastRatio, blendOver, parseTokenBlocks, themeTokens, checkPalette, extractStyles, PAIRS,
} from '../scripts/lib/contrast.mjs';

test('parseHsl reads the HSL triplets the theme uses and rejects anything else', () => {
  assert.deepEqual(parseHsl('24 8% 10%'), [24, 8, 10]);
  assert.deepEqual(parseHsl('  60.5   3%  96.25% '), [60.5, 3, 96.25]);
  assert.equal(parseHsl('#ffffff'), null);
  assert.equal(parseHsl('hsl(0 0% 0%)'), null);
  assert.equal(parseHsl('0 0 0'), null);
});

test('hslToRgb gives the primary colours and greys', () => {
  assert.deepEqual(hslToRgb([0, 0, 100]).map(Math.round), [255, 255, 255]);
  assert.deepEqual(hslToRgb([0, 0, 0]).map(Math.round), [0, 0, 0]);
  assert.deepEqual(hslToRgb([0, 100, 50]).map(Math.round), [255, 0, 0]);
  assert.deepEqual(hslToRgb([120, 100, 50]).map(Math.round), [0, 255, 0]);
  assert.deepEqual(hslToRgb([240, 100, 50]).map(Math.round), [0, 0, 255]);
  assert.deepEqual(hslToRgb([0, 0, 50]).map(Math.round), [128, 128, 128]);
});

const W: [number, number, number] = [255, 255, 255];
const K: [number, number, number] = [0, 0, 0];

test('contrastRatio matches the WCAG reference values', () => {
  assert.equal(contrastRatio(K, W).toFixed(2), '21.00');
  assert.equal(contrastRatio(W, W).toFixed(2), '1.00');
  // #777777 on white is the textbook 4.48:1; #767676 is the first grey that passes, at 4.54:1
  assert.equal(contrastRatio([0x77, 0x77, 0x77], W).toFixed(2), '4.48');
  assert.equal(contrastRatio([0x76, 0x76, 0x76], W).toFixed(2), '4.54');
  assert.equal(contrastRatio([20, 20, 20], [230, 230, 230]), contrastRatio([230, 230, 230], [20, 20, 20]));
});

test('blendOver mixes channel by channel in sRGB, the way CSS does', () => {
  assert.deepEqual(blendOver(W, 0.5, K), [127.5, 127.5, 127.5]);
  assert.deepEqual(blendOver(W, 1, K), W);
  assert.deepEqual(blendOver(W, 0, K), K);
  assert.deepEqual(blendOver([200, 100, 0], 0.25, [0, 100, 200]), [50, 100, 150]);
});

test('parseTokenBlocks reads :root and .dark at any depth and ignores comments and other selectors', () => {
  const css = `
    /* :root { --background: 1 1% 1%; } a comment with { braces } */
    @layer base {
      :root { --background: 0 0% 100%; --foreground: 0 0% 0%; --font-body: 'Inter', sans-serif; --x: url("data:image/svg+xml,a;b"); }
      .dark { --background: 0 0% 0%; --foreground: 0 0% 100%; }
      .dark .card { --background: 9 9% 9%; }
    }
    :root { --muted: 0 0% 90%; }
    @media (min-width: 1024px) { :root { --sticky-top: 136px; } }
    .dark { --muted: 0 0% 10%; }
  `;
  const { light, dark } = parseTokenBlocks(css);
  assert.deepEqual(light, { background: '0 0% 100%', foreground: '0 0% 0%', muted: '0 0% 90%' });
  assert.deepEqual(dark, { background: '0 0% 0%', foreground: '0 0% 100%', muted: '0 0% 10%' });
});

test('extractStyles returns the CSS in the <style> tags, so a mockup page can be measured like index.css', () => {
  const html = '<!doctype html><title>a { b }</title><style>:root { --a: 0 0% 0%; }</style><p>x</p><style media="all">\n.dark { --a: 0 0% 100%; }\n</style>';
  const { light, dark } = parseTokenBlocks(extractStyles(html));
  assert.deepEqual(light, { a: '0 0% 0%' });
  assert.deepEqual(dark, { a: '0 0% 100%' });
  assert.equal(extractStyles('no styles here'), '');
});

test('themeTokens: dark falls back to the light value for a token it does not override', () => {
  const t = themeTokens({ light: { a: '0 0% 100%', b: '0 0% 50%' }, dark: { a: '0 0% 0%' } });
  assert.deepEqual(t.light, { a: '0 0% 100%', b: '0 0% 50%' });
  assert.deepEqual(t.dark, { a: '0 0% 0%', b: '0 0% 50%' });
});

const PASSING = {
  light: {
    background: '0 0% 100%', foreground: '0 0% 0%', card: '0 0% 100%', 'card-foreground': '0 0% 0%',
    muted: '0 0% 95%', 'muted-foreground': '0 0% 30%', input: '0 0% 50%', primary: '0 0% 0%', 'primary-foreground': '0 0% 100%',
  },
  dark: {},
};

test('checkPalette marks a pair that misses its minimum, and a missing token, as failed', () => {
  const good = checkPalette(themeTokens(PASSING));
  const row = (rows: any[], theme: string, label: string) => rows.find((r) => r.theme === theme && r.label === label);
  assert.equal(row(good, 'light', 'muted-foreground on background').pass, true);
  assert.equal(row(good, 'light', 'input on background').min, 3);

  const bad = checkPalette(themeTokens({ ...PASSING, light: { ...PASSING.light, 'muted-foreground': '0 0% 70%' } }));
  const r = row(bad, 'light', 'muted-foreground on background');
  assert.equal(r.pass, false);
  assert.ok(r.ratio < 4.5);

  const missing = row(good, 'light', 'highlight on background');
  assert.equal(missing.pass, false);
  assert.equal(missing.ratio, null);
});

test('skipMissing leaves out pairs a page has no tokens for, but still measures the rest', () => {
  const all = checkPalette(themeTokens(PASSING));
  const some = checkPalette(themeTokens(PASSING), { skipMissing: true });
  assert.ok(some.length > 0 && some.length < all.length);
  assert.ok(some.every((r: { ratio: number | null }) => r.ratio !== null));
  assert.ok(some.some((r: { label: string }) => r.label === 'foreground on background'));
});

test('PAIRS covers the standard pairs the runbook promises', () => {
  const labels = PAIRS.map((p: { label: string }) => p.label);
  for (const want of [
    'foreground on background', 'foreground on card', 'foreground on muted',
    'muted-foreground on background', 'muted-foreground on card', 'muted-foreground on muted',
    'primary-foreground on primary', 'highlight on background', 'highlight on card',
    'input on background', 'input on card', 'charcoal-foreground on charcoal',
  ]) assert.ok(labels.includes(want), want);
  for (const p of PAIRS) assert.ok(p.min === 4.5 || p.min === 3, p.label);
  assert.equal(PAIRS.find((p: { label: string }) => p.label === 'input on background').min, 3);
});

// The check a store runs in Phase 3: this repo's own src/index.css, light and dark.
test('the palette in src/index.css passes: 4.5:1 for text, 3:1 for borders and focus rings, in both themes', () => {
  const rows = checkPalette(themeTokens(parseTokenBlocks(readFileSync('src/index.css', 'utf8'))));
  assert.ok(rows.length > 50, `only ${rows.length} pairs were measured`);
  const failed = rows.filter((r: { pass: boolean }) => !r.pass)
    .map((r: any) => `${r.theme}: ${r.label} ${r.ratio === null ? 'token missing' : r.ratio.toFixed(2)}:1 (needs ${r.min}:1)`);
  assert.deepEqual(failed, []);
});
