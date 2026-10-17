import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { storeFacts, type FactsDelivery } from '../src/lib/storeFacts.ts';
import { BRAND } from '../src/config/brand.ts';

const delivery: FactsDelivery = {
  enabled: true,
  homeState: 'Kerala',
  withinStateCharge: 50,
  outsideStateCharge: 100,
  freeDeliveryAbove: 999,
  estimatedDays: '3-5 business days',
};

const byId = (facts: ReturnType<typeof storeFacts>, id: string) => facts.find((f) => f.id === id);

const deliveryOf = (d: Partial<FactsDelivery>) => byId(storeFacts({ delivery: { ...delivery, ...d } }), 'delivery');
const DELHI = [{ state: 'Delhi', charge: 150 }];

test('delivery: free above an amount says "or more" (checkout frees a subtotal equal to it), then the standard charges', () => {
  const f = deliveryOf({});
  assert.equal(f?.title, 'Free delivery on orders of ₹999 or more');
  assert.equal(f?.detail, 'Below that, standard delivery is ₹50 in Kerala, ₹100 elsewhere');
});

test('delivery: one rate everywhere is said once', () => {
  assert.equal(deliveryOf({ withinStateCharge: 80, outsideStateCharge: 80 })?.detail, 'Below that, standard delivery is ₹80 per order');
  assert.deepEqual(deliveryOf({ withinStateCharge: 80, outsideStateCharge: 80, freeDeliveryAbove: 0 }), {
    id: 'delivery',
    title: 'Standard delivery ₹80 per order',
  });
});

test('delivery: no free-delivery amount says what standard delivery starts at, and where', () => {
  const f = deliveryOf({ freeDeliveryAbove: 0 });
  assert.equal(f?.title, 'Standard delivery from ₹50');
  assert.equal(f?.detail, '₹50 in Kerala, ₹100 elsewhere');
});

test('delivery: switched off with no state rates means free standard delivery', () => {
  assert.deepEqual(deliveryOf({ enabled: false, freeDeliveryAbove: 0 }), { id: 'delivery', title: 'Free standard delivery' });
  assert.deepEqual(deliveryOf({ enabled: false }), { id: 'delivery', title: 'Free standard delivery' });
});

test('delivery: switched off but a state still has a rate is never called free', () => {
  // Checkout prices Delhi at its state rate even while the store-wide charge is off.
  const noAmount = deliveryOf({ enabled: false, freeDeliveryAbove: 0, stateRates: DELHI });
  assert.equal(noAmount?.title, 'Delivery charge depends on your state');
  assert.equal(noAmount?.detail, 'Free in Kerala; other states vary');
  const withAmount = deliveryOf({ enabled: false, stateRates: DELHI });
  assert.equal(withAmount?.title, 'Free delivery on orders of ₹999 or more');
  assert.equal(withAmount?.detail, 'Below that, standard delivery is free in Kerala; other states vary');
  for (const f of [noAmount, withAmount]) assert.ok(!/^Free (standard )?delivery$/.test(f?.title ?? ''));
});

test('delivery: with state rates the line never says "elsewhere", and "from" counts the lowest state rate', () => {
  const f = deliveryOf({ freeDeliveryAbove: 0, stateRates: [{ state: 'Goa', charge: 30 }, { state: 'Delhi', charge: 150 }] });
  assert.equal(f?.title, 'Standard delivery from ₹30');
  assert.equal(f?.detail, '₹50 in Kerala; other states vary');
  assert.equal(deliveryOf({ stateRates: DELHI })?.detail, 'Below that, standard delivery is ₹50 in Kerala; other states vary');
  // one rate everywhere is not "one rate everywhere" once a state has its own
  assert.equal(deliveryOf({ freeDeliveryAbove: 0, withinStateCharge: 80, outsideStateCharge: 80, stateRates: DELHI })?.title, 'Standard delivery from ₹80');
});

test('delivery: a rate for the home state or with no state name is never used by checkout, so it changes nothing', () => {
  const plain = deliveryOf({ freeDeliveryAbove: 0 });
  assert.deepEqual(deliveryOf({ freeDeliveryAbove: 0, stateRates: [{ state: ' kerala ', charge: 5 }, { state: '', charge: 7 }] }), plain);
});

test('delivery: free in the home state but charged elsewhere is a plain statement, not "from ₹0"', () => {
  const f = deliveryOf({ freeDeliveryAbove: 0, withinStateCharge: 0, outsideStateCharge: 100 });
  assert.equal(f?.title, 'Delivery charge depends on your state');
  assert.equal(f?.detail, 'Free in Kerala, ₹100 elsewhere');
  assert.deepEqual(deliveryOf({ freeDeliveryAbove: 0, withinStateCharge: 0, outsideStateCharge: 0 }), { id: 'delivery', title: 'Free standard delivery' });
});

