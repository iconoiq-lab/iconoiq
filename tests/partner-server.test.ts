import { test } from 'node:test';
import assert from 'node:assert/strict';
import admin from 'firebase-admin';
import { FakeFirestore } from './helpers/fakeFirestore.ts';
import { reconcileRewards, refreshPartnerTotals } from '../api/notify-order.ts';
import { partnerNote, resolvePartnerCode } from '../api/create-order.ts';

const T = (ms: number) => admin.firestore.Timestamp.fromMillis(ms);
const CUST = 'cust1';
const PUID = 'partner1';
const asDb = (db: FakeFirestore) => db as unknown as Parameters<typeof reconcileRewards>[0];
const asCo = (db: FakeFirestore) => db as unknown as NonNullable<Parameters<typeof resolvePartnerCode>[3]>;

function shop(settings: Record<string, unknown> = { enabled: true }) {
  const db = new FakeFirestore();
  db.applySet('siteSettings/rewards', { enabled: false }, false);
  db.applySet('partnerSettings/main', settings, false);
  db.applySet('partnerCodes/RAVI3210', { uid: PUID, active: true }, false);
  db.applySet(`partners/${PUID}`, { uid: PUID, status: 'approved', code: 'RAVI3210', name: 'Ravi' }, false);
  return db;
}

/** A paid order placed with the partner's code. */
function order(db: FakeFirestore, rzp: string, sales: number, status: string, extra: Record<string, unknown> = {}, uid = CUST) {
  db.applySet(
    `payments/${rzp}`,
    { uid, amountPaise: sales * 100, base: sales, points: 0, pointsValue: 0, cashback: 0, partnerUid: PUID, partnerCode: 'RAVI3210', partnerSales: sales, partnerUnits: 2, partnerFamily: false, partnerSavings: 0, ...extra },
    false,
  );
  db.applySet(`orders/${rzp}`, { userId: uid, orderId: `ORD-${rzp}`, razorpayOrderId: rzp, status, paymentStatus: 'paid', total: sales, deliveredAt: T(Date.now()) }, false);
}
const reconcile = (db: FakeFirestore, rzp: string) => reconcileRewards(asDb(db), rzp, db.read(`orders/${rzp}`)!);
const sales = (db: FakeFirestore) => db.read(`partnerPrivate/${PUID}`)?.lifetimeSales;
const unlocked = (db: FakeFirestore) => db.read(`partnerPrivate/${PUID}`)?.unlockedSales;
/** Let an order's return window pass (its earning's unlockAt moves into the past). */
const age = (db: FakeFirestore, rzp: string) => db.applyUpdate(`partners/${PUID}/earnings/${rzp}`, { unlockAt: T(Date.now() - 1000) });
const refresh = (db: FakeFirestore) => refreshPartnerTotals(asDb(db), PUID, admin.firestore.Timestamp.now());
const setStatus = (db: FakeFirestore, rzp: string, status: string) => db.applyUpdate(`orders/${rzp}`, { status });

test('create-order: a partner code is resolved on the server; family use gets the tier percent', async () => {
  const db = shop({ enabled: true, customerDiscountPercent: 5 });
  assert.deepEqual(await resolvePartnerCode('RAVI3210', CUST, 2000, asCo(db)), { partnerUid: PUID, code: 'RAVI3210', family: false, percent: 5, discount: 100 });
  assert.deepEqual(await resolvePartnerCode('RAVI3210', PUID, 2000, asCo(db)), { partnerUid: PUID, code: 'RAVI3210', family: true, percent: 15, discount: 300 });
  db.applyUpdate(`partners/${PUID}`, { lifetimeSales: 0 }); // ignored: the figure is private
  db.applySet(`partnerPrivate/${PUID}`, { lifetimeSales: 250000, unlockedSales: 0 }, false);
  assert.equal((await resolvePartnerCode('RAVI3210', PUID, 2000, asCo(db)))!.percent, 15, 'sales still inside their return window: not Gold yet');
  db.applySet(`partnerPrivate/${PUID}`, { lifetimeSales: 250000, unlockedSales: 250000 }, false);
  assert.equal((await resolvePartnerCode('RAVI3210', PUID, 2000, asCo(db)))!.percent, 30, 'Gold partner: 30% family discount');
});

