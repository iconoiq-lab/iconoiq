import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

/**
 * The runbook rows for Phases 2 and 3 name files, scripts and tokens a store needs. These checks keep them
 * pointing at things that exist, and keep the three places that describe Phase 2 (the runbook row,
 * SECTIONS.md and the starter mockup) saying the same thing. docs/template/client/ exists only in the
 * template repo, so the runbook checks skip in a client copy (its CLAUDE.md is the filled-in runbook).
 */
const inTemplateRepo = existsSync('docs/template/client/CLAUDE.md');
const skip = inTemplateRepo ? false : 'client copy: no docs/template/client/';
const read = (f: string) => readFileSync(f, 'utf8');
const row = (md: string, name: string) => md.split(/\r?\n/).find((l) => l.startsWith(`| ${name} |`)) ?? '';

test('Phase 2 row: where the picks and the mockup go, the starter, the shots, and why the mockup', { skip }, () => {
  const p2 = row(read('docs/template/client/CLAUDE.md'), '2 Look');
  for (const needle of [
    'src/config/sections.ts', 'now, together with the mockup', 'a "no" from the client changes them',
    'docs/template/mockups/home-mockup-starter.html', 'docs/look/home-mockup.html', 'drawn placeholders',
    'which home blocks stay', 'docs/look/shots/home-{390,1440}-{light,dark}.png',
    'a starting point only', 'role names', 'contrast', 'the preview shows demo data until Phase 5',
  ]) assert.ok(p2.includes(needle), `Phase 2 row should say: ${needle}`);
});

test('Phase 3 row names the checklist, the files it touches and the contrast script', { skip }, () => {
  const p3 = row(read('docs/template/client/CLAUDE.md'), '3 Apply look');
  for (const needle of ['docs/template/PHASE3.md', 'src/index.css', 'tailwind.config.ts', 'index.html', 'public/manifest.webmanifest', '--highlight-soft', '--texture-opacity', 'node scripts/qa/contrast.mjs', 'brand-assets/palette.json', 'node scripts/make-wordmark.mjs', 'node scripts/build-logo-assets.mjs', '--block-firestore']) {
    assert.ok(p3.includes(needle), `Phase 3 row should name: ${needle}`);
  }
});

test('PHASE3.md lists every place a look lives', () => {
  const md = read('docs/template/PHASE3.md');
  for (const needle of [
    'src/index.css', '--highlight-soft', '--radius-panel', '--radius-card', '--radius-control', '--radius-chip',
    '--texture-opacity', '--grain-opacity', '--font-heading', '--font-body', 'tailwind.config.ts',
    'index.html', 'theme-color', 'Google Fonts', 'public/manifest.webmanifest', 'theme_color', 'background_color',
    'build-logo-assets.mjs', 'scripts/qa/contrast.mjs', 'src/config/homeBlocks.ts', 'HOME_BLOCK_RESERVE',
    'src/lib/lookTokens.ts', 'src/config/lookFallback.ts', 'tests/look-audit.test.ts', '--sheen', '--hover-lift', '--gradient-gold', 'data-heading-weight="light"', '--heading-weight-lg', '--heading-weight-sm',
  ]) assert.ok(md.includes(needle), `PHASE3.md should mention: ${needle}`);
});

test('PHASE3.md has the no-logo route and the page-check rules the trial run needed', () => {
  const md = read('docs/template/PHASE3.md');
  for (const needle of [
    // the no-logo route: font, palette, outlines, build
    'brand-assets/fonts/README.txt', 'brand-assets/palette.json', 'node scripts/make-wordmark.mjs', 'node scripts/build-logo-assets.mjs',
    'src/config/logoSize.ts', 'h-*',
    // the page check
    'ui-shots.mjs --block-firestore', 'fresh-store', 'order of the home page is part of the look', 'scripts/qa/sheet.mjs',
    'wait for Phase 5', '/cart', '/checkout', '/verify-email', 'guest redirect',
  ]) assert.ok(md.includes(needle), `PHASE3.md should say: ${needle}`);
});

test('every file the Phase 2 and 3 docs point at exists', () => {
  for (const f of ['docs/template/mockups/home-mockup-starter.html', 'docs/template/PHASE3.md', 'docs/template/SECTIONS.md', 'scripts/qa/contrast.mjs', 'scripts/qa/section-shots.mjs', 'scripts/build-logo-assets.mjs', 'public/manifest.webmanifest', 'scripts/make-wordmark.mjs', 'brand-assets/palette.json', 'brand-assets/fonts/README.txt', 'scripts/qa/sheet.mjs', 'scripts/qa/ui-shots.mjs']) {
    assert.ok(existsSync(f), f);
  }
});

test('SECTIONS.md agrees with the runbook: picks are set with the mockup, and a copy regenerates its own screenshots', () => {
  const md = read('docs/template/SECTIONS.md');
  assert.ok(!/After the client's yes, set the picks/.test(md), 'the old "after the yes" rule is gone');
  assert.match(md, /together with the homepage mockup/);
  assert.match(md, /with the mockup, then run `node scripts\/check\.mjs`/);
  assert.match(md, /home-mockup-starter\.html/);
  // At the top, not buried at the bottom.
  assert.ok(md.indexOf('node scripts/qa/section-shots.mjs') < md.indexOf('| Section |'), 'the regenerate line comes before the table');
  assert.match(md, /A client copy has no section screenshots beside it/);
  assert.match(md, /\*\*Detailed\*\* shows one key detail[^\n]*specifications[^\n]*weight[^\n]*shows nothing/);
  assert.match(md, /\*\*Classic\*\* shows a star row[^\n]*empty until[^\n]*real reviews/);
});

test('the starter mockup says where to copy it and where its screenshots go', () => {
  const html = read('docs/template/mockups/home-mockup-starter.html');
  assert.ok(html.includes('docs/look/home-mockup.html'));
  assert.ok(html.includes('home-390-light.png') && html.includes('home-1440-dark.png'));
});
