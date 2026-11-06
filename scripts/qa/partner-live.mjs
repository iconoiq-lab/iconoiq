// Live Academy partner run (Next step 2) against the project in .firebaserc.
// Real: the deployed security rules (browser + REST), the storefront and admin screens in Chromium,
// and the real api/create-order.ts, api/verify-payment.ts and api/notify-order.ts handlers (run in
// this process; the browser's /api/notify-order calls are routed to them). Faked: the Razorpay API.
//
// Roles: the test shopper (scripts/qa/shopper.local) applies as the partner; the temporary test
// admin (scripts/qa/admin.local) switches both programmes on, approves the partner, and is also the
// customer who orders with the partner's code. Then the partner orders with their own code (family).
// Also: Admin > Categories moves one category down and back, and the home strip follows.
//
// It WRITES to the live Firestore: run it only with the owner's OK. Everything it creates is deleted
// and the category order is put back. The two programme switches (siteSettings/dealer.enabled and
// partnerSettings/main.enabled) are restored too, unless --leave-on (Next step 2 turns them on).
// node scripts/qa/partner-live.mjs [BASE] [OUT] [--leave-on]   (dev server on BASE)
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

const args = process.argv.slice(2);
const LEAVE_ON = args.includes('--leave-on');
const [BASE = 'http://127.0.0.1:5182', OUT = '.shots/partner-live'] = args.filter((a) => !a.startsWith('--'));
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
    const id = `order_ptnlive${Date.now()}${n++}`;
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

// ── Accounts (credentials loaded, never printed) ─────────────────────────────
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
const partnerUser = await signIn('scripts/qa/shopper.local');
const adminUser = await signIn('scripts/qa/admin.local');
const PUID = partnerUser.uid;
const FS = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;
const enc = (v) => {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  return { booleanValue: Boolean(v) };
};
const restPatch = async (who, path, data) => {
  const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const body = { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)])) };
  return (await realFetch(`${FS}/${path}?${mask}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${who.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })).status;
};

// ── Snapshots ────────────────────────────────────────────────────────────────
const dealerSwitchRef = db.collection('siteSettings').doc('dealer');
const partnerSettingsRef = db.collection('partnerSettings').doc('main');
const dealerSwitchBefore = await dealerSwitchRef.get();
const partnerSettingsBefore = await partnerSettingsRef.get();
assert.equal((await db.collection('partners').doc(PUID).get()).exists, false, 'the test shopper must not be a partner yet');
const categoriesBefore = (await db.collection('categories').get()).docs.map((d) => ({ id: d.id, order: d.data().order }));
const ledgerIds = async (uid) => (await db.collection('users').doc(uid).collection('rewardLedger').get()).docs.map((d) => d.id).sort();
const ledgerBefore = { [PUID]: await ledgerIds(PUID), [adminUser.uid]: await ledgerIds(adminUser.uid) };

const prod = (await db.collection('products').where('flags.isActive', '==', true).limit(60).get())
  .docs.find((d) => {
    const x = d.data();
    const price = Number(x.price);
    return price >= 300 && price <= 1500 && Number(x.inventory?.stock) >= 3 && !x.silverPricing?.enabled;
  });
assert.ok(prod, 'need an active in-stock product priced Rs 300-1500');
const p = prod.data();
const price = Number(p.price);
const QTY = 2; // stays under the Rs 3,500 coin card minimum
const image = p.images?.[0]?.url || p.images?.[0] || p.image || '';
const addr = { fullName: 'Preview Shopper', mobile: '9000000000', pincode: '500001', address: '1 Demo Street',
  city: 'Hyderabad', state: 'Telangana', addressType: 'home' };
// A customer who shares nothing with the partner (the self-referral check compares phone, email, name and saved addresses).
const custAddr = { ...addr, fullName: 'Live Check Customer', mobile: '9000007777', address: '7 Check Road', pincode: '500002' };

const created = new Set();
let partnerCode = null;
const step = (msg) => console.log(`  ok  ${msg}`);
const read = async (ref) => (await ref.get()).data();
const earningRef = (rzp) => db.collection('partners').doc(PUID).collection('earnings').doc(rzp);
const privRef = db.collection('partnerPrivate').doc(PUID);
const reconcile = async (rzp, who) => {
  const r = await call(notifyOrder, { action: 'reconcile-rewards', orderId: rzp }, who.token);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json;
};

/** A paid checkout through the real create-order and verify-payment, then the order the storefront writes. */
async function paidOrder(tag, who, couponCode, ship = addr) {
  const r = await call(createOrder, { items: [{ productId: prod.id, quantity: QTY }], shippingState: 'Telangana',
    ...(couponCode ? { couponCode } : {}) }, who.token);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const rzp = r.json.order_id;
  created.add(rzp);
  const o = rzpOrders.get(rzp);
  Object.assign(o, { status: 'paid', amount_paid: o.amount, payments: [{ id: `pay_${rzp}`, status: 'captured' }] });
  const sig = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${rzp}|pay_${rzp}`).digest('hex');
  const v = await call(verifyPayment, { razorpay_order_id: rzp, razorpay_payment_id: `pay_${rzp}`, razorpay_signature: sig });
  assert.equal(v.status, 200, JSON.stringify(v.json));
  const total = r.json.amount / 100;
  const subtotal = price * QTY;
  await db.collection('orders').doc(rzp).set({
    demo: true, userId: who.uid, userEmail: who.email, userName: 'Preview Shopper', orderId: `PT-${tag}-${rzp.slice(-4)}`,
    items: [{ productId: prod.id, name: p.name, image: typeof image === 'string' ? image : '', price, quantity: QTY }],
    subtotal, discount: Math.max(0, subtotal - total), deliveryCharge: 0, taxAmount: 0, total,
    paymentMethod: 'Razorpay', paymentStatus: 'paid', razorpayOrderId: rzp, razorpayPaymentId: `pay_${rzp}`,
    shippingAddress: ship, status: 'pending', createdAt: T.now(), updatedAt: T.now(),
    statusHistory: [{ status: 'pending', timestamp: T.now(), note: 'Live check' }],
  });
  return { rzp, total, subtotal };
}
const deliver = async (rzp) => db.collection('orders').doc(rzp).update({
  status: 'delivered', deliveredAt: T.now(), updatedAt: T.now(),
  statusHistory: admin.firestore.FieldValue.arrayUnion({ status: 'delivered', timestamp: T.now(), note: 'Live check' }),
});

