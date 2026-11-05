// Live Lakshmi coin run against the project in .firebaserc with the test shopper.
// Real: create-order / verify-payment / notify-order code, Firestore, the deployed
// security rules (over REST as the shopper) and the storefront + admin in a browser
// (the dev server has no /api/notify-order, so the browser's calls go to the real
// handler in this process). Faked: the Razorpay API.
// Turns the coin on, then puts siteSettings/coinGift back exactly as it was and
// deletes everything it created (orders, payments, ledger rows, the test coupon).
// It writes to the live Firestore: run it only with the owner's OK.
// node scripts/qa/coin-gift-live.mjs [BASE] [OUT]   (dev server on BASE)
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { FIREBASE_PROJECT, THEME_KEY } from '../lib/brand.mjs';

const require = createRequire(`${process.cwd()}/package.json`);
require('dotenv').config({ quiet: true });
const admin = require('firebase-admin');
const { chromium } = createRequire('C:/Users/chala/AppData/Roaming/npm/node_modules/playwright/package.json')('playwright');
const sa = JSON.parse(Buffer.from(process.env.FIREBASE_ADMIN_SDK_BASE64, 'base64').toString('utf8'));
if (sa.project_id !== FIREBASE_PROJECT) throw new Error(`refusing: ${sa.project_id} (.firebaserc says ${FIREBASE_PROJECT})`);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const T = admin.firestore.Timestamp;

const BASE = process.argv[2] || 'http://127.0.0.1:5182';
const OUT = process.argv[3] || '.shots/coin-gift';
mkdirSync(OUT, { recursive: true });

process.env.RAZORPAY_KEY_ID = 'rzp_test_localcheck';
process.env.RAZORPAY_KEY_SECRET = 'local-check-secret';
process.env.FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;
process.env.FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY;

// ── Fake Razorpay ────────────────────────────────────────────────────────────
const rzpOrders = new Map();
const realFetch = globalThis.fetch;
let n = 0;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const m = u.match(/^https:\/\/api\.razorpay\.com\/v1\/orders(?:\/([^/?]+))?(\/payments)?/);
  if (!m) return realFetch(url, init);
  if ((init.method || 'GET') === 'POST') {
    const body = JSON.parse(init.body);
    const id = `order_coinlive${Date.now()}${n++}`;
    rzpOrders.set(id, { id, status: 'created', amount_paid: 0, payments: [], ...body });
    return new Response(JSON.stringify({ id, amount: body.amount, currency: body.currency }), { status: 200 });
  }
  const o = rzpOrders.get(decodeURIComponent(m[1] || ''));
  if (!o) return new Response('{}', { status: 404 });
  if (m[2]) return new Response(JSON.stringify({ items: o.payments }), { status: 200 });
  const { payments, ...order } = o;
  return new Response(JSON.stringify(order), { status: 200 });
};

// ── Code under test ──────────────────────────────────────────────────────────
const base = pathToFileURL(`${process.cwd()}/`);
const createOrder = (await import(new URL('api/create-order.ts', base).href)).default;
const verifyPayment = (await import(new URL('api/verify-payment.ts', base).href)).default;
const notifyOrder = (await import(new URL('api/notify-order.ts', base).href)).default;

const call = async (handler, body, token, method = 'POST') => {
  let status = 0;
  let json;
  const res = {
    setHeader() {},
    status(c) { status = c; return this; },
    json(j) { json = j; return this; },
    end() { return this; },
  };
  await handler({ method, body, headers: token ? { authorization: `Bearer ${token}` } : {} }, res);
  return { status, json };
};

// ── Test shopper over REST (the deployed security rules apply) ───────────────
const KEY = process.env.VITE_FIREBASE_API_KEY;
const P = process.env.VITE_FIREBASE_PROJECT_ID;
const signIn = async (file) => {
  const c = JSON.parse(readFileSync(file, 'utf8'));
  const r = await (await realFetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: c.email, password: c.password, returnSecureToken: true }),
  })).json();
  if (!r.idToken) throw new Error(`sign-in failed: ${file}`);
  return { ...c, token: r.idToken, uid: r.localId };
};
const shopper = await signIn('scripts/qa/shopper.local');
const adminUser = await signIn('scripts/qa/admin.local');
const uid = shopper.uid;
const H = { Authorization: `Bearer ${shopper.token}`, 'Content-Type': 'application/json' };
const FS = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;
const enc = (v) => {
  if (v === null) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
};
const restPatch = async (path, data) => {
  const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const body = { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)])) };
  return (await realFetch(`${FS}/${path}?${mask}`, { method: 'PATCH', headers: H, body: JSON.stringify(body) })).status;
};

