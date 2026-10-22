import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

/**
 * Before an address is chosen the cart and checkout must not say "Free" when the
 * charge depends on the state (free at home, ₹100 elsewhere), nor hide a charge
 * that is the same everywhere. siteSettingsService imports Firebase, so its pricing
 * source is read, stripped of types and run, as in storeFacts.test.ts.
 */
const NL = String.fromCharCode(10);
function load() {
  const src = readFileSync('src/services/siteSettingsService.ts', 'utf8');
  const from = src.indexOf('const normalizeState');
  const to = src.indexOf(NL + '// ───', src.indexOf('export function computeDeliveryCharge'));
  assert.ok(from > 0 && to > from, 'could not find normalizeState .. computeDeliveryCharge in siteSettingsService.ts');
  const js = stripTypeScriptTypes(src.slice(from, to).replaceAll('export function', 'function'));
  return new Function(`${js}${NL}return deliveryDependsOnAddress;`)() as (
    subtotal: number,
    settings: unknown,
    items?: unknown[],
  ) => boolean;
}

const base = {
  enabled: true,
  homeState: 'Telangana',
  withinStateCharge: 50,
  outsideStateCharge: 100,
  stateRates: [] as Array<{ state: string; charge: number }>,
  freeDeliveryAbove: 999,
  estimatedDays: '4-7 business days',
};

test('delivery depends on the address only when some state pays a different charge', () => {
  const depends = load();
  const at = (v: Partial<typeof base>, subtotal = 500, items: unknown[] = [{}]) => depends(subtotal, { ...base, ...v }, items);

  assert.equal(at({ withinStateCharge: 0, outsideStateCharge: 100, freeDeliveryAbove: 0 }), true, 'free at home, paid elsewhere');
  assert.equal(at({}), true, '₹50 at home, ₹100 elsewhere');
  assert.equal(at({}, 1200), false, 'over the free-delivery amount: free everywhere');
  assert.equal(at({ withinStateCharge: 80, outsideStateCharge: 80 }), false, 'one rate everywhere');
  assert.equal(at({ withinStateCharge: 80, outsideStateCharge: 80, stateRates: [{ state: 'Delhi', charge: 60 }] }), true, 'one rate plus a Delhi rate');
  assert.equal(at({ enabled: false }), false, 'delivery charges off');
  assert.equal(at({ enabled: false, stateRates: [{ state: 'Delhi', charge: 60 }] }), true, 'off, but Delhi pays');
  assert.equal(at({ enabled: false }, 500, [{ delivery: { chargeEnabled: true, withinState: 400, outsideState: 400 } }]), false, 'a product with one own rate');
  assert.equal(at({ enabled: false }, 500, [{ delivery: { chargeEnabled: true, withinState: 0, outsideState: 200 } }]), true, 'a product free at home only');
});
