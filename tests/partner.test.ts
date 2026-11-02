import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PARTNER_SETTINGS,
  claimId,
  cleanPartnerCode,
  earningsByMonth,
  normalisePartnerMoney,
  normalisePartnerSettings,
  partnerCodeCandidate,
  partnerCodeFor,
  partnerCommission,
  partnerDiscount,
  partnerDiscountPercent,
  partnerMonthKey,
  partnerRate,
  partnerSalesValue,
  partnerTierFor,
  partnerTotals,
  partnerView,
  perkStates,
  receivedTotal,
  settledAmount,
  silverGrams,
  silverPot,
  unlockedEarnings,
  type ClaimLike,
  type EarningRow,
} from '../src/lib/partner.ts';

const S = normalisePartnerSettings(null);
const NOW = Date.UTC(2026, 10, 15, 6, 0, 0); // 15 Nov 2026, 11:30 IST

test('defaults follow PLANS.pdf: Silver 15, Gold 30 from 2,00,000, customer discount 0, programme off', () => {
  assert.equal(S.enabled, false);
  assert.equal(S.silverPercent, 15);
  assert.equal(S.goldPercent, 30);
  assert.equal(S.goldThreshold, 200000);
  assert.equal(S.customerDiscountPercent, 0);
  assert.equal(S.silverStep, 10000);
  assert.deepEqual(S, DEFAULT_PARTNER_SETTINGS);
  const clamped = normalisePartnerMoney({ silverPercent: 150, goldPercent: -3, goldThreshold: 'x' as never, enabled: 'yes' as never });
  assert.equal(clamped.silverPercent, 90);
  assert.equal(clamped.goldPercent, 0);
  assert.equal(clamped.goldThreshold, 200000);
  assert.equal(clamped.enabled, false, 'only a real true switches it on');
});

test('code: first 4 letters (padded X) + last 4 phone digits', () => {
  assert.equal(partnerCodeFor('Ravi Kumar', '90000 13210'), 'RAVI3210');
  assert.equal(partnerCodeFor('Jo', '+91 90000 00017'), 'JOXX0017');
  assert.equal(partnerCodeFor('Śrī 9 Devi', '12'), 'RDEV0012', 'non A–Z letters and digits in the name are skipped');
  assert.equal(partnerCodeFor('', ''), 'XXXX0000');
  assert.equal(partnerCodeCandidate('RAVI3210', 0), 'RAVI3210');
  assert.equal(partnerCodeCandidate('RAVI3210', 1), 'RAVI32102');
  assert.equal(cleanPartnerCode(' ravi-3210 '), 'RAVI3210');
});

test('tier: Silver below the threshold, Gold exactly at and above it, override wins', () => {
  assert.equal(partnerTierFor(0, S), 'silver');
  assert.equal(partnerTierFor(199999.99, S), 'silver');
  assert.equal(partnerTierFor(200000, S), 'gold');
  assert.equal(partnerTierFor(450000, S), 'gold');
  assert.equal(partnerTierFor(450000, S, 'silver'), 'silver');
  assert.equal(partnerTierFor(10, S, 'gold'), 'gold');
  assert.equal(partnerTierFor(10, S, 'platinum'), 'silver', 'an unknown override is ignored');
  assert.equal(partnerRate('silver', S), 15);
  assert.equal(partnerRate('gold', S), 30);
});

test('commission and discounts', () => {
  assert.equal(partnerCommission(1000, 15), 150);
  assert.equal(partnerCommission(999.99, 15), 150);
  assert.equal(partnerCommission(333, 15), 49.95);
  assert.equal(partnerCommission(0, 15), 0);
  assert.equal(partnerCommission(-5, 15), 0);
  assert.equal(partnerDiscountPercent(false, 'gold', S), 0, 'customer: the setting (0 by default)');
  assert.equal(partnerDiscountPercent(true, 'silver', S), 15, 'family: the tier percent');
  assert.equal(partnerDiscountPercent(true, 'gold', S), 30);
  assert.equal(partnerDiscount(1999, 15), 299);
  assert.equal(partnerDiscount(1999, 0), 0);
  assert.equal(partnerSalesValue({ subtotal: 2000, discount: 300, pointsValue: 50, cashback: 20 }), 1630);
  assert.equal(partnerSalesValue({ subtotal: 100, discount: 300 }), 0);
});