/**
 * The facts must agree with what checkout charges. computeDeliveryCharge lives in a file that imports
 * Firebase, so its source is read here, stripped of types and run: the test checks the facts against the
 * real pricing code, not a copy of it.
 */
const NL = String.fromCharCode(10);
function checkoutPricing() {
  const src = readFileSync('src/services/siteSettingsService.ts', 'utf8');
  const from = src.indexOf('const normalizeState');
  const to = src.indexOf(NL + '// ───', src.indexOf('export function computeDeliveryCharge'));
  assert.ok(from > 0 && to > from, 'src/services/siteSettingsService.ts: could not find normalizeState .. computeDeliveryCharge; update checkoutPricing() in this test');
  const js = stripTypeScriptTypes(src.slice(from, to).replaceAll('export function', 'function'));
  return new Function(`${js}${NL}return computeDeliveryCharge;`)() as (
    subtotal: number,
    settings: unknown,
    items: unknown[],
    state?: string,
  ) => { charge: number };
}

const VARIANTS: Array<[string, Partial<FactsDelivery>]> = [
  ['plain', {}],
  ['no free amount', { freeDeliveryAbove: 0 }],
  ['one rate', { withinStateCharge: 80, outsideStateCharge: 80 }],
  ['one rate, no free amount', { withinStateCharge: 80, outsideStateCharge: 80, freeDeliveryAbove: 0 }],
  ['off', { enabled: false }],
  ['off, no free amount', { enabled: false, freeDeliveryAbove: 0 }],
  ['off, Delhi rate', { enabled: false, stateRates: DELHI }],
  ['off, Delhi rate, no free amount', { enabled: false, stateRates: DELHI, freeDeliveryAbove: 0 }],
  ['Delhi rate', { stateRates: DELHI }],
  ['Goa and Delhi rates, no free amount', { freeDeliveryAbove: 0, stateRates: [{ state: 'Goa', charge: 30 }, ...DELHI] }],
  ['free at home', { withinStateCharge: 0, outsideStateCharge: 100, freeDeliveryAbove: 0 }],
  ['all zero', { withinStateCharge: 0, outsideStateCharge: 0 }],
];
const STATES = ['Kerala', 'Goa', 'Delhi', 'Punjab', undefined];
const money = (t: string) => Number(t.replace(/[^\d]/g, ''));

test('delivery facts are true for what checkout charges, in every state', () => {
  const charge = checkoutPricing();
  const productOwnCharge = { delivery: { chargeEnabled: true, withinState: 400, outsideState: 400 } };
  for (const [name, v] of VARIANTS) {
    const d = { ...delivery, ...v };
    const settings = { ...d, stateRates: d.stateRates ?? [] };
    const f = storeFacts({ delivery: d }).find((x) => x.id === 'delivery');
    assert.ok(f, `${name}: a line is shown`);
    const at = (subtotal: number, state: string | undefined, items: unknown[] = [{}]) => charge(subtotal, settings, items, state).charge;
    const below = d.freeDeliveryAbove > 0 ? d.freeDeliveryAbove - 1 : 1;
    const text = `${f.title} / ${f.detail ?? ''}`;

    const freeAbove = f.title.match(/^Free delivery on orders of (₹[\d,]+) or more$/);
    if (freeAbove) {
      assert.equal(money(freeAbove[1]), d.freeDeliveryAbove, `${name}: ${text}`);
      for (const st of STATES) {
        // exactly the amount counts ("or more"), and a product with its own charge is freed too
        for (const items of [[{}], [productOwnCharge]]) {
          assert.equal(at(d.freeDeliveryAbove, st, items), 0, `${name}: free at the amount, ${st}: ${text}`);
          assert.equal(at(d.freeDeliveryAbove + 500, st, items), 0, `${name}: free above the amount, ${st}: ${text}`);
        }
      }
      // what it says about below the amount
      const per = f.detail?.match(/is (₹\d+) per order$/);
      if (per) for (const st of STATES) assert.equal(at(below, st), money(per[1]), `${name}: ${st}: ${text}`);
      const home = f.detail?.match(/is (free|₹\d+) in Kerala, (free|₹\d+) elsewhere$/);
      if (home) {
        assert.equal(at(below, 'Kerala'), home[1] === 'free' ? 0 : money(home[1]), `${name}: home: ${text}`);
        assert.equal(at(below, 'Punjab'), home[2] === 'free' ? 0 : money(home[2]), `${name}: elsewhere: ${text}`);
      }
      const vary = f.detail?.match(/is (free|₹\d+) in Kerala; other states vary$/);
      if (vary) {
        assert.equal(at(below, 'Kerala'), vary[1] === 'free' ? 0 : money(vary[1]), `${name}: home: ${text}`);
        assert.ok(d.stateRates!.length > 0, `${name}: "vary" needs a state rate: ${text}`);
      }
      assert.ok(home || per || vary, `${name}: the detail is one of the known shapes: ${text}`);
      continue;
    }
    if (f.title === 'Free standard delivery') {
      for (const st of STATES) for (const sub of [1, 500, 5000]) assert.equal(at(sub, st), 0, `${name}: ${st}: ${text}`);
      continue;
    }
    const single = f.title.match(/^Standard delivery (₹\d+) per order$/);
    if (single) {
      for (const st of STATES) for (const sub of [1, 500, 5000]) assert.equal(at(sub, st), money(single[1]), `${name}: ${st}: ${text}`);
      continue;
    }
    const from = f.title.match(/^Standard delivery from (₹\d+)$/);
    if (from) {
      const all = STATES.map((st) => at(below, st));
      assert.equal(Math.min(...all), money(from[1]), `${name}: lowest charge: ${text}`);
      continue;
    }
    assert.equal(f.title, 'Delivery charge depends on your state', `${name}: unknown title ${f.title}`);
    assert.ok(new Set(STATES.map((st) => at(below, st))).size > 1, `${name}: charges really differ by state: ${text}`);
  }
});