let browser;
const errors = [];
try {
  console.log(`product Rs ${price} x ${QTY} = Rs ${price * QTY}; switches before: dealer ${dealerSwitchBefore.data()?.enabled ?? 'unset'}, partner ${partnerSettingsBefore.data()?.enabled ?? 'unset'}`);
  browser = await chromium.launch();
  const ctxFor = async (w, h, theme, who, loginPath = '/login') => {
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
    if (who) {
      await page.goto(`${BASE}${loginPath}`, { waitUntil: 'load' });
      await page.locator('input[type="email"]').first().fill(who.email);
      await page.locator('input[type="password"]').first().fill(who.password);
      await page.locator('button[type="submit"]').first().click();
      await page.waitForURL((u) => u.pathname !== loginPath, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }
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

  // 1. Admin switches both programmes on, the way the owner would.
  {
    const { ctx, page } = await ctxFor(1440, 900, 'light', adminUser, '/admin');
    await page.goto(`${BASE}/admin/commerce-settings?tab=dealers`, { waitUntil: 'load' });
    await settle(page);
    const dl = page.locator('#dl-on');
    await dl.waitFor({ timeout: 20000 });
    if ((await dl.getAttribute('aria-checked')) !== 'true') await dl.click();
    await page.getByRole('button', { name: 'Save dealer settings' }).click();
    for (let i = 0; i < 30 && !(await read(dealerSwitchRef))?.enabled; i++) await page.waitForTimeout(300);
    assert.equal((await read(dealerSwitchRef))?.enabled, true, 'dealer switch saved on');
    await shot(page, 'admin-dealer-switch-1440-light');

    await page.goto(`${BASE}/admin/partners`, { waitUntil: 'load' });
    await settle(page);
    await page.getByRole('tab', { name: /Settings/ }).click();
    const ps = page.locator('#ps-enabled');
    await ps.waitFor({ timeout: 20000 });
    if ((await ps.getAttribute('aria-checked')) !== 'true') await ps.click();
    await page.getByRole('button', { name: 'Save settings' }).click();
    for (let i = 0; i < 30 && !(await read(partnerSettingsRef))?.enabled; i++) await page.waitForTimeout(300);
    const ps1 = await read(partnerSettingsRef);
    assert.equal(ps1?.enabled, true, 'partner programme saved on');
    await shot(page, 'admin-partner-settings-1440-light');
    console.log(`      partner settings: silver ${ps1.silverPercent}%, customer discount ${ps1.customerDiscountPercent}%, hold ${ps1.holdDays} days`);
    await ctx.close();
  }
  step('Admin: "Dealer programme" and "Partner programme" switched on and saved');
  const ps = await read(partnerSettingsRef);

  // 2. The test shopper applies as a partner on /dealer.
  {
    const { ctx, page } = await ctxFor(390, 844, 'light', partnerUser);
    await page.goto(`${BASE}/dealer?track=partner`, { waitUntil: 'load' });
    await settle(page);
    await page.locator('#partner-name').waitFor({ timeout: 20000 });
    await shot(page, 'apply-390-light');
    await page.locator('#partner-name').fill('Preview Tester');
    await page.locator('#partner-business').fill('Preview Test Academy');
    await page.locator('#partner-phone').fill('9000003210');
    await page.locator('#partner-city').fill('Hyderabad');
    await page.locator('#partner-state').click();
    await page.getByRole('option', { name: 'Telangana', exact: true }).click();
    await page.getByRole('button', { name: 'Send application' }).click();
    await page.getByText("We're reviewing your application").waitFor({ timeout: 20000 });
    await page.waitForTimeout(800);
    await shot(page, 'applied-pending-390-light');
    await ctx.close();
  }
  // The page shows "reviewing" from the local write; wait for the server copy (a 2026-11-06 run read it too early).
  let applied;
  for (let i = 0; i < 20 && applied?.status !== 'pending'; i++) {
    applied = await read(db.collection('partners').doc(PUID));
    if (applied?.status !== 'pending') await new Promise((r) => setTimeout(r, 500));
  }
  assert.equal(applied?.status, 'pending', 'application saved as pending');
  assert.equal(await restPatch(partnerUser, `partners/${PUID}`, { status: 'approved' }), 403, 'applicant cannot approve themselves');
  assert.equal(await restPatch(partnerUser, `partners/${PUID}`, { earnedTotal: 99999 }), 403, 'applicant cannot write totals');
  step('partner applied on /dealer (pending); rules: cannot self-approve or write totals (403)');

  // 3. Admin approves it in Admin > Partners with the suggested code.
  {
    const { ctx, page } = await ctxFor(1440, 900, 'dark', adminUser, '/admin');
    await page.goto(`${BASE}/admin/partners`, { waitUntil: 'load' });
    await settle(page);
    const card = page.locator('li', { hasText: 'Preview Test Academy' });
    await card.waitFor({ timeout: 20000 });
    const codeBox = card.getByLabel('Partner code');
    partnerCode = await codeBox.inputValue();
    assert.match(partnerCode, /^PREV3210/, `suggested code ${partnerCode}`);
    await shot(page, 'admin-application-1440-dark');
    await card.getByRole('button', { name: 'Approve' }).click();
    for (let i = 0; i < 30 && (await read(db.collection('partners').doc(PUID)))?.status !== 'approved'; i++) await page.waitForTimeout(300);
    await page.getByRole('tab', { name: /^Partners/ }).click();
    await page.getByRole('button', { name: 'Manage Preview Tester' }).waitFor({ timeout: 20000 });
    await shot(page, 'admin-partner-list-1440-dark');
    await ctx.close();
  }
  const approved = await read(db.collection('partners').doc(PUID));
  assert.deepEqual([approved.status, approved.code, approved.tier], ['approved', partnerCode, 'silver']);
  assert.equal((await read(db.collection('partnerCodes').doc(partnerCode)))?.uid, PUID, 'partnerCodes link');
  step(`approved in Admin > Partners: code ${partnerCode}, Silver`);

  // 4. A customer (the test admin account) orders with the code: commission credited only on delivery.
  const C = await paidOrder('CUST', adminUser, partnerCode, custAddr);
  const expectDiscount = Math.floor((C.subtotal * (ps.customerDiscountPercent || 0)) / 100);
  assert.equal(C.subtotal - C.total, expectDiscount, `customer discount ${ps.customerDiscountPercent}% (paid Rs ${C.total} of Rs ${C.subtotal})`);
  const cPay = await read(db.collection('payments').doc(C.rzp));
  assert.deepEqual([cPay.partnerUid, cPay.partnerCode, cPay.partnerFamily], [PUID, partnerCode, false], JSON.stringify(cPay));
  await reconcile(C.rzp, adminUser);
  assert.equal((await earningRef(C.rzp).get()).exists, false, 'no earning before delivery');
  await deliver(C.rzp);
  const rc = await reconcile(C.rzp, adminUser);
  assert.ok(rc.changed.includes(`partner:${C.rzp}`), JSON.stringify(rc));
  const e = await read(earningRef(C.rzp));
  const commission = Math.round(C.total * ps.silverPercent) / 100;
  assert.equal(e.amount, commission, `commission ${ps.silverPercent}% of Rs ${C.total}: ${JSON.stringify(e)}`);
  assert.equal(e.family, false);
  assert.ok(e.unlockAt.toMillis() > Date.now() + 24 * 3600_000, 'earning held until the return window ends');
  assert.equal(e.sales, undefined, 'the earning never shows the sales value');
  const again = await reconcile(C.rzp, adminUser);
  assert.ok(!again.changed.some((c) => c.startsWith(`partner:${C.rzp}`)), 'a second reconcile does not credit twice');
  step(`customer order Rs ${C.total} with ${partnerCode}: nothing before delivery; delivered -> Rs ${e.amount} held until ${e.unlockAt.toDate().toISOString().slice(0, 10)}; no double credit`);

  // 5. The partner orders with their own code: family discount, no commission.
  const F = await paidOrder('FAM', partnerUser, partnerCode);
  const famDiscount = Math.floor((F.subtotal * ps.silverPercent) / 100); // whole rupees, like a percent coupon
  assert.equal(F.subtotal - F.total, famDiscount, `family discount ${ps.silverPercent}% (paid Rs ${F.total} of Rs ${F.subtotal})`);
  await deliver(F.rzp);
  await reconcile(F.rzp, partnerUser);
  const fe = await read(earningRef(F.rzp));
  assert.deepEqual([fe.family, fe.amount, fe.savings], [true, 0, famDiscount], JSON.stringify(fe));
  const pr = await read(db.collection('partners').doc(PUID));
  assert.equal(pr.earnedTotal, commission, `earnedTotal ${pr.earnedTotal}`);
  assert.equal(pr.familySavings, famDiscount, `familySavings ${pr.familySavings}`);
  assert.equal(pr.unitsSold, QTY, `unitsSold counts the customer order only (${pr.unitsSold})`);
  assert.equal(pr.lifetimeSales, undefined, 'no sales value on the partner document');
  step(`own-code order: ${ps.silverPercent}% off (Rs ${famDiscount}), no commission; totals: earned Rs ${pr.earnedTotal}, units ${pr.unitsSold}, savings Rs ${pr.familySavings}`);

  // 5b. Self-referral (2026-11-06): another account orders with the code but ships to the partner.
  //     The partner's phone = their own order (no commission); only their name = held for the admin's check.
  const S = await paidOrder('SELF', adminUser, partnerCode, { ...custAddr, mobile: '+91 90000 03210' });
  await deliver(S.rzp);
  await reconcile(S.rzp, adminUser);
  const se = await read(earningRef(S.rzp));
  assert.deepEqual([se.family, se.amount, se.review], [true, 0, undefined], JSON.stringify(se));
  assert.equal((await read(privRef.collection('orders').doc(S.rzp)))?.selfOrder, 'phone');
  const N = await paidOrder('NAME', adminUser, partnerCode, { ...custAddr, fullName: 'preview  tester' });
  await deliver(N.rzp);
  await reconcile(N.rzp, adminUser);
  const ne = await read(earningRef(N.rzp));
  const nCommission = Math.round(N.total * ps.silverPercent) / 100;
  assert.deepEqual([ne.family, ne.amount, ne.review], [false, nCommission, 'pending'], JSON.stringify(ne));
  assert.equal((await read(privRef.collection('orders').doc(N.rzp)))?.reviewReason, 'name');
  assert.equal((await read(privRef))?.reviewPending, 1, 'admin list count');
  const pr2 = await read(db.collection('partners').doc(PUID));
  assert.equal(pr2.unitsSold, QTY * 2, `the own order adds no units; the held one does (${pr2.unitsSold})`);
  {
    for (const [w, h, theme] of [[390, 844, 'light'], [1440, 900, 'light'], [390, 844, 'dark'], [1440, 900, 'dark']]) {
      const { ctx, page } = await ctxFor(w, h, theme, adminUser, '/admin');
      await page.goto(`${BASE}/admin/partners`, { waitUntil: 'load' });
      await settle(page);
      await page.getByRole('tab', { name: /^Partners/ }).click();
      await page.getByText('1 order to check').first().waitFor({ timeout: 20000 });
      if (w === 1440 && theme === 'light') await shot(page, 'admin-partner-list-check-1440-light');
      await page.getByRole('button', { name: 'Manage Preview Tester' }).click();
      const box = page.getByText('Check before paying').first();
      await box.waitFor({ timeout: 20000 });
      await box.scrollIntoViewIfNeeded();
      await page.getByText("The delivery name is the partner's own name.").first().waitFor({ timeout: 20000 });
      await shot(page, `admin-check-${w}-${theme}`, false);
      if (w === 1440 && theme === 'dark') {
        await page.getByRole('button', { name: 'Pay it' }).first().click();
        for (let i = 0; i < 30 && (await read(earningRef(N.rzp)))?.review !== 'cleared'; i++) await page.waitForTimeout(300);
        await page.getByText('Check before paying').first().waitFor({ state: 'detached', timeout: 20000 });
        await shot(page, 'admin-check-cleared-1440-dark', false);
      }
      await ctx.close();
    }
  }
  const ne2 = await read(earningRef(N.rzp));
  assert.deepEqual([ne2.review, ne2.amount], ['cleared', nCommission], JSON.stringify(ne2));
  assert.equal((await read(privRef))?.reviewPending, 0);
  assert.equal((await read(privRef.collection('orders').doc(N.rzp)))?.reviewDecision, 'pay');
  step(`self-referral: partner's phone on another account's order -> own order, Rs 0; partner's name -> held, "Check before paying" in Admin > Partners, "Pay it" releases Rs ${nCommission}; 4 sizes/themes`);

  // 6. Partner area: the earning shows, still waiting on the return window ("Total to be settled" Rs 0).
  for (const [w, h, theme] of [[390, 844, 'light'], [1440, 900, 'dark'], [390, 844, 'dark'], [1440, 900, 'light']]) {
    const { ctx, page } = await ctxFor(w, h, theme, partnerUser);
    await page.goto(`${BASE}/account/partner`, { waitUntil: 'load' });
    await settle(page);
    await page.getByText(partnerCode).first().waitFor({ timeout: 20000 });
    await page.getByText('more unlocks once the return window ends').first().waitFor({ timeout: 20000 });
    const text = await page.locator('main').innerText();
    assert.ok(!text.includes(String(C.total)) || String(C.total) === String(commission), 'the partner page never shows the sales value');
    await shot(page, `partner-area-${w}-${theme}`);
    await ctx.close();
  }
  step('partner area: code, earning shown as waiting for the return window, no sales value; 4 sizes/themes');

  // 7. Admin > Categories: move the first category down and back; the home strip follows.
  {
    const strip = async (page) => {
      await page.goto(`${BASE}/`, { waitUntil: 'load' });
      await settle(page);
      const hrefs = await page.locator('nav[aria-label="Categories"] a[href^="/category/"]').evaluateAll(
        (as) => as.filter((a) => a.offsetParent !== null).map((a) => a.getAttribute('href')).filter((h) => !h.includes('?')));
      return [...new Set(hrefs)].map((h) => h.replace('/category/', ''));
    };
    const { ctx, page } = await ctxFor(1440, 900, 'light', adminUser, '/admin');
    const before = await strip(page);
    await page.goto(`${BASE}/admin/categories`, { waitUntil: 'load' });
    await settle(page);
    const firstDown = page.locator('[data-move="down"]').first();
    await firstDown.waitFor({ timeout: 20000 });
    const slug = await firstDown.getAttribute('data-slug');
    const name = (await firstDown.getAttribute('aria-label')).replace(/^Move | down$/g, '');
    await firstDown.click();
    await page.waitForTimeout(2500);
    await shot(page, 'admin-categories-moved-1440-light');
    const moved = await strip(page);
    const i0 = before.indexOf(slug);
    const i1 = moved.indexOf(slug);
    assert.ok(i0 >= 0 && i1 === i0 + 1, `strip: ${slug} ${i0} -> ${i1} (${before.join(',')} / ${moved.join(',')})`);
    await shot(page, 'home-strip-moved-1440-light', false);
    await page.goto(`${BASE}/admin/categories`, { waitUntil: 'load' });
    await settle(page);
    await page.getByRole('button', { name: `Move ${name} up` }).click();
    await page.waitForTimeout(2500);
    const back = await strip(page);
    assert.deepEqual(back, before, `strip back to ${before.join(',')}: ${back.join(',')}`);
    await ctx.close();
    step(`Admin > Categories: "${name}" down -> strip shows it one place later; up -> strip back to the start`);
  }

  const real = errors.filter((x) => !/favicon|DevTools|Download the React/.test(x));
  console.log(real.length ? `console errors:\n${real.join('\n')}` : '  ok  0 console errors');
  console.log('partner live run: PASS');
} finally {
  if (browser) await browser.close();
  // Orders, payments and what reconcile wrote for both accounts.
  let removed = 0;
  for (const uid of [PUID, adminUser.uid]) {
    const user = db.collection('users').doc(uid);
    for (const col of ['rewardLedger', 'scratchCards']) {
      for (const d of (await user.collection(col).get()).docs) {
        if ([...created].some((id) => d.id.includes(id))) { await d.ref.delete(); removed++; }
      }
    }
    await user.collection('rewardState').doc('lock').delete();
  }
  for (const id of created) {
    await db.collection('orders').doc(id).delete();
    await db.collection('payments').doc(id).delete();
  }
  // The partner record, its subcollections, the private figures and the code link.
  const pRef = db.collection('partners').doc(PUID);
  await db.recursiveDelete(pRef);
  await db.recursiveDelete(privRef);
  for (const d of (await db.collection('partnerCodes').where('uid', '==', PUID).get()).docs) await d.ref.delete();
  // Category order back exactly.
  for (const c of categoriesBefore) {
    const ref = db.collection('categories').doc(c.id);
    const now = (await ref.get()).data()?.order;
    if (now !== c.order) await ref.update({ order: c.order === undefined ? admin.firestore.FieldValue.delete() : c.order });
  }
  if (!LEAVE_ON) {
    for (const [ref, snap] of [[dealerSwitchRef, dealerSwitchBefore], [partnerSettingsRef, partnerSettingsBefore]]) {
      if (snap.exists) await ref.set(snap.data()); else await ref.delete();
    }
  }
  const ledgerOk = JSON.stringify(await ledgerIds(PUID)) === JSON.stringify(ledgerBefore[PUID])
    && JSON.stringify(await ledgerIds(adminUser.uid)) === JSON.stringify(ledgerBefore[adminUser.uid]);
  const catsOk = (await db.collection('categories').get()).docs.every((d) => categoriesBefore.find((c) => c.id === d.id)?.order === d.data().order);
  console.log(`cleaned up ${created.size} orders and payments, ${removed} ledger/scratch rows, the partner record and code; ledgers back: ${ledgerOk}; category order back: ${catsOk}`);
  console.log(LEAVE_ON ? 'switches left ON (--leave-on): dealer programme + partner programme' : 'switches restored to their start');
}
process.exit(0);