// ── Fixtures ─────────────────────────────────────────────────────────────────
const settingsRef = db.collection('siteSettings').doc('coinGift');
const originalSettings = await settingsRef.get();
const ledger = db.collection('users').doc(uid).collection('rewardLedger');
const ledgerBefore = (await ledger.get()).docs.map((d) => d.id).sort();
const shopperCoinsBefore = (await db.collection('payments').where('uid', '==', uid).get())
  .docs.filter((d) => d.data().coinGift).length;
assert.equal(shopperCoinsBefore, 0, 'the test shopper must start with no coins');

const MIN = 3500;
const prod = (await db.collection('products').where('flags.isActive', '==', true).limit(40).get())
  .docs.find((d) => {
    const x = d.data();
    const price = Number(x.price);
    return price >= 300 && price < MIN && Number(x.inventory?.stock) >= Math.ceil(MIN / price) + 1 && !x.silverPricing?.enabled;
  });
assert.ok(prod, 'need an active in-stock product priced Rs 300-3499');
const p = prod.data();
const price = Number(p.price);
const qtyAt = Math.ceil(MIN / price); // goods >= 3500
const qtyBelow = Math.floor((MIN - 1) / price); // goods < 3500
const image = p.images?.[0]?.url || p.images?.[0] || p.image || '';
const addr = { fullName: 'Preview Shopper', mobile: '9000000000', pincode: '500001', address: '1 Demo Street',
  city: 'Hyderabad', state: 'Telangana', addressType: 'home' };

const created = new Set();
const couponRef = db.collection('coupons').doc(`coinlive-${Date.now()}`);
const COUPON = `COINLIVE${Date.now() % 100000}`;
const step = (msg) => console.log(`  ok  ${msg}`);
const read = async (ref) => (await ref.get()).data();
const payOf = (rzp) => read(db.collection('payments').doc(rzp));
const orderOf = (rzp) => read(db.collection('orders').doc(rzp));
const reconcile = async (rzp) => {
  const r = await call(notifyOrder, { action: 'reconcile-rewards', orderId: rzp }, shopper.token);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json;
};

