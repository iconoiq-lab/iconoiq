import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  collection,
  initializeFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  type Firestore,
} from 'firebase/firestore';

/**
 * The partner programme's firestore.rules against the real Firestore emulator.
 * Runs only when FIRESTORE_EMULATOR_HOST is set (a local emulator with a
 * demo- project; nothing live is touched):
 *
 *   firebase emulators:start --only firestore --project demo-iconoiq
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node --test tests/partnerRules.emulator.test.ts
 *
 * Seeds with the emulator's rules-bypass ("owner") token over REST.
 */

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = 'demo-iconoiq';
const skip = !HOST ? 'FIRESTORE_EMULATOR_HOST is not set' : false;
const apps: FirebaseApp[] = [];

function as(uid: string): Firestore {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'x' }, `u-${uid}-${apps.length}`);
  apps.push(app);
  const db = initializeFirestore(app, {});
  const [host, port] = String(HOST).split(':');
  connectFirestoreEmulator(db, host, Number(port), { mockUserToken: { user_id: uid, sub: uid } });
  return db;
}

/** Rules-bypassing write (the emulator's "owner" token), for seeding. */
async function seed(path: string, fields: Record<string, unknown>) {
  const enc = (v: unknown): unknown => {
    if (typeof v === 'string') return { stringValue: v };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (v && typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
    return { nullValue: null };
  };
  const r = await fetch(`http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, x]) => [k, enc(x)])) }),
  });
  assert.ok(r.ok, `seed ${path}: ${r.status} ${await r.text()}`);
}

const denied = async (p: Promise<unknown>, what: string) => {
  await assert.rejects(p, (e: { code?: string }) => e.code === 'permission-denied', what);
};

let ravi: Firestore;
let mira: Firestore;
let admin: Firestore;
let stranger: Firestore;

before(async () => {
  if (skip) return;
  await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await seed('users/boss', { role: 'admin' });
  await seed('partnerSettings/main', { enabled: true });
  await seed('partners/ravi', { uid: 'ravi', status: 'approved', code: 'RAVI3210', name: 'Ravi', silverGrams: 3 });
  await seed('partnerPrivate/ravi', { lifetimeSales: 35000, unlockedSales: 35000 });
  // Kiran's ₹2L is still inside its return window: counted, not unlocked.
  await seed('partners/kiran', { uid: 'kiran', status: 'approved', code: 'KIRAN111', name: 'Kiran' });
  await seed('partnerPrivate/kiran', { lifetimeSales: 200000, unlockedSales: 0 });
  await seed('partnerPrivate/ravi/orders/o1', { sales: 35000 });
  // A sales figure on the partner's own doc is ignored: unlocks read partnerPrivate (Mira has none).
  await seed('partners/mira', { uid: 'mira', status: 'approved', code: 'MIRA1111', name: 'Mira', lifetimeSales: 999999 });
  await seed('partnerCodes/RAVI3210', { uid: 'ravi', active: true });
  await seed('partners/ravi/earnings/o1', { amount: 150, state: 'active' });
  await seed('partners/ravi/payouts/p1', { amount: 150, note: 'UPI' });
  await seed('dealers/shop', { uid: 'shop', status: 'approved', businessName: 'Shop' });
  ravi = as('ravi');
  mira = as('mira');
  admin = as('boss');
  stranger = as('stranger');
});

after(async () => {
  await Promise.all(apps.map((a) => deleteApp(a)));
});

test('a partner cannot raise their own totals, tier or code', { skip }, async () => {
  await denied(updateDoc(doc(ravi, 'partners/ravi'), { lifetimeSales: 999999 }), 'totals');
  await denied(updateDoc(doc(ravi, 'partners/ravi'), { tier: 'gold' }), 'tier');
  await denied(updateDoc(doc(ravi, 'partners/ravi'), { code: 'RICH0001' }), 'code');
  await denied(setDoc(doc(ravi, 'partners/ravi/earnings/fake'), { amount: 5000, state: 'active' }), 'earning');
  await denied(updateDoc(doc(ravi, 'partners/ravi/earnings/o1'), { amount: 5000 }), 'edit earning');
  await denied(setDoc(doc(ravi, 'partnerCodes/RICH0001'), { uid: 'ravi', active: true }), 'claim a code');
  await denied(setDoc(doc(ravi, 'partnerSettings/main'), { enabled: true, silverPercent: 90 }), 'settings');
});

test('an application is pending with no totals; it cannot start approved', { skip }, async () => {
  const app = { uid: 'stranger', name: 'Asha', business: 'Asha Dance Academy', phone: '9876543210', city: 'Hyderabad', state: 'Telangana' };
  await denied(setDoc(doc(stranger, 'partners/stranger'), { ...app, status: 'approved', appliedAt: serverTimestamp() }), 'approved');
  await denied(setDoc(doc(stranger, 'partners/stranger'), { ...app, status: 'pending', appliedAt: serverTimestamp(), lifetimeSales: 500000 }), 'with totals');
  await setDoc(doc(stranger, 'partners/stranger'), { ...app, status: 'pending', appliedAt: serverTimestamp() });
  await denied(updateDoc(doc(stranger, 'partners/stranger'), { status: 'approved' }), 'self-approve');
});

test('a partner cannot read another partner, their earnings or list codes', { skip }, async () => {
  assert.equal((await getDoc(doc(ravi, 'partners/ravi'))).exists(), true);
  await denied(getDoc(doc(mira, 'partners/ravi')), 'other partner');
  await denied(getDocs(collection(mira, 'partners/ravi/earnings')), 'other earnings');
  await denied(getDocs(collection(mira, 'partners')), 'list partners');
  await denied(getDocs(collection(mira, 'partnerCodes')), 'list codes');
  assert.equal((await getDoc(doc(stranger, 'partnerCodes/RAVI3210'))).data()?.uid, 'ravi', 'one code can be looked up');
});

test('the sales value is admin-only: no partner reads or writes partnerPrivate', { skip }, async () => {
  await denied(getDoc(doc(ravi, 'partnerPrivate/ravi')), 'own lifetime sales');
  await denied(getDocs(collection(ravi, 'partnerPrivate/ravi/orders')), 'own per-order sales');
  await denied(getDoc(doc(mira, 'partnerPrivate/ravi')), 'another partner');
  await denied(setDoc(doc(ravi, 'partnerPrivate/ravi'), { lifetimeSales: 999999 }), 'raise own sales');
  await denied(setDoc(doc(ravi, 'partnerPrivate/ravi/orders/x'), { sales: 999999 }), 'add an order');
  await denied(setDoc(doc(admin, 'partnerPrivate/ravi'), { lifetimeSales: 1 }), 'even the admin: server only');
  assert.equal((await getDoc(doc(admin, 'partnerPrivate/ravi'))).data()?.lifetimeSales, 35000, 'the admin reads it');
  assert.equal((await getDocs(collection(admin, 'partnerPrivate'))).size >= 1, true, 'the admin lists it');
});

test('a payout is confirmed once, by its partner, with the server time only', { skip }, async () => {
  await denied(updateDoc(doc(mira, 'partners/ravi/payouts/p1'), { receivedAt: serverTimestamp() }), 'other partner');
  await denied(updateDoc(doc(ravi, 'partners/ravi/payouts/p1'), { receivedAt: serverTimestamp(), amount: 9000 }), 'with amount');
  await updateDoc(doc(ravi, 'partners/ravi/payouts/p1'), { receivedAt: serverTimestamp() });
  await denied(updateDoc(doc(ravi, 'partners/ravi/payouts/p1'), { receivedAt: serverTimestamp() }), 'twice');
  await denied(setDoc(doc(ravi, 'partners/ravi/payouts/p2'), { amount: 100 }), 'create payout');
});

test('perk claims: unlocked only, once each, counted and monthly limits', { skip }, async () => {
  const c = (id: string, data: Record<string, unknown>) =>
    setDoc(doc(ravi, `partners/ravi/claims/${id}`), { status: 'requested', createdAt: serverTimestamp(), ...data });
  await c('pamphlets', { perk: 'pamphlets' });
  await denied(c('pamphlets', { perk: 'pamphlets' }), 'twice (the same id)');
  await denied(c('standee', { perk: 'standee' }), 'locked: needs 50,000');
  await denied(c('trip', { perk: 'trip' }), 'locked: needs 1,00,000');
  await denied(c('pamphlets2', { perk: 'pamphlets' }), 'a second id for a one-time perk');
  await c('masterclass_1', { perk: 'masterclass', index: 1 });
  await denied(c('masterclass_7', { perk: 'masterclass', index: 7 }), 'beyond the 6 classes');
  await denied(c('masterclass_x', { perk: 'masterclass', index: 2 }), 'id must match the index');
  const ist = new Date(Date.now() + 330 * 60_000);
  const month = `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`;
  await c(`promoTeam_${month}`, { perk: 'promoTeam', month });
  await denied(c('promoTeam_2020-01', { perk: 'promoTeam', month: '2020-01' }), 'another month');
  await denied(c('fake', { perk: 'pamphlets', status: 'fulfilled' }), 'self-fulfilled');
  await denied(updateDoc(doc(ravi, 'partners/ravi/claims/pamphlets'), { status: 'fulfilled' }), 'fulfil own claim');
  await denied(deleteDoc(doc(ravi, 'partners/ravi/claims/pamphlets')), 'delete to claim again');
  await denied(setDoc(doc(mira, 'partners/mira/claims/pamphlets'), { perk: 'pamphlets', status: 'requested', createdAt: serverTimestamp() }), 'Mira: locked');
  await updateDoc(doc(admin, 'partners/ravi/claims/pamphlets'), { status: 'fulfilled' });
});

test('silver coins: a chain that never passes the grams earned', { skip }, async () => {
  const c = (id: string, data: Record<string, unknown>) =>
    setDoc(doc(ravi, `partners/ravi/claims/${id}`), { perk: 'silver', status: 'requested', createdAt: serverTimestamp(), ...data });
  await denied(c('silver_0', { from: 0, to: 4 }), '35,000 earns 3 g, not 4');
  await c('silver_0', { from: 0, to: 2 });
  await denied(c('silver_0', { from: 0, to: 3 }), 'the same start twice');
  await denied(c('silver_1', { from: 1, to: 3, prev: 0 }), 'overlapping the first claim');
  await c('silver_2', { from: 2, to: 3, prev: 0 });
  await denied(c('silver_3', { from: 3, to: 4, prev: 2 }), 'nothing left to claim');
});

test('claims read unlocked sales only: sales inside the return window unlock nothing', { skip }, async () => {
  const kiran = as('kiran');
  const c = (id: string, data: Record<string, unknown>) =>
    setDoc(doc(kiran, `partners/kiran/claims/${id}`), { status: 'requested', createdAt: serverTimestamp(), ...data });
  await denied(c('trip', { perk: 'trip' }), 'trip: ₹2L sold but none past the window');
  await denied(c('pamphlets', { perk: 'pamphlets' }), 'pamphlets: needs ₹10,000 unlocked');
  await denied(c('silver_0', { perk: 'silver', from: 0, to: 1 }), 'no silver yet');
  await c('catalogue', { perk: 'catalogue' });
});

test('orders cannot carry the partner fields from the browser', { skip }, async () => {
  await denied(
    setDoc(doc(mira, 'orders/rzp_x'), { userId: 'mira', status: 'pending', razorpayOrderId: 'rzp_x', partnerUid: 'mira', partnerCode: 'MIRA1111' }),
    'self-attribution',
  );
  // The same order without them is accepted, so the refusal above is the partner fields.
  await setDoc(doc(mira, 'orders/rzp_y'), { userId: 'mira', status: 'pending', razorpayOrderId: 'rzp_y' });
});

test('a stockist logs and reads their own sales; others cannot', { skip }, async () => {
  const shop = as('shop');
  const sale = { productId: 'p1', name: 'Kolam kit', qty: 2, unitPrice: 499, at: new Date(), createdAt: serverTimestamp() };
  await setDoc(doc(shop, 'dealers/shop/sales/s1'), sale);
  assert.equal((await getDocs(collection(shop, 'dealers/shop/sales'))).size, 1);
  await denied(getDocs(collection(mira, 'dealers/shop/sales')), 'another user');
  await denied(setDoc(doc(mira, 'dealers/mira/sales/s1'), sale), 'not a dealer');
  await denied(updateDoc(doc(shop, 'dealers/shop/sales/s1'), { qty: 1 }), 'edit');
  await denied(setDoc(doc(shop, 'dealers/shop/sales/s2'), { ...sale, qty: 0 }), 'zero qty');
});