test('delivery time: the setting is the title and shipsTo the detail; no days, no line', () => {
  const f = byId(storeFacts({ delivery, shipsTo: 'Shipped across India' }), 'days');
  assert.deepEqual(f, { id: 'days', title: 'Delivered in 3-5 business days', detail: 'Shipped across India' });
  assert.equal(byId(storeFacts({ delivery: { ...delivery, estimatedDays: '  ' } }), 'days'), undefined);
  assert.equal(byId(storeFacts({ delivery, shipsTo: '' }), 'days')?.detail, undefined);
});

test('reply time: "Within ..." reads as a sentence, any other text keeps a label', () => {
  assert.equal(byId(storeFacts({ delivery, responseTime: 'Within 24 hours' }), 'reply')?.title, 'We reply within 24 hours');
  assert.equal(byId(storeFacts({ delivery, responseTime: 'Same day' }), 'reply')?.title, 'Reply time: Same day');
});

test('reply time: the opening hours are the detail, and an empty reply time hides the line', () => {
  const f = byId(storeFacts({ delivery, responseTime: 'Within 2 hours', hours: 'Mon to Sat, 10 am to 6 pm' }), 'reply');
  assert.equal(f?.detail, 'Mon to Sat, 10 am to 6 pm');
  assert.equal(byId(storeFacts({ delivery, responseTime: '' }), 'reply'), undefined);
  assert.equal(byId(storeFacts({ delivery }), 'reply'), undefined);
});

test('the order is delivery, time, reply, and Indian digit grouping is used', () => {
  const facts = storeFacts({ delivery: { ...delivery, freeDeliveryAbove: 150000 }, responseTime: 'Within 24 hours' });
  assert.deepEqual(facts.map((f) => f.id), ['delivery', 'days', 'reply']);
  assert.equal(facts[0].title, 'Free delivery on orders of ₹1,50,000 or more');
});

test('the reply time has one home: BRAND.replyWithin feeds the support default, and Phase 1 names both new fields', () => {
  assert.equal(typeof BRAND.replyWithin, 'string');
  assert.equal(typeof BRAND.shipsTo, 'string');
  const settings = readFileSync('src/services/siteSettingsService.ts', 'utf8');
  assert.match(settings, /responseTime: BRAND\.replyWithin \? `Within \$\{BRAND\.replyWithin\}` : ''/, 'DEFAULT_SUPPORT.responseTime must be built from BRAND.replyWithin');
  const phase1 = readFileSync('docs/template/PHASE1.md', 'utf8');
  for (const field of ['replyWithin', 'shipsTo']) assert.ok(phase1.includes(field), `PHASE1.md should name ${field}`);
});

test('the strip reads the live delivery and support settings, not typed numbers', () => {
  const src = readFileSync('src/components/FactsStrip.tsx', 'utf8');
  for (const needle of ['subscribeDeliverySettings', 'subscribeCustomerSupportSettings', 'BRAND.shipsTo', 'storeFacts(']) {
    assert.ok(src.includes(needle), `FactsStrip.tsx should use ${needle}`);
  }
  assert.ok(!/₹\s*\d/.test(src), 'no rupee amount typed into the strip');
});
