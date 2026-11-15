import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestore } from './helpers/fakeFirestore.ts';
import { upiSettings } from '../api/create-order.ts';
import { claimUpiPayment, reviewUpiPayment } from '../api/notify-order.ts';
import { normalisePaymentSettings, upiPayLink, upiSettingsProblem, cleanUtr, UTR_PATTERN } from '../src/lib/paymentMode.ts';

process.env.R2_PUBLIC_URL = 'https://media.example.com';
const asDb = (db: FakeFirestore) => db as unknown as Parameters<typeof claimUpiPayment>[0];
const ID = 'upi_abc123def456789a';
const SHOT = 'https://media.example.com/payments/u1/shot.webp';

const seed = (db: FakeFirestore, extra: Record<string, unknown> = {}) => {
  db.docs.set(`manualPayments/${ID}`, {
    uid: 'u1',
    amountPaise: 129900,
    notes: { rw_base: '1299', rw_cart: 'h1' },
    upiId: 'shop@okaxis',
    payeeName: 'Shop',
    status: 'awaiting',
    ...extra,
  });
  db.docs.set(`orders/${ID}`, { userId: 'u1', paymentStatus: 'pending', status: 'pending', razorpayOrderId: ID });
};

test('the server reads the payment switch: Razorpay, UPI, or UPI without details', () => {
  assert.equal(upiSettings(null), null);
  assert.equal(upiSettings({ mode: 'razorpay', upiId: 'shop@okaxis' }), null);
  assert.equal(upiSettings({ mode: 'upi', upiId: 'not an id', payeeName: 'Shop' }), 'not_set_up');
  assert.equal(upiSettings({ mode: 'upi', upiId: 'shop@okaxis', payeeName: '' }), 'not_set_up');
  assert.deepEqual(upiSettings({ mode: 'upi', upiId: ' shop@okaxis ', payeeName: ' Shop ' }), { upiId: 'shop@okaxis', payeeName: 'Shop' });
});

test('the page and the admin form follow the same rules', () => {
  assert.equal(normalisePaymentSettings(undefined).mode, 'razorpay');
  assert.equal(normalisePaymentSettings({ mode: 'upi' }).mode, 'upi');
  assert.match(upiSettingsProblem({ mode: 'upi', upiId: 'x', payeeName: 'S' }) || '', /valid UPI ID/);
  assert.equal(upiSettingsProblem({ mode: 'upi', upiId: 'shop@okaxis', payeeName: 'S' }), null);
  assert.equal(upiSettingsProblem({ mode: 'razorpay', upiId: '', payeeName: '' }), null);
  assert.equal(cleanUtr(' 4123 5678 9012 '), '412356789012');
  assert.ok(UTR_PATTERN.test('412356789012'));
});

test('the QR link carries the exact amount and no "+" for spaces', () => {
  const link = upiPayLink({ upiId: 'shop@okaxis', payeeName: 'Iconoiq Store', amount: 1299, note: 'Order IQ-1' });
  assert.ok(link.startsWith('upi://pay?pa=shop%40okaxis&pn=Iconoiq%20Store&am=1299.00&cu=INR&tn=Order%20IQ-1'), link);
});

test('a customer sends a UTR and their own screenshot', async () => {
  const db = new FakeFirestore();
  seed(db);
  const r = await claimUpiPayment(asDb(db), 'u1', ID, '4123 5678 9012', SHOT);
  assert.equal(r.status, 200);
  const p = db.read(`manualPayments/${ID}`)!;
  assert.equal(p.status, 'submitted');
  assert.equal(p.utr, '412356789012');
  assert.equal(p.screenshotUrl, SHOT);
});

test('a claim is refused for a bad UTR, another folder, another customer or a checked payment', async () => {
  const db = new FakeFirestore();
  seed(db);
  assert.equal((await claimUpiPayment(asDb(db), 'u1', ID, '12', SHOT)).status, 400);
  assert.equal((await claimUpiPayment(asDb(db), 'u1', ID, '412356789012', 'https://media.example.com/payments/u2/x.webp')).status, 400);
  assert.equal((await claimUpiPayment(asDb(db), 'u1', ID, '412356789012', 'https://evil.example/payments/u1/x.webp')).status, 400);
  assert.equal((await claimUpiPayment(asDb(db), 'u2', ID, '412356789012', 'https://media.example.com/payments/u2/x.webp')).status, 404);
  const done = new FakeFirestore();
  seed(done, { status: 'approved' });
  assert.equal((await claimUpiPayment(asDb(done), 'u1', ID, '412356789012', SHOT)).status, 409);
});

test('a UTR already used for another payment is flagged for the admin', async () => {
  const db = new FakeFirestore();
  seed(db);
  db.docs.set('manualPayments/upi_other', { uid: 'u9', utr: '412356789012', status: 'approved' });
  const r = await claimUpiPayment(asDb(db), 'u1', ID, '412356789012', SHOT);
  assert.equal(r.body.duplicateUtr, true);
  assert.deepEqual(db.read(`manualPayments/${ID}`)!.duplicateUtrOf, ['upi_other']);
});

test('approval writes the payment record and marks the order paid, once', async () => {
  const db = new FakeFirestore();
  seed(db, { status: 'submitted', utr: '412356789012' });
  const r = await reviewUpiPayment(asDb(db), 'admin1', ID, 'approve', '');
  assert.equal(r.status, 200);
  const pay = db.read(`payments/${ID}`)!;
  assert.equal(pay.uid, 'u1');
  assert.equal(pay.amountPaise, 129900);
  assert.equal(pay.status, 'verified');
  assert.equal(pay.method, 'upi');
  assert.equal(pay.points, 0);
  const order = db.read(`orders/${ID}`)!;
  assert.equal(order.paymentStatus, 'paid');
  assert.equal(order.upiReview.status, 'approved');
  assert.equal((await reviewUpiPayment(asDb(db), 'admin1', ID, 'reject', '')).status, 409);
});

test('rejection marks the order not paid and writes no payment record', async () => {
  const db = new FakeFirestore();
  seed(db, { status: 'submitted', utr: '412356789012' });
  const r = await reviewUpiPayment(asDb(db), 'admin1', ID, 'reject', 'No payment with this UTR');
  assert.equal(r.status, 200);
  assert.equal(db.read(`payments/${ID}`), undefined);
  assert.equal(db.read(`orders/${ID}`)!.paymentStatus, 'failed');
  assert.equal(db.read(`orders/${ID}`)!.upiReview.reason, 'No payment with this UTR');
});

test('an order saved under another customer is never approved', async () => {
  const db = new FakeFirestore();
  seed(db, { status: 'submitted' });
  db.docs.set(`orders/${ID}`, { userId: 'u2', paymentStatus: 'pending' });
  assert.equal((await reviewUpiPayment(asDb(db), 'admin1', ID, 'approve', '')).status, 409);
  assert.equal(db.read(`payments/${ID}`), undefined);
});
