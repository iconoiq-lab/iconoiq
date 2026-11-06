import { test } from 'node:test';
import assert from 'node:assert/strict';
import admin from 'firebase-admin';
import { FakeFirestore } from './helpers/fakeFirestore.ts';
import { reconcileRewards, refreshPartnerTotals, reviewPartnerEarning } from '../api/notify-order.ts';
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

// ─── Self-referral (2026-11-03 security review) ────────────────────────────
// A partner checking out as a guest or from a second account with their own
// code must not earn commission or unlock credit.

/** The partner's own account and application details. */
function partnerContact(db: FakeFirestore) {
  db.applyUpdate(`partners/${PUID}`, { name: 'Ravi Kumar', phone: '+91 98480 12345', city: 'Vijayawada', state: 'Andhra Pradesh' });
  db.applySet(`users/${PUID}`, { email: 'Ravi.K@example.com', phone: '9000011111' }, false);
  db.applySet(`users/${PUID}/addresses/a1`, { fullName: 'Ravi Kumar', mobile: '9000011111', address: '12-4, Temple Street', pincode: '520001' }, false);
}
const ship = (o: Record<string, unknown>) => ({ shippingAddress: { fullName: 'Sita Devi', mobile: '9123456789', address: '7 Lake Road', pincode: '500001', ...o } });
const earning = (db: FakeFirestore, rzp: string) => db.read(`partners/${PUID}/earnings/${rzp}`)!;
const privateOrder = (db: FakeFirestore, rzp: string) => db.read(`partnerPrivate/${PUID}/orders/${rzp}`)!;

test('self-referral: a delivery phone that is the partner\'s own earns nothing and adds no sales', async () => {
  const db = shop();
  partnerContact(db);
  order(db, 's1', 1000, 'delivered', {}, 'guest-or-second-account');
  db.applyUpdate('orders/s1', ship({ mobile: '098480-12345' }));
  await reconcile(db, 's1');
  const e = earning(db, 's1');
  assert.deepEqual([e.amount, e.rate, e.family], [0, 0, true]);
  assert.equal(privateOrder(db, 's1').selfOrder, 'phone', 'the reason is kept where only the admin reads it');
  assert.equal(e.selfOrder, undefined, 'not on the earning the partner reads');
  age(db, 's1');
  await refresh(db);
  assert.deepEqual([sales(db), unlocked(db), db.read(`partners/${PUID}`)!.earnedTotal], [0, 0, 0]);
});

test('self-referral: the partner\'s account phone or email on the order also counts as their own', async () => {
  const db = shop();
  partnerContact(db);
  order(db, 's1', 1000, 'delivered', {}, 'second');
  db.applyUpdate('orders/s1', { ...ship({}), userPhone: '+919000011111' });
  order(db, 's2', 1000, 'delivered', {}, 'third');
  db.applyUpdate('orders/s2', { ...ship({}), userEmail: ' ravi.k@EXAMPLE.com ' });
  order(db, 's3', 1000, 'delivered', {}, 'fourth');
  db.applyUpdate('orders/s3', ship({}));
  db.applySet('users/fourth', { phone: '98480 12345' }, false);
  for (const id of ['s1', 's2', 's3']) await reconcile(db, id);
  assert.deepEqual(['s1', 's2', 's3'].map((id) => [earning(db, id).amount, privateOrder(db, id).selfOrder]), [[0, 'phone'], [0, 'email'], [0, 'phone']]);
});

test('self-referral: the partner\'s name or saved address holds the commission for the admin\'s check', async () => {
  const db = shop();
  partnerContact(db);
  order(db, 'n1', 1000, 'delivered');
  db.applyUpdate('orders/n1', ship({ fullName: '  ravi   KUMAR ' }));
  order(db, 'a1', 2000, 'delivered');
  db.applyUpdate('orders/a1', ship({ address: '12-4 temple street', pincode: '520001' }));
  await reconcile(db, 'n1');
  await reconcile(db, 'a1');
  assert.deepEqual([earning(db, 'n1').amount, earning(db, 'n1').review], [150, 'pending'], 'credited, but waiting for a check');
  assert.deepEqual([privateOrder(db, 'n1').reviewReason, privateOrder(db, 'a1').reviewReason], ['name', 'address']);
  age(db, 'n1');
  age(db, 'a1');
  await refresh(db);
  assert.equal(unlocked(db), 0, 'an order waiting for a check unlocks nothing');
  assert.equal(db.read(`partnerPrivate/${PUID}`)!.reviewPending, 2, 'the admin list shows how many to check');
});

test('self-referral: a customer with different details is credited normally', async () => {
  const db = shop();
  partnerContact(db);
  order(db, 'c1', 1000, 'delivered');
  db.applyUpdate('orders/c1', { ...ship({}), userEmail: 'sita@example.com', userPhone: '9123456789' });
  await reconcile(db, 'c1');
  const e = earning(db, 'c1');
  assert.deepEqual([e.amount, e.family, e.review], [150, false, undefined]);
  assert.equal(db.read(`partnerPrivate/${PUID}`)!.reviewPending, 0);
});

test('admin review: "pay it" releases the commission; "their own order" removes it for good', async () => {
  const db = shop();
  partnerContact(db);
  for (const id of ['r1', 'r2']) {
    order(db, id, 1000, 'delivered');
    db.applyUpdate(`orders/${id}`, ship({ fullName: 'Ravi Kumar' }));
    await reconcile(db, id);
    age(db, id);
  }
  const now = admin.firestore.Timestamp.now();
  assert.equal(await reviewPartnerEarning(asDb(db), PUID, 'r1', 'pay', 'admin1', now), true);
  assert.equal(await reviewPartnerEarning(asDb(db), PUID, 'r2', 'own', 'admin1', now), true);
  assert.deepEqual([earning(db, 'r1').review, earning(db, 'r1').amount], ['cleared', 150]);
  assert.deepEqual([earning(db, 'r2').review, earning(db, 'r2').amount, earning(db, 'r2').family], ['own', 0, true]);
  assert.equal(privateOrder(db, 'r2').reviewedBy, 'admin1');
  assert.deepEqual([unlocked(db), sales(db), db.read(`partnerPrivate/${PUID}`)!.reviewPending], [1000, 1000, 0]);
  // A later reconcile (status change) never brings the commission back.
  await reconcile(db, 'r2');
  assert.equal(earning(db, 'r2').amount, 0);
  assert.equal(await reviewPartnerEarning(asDb(db), PUID, 'r2', 'pay', 'admin1', now), false, 'only an order still waiting can be decided');
  assert.equal(await reviewPartnerEarning(asDb(db), PUID, 'nope', 'pay', 'admin1', now), false);
});
