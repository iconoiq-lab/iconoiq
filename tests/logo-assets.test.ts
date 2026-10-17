import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

// The logo files are built from brand-assets/ by `node scripts/build-logo-assets.mjs`
// (and drawn from the store name by `node scripts/make-wordmark.mjs` when the client has no logo).
const palette = JSON.parse(readFileSync('brand-assets/palette.json', 'utf8'));
const hasSvgArt = existsSync('brand-assets/logo.svg') && existsSync('brand-assets/mark.svg');
const logo = hasSvgArt ? readFileSync('brand-assets/logo.svg', 'utf8') : '';
const mark = hasSvgArt ? readFileSync('brand-assets/mark.svg', 'utf8') : '';
const hasFont = existsSync('brand-assets/fonts/wordmark.ttf');
const run = (script: string, args: string[], cwd: string) =>
  spawnSync(process.execPath, [resolve(script), ...args], { cwd, encoding: 'utf8' });

test('palette.json holds the three art colours and the three bag colours as hex', () => {
  for (const key of ['ink', 'paper', 'tile', 'band', 'stone', 'stoneLight']) {
    assert.match(palette[key], /^#[0-9a-f]{6}$/i, `palette.${key} should be a #rrggbb colour`);
  }
});

test('the SVG art is outlines (no font needed to draw it) and has no NaN point', { skip: !hasSvgArt && 'the art is PNG' }, () => {
  assert.ok(!/<text\b/i.test(logo), 'logo.svg has <text>: node scripts/make-wordmark.mjs draws outlines');
  assert.ok(!/<text\b/i.test(mark), 'mark.svg has <text>: node scripts/make-wordmark.mjs draws outlines');
  assert.ok(!/NaN/.test(logo + mark), 'an outline has a NaN point');
});

test('the art uses exactly the colours in brand-assets/palette.json', { skip: !hasSvgArt && 'the art is PNG' }, () => {
  // build-logo-assets.mjs swaps the ink for the paper colour to make the light wordmark.
  assert.ok(logo.toLowerCase().includes(palette.ink.toLowerCase()), 'logo.svg is not drawn in the palette ink');
  assert.ok(mark.toLowerCase().includes(palette.tile.toLowerCase()), 'mark.svg tile is not the palette tile colour');
  assert.ok(mark.toLowerCase().includes(palette.paper.toLowerCase()), 'mark.svg letter is not the palette paper colour');
});

test('every file the build writes exists', () => {
  for (const f of [
    'public/black_logo.png', 'public/white_logo.png', 'public/black_logo_full.png', 'public/white_logo_full.png',
    'public/logo-new.png', 'public/loading_black.png', 'public/loading_white.png', 'public/favicon.png',
    'public/favicon.ico', 'public/icon-192.png', 'public/apple-touch-icon.png', 'public/og-image.jpg',
    'src/assets/dark.png', 'src/assets/login-cart.png', 'src/assets/shopping-bags.png', 'src/config/logoSize.ts',
  ]) assert.ok(existsSync(f), `${f} is missing: run node scripts/build-logo-assets.mjs`);
});

test('logoSize.ts is the size of the built wordmark, and the header and footers read it', async () => {
  const { LOGO } = await import('../src/config/logoSize.ts');
  const meta = await sharp('public/black_logo.png').metadata();
  assert.deepEqual({ width: LOGO.width, height: LOGO.height }, { width: meta.width, height: meta.height },
    'src/config/logoSize.ts is out of date: run node scripts/build-logo-assets.mjs');
  for (const f of [
    'src/components/Header.tsx', 'src/components/MobileHeader.tsx', 'src/components/header/CenteredHeaderBar.tsx',
    'src/components/Footer.tsx', 'src/components/footer/CompactFooter.tsx',
  ]) {
    const src = readFileSync(f, 'utf8');
    assert.ok(/width=\{LOGO\.width\}/.test(src) && /height=\{LOGO\.height\}/.test(src), `${f}: the logo <img> takes width and height from LOGO`);
  }
});

test('the invoice fits the logo into its box at the image\'s own proportions', () => {
  const src = readFileSync('src/services/invoiceService.ts', 'utf8');
  assert.ok(src.includes('getImageProperties'), 'invoiceService reads the logo\'s own size');
  assert.ok(!/addImage\(logo, 'PNG', margin, 8, 55, 16\)/.test(src), 'the logo must not be forced into 55 x 16 mm');
});

test('make-wordmark draws NaN-free outlines in the palette ink and tile', { skip: !hasFont && 'no brand-assets/fonts/wordmark.ttf' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'wordmark-'));
  try {
    const r = run('scripts/make-wordmark.mjs', ['--text', 'Clay Studio', '--letter', 'C', '--font', resolve('brand-assets/fonts/wordmark.ttf'), '--out', dir], process.cwd());
    assert.equal(r.status, 0, r.stderr);
    const l = readFileSync(join(dir, 'logo.svg'), 'utf8');
    const m = readFileSync(join(dir, 'mark.svg'), 'utf8');
    assert.ok(!/<text\b/i.test(l + m) && !/NaN/.test(l + m));
    assert.ok(l.includes(`fill="${palette.ink}"`), 'wordmark is in the ink');
    assert.ok(m.includes(`fill="${palette.tile}"`) && m.includes(`fill="${palette.paper}"`), 'monogram is paper on the tile');
    const [, w, h] = l.match(/width="([\d.]+)" height="([\d.]+)" viewBox/) ?? [];
    assert.ok(Number(w) > Number(h) * 2, 'a two-word name makes a wide wordmark');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the tile colour is its own value: a clay tile with umber ink', { skip: !hasFont && 'no brand-assets/fonts/wordmark.ttf', timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'logo-build-'));
  try {
    for (const d of ['brand-assets', 'public', 'src/assets', 'src/config']) mkdirSync(join(dir, d), { recursive: true });
    const clay = { ink: '#2a1e18', paper: '#f5f1eb', tile: '#683c2c', band: '#4a2a1f', stone: '#a8998a', stoneLight: '#ddd3c6' };
    writeFileSync(join(dir, 'brand-assets/palette.json'), JSON.stringify(clay));
    const font = resolve('brand-assets/fonts/wordmark.ttf');
    // Both scripts read and write the folder they run in (a store's repo root).
    let r = run('scripts/make-wordmark.mjs', ['--text', 'Clay Studio', '--letter', 'C', '--font', font], dir);
    assert.equal(r.status, 0, r.stderr);
    r = run('scripts/build-logo-assets.mjs', [], dir);
    assert.equal(r.status, 0, r.stderr);
    // The touch icon is flattened onto the tile colour (its rounded corners are transparent in the art).
    const { data } = await sharp(join(dir, 'public/apple-touch-icon.png')).raw().toBuffer({ resolveWithObject: true });
    const hex = '#' + [0, 1, 2].map((i) => data[i].toString(16).padStart(2, '0')).join('');
    assert.equal(hex, clay.tile, 'touch icon corner is the tile colour, not the ink');
    // logoSize.ts names the wordmark's own pixel size.
    const meta = await sharp(join(dir, 'public/black_logo.png')).metadata();
    assert.equal(readFileSync(join(dir, 'src/config/logoSize.ts'), 'utf8').match(/width: (\d+), height: (\d+)/)?.slice(1).join('x'), `${meta.width}x${meta.height}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