test('create-order: off switch, unknown, inactive or unapproved codes give nothing', async () => {
  assert.equal(await resolvePartnerCode('RAVI3210', CUST, 2000, asCo(shop({ enabled: false }))), null);
  const db = shop();
  assert.equal(await resolvePartnerCode('NOPE1234', CUST, 2000, asCo(db)), null);
  assert.equal(await resolvePartnerCode('../x', CUST, 2000, asCo(db)), null, 'a malformed code is never looked up');
  db.applyUpdate(`partners/${PUID}`, { status: 'suspended' });
  assert.equal(await resolvePartnerCode('RAVI3210', CUST, 2000, asCo(db)), null);
  db.applyUpdate(`partners/${PUID}`, { status: 'approved', code: 'RAVI9999' });
  assert.equal(await resolvePartnerCode('RAVI3210', CUST, 2000, asCo(db)), null, 'a code the admin changed no longer works');
});

test('create-order: the rw_partner note carries the sales value after every discount', () => {
  const use = { partnerUid: PUID, code: 'RAVI3210', family: false, percent: 5, discount: 100 };
  assert.equal(partnerNote(use, 2000, { pointsValue: 50, cashback: 20 }, [{ quantity: 2 }, { quantity: 1 }]), `${PUID}|RAVI3210|1830|3|0|0`);
  assert.equal(partnerNote({ ...use, family: true, discount: 300 }, 2000, { pointsValue: 0, cashback: 0 }, [{ quantity: 1 }]), `${PUID}|RAVI3210|1700|1|1|300`);
});

test('reconcile: nothing until delivered; then 15% credited once, held until the return window ends', async () => {
  const db = shop();
  order(db, 'o1', 1000, 'shipped');
  await reconcile(db, 'o1');
  assert.equal(db.read(`partners/${PUID}/earnings/o1`), undefined);
  setStatus(db, 'o1', 'delivered');
  await reconcile(db, 'o1');
  await reconcile(db, 'o1');
  const e = db.read(`partners/${PUID}/earnings/o1`)!;
  assert.equal(e.amount, 150);
  assert.equal(e.rate, 15);
  assert.equal(e.state, 'active');
  assert.ok(e.unlockAt.toMillis() >= Date.now() + 6 * 86_400_000, 'unlocks after the 7-day return window');
  const p = db.read(`partners/${PUID}`)!;
  assert.deepEqual([sales(db), p.unitsSold, p.earnedTotal, p.tier], [1000, 2, 150, 'silver']);
  // Spec decision 6: no sales value anywhere the partner can read.
  assert.equal(p.lifetimeSales, undefined, 'not on the partner doc');
  assert.equal(e.sales, undefined, 'not on the earning');
  assert.equal(db.read(`partnerPrivate/${PUID}/orders/o1`)!.sales, 1000, 'kept privately per order');
  assert.deepEqual([p.silverGrams, p.perksUnlocked], [0, ['catalogue', 'photos']]);
  const o = db.read('orders/o1')!;
  assert.deepEqual([o.partnerUid, o.partnerCode, o.partnerFamily], [PUID, 'RAVI3210', false]);
});