/** A paid checkout through the real create-order and verify-payment, then the order the storefront writes. */
async function paidOrder(tag, qty, couponCode) {
  const r = await call(createOrder, { items: [{ productId: prod.id, quantity: qty }], shippingState: 'Telangana',
    ...(couponCode ? { couponCode } : {}) }, shopper.token);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const rzp = r.json.order_id;
  created.add(rzp);
  const o = rzpOrders.get(rzp);
  Object.assign(o, { status: 'paid', amount_paid: o.amount, payments: [{ id: `pay_${rzp}`, status: 'captured' }] });
  const sig = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${rzp}|pay_${rzp}`).digest('hex');
  const v = await call(verifyPayment, { razorpay_order_id: rzp, razorpay_payment_id: `pay_${rzp}`, razorpay_signature: sig });
  assert.equal(v.status, 200, JSON.stringify(v.json));
  const total = r.json.amount / 100;
  const subtotal = price * qty;
  await db.collection('orders').doc(rzp).set({
    demo: true, userId: uid, userEmail: shopper.email, userName: 'Preview Shopper', orderId: `LC-${tag}-${rzp.slice(-4)}`,
    items: [{ productId: prod.id, name: p.name, image: typeof image === 'string' ? image : '', price, quantity: qty }],
    subtotal, discount: Math.max(0, subtotal - total), deliveryCharge: 0, taxAmount: 0, total,
    paymentMethod: 'Razorpay', paymentStatus: 'paid', razorpayOrderId: rzp, razorpayPaymentId: `pay_${rzp}`,
    shippingAddress: addr, status: 'pending', createdAt: T.now(), updatedAt: T.now(),
    statusHistory: [{ status: 'pending', timestamp: T.now(), note: 'Live check' }],
  });
  return { rzp, total, subtotal };
}

const coinOf = async (rzp) => (await payOf(rzp))?.coinGift || null;
const expectCoin = async (rzp, type, seq, label) => {
  const g = await coinOf(rzp);
  assert.ok(g, `${label}: a coin`);
  assert.deepEqual([g.type, g.seq, g.status], [type, seq, 'active'], `${label}: ${JSON.stringify(g)}`);
  const m = (await orderOf(rzp)).coinGift;
  assert.deepEqual([m?.type, m?.seq, m?.status], [type, seq, 'active'], `${label}: order mirror ${JSON.stringify(m)}`);
};

let browser;
try {
  console.log(`product Rs ${price}: ${qtyAt} = Rs ${price * qtyAt} (coin), ${qtyBelow} = Rs ${price * qtyBelow} (no coin)`);

  // 0. Switch off (or never set): no coin.
  if (originalSettings.exists) await settingsRef.set({ ...originalSettings.data(), enabled: false });
  const OFF = await paidOrder('OFF', qtyAt);
  await reconcile(OFF.rzp);
  assert.equal(await coinOf(OFF.rzp), null, 'no coin while the switch is off');
  // Paid an hour ago, so it stays "before the switch went on".
  await db.collection('payments').doc(OFF.rzp).update({ verifiedAt: T.fromMillis(Date.now() - 3_600_000) });
  step('switch off: a paid Rs 3,500+ order gets no coin');

  // 1. Switch on the way the admin tab saves it.
  await settingsRef.set({ enabled: true, minOrder: MIN, goldEvery: 4,
    enabledAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  await reconcile(OFF.rzp);
  assert.equal(await coinOf(OFF.rzp), null, 'an order paid before the switch went on gets no coin');
  step('switch on: the order paid before it still gets no coin');

  // 2. Below the minimum: none.
  if (qtyBelow >= 1) {
    const LOW = await paidOrder('LOW', qtyBelow);
    await reconcile(LOW.rzp);
    assert.equal(await coinOf(LOW.rzp), null, `Rs ${LOW.subtotal} gets no coin`);
    step(`Rs ${LOW.subtotal} (under Rs 3,500): no coin`);
  }

  // 3. A coupon that takes the paid amount under Rs 3,500 still qualifies (goods before coupon).
  await couponRef.set({ code: COUPON, active: true, type: 'percent', value: 20, maxDiscount: 0, minOrderValue: 0,
    maxUses: 0, usedCount: 0, description: 'Live coin check', createdAt: T.now() });
  const A1 = await paidOrder('A1', qtyAt, COUPON);
  assert.ok(A1.total < A1.subtotal, `the coupon applied (paid Rs ${A1.total} of Rs ${A1.subtotal})`);
  assert.equal((await payOf(A1.rzp)).subtotal, A1.subtotal, 'payment keeps the goods total before the coupon');
  const r1 = await reconcile(A1.rzp);
  assert.ok(r1.changed.some((c) => c.startsWith('coin:silver#1')), JSON.stringify(r1));
  await expectCoin(A1.rzp, 'silver', 1, 'coin order 1');
  const again = await reconcile(A1.rzp);
  assert.ok(!again.changed.some((c) => c.startsWith('coin')), 'a second reconcile changes nothing');
  step(`coupon order: goods Rs ${A1.subtotal}, paid Rs ${A1.total} -> silver #1; reconcile again changes nothing`);

  // 4. Orders 2-4: silver, silver, gold.
  const A2 = await paidOrder('A2', qtyAt); await reconcile(A2.rzp); await expectCoin(A2.rzp, 'silver', 2, 'coin order 2');
  const A3 = await paidOrder('A3', qtyAt); await reconcile(A3.rzp); await expectCoin(A3.rzp, 'silver', 3, 'coin order 3');
  const A4 = await paidOrder('A4', qtyAt); await reconcile(A4.rzp); await expectCoin(A4.rzp, 'gold', 4, 'coin order 4');
  step('coin orders 1-3 silver, 4th gold');

  // 5. Rules: the customer cannot give themselves a coin or change one.
  const forge = await restPatch(`orders/${A1.rzp}`, { coinGift: { type: 'gold', seq: 4, status: 'active' } });
  assert.equal(forge, 403, 'customer cannot write coinGift on their order');
  step('rules: the customer cannot write coinGift (403)');

  // 6. Reveal: own coin stamps revealedAt once; someone else's coin is 404.
  const rev = await call(notifyOrder, { action: 'coin-reveal', orderId: A1.rzp }, shopper.token);
  assert.equal(rev.status, 200, JSON.stringify(rev.json));
  const at = (await coinOf(A1.rzp)).revealedAt;
  assert.ok(at, 'payment stamped revealedAt');
  assert.ok((await orderOf(A1.rzp)).coinGift.revealedAt, 'order mirror stamped revealedAt');
  await call(notifyOrder, { action: 'coin-reveal', orderId: A1.rzp }, shopper.token);
  assert.equal((await coinOf(A1.rzp)).revealedAt.toMillis(), at.toMillis(), 'revealing again keeps the first time');
  const other = `order_coinlive_other${Date.now()}`;
  created.add(other);
  await db.collection('payments').doc(other).set({ uid: 'someone-else', coinGift: { type: 'gold', seq: 4, status: 'active' } });
  await db.collection('orders').doc(other).set({ demo: true, userId: 'someone-else', status: 'pending' });
  const steal = await call(notifyOrder, { action: 'coin-reveal', orderId: other }, shopper.token);
  assert.equal(steal.status, 404, 'another customer\'s coin is not found');
  step('reveal: stamps revealedAt once; another customer\'s coin -> 404');

  // 7. Cancel order 2: its coin is void; the next order is silver #1 (not a second gold); reopen restores it.
  await db.collection('orders').doc(A2.rzp).update({ status: 'cancelled', updatedAt: T.now() });
  const rc = await reconcile(A2.rzp);
  assert.ok(rc.changed.includes('coin:void'), JSON.stringify(rc));
  assert.equal((await coinOf(A2.rzp)).status, 'void');
  assert.equal((await orderOf(A2.rzp)).coinGift.status, 'void');
  const A5 = await paidOrder('A5', qtyAt); await reconcile(A5.rzp); await expectCoin(A5.rzp, 'silver', 1, 'after a cancelled order');
  await db.collection('orders').doc(A2.rzp).update({ status: 'pending', updatedAt: T.now() });
  const rr = await reconcile(A2.rzp);
  assert.ok(rr.changed.includes('coin:restore'), JSON.stringify(rr));
  await expectCoin(A2.rzp, 'silver', 2, 'restored');
  step('cancel -> coin void (stops counting), next order silver #1 not gold; reopen -> restored');

  // 8. Browser: the customer scratches the coin on the order page; admin sees the packing note.
  browser = await chromium.launch();
  const errors = [];
  const ctxFor = async (w, h, theme, who = shopper, loginPath = '/login') => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme });
    await ctx.addInitScript(([k, t]) => localStorage.setItem(k, t), [THEME_KEY, theme]);
    await ctx.route('**/api/notify-order', async (route) => {
      const req = route.request();
      if (req.method() !== 'POST') return route.fulfill({ status: 204, body: '' });
      const token = (req.headers().authorization || '').replace(/^Bearer /, '');
      const r = await call(notifyOrder, JSON.parse(req.postData() || '{}'), token);
      await route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.json ?? {}) });
    });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${w}-${theme}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${w}-${theme}: ${e.message}`));
    await page.goto(`${BASE}${loginPath}`, { waitUntil: 'load' });
    await page.locator('input[type="email"]').first().fill(who.email);
    await page.locator('input[type="password"]').first().fill(who.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => u.pathname !== loginPath, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    return { ctx, page };
  };
  const settle = async (page) => {
    await page.waitForFunction(() => document.body.innerText.length > 300 && !document.querySelector('[aria-busy="true"]'), null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
  };
  const shot = async (page, name, fullPage = true) => {
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(wide, false, `${name}: no sideways overflow`);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
    console.log('      shot', name);
  };
  /** Drag the mouse back and forth over the foil, like a finger. */
  const scratchFoil = async (page) => {
    const canvas = page.locator('[role="dialog"] canvas').first();
    await canvas.waitFor({ timeout: 10000 });
    const b = await canvas.boundingBox();
    // Press on the coin itself (the square's corners are outside the round foil), then rub across it.
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    for (let row = 1; row <= 9; row++) {
      const y = b.y + (b.height * row) / 10;
      await page.mouse.move(b.x + b.width * (row % 2 ? 0.92 : 0.08), y, { steps: 8 });
      await page.mouse.move(b.x + b.width * (row % 2 ? 0.08 : 0.92), y + b.height / 20, { steps: 8 });
    }
    await page.mouse.up();
  };

  for (const [w, h, theme, order, how] of [
    [390, 844, 'light', A3, 'scratch'],
    [1440, 900, 'dark', A4, 'button'],
  ]) {
    const { ctx, page } = await ctxFor(w, h, theme);
    await page.goto(`${BASE}/account/orders/${order.rzp}`, { waitUntil: 'load' });
    await settle(page);
    const open = page.getByRole('button', { name: 'Scratch to see your coin' });
    await open.waitFor({ timeout: 20000 });
    await shot(page, `order-${w}-${theme}-coin-note`);
    await open.click();
    await page.getByRole('button', { name: 'Reveal coin' }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(700);
    await shot(page, `dialog-${w}-${theme}-before`, false);
    if (how === 'scratch') await scratchFoil(page);
    else await page.getByRole('button', { name: 'Reveal coin' }).click();
    const lead = order === A4 ? 'A Gold Lakshmi coin!' : 'A Silver Lakshmi coin.';
    await page.getByText(lead).waitFor({ timeout: 15000 });
    await page.waitForTimeout(1200);
    await shot(page, `dialog-${w}-${theme}-revealed`, false);
    // The server got the reveal.
    for (let i = 0; i < 20 && !(await coinOf(order.rzp)).revealedAt; i++) await page.waitForTimeout(300);
    assert.ok((await coinOf(order.rzp)).revealedAt, `${w}-${theme}: reveal saved`);
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'View card' }).waitFor({ timeout: 10000 });
    await ctx.close();
  }
  step(`browser: scratched silver #3 with the mouse (390 light), revealed gold #4 by button (1440 dark); both saved; note shows "View card"`);

  // The other two combos, plus the cancelled-coin line.
  await db.collection('orders').doc(A5.rzp).update({ status: 'cancelled', updatedAt: T.now() });
  await reconcile(A5.rzp);
  for (const [w, h, theme] of [[390, 844, 'dark'], [1440, 900, 'light']]) {
    const { ctx, page } = await ctxFor(w, h, theme);
    await page.goto(`${BASE}/account/orders/${A2.rzp}`, { waitUntil: 'load' });
    await settle(page);
    await page.getByRole('button', { name: 'Scratch to see your coin' }).click();
    await page.getByRole('button', { name: 'Reveal coin' }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(700);
    await shot(page, `dialog-${w}-${theme}-before`, false);
    await page.keyboard.press('Escape');
    await page.goto(`${BASE}/account/orders/${A5.rzp}`, { waitUntil: 'load' });
    await settle(page);
    await page.getByText('The Lakshmi coin card was cancelled with this order.').waitFor({ timeout: 20000 });
    await shot(page, `order-${w}-${theme}-coin-cancelled`);
    await ctx.close();
  }
  step('dialog at the other two sizes/themes; a cancelled order shows the cancelled-card line');

  // Admin: the packing note on the order and the settings tab with its previews.
  for (const [w, h, theme] of [[1440, 900, 'light'], [390, 844, 'dark']]) {
    const { ctx, page } = await ctxFor(w, h, theme, adminUser, '/admin');
    await page.goto(`${BASE}/admin/orders/${A4.rzp}`, { waitUntil: 'load' });
    await settle(page);
    await page.getByText('Pack a Gold Lakshmi coin card').waitFor({ timeout: 20000 });
    await shot(page, `admin-order-${w}-${theme}`);
    await page.goto(`${BASE}/admin/orders/${A5.rzp}`, { waitUntil: 'load' });
    await settle(page);
    await page.getByText('Lakshmi coin card cancelled: do not pack it').waitFor({ timeout: 20000 });
    await page.goto(`${BASE}/admin/commerce-settings?tab=coin`, { waitUntil: 'load' });
    await settle(page);
    await page.getByRole('button', { name: 'Save Lakshmi coin' }).waitFor({ timeout: 20000 });
    await shot(page, `admin-settings-${w}-${theme}`);
    await page.getByRole('button', { name: 'Preview gold' }).click();
    await page.getByRole('button', { name: 'Reveal coin' }).click();
    await page.getByText('A Gold Lakshmi coin!').waitFor({ timeout: 10000 });
    await page.waitForTimeout(900);
    await shot(page, `admin-preview-gold-${w}-${theme}`, false);
    await ctx.close();
  }
  step('admin: "Pack a Gold Lakshmi coin card" and "do not pack" notes; settings tab and preview');

  const real = errors.filter((e) => !/favicon|DevTools|Download the React/.test(e));
  console.log(real.length ? `console errors:\n${real.join('\n')}` : '  ok  0 console errors');
  console.log('coin-gift live run: PASS');
} finally {
  if (browser) await browser.close();
  let removed = 0;
  for (const d of (await ledger.get()).docs) {
    if ([...created].some((id) => d.id.includes(id))) { await d.ref.delete(); removed++; }
  }
  for (const id of created) {
    await db.collection('orders').doc(id).delete();
    await db.collection('payments').doc(id).delete();
  }
  await db.collection('users').doc(uid).collection('rewardState').doc('lock').delete();
  await couponRef.delete();
  if (originalSettings.exists) await settingsRef.set(originalSettings.data());
  else await settingsRef.delete();
  const after = (await ledger.get()).docs.map((d) => d.id).sort();
  console.log(`cleaned up ${removed} ledger entries, ${created.size} orders and payments, the test coupon; coin settings ${originalSettings.exists ? 'restored' : 'deleted (were never set)'}`);
  console.log(`ledger back to its start: ${JSON.stringify(after) === JSON.stringify(ledgerBefore)}`);
}
process.exit(0);