test('month bucketing uses India time', () => {
  assert.equal(partnerMonthKey(Date.UTC(2026, 9, 31, 18, 29)), '2026-10');
  assert.equal(partnerMonthKey(Date.UTC(2026, 9, 31, 18, 30)), '2026-11', 'midnight IST starts November');
  const rows: EarningRow[] = [
    { id: 'a', amount: 150, sales: 1000, units: 2, state: 'active', rate: 15, month: '2026-10', unlockAtMs: 0 },
    { id: 'b', amount: 30, sales: 200, units: 1, state: 'held', rate: 15, month: '2026-11', unlockAtMs: NOW + 1 },
    { id: 'c', amount: 99, sales: 660, units: 4, state: 'void', rate: 15, month: '2026-11', unlockAtMs: 0 },
    { id: 'd', amount: 15, sales: 100, units: 1, state: 'active', rate: 15, month: '2026-10', unlockAtMs: 0 },
  ];
  assert.deepEqual(earningsByMonth(rows), [
    { month: '2026-11', amount: 30, units: 1 },
    { month: '2026-10', amount: 165, units: 3 },
  ]);
});

test('totals: void and family orders never count as sales; family savings add up', () => {
  const t = partnerTotals([
    { amount: 150, sales: 1000, units: 2, state: 'active' },
    { amount: 30, sales: 200, units: 1, state: 'held' },
    { amount: 99, sales: 660, units: 4, state: 'void' },
    { amount: 0, sales: 900, units: 3, state: 'active', family: true, savings: 135 },
    { amount: 0, sales: 900, units: 3, state: 'void', family: true, savings: 135 },
  ]);
  assert.deepEqual(t, { lifetimeSales: 1200, unitsSold: 3, earnedTotal: 180, familySavings: 135 });
});

test('silver grams = floor(lifetimeSales / 10,000)', () => {
  assert.equal(silverGrams(0), 0);
  assert.equal(silverGrams(9999.99), 0);
  assert.equal(silverGrams(10000), 1);
  assert.equal(silverGrams(59999), 5);
  assert.equal(silverGrams(60000, 20000), 3);
  const claims: ClaimLike[] = [
    { id: 'silver_0', perk: 'silver', from: 0, to: 2, status: 'fulfilled' },
    { id: 'silver_2', perk: 'silver', from: 2, to: 3, status: 'requested' },
  ];
  assert.deepEqual(silverPot(5, claims), { earned: 5, claimed: 3, unclaimed: 2, lastFrom: 2 });
  assert.deepEqual(silverPot(0, []), { earned: 0, claimed: 0, unclaimed: 0, lastFrom: null });
});