test('reconcile: a return holds, a refund voids and removes the sales, reopening restores', async () => {
  const db = shop();
  order(db, 'o1', 1000, 'delivered');
  await reconcile(db, 'o1');
  setStatus(db, 'o1', 'returnRequested');
  await reconcile(db, 'o1');
  assert.equal(db.read(`partners/${PUID}/earnings/o1`)!.state, 'held');
  assert.equal(sales(db), 1000, 'still counts while the return is open');
  setStatus(db, 'o1', 'refunded');
  await reconcile(db, 'o1');
  assert.equal(db.read(`partners/${PUID}/earnings/o1`)!.state, 'void');
  assert.equal(sales(db), 0);
  assert.equal(db.read(`partners/${PUID}`)!.earnedTotal, 0);
  setStatus(db, 'o1', 'delivered');
  await reconcile(db, 'o1');
  assert.equal(db.read(`partners/${PUID}/earnings/o1`)!.state, 'active');
  assert.equal(sales(db), 1000);
});

test('reconcile: Gold applies only to orders delivered after the threshold is passed', async () => {
  const db = shop();
  order(db, 'big', 199000, 'delivered');
  await reconcile(db, 'big');
  order(db, 'cross', 5000, 'delivered');
  await reconcile(db, 'cross');
  assert.equal(db.read(`partners/${PUID}/earnings/cross`)!.rate, 15, 'the order that crosses the line is still Silver');
  age(db, 'big');
  age(db, 'cross');
  assert.equal(await refresh(db), true);
  assert.equal(db.read(`partners/${PUID}`)!.tier, 'gold');
  assert.equal(db.read(`partners/${PUID}`)!.silverGrams, 20);
  assert.equal(db.read(`partners/${PUID}`)!.perksUnlocked.includes('trip'), true);
  order(db, 'next', 1000, 'delivered');
  await reconcile(db, 'next');
  assert.equal(db.read(`partners/${PUID}/earnings/next`)!.rate, 30);
  assert.equal(db.read(`partners/${PUID}/earnings/next`)!.amount, 300);
  assert.equal(db.read(`partners/${PUID}/earnings/big`)!.rate, 15, 'not retroactive');
});

test('reconcile: the admin override wins over the automatic tier', async () => {
  const db = shop();
  db.applyUpdate(`partners/${PUID}`, { tierOverride: 'gold' });
  order(db, 'o1', 1000, 'delivered');
  await reconcile(db, 'o1');
  assert.equal(db.read(`partners/${PUID}/earnings/o1`)!.amount, 300);
  assert.equal(db.read(`partners/${PUID}`)!.tier, 'gold');
});

test('reconcile: a family order earns nothing, records the savings and adds no sales', async () => {
  const db = shop();
  order(db, 'f1', 1700, 'delivered', { partnerFamily: true, partnerSavings: 300 }, PUID);
  await reconcile(db, 'f1');
  const e = db.read(`partners/${PUID}/earnings/f1`)!;
  assert.deepEqual([e.amount, e.family, e.savings], [0, true, 300]);
  const p = db.read(`partners/${PUID}`)!;
  assert.deepEqual([sales(db), p.familySavings, p.earnedTotal], [0, 300, 0]);
});

test('reconcile: a partner who is not approved is not credited', async () => {
  const db = shop();
  db.applyUpdate(`partners/${PUID}`, { status: 'suspended' });
  order(db, 'o1', 1000, 'delivered');
  await reconcile(db, 'o1');
  assert.equal(db.read(`partners/${PUID}/earnings/o1`), undefined);
});

test('unlocks: sales inside the return window unlock no perks, silver or Gold', async () => {
  const db = shop();
  order(db, 'big', 250000, 'delivered');
  await reconcile(db, 'big');
  const p = db.read(`partners/${PUID}`)!;
  assert.deepEqual([sales(db), unlocked(db)], [250000, 0], 'counted for the admin, not unlocked');
  assert.deepEqual([p.tier, p.silverGrams, p.perksUnlocked], ['silver', 0, ['catalogue', 'photos']]);
  assert.equal(p.viewsDueAt.toMillis(), db.read(`partners/${PUID}/earnings/big`)!.unlockAt.toMillis(), 'the partner area knows when to ask again');
  order(db, 'next', 1000, 'delivered');
  await reconcile(db, 'next');
  assert.equal(db.read(`partners/${PUID}/earnings/next`)!.rate, 15, 'a returnable ₹2.5L order does not lift the next one to Gold');
});

