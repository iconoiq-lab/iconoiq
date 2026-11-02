import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import type { firestore } from 'firebase-admin';

/**
 * POST /api/verify-payment
 *
 * Verifies the signature Razorpay returns to the browser after a successful
 * payment. Razorpay signs `${order_id}|${payment_id}` with HMAC-SHA256 using
 * the key secret; we recompute it and compare in constant time. The order is
 * only considered paid when the recomputed HMAC matches.
 *
 * Self-contained (Node built-ins only, firebase-admin loaded lazily) so the
 * serverless function can't fail to load — mirrors the other functions in /api.
 *
 * Body:    { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Returns: { verified: true, paymentRecorded, ... } on match, 400 otherwise
 *          (never marks as paid).
 *
 * After a match the payment is RECORDED as payments/<razorpay order id>, from
 * the notes api/create-order.ts put on the Razorpay order (never from the
 * browser): the customer it is bound to, the amount, the cart hash and the
 * points/cashback it spent. firestore.rules only lets a customer create an
 * order marked paid at orders/<razorpay order id> when that record exists and
 * names them. The same transaction confirms the points/cashback reserved for
 * the payment (or spends them again if they had been released as abandoned).
 *
 * `paymentRecorded: false` means the bookkeeping did not finish in time; the
 * browser retries once, and the reconcile action in api/notify-order.ts
 * repairs it from Razorpay later. Bookkeeping never changes the verification
 * answer.
 */

