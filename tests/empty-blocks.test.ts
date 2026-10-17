import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// A new store has no products, banners or collections yet. The content-driven home blocks must then render
// nothing (or a neutral panel), never an empty box, a template banner or a [NEED: ...] card.
const read = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

test('product shelves, banner and collections render nothing when empty', () => {
  for (const f of ['BestSellers', 'TrendProducts']) {
    const src = read(`src/components/${f}.tsx`);
    assert.ok(!src.includes('EmptyState'), `${f}: no empty-state box on the home page`);
    assert.match(src, /!loading\s*&&\s*products\.length\s*===\s*0\s*\)\s*\{?\s*return null/, `${f} must hide itself when empty (and not loading)`);
  }
  const banner = read('src/components/CollectionBanner.tsx');
  assert.ok(!banner.includes('FALLBACK') && !banner.includes('/demo/'), 'CollectionBanner: no template banner when none is set');
  assert.match(banner, /!banner\s*\)\s*\{?\s*return null/, 'CollectionBanner must render nothing without a banner');
  const promo = read('src/components/PromoSection.tsx');
  assert.ok(!promo.includes('DEFAULT_HOME_COLLECTIONS'), 'PromoSection: no placeholder collection cards');
  assert.match(promo, /cards\.length\s*===\s*0\s*\)\s*\{?\s*return null/, 'PromoSection must render nothing without collections');
});

test('the empty hero is a calm panel on the page colours, not a dark slab', () => {
  const src = read('src/components/HeroBanner.tsx');
  const start = src.indexOf('if (count === 0) {');
  assert.ok(start > 0, 'the no-banner branch moved: update this test');
  const branch = src.slice(start, src.indexOf('\n  }\n', start));
  assert.ok(branch.includes('bg-muted'), 'empty hero sits on bg-muted');
  assert.ok(!/charcoal|tx-slate/.test(branch), 'empty hero must not use the dark charcoal / slate surface');
});

test('no product-type words from a past store in the home blocks', () => {
  for (const f of ['BestSellers', 'TrendProducts', 'CollectionBanner', 'PromoSection', 'HeroBanner']) {
    assert.ok(!/formulation/i.test(read(`src/components/${f}.tsx`)), `${f}: "formulation" is a word from a past store`);
  }
});
