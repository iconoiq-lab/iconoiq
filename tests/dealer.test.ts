import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DEALER_PRICING,
  DEFAULT_DEALER_SETTINGS,
  dealerQuote,
  dealerTierFor,
  dealerUnitPrice,
  normaliseDealerPricing,
  normaliseDealerSettings,
  normaliseDealerTiers,
} from '../src/lib/dealer.ts';

const ON = normaliseDealerSettings({ enabled: true });
const P = normaliseDealerPricing({ productPrices: { 'sku-b': 810 } });
const line = (unit: number, quantity = 1, productId = 'x') => ({ productId, unit, quantity });

test('defaults are the client PLANS.pdf tiers: 1,50,000 → 40%, 2,50,000 → 50%', () => {
  const tiers = [{ minOrder: 150000, percent: 40 }, { minOrder: 250000, percent: 50 }];
  assert.deepEqual(DEFAULT_DEALER_SETTINGS, { enabled: false, minOrder: 150000, tiers });
  assert.deepEqual(DEFAULT_DEALER_PRICING, { productPrices: {} });
  assert.deepEqual(normaliseDealerSettings(null), { enabled: false, minOrder: 150000, tiers });
  assert.deepEqual(normaliseDealerPricing(undefined), { productPrices: {} });
});

test('an old settings document (single minimum, no tiers) gets the default tiers; minOrder follows the first tier', () => {
  const s = normaliseDealerSettings({ enabled: true, minOrder: 2000 } as never);
  assert.equal(s.minOrder, 150000);
  assert.equal(s.tiers.length, 2);
});

test('tiers are cleaned: sorted, clamped, duplicates collapsed, junk dropped, at most 5', () => {
  assert.deepEqual(
    normaliseDealerTiers([{ minOrder: 300000, percent: 95 }, { minOrder: '100000.4', percent: 30 }, { minOrder: 0, percent: 10 }, null, { minOrder: 5000, percent: 0 }]),
    [{ minOrder: 1, percent: 10 }, { minOrder: 100000, percent: 30 }, { minOrder: 300000, percent: 90 }],
  );
  assert.deepEqual(normaliseDealerTiers([{ minOrder: 1000, percent: 10 }, { minOrder: 1000, percent: 20 }]), [{ minOrder: 1000, percent: 20 }]);
  assert.equal(normaliseDealerTiers([]).length, 2, 'no valid tier: the defaults');
  assert.equal(normaliseDealerTiers(Array.from({ length: 8 }, (_, i) => ({ minOrder: (i + 1) * 1000, percent: i + 1 }))).length, 5);
  assert.deepEqual(normaliseDealerPricing({ productPrices: { a: 100.555, b: 0, c: -1, d: 'x' as never } }).productPrices, { a: 100.56 });
});

test('tier selection: below tier 1 none, exactly 1,50,000 → 40, between → 40, exactly 2,50,000 → 50, above → 50', () => {
  const tiers = ON.tiers;
  assert.equal(dealerTierFor(149999.99, tiers), null);
  assert.equal(dealerTierFor(150000, tiers)?.percent, 40);
  assert.equal(dealerTierFor(200000, tiers)?.percent, 40);
  assert.equal(dealerTierFor(250000, tiers)?.percent, 50);
  assert.equal(dealerTierFor(900000, tiers)?.percent, 50);
});

test('unit price: fixed price wins over the tier, capped at regular; else the tier percent in whole rupees', () => {
  assert.equal(dealerUnitPrice('sku-a', 800, P, 40), 480);
  assert.equal(dealerUnitPrice('sku-a', 799, P, 50), 400);
  assert.equal(dealerUnitPrice('sku-b', 1150, P, 50), 810, 'fixed price wins over 50%');
  assert.equal(dealerUnitPrice('sku-b', 700, P, 40), 700, 'a later sale never makes the dealer price higher');
  assert.equal(dealerUnitPrice('x', 1, P, 40), 1);
  assert.equal(dealerUnitPrice('x', 0.5, P, 40), 0.5);
  assert.equal(dealerUnitPrice('x', 0, P, 40), 0);
  assert.equal(dealerUnitPrice('x', 800, P, 0), 800);
});

test('quote: not a dealer, or programme off, is regular prices', () => {
  const lines = [line(80000, 3)];
  for (const q of [dealerQuote(lines, ON, P, false), dealerQuote(lines, { ...ON, enabled: false }, P, true), dealerQuote(lines, ON, null, true)]) {
    assert.deepEqual(q, { applies: false, regularSubtotal: 240000, dealerSubtotal: 240000, subtotal: 240000, savings: 0, shortBy: 0, units: [80000], percent: 0, nextTier: null });
  }
});

test('quote below tier 1: regular prices (fixed prices too) and how much more is needed', () => {
  const q = dealerQuote([line(1150, 1, 'sku-b'), line(100000)], ON, P, true);
  assert.equal(q.applies, false);
  assert.equal(q.subtotal, 101150);
  assert.deepEqual(q.units, [1150, 100000]);
  assert.equal(q.shortBy, 48850);
  assert.equal(q.percent, 0);
  assert.deepEqual(q.nextTier, { minOrder: 150000, percent: 40 });
});

test('quote exactly at tier 1: 40% off, next tier shown', () => {
  const q = dealerQuote([line(75000, 2)], ON, P, true);
  assert.deepEqual(q, { applies: true, regularSubtotal: 150000, dealerSubtotal: 90000, subtotal: 90000, savings: 60000, shortBy: 0, units: [45000], percent: 40, nextTier: { minOrder: 250000, percent: 50 } });
});

test('quote between the tiers stays at 40%', () => {
  const q = dealerQuote([line(200000)], ON, P, true);
  assert.equal(q.percent, 40);
  assert.equal(q.subtotal, 120000);
});

test('quote exactly at tier 2: 50% off, no next tier', () => {
  const q = dealerQuote([line(125000, 2)], ON, P, true);
  assert.equal(q.percent, 50);
  assert.equal(q.subtotal, 125000);
  assert.equal(q.nextTier, null);
});

test('quote at a tier: a fixed product price wins and is capped at regular', () => {
  const fixed = normaliseDealerPricing({ productPrices: { cheap: 900, dear: 5000 } });
  const q = dealerQuote([line(1000, 1, 'cheap'), line(4000, 1, 'dear'), line(250000)], ON, fixed, true);
  assert.equal(q.percent, 50);
  assert.deepEqual(q.units, [900, 4000, 125000], 'fixed 900 wins over 50%; fixed 5000 is capped at the regular 4000');
  assert.equal(q.subtotal, 129900);
});

test('quote: no saving means no dealer pricing', () => {
  const onlyFixed = normaliseDealerPricing({ productPrices: { x: 200000 } });
  const q = dealerQuote([line(200000)], ON, onlyFixed, true);
  assert.equal(q.applies, false);
  assert.equal(q.subtotal, 200000);
});
