import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseCoinSettings,
  coinTypeFor,
  nextRunPlace,
  planCoinGift,
  readOrderCoinGift,
  ordersToGold,
  type CoinPlanInput,
} from '../src/lib/coinGift.ts';

const on = normaliseCoinSettings({ enabled: true });
const base: CoinPlanInput = {
  settings: on,
  gift: null,
  goodsRupees: 3500,
  dealer: false,
  ended: false,
  paidAtMs: 2_000_000,
  enabledAtMs: 1_000_000,
  others: [],
};

const S = (t: number) => ({ type: 'silver' as const, decidedAtMs: t });
const G = (t: number) => ({ type: 'gold' as const, decidedAtMs: t });

test('settings: defaults, clamping, off unless exactly true', () => {
  assert.deepEqual(normaliseCoinSettings(null), { enabled: false, minOrder: 3500, goldEvery: 4 });
  assert.equal(normaliseCoinSettings({ enabled: 'yes' as unknown as boolean }).enabled, false);
  assert.deepEqual(normaliseCoinSettings({ enabled: true, minOrder: -5, goldEvery: 0 }), { enabled: true, minOrder: 0, goldEvery: 1 });
  assert.equal(normaliseCoinSettings({ minOrder: '4000' as unknown as number }).minOrder, 4000);
  assert.equal(normaliseCoinSettings({ goldEvery: Number.NaN }).goldEvery, 4);
});

test('run places 1-3 silver, 4th gold', () => {
  assert.deepEqual([1, 2, 3, 4].map((n) => coinTypeFor(n, on)), ['silver', 'silver', 'silver', 'gold']);
  // gold every 4 lowered to 2 mid-run: a longer run still ends in gold
  assert.equal(coinTypeFor(3, normaliseCoinSettings({ goldEvery: 2 })), 'gold');
});

test('run place: counts active coins since the latest active gold', () => {
  assert.equal(nextRunPlace([]), 1);
  assert.equal(nextRunPlace([S(1), S(2)]), 3);
  assert.equal(nextRunPlace([S(1), S(2), S(3), G(4)]), 1);
  assert.equal(nextRunPlace([S(1), S(2), S(3), G(4), S(5)]), 2);
  // silver 2 cancelled after gold 4: the next is still silver, never a second gold in a row
  assert.equal(nextRunPlace([S(1), S(3), G(4)]), 1);
  // the gold order cancelled: its run reopens, so the next coin is the gold
  assert.equal(nextRunPlace([S(1), S(2), S(3)]), 4);
  // order of the list does not matter
  assert.equal(nextRunPlace([S(5), G(4), S(1)]), 2);
});

test('sequence: 8 orders give silver x3, gold, silver x3, gold', () => {
  const seen: { type: 'silver' | 'gold'; decidedAtMs: number }[] = [];
  const types: string[] = [];
  for (let t = 1; t <= 8; t++) {
    const plan = planCoinGift({ ...base, others: seen });
    assert.equal(plan.action, 'create');
    if (plan.action !== 'create') return;
    types.push(plan.type);
    seen.push({ type: plan.type, decidedAtMs: t });
  }
  assert.deepEqual(types, ['silver', 'silver', 'silver', 'gold', 'silver', 'silver', 'silver', 'gold']);
});

test('create: exactly the minimum qualifies, one rupee less does not', () => {
  assert.deepEqual(planCoinGift(base), { action: 'create', type: 'silver', seq: 1 });
  assert.deepEqual(planCoinGift({ ...base, goodsRupees: 3499 }), { action: 'none' });
  assert.deepEqual(planCoinGift({ ...base, goodsRupees: Number.NaN }), { action: 'none' });
});

test('create: 4th coin order is gold', () => {
  assert.deepEqual(planCoinGift({ ...base, others: [S(1), S(2), S(3)] }), { action: 'create', type: 'gold', seq: 4 });
});

test('no coin when off, dealer, ended, or paid before switch-on', () => {
  assert.deepEqual(planCoinGift({ ...base, settings: normaliseCoinSettings({}) }), { action: 'none' });
  assert.deepEqual(planCoinGift({ ...base, dealer: true }), { action: 'none' });
  assert.deepEqual(planCoinGift({ ...base, ended: true }), { action: 'none' });
  assert.deepEqual(planCoinGift({ ...base, paidAtMs: 100, enabledAtMs: 1_000_000 }), { action: 'none' });
  // unknown pay time still qualifies (server sets it; never punish the customer for a missing stamp)
  assert.equal(planCoinGift({ ...base, paidAtMs: 0 }).action, 'create');
});

test('a given coin never changes; void on end, restore on reopen', () => {
  const gift = { type: 'silver' as const, seq: 1, status: 'active' as const };
  assert.deepEqual(planCoinGift({ ...base, gift }), { action: 'none' });
  assert.deepEqual(planCoinGift({ ...base, gift, goodsRupees: 10 }), { action: 'none' });
  assert.deepEqual(planCoinGift({ ...base, gift, ended: true }), { action: 'void' });
  const voided = { ...gift, status: 'void' as const, voidedBy: 'server' };
  assert.deepEqual(planCoinGift({ ...base, gift: voided }), { action: 'restore' });
  assert.deepEqual(planCoinGift({ ...base, gift: voided, ended: true }), { action: 'none' });
  // switched off later: an existing coin is kept
  assert.deepEqual(planCoinGift({ ...base, gift, settings: normaliseCoinSettings({}) }), { action: 'none' });
  // voided by the shop by hand: left alone
  assert.deepEqual(planCoinGift({ ...base, gift: { ...gift, status: 'void', voidedBy: 'admin' } }), { action: 'none' });
});

test('order view reader and orders-to-gold', () => {
  assert.equal(readOrderCoinGift(null), null);
  assert.equal(readOrderCoinGift({ type: 'bronze' }), null);
  assert.deepEqual(readOrderCoinGift({ type: 'gold', seq: 4, status: 'active', revealedAt: 1 }), {
    type: 'gold', seq: 4, status: 'active', revealed: true,
  });
  assert.equal(readOrderCoinGift({ type: 'silver', seq: 2 })?.revealed, false);
  assert.deepEqual([1, 2, 3, 4].map((s) => ordersToGold(s, 4)), [3, 2, 1, 0]);
});
