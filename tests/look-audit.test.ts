import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

/**
 * Phase 3 re-skins a store by editing the tokens in src/index.css, so no other file in src/ may keep a second
 * copy of the template's look. This fails when the template's default colours or fonts show up in src/ outside
 * the one fallback module (src/config/lookFallback.ts, used only when there is no document to read the CSS
 * from), and when a storefront component uses a one-off Tailwind colour instead of a token.
 *
 * What stays a hand edit, outside src/: the fonts <link> and the theme-color metas in index.html, and
 * public/manifest.webmanifest (docs/template/PHASE3.md lists them).
 */
const sources = (readdirSync('src', { recursive: true }) as string[])
  .map((f) => join('src', f).replace(/\\/g, '/'))
  .filter((f) => /\.tsx?$/.test(f));

const ALLOWED = new Set(['src/config/lookFallback.ts']);

/** The template's default look, as it would be copied into code. */
const DEFAULTS: Array<[RegExp, string]> = [
  [/#1C1917/i, 'the ink hex #1C1917 (--primary, --foreground)'],
  [/#FAFAF9/i, 'the page hex #FAFAF9 (--background)'],
  [/Fraunces/, 'the heading font name (--font-heading)'],
  [/\bInter\b/, 'the body font name (--font-body)'],
  [/hsl\(\s*24 8% 10%/, 'the ink as an hsl() literal (use hsl(var(--charcoal)) or hsl(var(--primary)))'],
  [/hsl\(\s*213 94% 68%/, 'the highlight-soft blue as an hsl() literal (use hsl(var(--highlight-soft)))'],
];

/** Storefront code: the shop itself, not the admin or the delivery-staff app (they keep their own status colours). */
const isStorefront = (f: string) =>
  (f.startsWith('src/components/') && !f.startsWith('src/components/admin/') && !basename(f).startsWith('Delivery')) ||
  (/^src\/pages\/[^/]+\.tsx$/.test(f) && !basename(f).startsWith('Admin'));

const ONE_OFFS: Array<[RegExp, string]> = [
  [/\bemerald-\d/, 'an emerald-* one-off colour (use the status-success tokens)'],
  [/\bbg-red-500/, 'bg-red-500, a one-off colour (use bg-destructive or the status-danger tokens)'],
];

test('the matchers see what they are meant to, and not the look of a different store', () => {
  assert.ok(DEFAULTS[0][0].test("color: '#1c1917'"));
  assert.ok(DEFAULTS[2][0].test("font: 'Fraunces', serif"));
  assert.ok(DEFAULTS[3][0].test('font: Inter, sans-serif'));
  assert.ok(!DEFAULTS[3][0].test('Interface, International, Intersect'));
  assert.ok(DEFAULTS[4][0].test('hsl(24 8% 10% / 0.9)'));
  assert.ok(!DEFAULTS[4][0].test('hsl(var(--charcoal) / 0.9)'));
  assert.ok(ONE_OFFS[0][0].test('bg-emerald-500') && ONE_OFFS[1][0].test('bg-red-500/10'));
  assert.ok(isStorefront('src/components/SilverRateWidget.tsx') && isStorefront('src/pages/About.tsx'));
  assert.ok(!isStorefront('src/components/admin/StatCard.tsx') && !isStorefront('src/pages/delivery/DeliveryLogin.tsx') && !isStorefront('src/pages/AdminOrders.tsx'));
});

test('the template default hexes and font names live only in src/config/lookFallback.ts', () => {
  assert.ok(sources.length > 100, 'found the src files');
  const hits: string[] = [];
  for (const f of sources.filter((f) => !ALLOWED.has(f))) {
    readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
      for (const [re, what] of DEFAULTS) if (re.test(line)) hits.push(`${f}:${i + 1}: ${what}`);
    });
  }
  assert.deepEqual(hits, [], `A second copy of the look. Read it from the tokens (src/lib/lookTokens.ts) or write var(--token):\n${hits.join('\n')}`);
});

test('storefront components use tokens, not one-off emerald or bg-red-500 colours', () => {
  const hits: string[] = [];
  for (const f of sources.filter(isStorefront)) {
    readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
      for (const [re, what] of ONE_OFFS) if (re.test(line)) hits.push(`${f}:${i + 1}: ${what}`);
    });
  }
  assert.deepEqual(hits, [], `One-off colours in the storefront:\n${hits.join('\n')}`);
});

test('docs/ui-system.md describes roles and points to src/index.css; it does not state the template values', () => {
  const doc = readFileSync('docs/ui-system.md', 'utf8');
  const checks: Array<[RegExp, string]> = [
    ...DEFAULTS,
    [/\bblue\b/i, 'a colour name ("blue highlight"): the highlight is whatever --highlight is'],
    [/rounded-(panel|card|control|chip)`?\s*\(\d+px/,'a radius in pixels (they are --radius-* in src/index.css)'],
    [/duration-(press|hover|tooltip|dropdown|modal|drawer|exit|reveal)[^\n]*\d+ms/, 'a duration in ms next to its token (the value is in src/index.css)'],
  ];
  const hits: string[] = [];
  doc.split(/\r?\n/).forEach((line, i) => {
    for (const [re, what] of checks) if (re.test(line)) hits.push(`docs/ui-system.md:${i + 1}: ${what}`);
  });
  assert.deepEqual(hits, [], `State roles and rules, not values:\n${hits.join('\n')}`);
  assert.ok(doc.includes('--primary-dark') && doc.includes('--primary-light'), 'documents that --primary-dark and --primary-light differ between light and dark');
  assert.ok(doc.includes('src/index.css'), 'points to src/index.css for the values');
});