test('unlocks: a held order (return open) unlocks nothing, even past its unlockAt', async () => {
  const db = shop();
  order(db, 'o1', 120000, 'delivered');
  await reconcile(db, 'o1');
  setStatus(db, 'o1', 'returnRequested');
  await reconcile(db, 'o1');
  age(db, 'o1');
  await refresh(db);
  assert.equal(unlocked(db), 0);
  assert.equal(db.read(`partners/${PUID}`)!.silverGrams, 0);
});

test('unlocks: once the return window ends they unlock, and the next order earns Gold', async () => {
  const db = shop();
  order(db, 'big', 250000, 'delivered');
  await reconcile(db, 'big');
  age(db, 'big');
  assert.equal(await refresh(db), true);
  assert.equal(await refresh(db), false, 'nothing to write the second time');
  const p = db.read(`partners/${PUID}`)!;
  assert.deepEqual([unlocked(db), p.tier, p.silverGrams, p.viewsDueAt], [250000, 'gold', 25, null]);
  assert.ok(p.perksUnlocked.includes('trip') && p.perksUnlocked.includes('uniforms'));
  assert.equal(p.lifetimeSales, undefined, 'still no sales value on the partner doc');
  order(db, 'next', 1000, 'delivered');
  await reconcile(db, 'next');
  assert.equal(db.read(`partners/${PUID}/earnings/next`)!.rate, 30);
});

test('unlocks: a return void takes the sales back out of unlockedSales', async () => {
  const db = shop();
  order(db, 'a', 60000, 'delivered');
  order(db, 'b', 50000, 'delivered');
  await reconcile(db, 'a');
  await reconcile(db, 'b');
  age(db, 'a');
  age(db, 'b');
  await refresh(db);
  assert.equal(unlocked(db), 110000);
  assert.ok(db.read(`partners/${PUID}`)!.perksUnlocked.includes('trip'));
  setStatus(db, 'b', 'refunded');
  await reconcile(db, 'b');
  const p = db.read(`partners/${PUID}`)!;
  assert.deepEqual([sales(db), unlocked(db), p.silverGrams], [60000, 60000, 6]);
  assert.equal(p.perksUnlocked.includes('trip'), false, 'the trip locks again');
});

test('unlocks: an order delivered after a held credit waits the full return window from delivery', async () => {
  const db = shop({ enabled: true, holdDays: 1 });
  order(db, 'o1', 30000, 'delivered');
  await reconcile(db, 'o1');
  setStatus(db, 'o1', 'returnRequested');
  await reconcile(db, 'o1');
  // The earning's unlockAt somehow sits before the window (an older credit): release extends it.
  age(db, 'o1');
  db.applyUpdate(`orders/o1`, { deliveredAt: T(Date.now()) });
  setStatus(db, 'o1', 'delivered');
  await reconcile(db, 'o1');
  assert.ok(db.read(`partners/${PUID}/earnings/o1`)!.unlockAt.toMillis() >= Date.now() + 6 * 86_400_000);
  assert.equal(unlocked(db), 0);
});

test('totals: two reconciles at once never undercount (one transaction each)', async () => {
  const db = shop();
  order(db, 'a', 40000, 'delivered');
  order(db, 'b', 30000, 'delivered');
  await Promise.all([reconcile(db, 'a'), reconcile(db, 'b')]);
  age(db, 'a');
  age(db, 'b');
  await Promise.all([refresh(db), refresh(db), reconcile(db, 'a')]);
  assert.deepEqual([sales(db), unlocked(db)], [70000, 70000]);
  assert.equal(db.read(`partners/${PUID}`)!.unitsSold, 4);
});