test('perks: unlock at the threshold, counted and monthly claims', () => {
  const claims: ClaimLike[] = [
    { id: 'catalogue', perk: 'catalogue', status: 'fulfilled' },
    { id: 'masterclass_1', perk: 'masterclass', index: 1, status: 'requested' },
    { id: 'masterclass_3', perk: 'masterclass', index: 3, status: 'fulfilled' },
    { id: 'promoTeam_2026-10', perk: 'promoTeam', month: '2026-10', status: 'fulfilled' },
  ];
  const at = (sales: number) => Object.fromEntries(perkStates(partnerView(sales, S).perksUnlocked, S, claims, NOW).map((p) => [p.def.id, p]));
  const low = at(9999);
  assert.equal(low.catalogue.unlocked, true);
  assert.equal(low.catalogue.left, 0, 'one-time perk already redeemed');
  assert.equal(low.catalogue.fulfilled, 1);
  assert.equal(low.photos.left, 1);
  assert.equal(low.pamphlets.unlocked, false);
  assert.equal(low.pamphlets.left, 0, 'locked perks have nothing to claim');
  assert.equal(at(10000).pamphlets.unlocked, true, 'exactly at the threshold unlocks');
  const mid = at(30000);
  assert.equal(mid.masterclass.used, 2);
  assert.equal(mid.masterclass.left, 4);
  assert.equal(mid.masterclass.nextIndex, 2, 'the first free class');
  assert.equal(mid.passGroup.left, 20);
  assert.equal(mid.passSolo.left, 4);
  assert.equal(mid.promoTeam.used, 0, "last month's request does not use this month's");
  assert.equal(mid.promoTeam.left, 1);
  assert.equal(mid.standee.unlocked, false);
  assert.equal(at(100000).trip.unlocked, true);
  assert.equal(claimId('masterclass', { index: 2 }), 'masterclass_2');
  assert.equal(claimId('promoTeam', { month: '2026-11' }), 'promoTeam_2026-11');
  assert.equal(claimId('standee'), 'standee');
});

test('partnerView: only derived values for the partner doc, never the sales figure', () => {
  const v = partnerView(35000, S);
  assert.deepEqual(Object.keys(v).sort(), ['perksUnlocked', 'silverGrams', 'tier']);
  assert.equal(v.tier, 'silver');
  assert.equal(v.silverGrams, 3);
  assert.deepEqual(v.perksUnlocked, ['catalogue', 'photos', 'pamphlets', 'masterclass', 'passGroup', 'passSolo', 'promoTeam', 'onlinePromo']);
  assert.equal(partnerView(200000, S).tier, 'gold');
  assert.equal(partnerView(0, S, 'gold').tier, 'gold', 'the admin override wins');
  const custom = partnerView(25000, { perks: { masterclass: { unlockAt: 30000 } }, silverStep: 5000 });
  assert.equal(custom.perksUnlocked.includes('masterclass'), false, 'the admin-set threshold applies');
  assert.equal(custom.silverGrams, 5, 'the admin-set silver step applies');
});

test('settled = unlocked earnings − payouts confirmed received', () => {
  const rows: EarningRow[] = [
    { id: 'a', amount: 150, sales: 1000, units: 2, state: 'active', rate: 15, month: '2026-10', unlockAtMs: NOW - 1 },
    { id: 'b', amount: 300, sales: 2000, units: 2, state: 'active', rate: 15, month: '2026-11', unlockAtMs: NOW + 1000 },
    { id: 'c', amount: 45, sales: 300, units: 1, state: 'held', rate: 15, month: '2026-11', unlockAtMs: NOW - 1 },
    { id: 'd', amount: 60, sales: 400, units: 1, state: 'void', rate: 15, month: '2026-10', unlockAtMs: 0 },
    { id: 'e', amount: 15.5, sales: 103.33, units: 1, state: 'active', rate: 15, month: '2026-10', unlockAtMs: NOW },
  ];
  assert.equal(unlockedEarnings(rows, NOW), 165.5);
  const payouts = [{ id: 'p1', amount: 100, receivedAtMs: NOW - 5 }, { id: 'p2', amount: 50 }];
  assert.equal(receivedTotal(payouts), 100, 'a payout not yet confirmed does not count');
  assert.equal(settledAmount(rows, payouts, NOW), 65.5);
  assert.equal(settledAmount(rows, [{ id: 'p', amount: 999, receivedAtMs: 1 }], NOW), 0, 'never below zero');
});

test('settings: perk thresholds and counts are editable, unknown keys dropped', () => {
  const s = normalisePartnerSettings({ perks: { masterclass: { unlockAt: 25000, count: 8 }, standee: { unlockAt: -1, count: 9 }, nope: {} } as never });
  assert.deepEqual(s.perks.masterclass, { unlockAt: 25000, count: 8 });
  assert.deepEqual(s.perks.standee, { unlockAt: 0, count: 1 }, 'one-time perks always count 1');
  assert.equal('nope' in s.perks, false);
});
