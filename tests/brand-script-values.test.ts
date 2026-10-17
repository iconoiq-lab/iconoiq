import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BRAND } from '../src/config/brand.ts';
import { BRAND_SLUG, THEME_KEY, brandState } from '../scripts/lib/brand.mjs';

/**
 * The QA scripts read the store's slug and state from BRAND itself (not by pattern), so a copy whose
 * brand.ts is written another way cannot make a script test the wrong home state.
 */
test('QA script brand values come straight from BRAND', () => {
  assert.equal(BRAND_SLUG, BRAND.slug);
  assert.equal(brandState(), BRAND.state);
  assert.equal(THEME_KEY, BRAND.storageKeys.theme);
});

test('scripts/lib/brand.mjs has no hard-coded fallback state or slug', () => {
  // read as text: a "?? 'Telangana'" fallback would silently test the wrong home state
  const src = readFileSync('scripts/lib/brand.mjs', 'utf8');
  assert.ok(!/\?\?\s*'/.test(src), 'no ?? fallback string in scripts/lib/brand.mjs');
  assert.ok(!/Telangana|demo-store/.test(src), 'no state or slug typed into scripts/lib/brand.mjs');
});