const RAZORPAY_TIMEOUT_MS = 2500;
/** Upper bound on the bookkeeping, so a captured payment is never kept waiting long. */
const BOOKKEEPING_TIMEOUT_MS = 4500;

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function isValidSignature(orderId: string, paymentId: string, signature: string, keySecret: string): boolean {
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(String(signature), 'utf8');

  // timingSafeEqual throws if the buffers differ in length — guard first.
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

const whole = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
const money = (v: unknown) => Math.max(0, Number(v) || 0);

// Copied from src/lib/partner.ts (npm run sync:rewards); only partnerFieldsFromNote is used here.
// >>> partner-core
type PartnerTier = 'silver' | 'gold';

/** The money settings of partnerSettings/main (the server reads only these). */
interface PartnerMoneySettings {
  /** The programme's own runtime switch. Off: partner codes do nothing at checkout. */
  enabled: boolean;
  /** Commission for every approved partner, percent of the sales value. */
  silverPercent: number;
  /** Commission once lifetime delivered sales reach goldThreshold. */
  goldPercent: number;
  /** Rupees of lifetime delivered sales that switch a partner to Gold. */
  goldThreshold: number;
  /** Discount a customer gets with a partner's code (percent of the products). */
  customerDiscountPercent: number;
  /** Extra days earnings stay held after delivery (the return window always applies). */
  holdDays: number;
}

const DEFAULT_PARTNER_MONEY: PartnerMoneySettings = {
  enabled: false,
  silverPercent: 15,
  goldPercent: 30,
  goldThreshold: 200_000,
  customerDiscountPercent: 0,
  holdDays: 0,
};

function partnerNum(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

const partnerMoney = (n: number) => Math.round(n * 100) / 100;

function normalisePartnerMoney(raw: Partial<PartnerMoneySettings> | null | undefined): PartnerMoneySettings {
  const d = DEFAULT_PARTNER_MONEY;
  const pct = (v: unknown, f: number) => Math.round(partnerNum(v, f, 0, 90) * 100) / 100;
  return {
    enabled: raw?.enabled === true,
    silverPercent: pct(raw?.silverPercent, d.silverPercent),
    goldPercent: pct(raw?.goldPercent, d.goldPercent),
    goldThreshold: Math.round(partnerNum(raw?.goldThreshold, d.goldThreshold, 1, 1_000_000_000)),
    customerDiscountPercent: pct(raw?.customerDiscountPercent, d.customerDiscountPercent),
    holdDays: Math.round(partnerNum(raw?.holdDays, d.holdDays, 0, 90)),
  };
}

/**
 * The partner's tier. An admin override wins; otherwise Gold once lifetime
 * delivered sales reach the threshold, Silver before.
 */
function partnerTierFor(lifetimeSales: number, s: PartnerMoneySettings, override?: unknown): PartnerTier {
  if (override === 'gold' || override === 'silver') return override;
  return (Number(lifetimeSales) || 0) >= s.goldThreshold ? 'gold' : 'silver';
}

function partnerRate(tier: PartnerTier, s: PartnerMoneySettings): number {
  return tier === 'gold' ? s.goldPercent : s.silverPercent;
}

/** Commission on one order's sales value, in rupees and paise. */
function partnerCommission(sales: number, ratePercent: number): number {
  const v = Number(sales) || 0;
  const r = Number(ratePercent) || 0;
  return v > 0 && r > 0 ? partnerMoney((v * r) / 100) : 0;
}

/**
 * The checkout discount a partner code gives: the partner's own tier percent
 * when they use their own code (family discount, no commission), otherwise
 * the customer discount setting.
 */
function partnerDiscountPercent(family: boolean, tier: PartnerTier, s: PartnerMoneySettings): number {
  return family ? partnerRate(tier, s) : s.customerDiscountPercent;
}

/** Whole rupees off the products, the same formula as a percent coupon. */
function partnerDiscount(subtotal: number, percent: number): number {
  const v = Number(subtotal) || 0;
  const p = Number(percent) || 0;
  return v > 0 && p > 0 ? Math.floor((v * p) / 100) : 0;
}

/** What the customer paid for the products: after every discount, delivery excluded. */
function partnerSalesValue(i: { subtotal: number; discount: number; pointsValue?: number; cashback?: number }): number {
  const v = (Number(i.subtotal) || 0) - (Number(i.discount) || 0) - (Number(i.pointsValue) || 0) - (Number(i.cashback) || 0);
  return Math.max(0, partnerMoney(v));
}

const IST_OFFSET_MS = 330 * 60_000;

/** "YYYY-MM" of a time in India (the month an order counts in). */
function partnerMonthKey(ms: number): string {
  const d = new Date((Number(ms) || 0) + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** One credited order, as partners/{uid}/earnings/{orderId} holds it. */
interface PartnerEarningLike {
  amount: number;
  sales: number;
  units: number;
  state: 'held' | 'active' | 'void';
  family?: boolean;
  savings?: number;
}

interface PartnerTotals {
  /** Delivered sales value, family orders and voided orders excluded. */
  lifetimeSales: number;
  unitsSold: number;
  /** Commission on orders that are not void (held and active). */
  earnedTotal: number;
  /** Family-discount savings on orders that are not void. */
  familySavings: number;
}

/** The partner's server totals, recomputed from the earnings (idempotent). */
function partnerTotals(rows: PartnerEarningLike[]): PartnerTotals {
  let lifetimeSales = 0;
  let unitsSold = 0;
  let earnedTotal = 0;
  let familySavings = 0;
  for (const r of rows) {
    if (r.state === 'void') continue;
    if (r.family) {
      familySavings += Number(r.savings) || 0;
      continue;
    }
    lifetimeSales += Number(r.sales) || 0;
    unitsSold += Math.max(0, Math.floor(Number(r.units) || 0));
    earnedTotal += Number(r.amount) || 0;
  }
  return {
    lifetimeSales: partnerMoney(lifetimeSales),
    unitsSold,
    earnedTotal: partnerMoney(earnedTotal),
    familySavings: partnerMoney(familySavings),
  };
}
/** The payment record's partner fields from the rw_partner note ("uid|CODE|sales|units|f|savings"); {} when absent or malformed. */
function partnerFieldsFromNote(note: unknown): Record<string, string | number | boolean> {
  const parts = typeof note === 'string' ? note.split('|') : [];
  if (parts.length !== 6 || !parts[0] || !/^[A-Z0-9]{4,16}$/.test(parts[1])) return {};
  const num = (v: string) => Math.max(0, Number(v) || 0);
  return {
    partnerUid: parts[0],
    partnerCode: parts[1],
    partnerSales: num(parts[2]),
    partnerUnits: Math.floor(num(parts[3])),
    partnerFamily: parts[4] === '1',
    partnerSavings: num(parts[5]),
  };
}
// <<< partner-core

/**
 * Write payments/<razorpayOrderId> and confirm the reserved spends.
 * Returns recorded: false when the Razorpay order carries no customer (it was
 * created without a signed-in customer), so there is nothing to bind it to.
 */
async function recordPayment(
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<{ recorded: boolean; late?: boolean }> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('Razorpay keys missing');
  const basic = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const resp = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(razorpayOrderId)}`, {
    headers: { Authorization: `Basic ${basic}` },
    signal: AbortSignal.timeout(RAZORPAY_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`Razorpay order lookup failed (HTTP ${resp.status})`);
  const rzpOrder = (await resp.json()) as { amount?: number; notes?: Record<string, string> };
  const notes = rzpOrder.notes || {};
  const uid = String(notes.rw_uid || '');
  if (!uid) return { recorded: false };

  const { default: admin } = await import('firebase-admin');
  const app = admin.apps.length
    ? admin.app()
    : admin.initializeApp({
        credential: admin.credential.cert(
          JSON.parse(Buffer.from(process.env.FIREBASE_ADMIN_SDK_BASE64 || '', 'base64').toString('utf8')),
        ),
      });
  const db = admin.firestore(app);
  const ledger = db.collection('users').doc(uid).collection('rewardLedger');
  const want = { points: whole(notes.rw_points), cashback: whole(notes.rw_cashback) };

  let late = false;
  await db.runTransaction(async (tx) => {
    late = false;
    const now = admin.firestore.Timestamp.now();
    const spends = (['points', 'cashback'] as const).filter((c) => want[c] > 0);
    const snaps: firestore.DocumentSnapshot[] = [];
    for (const currency of spends) snaps.push(await tx.get(ledger.doc(`spend_${razorpayOrderId}_${currency}`)));

    tx.set(
      db.collection('payments').doc(razorpayOrderId),
      {
        uid,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: whole(rzpOrder.amount),
        base: money(notes.rw_base),
        points: want.points,
        pointsValue: money(notes.rw_pv),
        cashback: want.cashback,
        cartHash: String(notes.rw_cart || ''),
        ...(notes.rw_dealer === '1' ? { dealer: true, regularSubtotal: money(notes.rw_regular) } : {}),
        ...partnerFieldsFromNote(notes.rw_partner),
        status: 'verified',
        verifiedAt: now,
        source: 'verify-payment',
      },
      { merge: true },
    );

    spends.forEach((currency, i) => {
      const snap = snaps[i];
      const d = snap.data();
      if (!snap.exists || !d) {
        // Nothing was reserved (a checkout from before reservations): spend it now.
        tx.create(snap.ref, {
          currency,
          amount: -want[currency],
          kind: 'spend',
          status: 'active',
          hold: false,
          unlockAt: now,
          razorpayOrderId,
          note:
            currency === 'points'
              ? `Used ${want[currency]} points on an order`
              : `Used ₹${want[currency]} wallet cashback on an order`,
          createdAt: now,
          confirmedAt: now,
          createdBy: 'server',
        });
      } else if (d.status === 'active' && d.hold === true) {
        tx.update(snap.ref, { hold: false, confirmedAt: now });
      } else if (d.status === 'void' && d.voidReason === 'payment-not-completed') {
        // Released as abandoned, then paid after all. Spend it now; the
        // balance may go below zero, which the shop sees on the order.
        tx.update(snap.ref, { status: 'active', hold: false, late: true, confirmedAt: now });
        late = true;
      }
    });
  });
  return { recorded: true, late };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = (req.body || {}) as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  const orderId = body.razorpay_order_id;
  const paymentId = body.razorpay_payment_id;
  const signature = body.razorpay_signature;

  // ── Missing fields → 400 ──
  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({
      verified: false,
      error: 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required',
    });
  }

  // The order id becomes the payments/<id> document id (one path segment).
  if (typeof orderId !== 'string' || !/^[\w-]{1,128}$/.test(orderId)) {
    return res.status(400).json({ verified: false, error: 'invalid razorpay_order_id' });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    console.error('[verify-payment] RAZORPAY_KEY_SECRET is not configured');
    return res.status(503).json({ verified: false, error: 'We could not confirm your payment right now. If money was taken, contact us with your order number.' });
  }

  // ── Signature mismatch → 400, do NOT mark as paid ──
  if (!isValidSignature(orderId, paymentId, signature, keySecret)) {
    return res.status(400).json({ verified: false, error: 'Payment signature verification failed' });
  }

  // Never let the bookkeeping change the verification answer, or hold it up for long.
  const record = await withTimeout(
    recordPayment(orderId, paymentId),
    BOOKKEEPING_TIMEOUT_MS,
    'Payment record',
  ).catch((err: unknown) => {
    console.warn('[verify-payment] payment not recorded:', err instanceof Error ? err.message : err);
    return { recorded: false, late: false };
  });

  return res.status(200).json({
    verified: true,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    paymentRecorded: record.recorded,
    ...(record.recorded ? {} : { rewardsPending: true }),
    ...(record.late ? { rewardsLate: true } : {}),
  });
}
