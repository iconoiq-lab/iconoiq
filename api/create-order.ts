import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { firestore } from 'firebase-admin';
import { createHash } from 'node:crypto';

/**
 * POST /api/create-order
 *
 * Creates a Razorpay order so the browser can open Standard Checkout against
 * a real `order_id`.
 *
 * SECURITY: the order amount is computed HERE, from Firestore, and the client's
 * figure is only used as a cross-check. An earlier version took `amount`
 * straight from the request body and validated nothing but "is it >= 100 paise",
 * so anyone could open devtools and pay Rs.1 for a Rs.45,600 order - the
 * signature returned by Razorpay would verify perfectly, because it signs the
 * order, not the price. Every input below (product prices, delivery tiers, GST,
 * coupons, silver rate) is server-controlled data.
 *
 * Body:    { items: [{ productId, quantity }], paymentMethod?, couponCode?,
 *            usePoints?, useCashback?, pricing? ('dealer' | 'retail': how the browser
 *            priced the cart), currency?, receipt?, notes?,
 *            amount? (client's claim, checked),
 *            amountBeforeRewards? (client's claim before points/cashback, checked) }
 * Header:  Authorization: Bearer <Firebase ID token> (sent whenever signed in)
 * Returns: { order_id, amount, currency, key_id, pointsApplied, pointsValue, cashbackApplied }
 *
 * The server's facts about the payment travel in the Razorpay order notes,
 * which only this function writes (any rw_* note from the browser is dropped):
 *   rw_uid    the signed-in customer (from the verified ID token)
 *   rw_base   rupees paid for products, which points are earned on (earnBase)
 *   rw_cart   SHA-256 of the cart (cartKey), to compare with the order later
 *   rw_sub    rupees of goods before coupons, delivery and rewards (Lakshmi coin threshold)
 *   rw_dealer  '1' when the order was charged dealer prices; its points base (rw_base) is then 0
 *   rw_regular the cart at regular prices (rupees), written with rw_dealer
 *   rw_points / rw_pv / rw_cashback   points spent, their rupee value, cashback spent
 *   rw_partner  "uid|CODE|sales|units|f|savings" when an academy partner's code
 *               was used (f = 1 for the partner's own family discount)
 * api/verify-payment.ts copies them into payments/<razorpay order id>, the
 * record an order document must be created against.
 *
 * Loyalty points / wallet cashback: the customer's private ledger is read with
 * the Admin SDK, the redemption is priced with the shared rules below, and the
 * amounts are RESERVED before the order id is returned: spend entries
 * (spend_<razorpay order id>_<currency>, hold: true) are written in a
 * transaction that re-checks the balance under a per-customer lock, so two
 * checkouts cannot spend one balance. verify-payment confirms the hold; a hold
 * whose payment never happens is released by the 'release-holds' action in
 * api/notify-order.ts. 409 rewards_unavailable when rewards cannot be priced
 * safely, 409 rewards_changed when the balance moved; nothing is charged.
 */

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';
/** Client and server both round; allow a rupee of drift before rejecting. */
const AMOUNT_TOLERANCE_PAISE = 100;
/** How long a checkout keeps the customer's points/cashback reserved. */
const HOLD_MS = 30 * 60_000;
/** The Admin SDK can retry for many seconds; checkout must not hang on it. */
const ADMIN_TIMEOUT_MS = 6000;
/**
 * Two checkouts reserving at once are serialised by the customer lock: the
 * second waits for the first and retries, which takes a few seconds. Long
 * enough for it to see the first one and answer rewards_changed.
 */
const RESERVE_TIMEOUT_MS = 9000;

/**
 * Firestore access uses the REST API with the public web key, not the Admin SDK.
 *
 * On the Spark plan the Admin SDK's Firestore reads fail with
 * `8 RESOURCE_EXHAUSTED: Quota exceeded` (server-side API quota is zeroed
 * without billing), which would take checkout down entirely. Everything read
 * here - products, coupons, siteSettings - is already `allow read: if true`, so
 * the public key is sufficient and this works on both Spark and Blaze.
 *
 * Read-only and public does not mean untrusted: these documents are only
 * writable by admins, so they remain a trustworthy source of prices.
 */
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const WEB_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
const PAYMENTS_UNAVAILABLE = 'Online payment is not available right now. Please try again later or contact us.';

const firestoreBase = () =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/** Unwrap Firestore's typed REST representation into plain JS. */
function decodeValue(v: any): any {
  if (v == null) return undefined;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  return undefined;
}

function decodeFields(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
  return out;
}

/** A document id taken from the request: one path segment, never "..", "/" or "%". */
const SAFE_DOC_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Returns the document's data, or null when it does not exist. `path` is
 * built from fixed names and ids that passed SAFE_DOC_ID (encoded anyway).
 */
async function getDoc(path: string): Promise<Record<string, any> | null> {
  const resp = await fetch(`${firestoreBase()}/${path}?key=${WEB_API_KEY}`);
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Firestore read failed for ${path} (HTTP ${resp.status})`);
  const json = (await resp.json()) as { fields?: Record<string, any> };
  return decodeFields(json.fields || {});
}

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Loyalty points / wallet cashback ─────────────────────────────────────────
// Verbatim copy of src/lib/rewards.ts (api/ files import nothing from src/).
// tests/rewards-parity.test.ts fails if it drifts.

// >>> rewards-core
type RewardCurrency = 'points' | 'cashback';
type RewardKind = 'earn' | 'spend' | 'refund' | 'adjust';

interface LoyaltyTier {
  name: string;
  /** Rupees paid online on delivered orders from which the tier starts. */
  minSpend: number;
  /** Points multiplier for orders delivered while the customer is in this tier. */
  multiplier: number;
}

interface RewardSettings {
  enabled: boolean;
  /** Points earned per ₹100 paid for products. */
  pointsPer100: number;
  /** Rupee value of one point. */
  pointValue: number;
  /** Days after delivery before earned points can be spent (the return window). */
  unlockDays: number;
  /** Share of the product amount (after coupon) that points may cover, in percent. */
  maxPointsPercent: number;
  /** Exactly 4, sorted by minSpend; the first starts at ₹0. */
  tiers: LoyaltyTier[];
}

// TODO(client): tier names, thresholds and multipliers.
const DEFAULT_TIERS: LoyaltyTier[] = [
  { name: 'Silver', minSpend: 0, multiplier: 1 },
  { name: 'Gold', minSpend: 5000, multiplier: 1.25 },
  { name: 'Platinum', minSpend: 15000, multiplier: 1.5 },
  { name: 'Premium', minSpend: 30000, multiplier: 2 },
];

// TODO(client): placeholder values until the client confirms them.
const DEFAULT_REWARD_SETTINGS: RewardSettings = {
  // Off until an admin turns rewards on (template default).
  enabled: false,
  pointsPer100: 1,
  pointValue: 1,
  unlockDays: 7,
  maxPointsPercent: 20,
  tiers: DEFAULT_TIERS,
};

interface LedgerLike {
  currency: RewardCurrency;
  amount: number;
  status: 'active' | 'void';
  kind: RewardKind;
  /** When earned points become spendable. Only earn entries wait; every other entry counts at once. */
  unlockAtMs: number;
  /** Earned points frozen while their order has a return open. */
  held?: boolean;
}

interface RewardBalances {
  points: { available: number; pending: number };
  cashback: { available: number; pending: number };
}

/** Four tiers: missing or bad values fall back to the defaults, the first starts at ₹0, sorted by minSpend. */
function normaliseTiers(raw: unknown): LoyaltyTier[] {
  const rows = Array.isArray(raw) ? raw : [];
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  const tiers = DEFAULT_TIERS.map((d, i) => {
    const r = (rows[i] && typeof rows[i] === 'object' ? rows[i] : {}) as Record<string, unknown>;
    const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 24) : d.name;
    const min = num(r.minSpend);
    const minSpend = i === 0 ? 0 : Number.isFinite(min) ? Math.round(Math.min(10_000_000, Math.max(0, min))) : d.minSpend;
    const m = num(r.multiplier);
    const multiplier = Number.isFinite(m) ? Math.round(Math.min(5, Math.max(1, m)) * 100) / 100 : d.multiplier;
    return { name, minSpend, multiplier };
  });
  return tiers.sort((a, b) => a.minSpend - b.minSpend);
}

function normaliseRewardSettings(raw: Partial<RewardSettings> | null | undefined): RewardSettings {
  const num = (v: unknown, fallback: number, min: number, max: number) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const d = DEFAULT_REWARD_SETTINGS;
  return {
    enabled: raw?.enabled === undefined ? d.enabled : raw.enabled === true,
    pointsPer100: num(raw?.pointsPer100, d.pointsPer100, 0, 100),
    pointValue: num(raw?.pointValue, d.pointValue, 0, 100),
    unlockDays: num(raw?.unlockDays, d.unlockDays, 0, 365),
    maxPointsPercent: num(raw?.maxPointsPercent, d.maxPointsPercent, 0, 100),
    tiers: normaliseTiers((raw as { tiers?: unknown } | null | undefined)?.tiers),
  };
}

/**
 * Balances from ledger entries. Only earned points can be pending (until their
 * unlock date, or while their order has a return open). Spends, refunds and
 * adjustments count the moment they exist, so the browser and the server agree
 * whatever their clocks say.
 */
function summariseRewards(entries: LedgerLike[], nowMs: number): RewardBalances {
  const out: RewardBalances = {
    points: { available: 0, pending: 0 },
    cashback: { available: 0, pending: 0 },
  };
  for (const e of entries) {
    if (e.status !== 'active') continue;
    const bucket = out[e.currency];
    if (!bucket) continue;
    const amount = Number(e.amount) || 0;
    const waiting = e.kind === 'earn' && amount > 0 && (e.held === true || e.unlockAtMs > nowMs);
    if (waiting) bucket.pending += amount;
    else bucket.available += amount;
  }
  return out;
}

interface RedemptionInput {
  subtotal: number;
  couponDiscount: number;
  deliveryCharge: number;
  gstOnTop: number;
  balances: RewardBalances;
  settings: RewardSettings;
  usePoints: boolean;
  useCashback: boolean;
}

interface Redemption {
  points: number;
  pointsValue: number;
  cashback: number;
  /** Left to pay; redemptions never take it below ₹1 (Razorpay's minimum). */
  payable: number;
}

function computeRedemption(i: RedemptionInput): Redemption {
  const s = i.settings;
  const productsAfterCoupon = Math.max(0, i.subtotal - i.couponDiscount);
  let payable = Math.max(0, productsAfterCoupon + i.deliveryCharge + i.gstOnTop);
  let points = 0;
  let pointsValue = 0;
  let cashback = 0;
  if (s.enabled && i.usePoints && s.pointValue > 0) {
    const capRupees = Math.floor((productsAfterCoupon * s.maxPointsPercent) / 100);
    const rupees = Math.max(0, Math.min(capRupees, Math.floor(payable - 1)));
    const affordable = Math.floor(rupees / s.pointValue);
    points = Math.max(0, Math.min(Math.floor(i.balances.points.available), affordable));
    pointsValue = points * s.pointValue;
    payable -= pointsValue;
  }
  if (s.enabled && i.useCashback) {
    cashback = Math.max(0, Math.min(Math.floor(i.balances.cashback.available), Math.floor(payable - 1)));
    payable -= cashback;
  }
  return { points, pointsValue, cashback, payable };
}

interface EarnBaseInput {
  subtotal: number;
  couponDiscount: number;
  /** Rupee value of the points spent on the order. */
  pointsValue: number;
  cashback: number;
  /** The shop's GST settings when the order was priced. */
  gstEnabled: boolean;
  gstInclusive: boolean;
  gstRate: number;
}

/**
 * Rupees paid for products, which is what points are earned on: after the
 * coupon, points and cashback, without delivery, and without the GST that
 * GST-inclusive prices carry. Two decimals. Worked out by api/create-order.ts
 * and kept with the payment, so nothing the browser writes can change it.
 */
function earnBase(i: EarnBaseInput): number {
  const paid = Math.max(0, i.subtotal - i.couponDiscount - i.pointsValue - i.cashback);
  const rate = i.gstEnabled && i.gstInclusive && i.gstRate > 0 ? i.gstRate : 0;
  return Math.floor(((paid * 100) / (100 + rate)) * 100 + 1e-6) / 100;
}

/** Points earned on a base from earnBase, times the customer's tier multiplier (1 to 5, in hundredths). */
function pointsForBase(base: number, s: RewardSettings, multiplier = 1): number {
  if (!s.enabled || !(base > 0)) return 0;
  const hundredths = Math.round(Math.min(5, Math.max(1, Number(multiplier) || 1)) * 100);
  // Multiply before dividing, with a hair of tolerance: ₹820 at 15 per ₹100 is 123, not 122.
  return Math.max(0, Math.floor((base * s.pointsPer100 * hundredths) / 10_000 + 1e-9));
}

/** The customer's tier: the highest one whose minSpend they have reached. */
function tierIndexForSpend(spend: number, tiers: LoyaltyTier[]): number {
  let index = 0;
  for (let i = 0; i < tiers.length; i++) if (spend >= tiers[i].minSpend) index = i;
  return index;
}

interface TierSpendRow {
  /** The Razorpay order id (payments/<id>, orders/<id>). */
  id: string;
  amountPaise: number;
  /** A dealer-priced order (payments/<id>.dealer). */
  dealer?: boolean;
  /** orders/<id>.status now. */
  orderStatus: string;
}

/**
 * What tiers count: rupees paid online for delivered orders that were not
 * dealer-priced, from the server's payment records (never order.total, which
 * the browser writes). A returned or cancelled order drops out with its
 * status. excludeId leaves out the order being earned on.
 */
function tierSpend(rows: TierSpendRow[], excludeId = ''): number {
  let paise = 0;
  for (const r of rows) {
    if (r.id === excludeId || r.dealer === true || r.orderStatus !== 'delivered') continue;
    const p = Number(r.amountPaise);
    if (Number.isFinite(p) && p > 0) paise += Math.round(p);
  }
  return paise / 100;
}

/**
 * A cart in a canonical form (productId:quantity, merged and sorted) so what
 * was paid for can be compared with what was ordered. Stored as a SHA-256 hash.
 */
function cartKey(items: Array<{ productId?: string; quantity?: unknown }>): string {
  const qty = new Map<string, number>();
  for (const it of items || []) {
    const id = String(it?.productId || '');
    if (id) qty.set(id, (qty.get(id) || 0) + (Number(it?.quantity) || 0));
  }
  return [...qty.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, q]) => `${id}:${q}`)
    .join('|');
}
// <<< rewards-core

// >>> dealer-core
/** A stockist margin tier: one order worth minOrder or more at regular prices gets percent off. */
interface DealerTier {
  /** Rupees, at regular prices, for this single order. */
  minOrder: number;
  /** Percent off the regular price. */
  percent: number;
}

interface DealerSettings {
  /** The programme switch. Off: no dealer prices, and /dealer is hidden from customers with no application. */
  enabled: boolean;
  /** The first tier's threshold (rupees, at regular prices): below it regular prices apply. Derived from tiers. */
  minOrder: number;
  /** Margin tiers, lowest threshold first. The highest tier an order meets wins. */
  tiers: DealerTier[];
}

interface DealerPricing {
  /** Fixed dealer unit prices by product id (rupees). A fixed price wins over the tier percent. */
  productPrices: Record<string, number>;
}

// The client's PLANS.pdf: Rs 1,50,000 or more in one order: 40% off; Rs 2,50,000 or more: 50% off.
const DEFAULT_DEALER_TIERS: DealerTier[] = [
  { minOrder: 150_000, percent: 40 },
  { minOrder: 250_000, percent: 50 },
];
const DEALER_MAX_TIERS = 5;
const DEFAULT_DEALER_SETTINGS: DealerSettings = {
  enabled: false,
  minOrder: DEFAULT_DEALER_TIERS[0].minOrder,
  tiers: DEFAULT_DEALER_TIERS.map((t) => ({ ...t })),
};
const DEFAULT_DEALER_PRICING: DealerPricing = { productPrices: {} };

interface DealerLine {
  productId: string;
  /** Regular unit price, rupees. */
  unit: number;
  quantity: number;
}

interface DealerQuote {
  /** True when this cart is charged dealer prices. */
  applies: boolean;
  regularSubtotal: number;
  /** The cart at dealer prices: at the tier it meets, or at the first tier's percent while below it (for display). */
  dealerSubtotal: number;
  /** What the products are charged: dealerSubtotal when applies, otherwise regularSubtotal. */
  subtotal: number;
  /** regularSubtotal - subtotal. */
  savings: number;
  /** Rupees more, at regular prices, before dealer prices apply. 0 once met, and for non-dealers. */
  shortBy: number;
  /** The charged unit price of each line, in line order. */
  units: number[];
  /** The tier percent charged; 0 when dealer prices do not apply. */
  percent: number;
  /** The next tier above this cart, for an "add more for a bigger margin" nudge; null at the top or for non-dealers. */
  nextTier: DealerTier | null;
}

const dealerMoney = (n: number) => Math.round(n * 100) / 100;

function dealerNum(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Clean tiers: whole-rupee thresholds of 1 or more, up to 90% off, sorted, one per threshold (the last wins). None valid: the defaults. */
function normaliseDealerTiers(raw: unknown): DealerTier[] {
  const byMin = new Map<number, number>();
  if (Array.isArray(raw)) {
    for (const t of raw.slice(0, DEALER_MAX_TIERS)) {
      if (!t || typeof t !== 'object') continue;
      const minOrder = Math.round(dealerNum((t as DealerTier).minOrder, NaN, 1, 100_000_000));
      const percent = Math.round(dealerNum((t as DealerTier).percent, NaN, 0, 90) * 100) / 100;
      if (Number.isFinite(minOrder) && Number.isFinite(percent) && percent > 0) byMin.set(minOrder, percent);
    }
  }
  const tiers = [...byMin.entries()].map(([minOrder, percent]) => ({ minOrder, percent })).sort((a, b) => a.minOrder - b.minOrder);
  return tiers.length ? tiers : DEFAULT_DEALER_TIERS.map((t) => ({ ...t }));
}

function normaliseDealerSettings(raw: Partial<DealerSettings> | null | undefined): DealerSettings {
  const tiers = normaliseDealerTiers(raw?.tiers);
  return { enabled: raw?.enabled === true, minOrder: tiers[0].minOrder, tiers };
}

function normaliseDealerPricing(raw: Partial<DealerPricing> | null | undefined): DealerPricing {
  const productPrices: Record<string, number> = {};
  const source = raw?.productPrices && typeof raw.productPrices === 'object' ? raw.productPrices : {};
  for (const [id, v] of Object.entries(source)) {
    if (id && typeof v === 'number' && Number.isFinite(v) && v > 0) productPrices[id] = dealerMoney(v);
  }
  return { productPrices };
}

/** The highest tier this regular-price order value meets, or null below the first. */
function dealerTierFor(regularSubtotal: number, tiers: DealerTier[]): DealerTier | null {
  let best: DealerTier | null = null;
  for (const t of tiers) if (regularSubtotal >= t.minOrder && (!best || t.minOrder > best.minOrder)) best = t;
  return best;
}

/**
 * One product's dealer unit price at a tier percent. A fixed dealer price
 * wins, capped at the regular price (a later sale never makes it dearer than
 * the regular price). Otherwise percent off, in whole rupees, never above the
 * regular price and never below 1 rupee unless the regular price is.
 */
function dealerUnitPrice(productId: string, regularUnit: number, p: DealerPricing, percent: number): number {
  const regular = Number(regularUnit);
  if (!(regular > 0)) return Math.max(0, regular || 0);
  const fixed = p.productPrices[productId];
  if (typeof fixed === 'number' && fixed > 0) return Math.min(regular, dealerMoney(fixed));
  const pct = Math.min(90, Math.max(0, Number(percent) || 0));
  const off = Math.round((regular * (100 - pct)) / 100);
  return Math.min(regular, Math.max(Math.min(1, regular), off));
}

/**
 * A cart priced for this customer. Dealer prices apply only to an approved
 * dealer, while the programme is on, when this one order is worth at least the
 * first tier at regular prices and the dealer total is lower. The highest tier
 * met sets the percent; fixed product prices win over it.
 */
function dealerQuote(
  lines: DealerLine[],
  s: DealerSettings,
  p: DealerPricing | null,
  approved: boolean,
): DealerQuote {
  let regular = 0;
  for (const l of lines) regular += l.unit * l.quantity;
  regular = dealerMoney(regular);
  const regularUnits = lines.map((l) => l.unit);
  const tiers = s.tiers && s.tiers.length ? s.tiers : DEFAULT_DEALER_TIERS;
  if (!approved || !s.enabled || !p) {
    return { applies: false, regularSubtotal: regular, dealerSubtotal: regular, subtotal: regular, savings: 0, shortBy: 0, units: regularUnits, percent: 0, nextTier: null };
  }
  const tier = dealerTierFor(regular, tiers);
  const nextTier = tiers.find((t) => t.minOrder > regular) ?? null;
  const percent = tier ? tier.percent : tiers[0].percent;
  const units = lines.map((l) => dealerUnitPrice(l.productId, l.unit, p, percent));
  let dealer = 0;
  for (let i = 0; i < lines.length; i++) dealer += units[i] * lines[i].quantity;
  dealer = dealerMoney(dealer);
  const applies = tier !== null && dealer < regular;
  return {
    applies,
    regularSubtotal: regular,
    dealerSubtotal: dealer,
    subtotal: applies ? dealer : regular,
    savings: applies ? dealerMoney(regular - dealer) : 0,
    shortBy: tier ? 0 : dealerMoney(tiers[0].minOrder - regular),
    units: applies ? units : regularUnits,
    percent: applies && tier ? tier.percent : 0,
    nextTier,
  };
}
// <<< dealer-core

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
  /** The order's sales value: kept on partnerPrivate/<uid>/orders/<id>, never on the earning (spec decision 6). */
  sales?: number;
  units: number;
  state: 'held' | 'active' | 'void';
  family?: boolean;
  savings?: number;
  /** When the return window ends (ms). Sales count towards unlocks only after it. */
  unlockAtMs?: number;
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
/**
 * Sales that may unlock perks, silver and the Gold tier: delivered orders whose
 * return window has ended (state active and unlockAt passed). A held order or
 * one still inside the window could still be returned, so it never counts here;
 * lifetimeSales (admin display) counts it. nextUnlockMs: when the next active
 * order leaves its window, so the views can be refreshed then.
 */
function partnerUnlocked(rows: PartnerEarningLike[], nowMs: number): { unlockedSales: number; nextUnlockMs: number | null } {
  let unlockedSales = 0;
  let nextUnlockMs: number | null = null;
  for (const r of rows) {
    if (r.state !== 'active' || r.family) continue;
    const at = Number(r.unlockAtMs);
    if (Number.isFinite(at) && at <= nowMs) unlockedSales += Number(r.sales) || 0;
    else if (Number.isFinite(at) && (nextUnlockMs === null || at < nextUnlockMs)) nextUnlockMs = at;
  }
  return { unlockedSales: partnerMoney(unlockedSales), nextUnlockMs };
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

type PerkId =
  | 'catalogue'
  | 'photos'
  | 'pamphlets'
  | 'masterclass'
  | 'passGroup'
  | 'passSolo'
  | 'promoTeam'
  | 'onlinePromo'
  | 'standee'
  | 'uniforms'
  | 'trip';

interface PerkRule {
  /** Rupees of lifetime delivered sales; 0 = from approval. */
  unlockAt: number;
  /** For counted perks: how many claims. */
  count: number;
}

/** The client's PLANS.pdf. Keep in step with perkDefaults() in firestore.rules (tests/partnerRules.test.ts). */
const DEFAULT_PERK_RULES: Record<PerkId, PerkRule> = {
  catalogue: { unlockAt: 0, count: 1 },
  photos: { unlockAt: 0, count: 1 },
  pamphlets: { unlockAt: 10_000, count: 1 },
  masterclass: { unlockAt: 20_000, count: 6 },
  passGroup: { unlockAt: 30_000, count: 20 },
  passSolo: { unlockAt: 30_000, count: 4 },
  promoTeam: { unlockAt: 30_000, count: 1 },
  onlinePromo: { unlockAt: 30_000, count: 1 },
  standee: { unlockAt: 50_000, count: 1 },
  uniforms: { unlockAt: 100_000, count: 1 },
  trip: { unlockAt: 100_000, count: 1 },
};

const DEFAULT_SILVER_STEP = 10_000;

/** Grams of silver earned: 1 g per full silverStep of lifetime sales. */
const silverGrams = (lifetimeSales: number, step = DEFAULT_SILVER_STEP) =>
  step > 0 ? Math.max(0, Math.floor((Number(lifetimeSales) || 0) / step)) : 0;

/**
 * What the partner may see on partners/<uid> (spec decision 6): the tier, the
 * silver grams earned and which perks are unlocked, from unlockedSales
 * (partnerUnlocked), never from sales still inside the return window. The sales value itself
 * stays on partnerPrivate/<uid>, which only the admin and the server read.
 */
interface PartnerView {
  tier: PartnerTier;
  silverGrams: number;
  perksUnlocked: PerkId[];
}

function partnerView(unlockedSales: number, raw: Record<string, unknown> | null | undefined, override?: unknown): PartnerView {
  const sales = Number(unlockedSales) || 0;
  const perks = (raw?.perks && typeof raw.perks === 'object' ? raw.perks : {}) as Record<string, { unlockAt?: unknown } | undefined>;
  const step = Math.round(partnerNum(raw?.silverStep, DEFAULT_SILVER_STEP, 100, 10_000_000));
  const ids = Object.keys(DEFAULT_PERK_RULES) as PerkId[];
  return {
    tier: partnerTierFor(sales, normalisePartnerMoney(raw as Partial<PartnerMoneySettings> | null | undefined), override),
    silverGrams: silverGrams(sales, step),
    perksUnlocked: ids.filter((id) => sales >= Math.round(partnerNum(perks[id]?.unlockAt, DEFAULT_PERK_RULES[id].unlockAt, 0, 1_000_000_000))),
  };
}
// <<< partner-core

/** Reject when `p` takes longer than `ms`, so a slow Admin SDK call cannot hang checkout. */
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/**
 * The Admin SDK, loaded lazily: only the customer lookup and the rewards
 * paths need it, so a broken service-account variable cannot stop pricing.
 */
async function adminSdk() {
  const { default: admin } = await import('firebase-admin');
  const app = admin.apps.length
    ? admin.app()
    : admin.initializeApp({
        credential: admin.credential.cert(
          JSON.parse(Buffer.from(process.env.FIREBASE_ADMIN_SDK_BASE64 || '', 'base64').toString('utf8')),
        ),
      });
  return { admin, app, db: admin.firestore(app) };
}

/** The signed-in customer from the Bearer ID token; null when none was sent. Throws if it does not verify. */
async function customerUid(req: VercelRequest): Promise<string | null> {
  const header = String(req.headers.authorization || '');
  const idToken = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!idToken) return null;
  const { admin, app } = await adminSdk();
  const { uid } = await withTimeout(admin.auth(app).verifyIdToken(idToken), ADMIN_TIMEOUT_MS, 'Sign-in check');
  return uid;
}

/**
 * What the dealer step decides for a priced cart: an error reply, or null to
 * go on. The browser says how it priced the cart (pricing); when the server
 * disagrees the customer must see the new total before paying. Dealer prices
 * take no coupon, points or cashback. Exported for tests.
 */
export function dealerCheck(
  quote: DealerQuote,
  body: { pricing?: unknown; couponCode?: unknown; usePoints?: unknown; useCashback?: unknown },
): { status: number; body: Record<string, unknown> } | null {
  const server = quote.applies ? 'dealer' : 'retail';
  if ((body.pricing === 'dealer' || body.pricing === 'retail') && body.pricing !== server) {
    return {
      status: 409,
      body: {
        code: 'dealer_pricing_changed',
        pricing: server,
        error:
          server === 'dealer'
            ? 'Dealer prices now apply to this order. Check the new total and pay again.'
            : 'Dealer prices no longer apply to this order. Check the new total and pay again.',
      },
    };
  }
  if (quote.applies) {
    const coupon = typeof body.couponCode === 'string' && body.couponCode.trim() !== '';
    if (coupon || body.usePoints === true || body.useCashback === true) {
      return {
        status: 400,
        body: { code: 'dealer_no_extras', error: "Coupons, points and cashback don't apply to dealer-priced orders." },
      };
    }
  }
  return null;
}

/**
 * Whether the customer is an approved dealer, and the private dealer prices.
 * Read with the Admin SDK: dealers/<uid> and dealerPricing/current are not
 * public. Throws when they cannot be read.
 */
export async function loadDealer(
  uid: string | null,
  settings: DealerSettings,
  // Tests pass an in-memory database; the handler leaves it out.
  injectedDb?: Pick<firestore.Firestore, 'collection'>,
): Promise<{ approved: boolean; pricing: DealerPricing | null }> {
  if (!uid || !settings.enabled) return { approved: false, pricing: null };
  const db = injectedDb ?? (await adminSdk()).db;
  const dealer = await withTimeout(db.collection('dealers').doc(uid).get(), ADMIN_TIMEOUT_MS, 'Dealer check');
  if (dealer.data()?.status !== 'approved') return { approved: false, pricing: null };
  const pricing = await withTimeout(db.collection('dealerPricing').doc('current').get(), ADMIN_TIMEOUT_MS, 'Dealer prices');
  return { approved: true, pricing: normaliseDealerPricing(pricing.exists ? (pricing.data() as Partial<DealerPricing>) : null) };
}

const DEALER_UNAVAILABLE = {
  code: 'dealer_unavailable',
  error: "We couldn't confirm your dealer prices just now. Nothing was charged. Please try again.",
};

const PARTNER_UNAVAILABLE = {
  code: 'partner_unavailable',
  error: "We couldn't check this partner code just now. Nothing was charged. Please try again.",
};

/** What an academy partner code gives this order. */
export interface PartnerCodeUse {
  partnerUid: string;
  code: string;
  /** The partner is using their own code: family discount, no commission. */
  family: boolean;
  percent: number;
  discount: number;
}

/**
 * An academy partner code typed in the coupon box (only when no store coupon
 * has that code). Read with the Admin SDK: partnerCodes/<CODE>, the partner's
 * own document (approved only) and partnerSettings/main (the programme's own
 * switch). Null when the code is not a usable partner code. Throws when the
 * documents cannot be read. The discount and the tier are decided here, never
 * by the browser. Exported for tests.
 */
export async function resolvePartnerCode(
  code: string,
  uid: string | null,
  subtotal: number,
  injectedDb?: Pick<firestore.Firestore, 'collection'>,
): Promise<PartnerCodeUse | null> {
  if (!/^[A-Z0-9]{4,16}$/.test(code)) return null;
  const db = injectedDb ?? (await adminSdk()).db;
  const [settingsSnap, codeSnap] = await withTimeout(
    Promise.all([db.collection('partnerSettings').doc('main').get(), db.collection('partnerCodes').doc(code).get()]),
    ADMIN_TIMEOUT_MS,
    'Partner code check',
  );
  const settings = normalisePartnerMoney(settingsSnap.exists ? (settingsSnap.data() as Partial<PartnerMoneySettings>) : null);
  const link = codeSnap.data();
  if (!settings.enabled || !link || link.active === false || typeof link.uid !== 'string' || !link.uid) return null;
  const [partnerSnap, privateSnap] = await withTimeout(
    Promise.all([db.collection('partners').doc(link.uid).get(), db.collection('partnerPrivate').doc(link.uid).get()]),
    ADMIN_TIMEOUT_MS,
    'Partner check',
  );
  const partner = partnerSnap.data();
  if (!partner || partner.status !== 'approved' || partner.code !== code) return null;
  const family = !!uid && uid === link.uid;
  const tier = partnerTierFor(Number(privateSnap.data()?.unlockedSales) || 0, settings, partner.tierOverride);
  const percent = partnerDiscountPercent(family, tier, settings);
  return { partnerUid: link.uid, code, family, percent, discount: partnerDiscount(subtotal, percent) };
}

type LedgerDoc = { data: () => Record<string, any> };

const toLedgerLike = (d: LedgerDoc): LedgerLike => {
  const x = d.data();
  return {
    currency: x.currency === 'cashback' ? 'cashback' : 'points',
    amount: Number(x.amount) || 0,
    status: x.status === 'void' ? 'void' : 'active',
    kind: x.kind === 'earn' || x.kind === 'spend' || x.kind === 'refund' ? x.kind : 'adjust',
    unlockAtMs: typeof x.unlockAt?.toMillis === 'function' ? x.unlockAt.toMillis() : 0,
    held: x.held === true,
  };
};

type LedgerSnap = LedgerDoc & { id: string; ref: firestore.DocumentReference };

/** An order whose earned points must not be spent: it exists (the shop may delete one) and is not at delivered. */
const offDelivered = (status: unknown) => status !== undefined && status !== 'delivered';

/**
 * Earned points and scratch prizes (kind 'earn', on an order) are spendable
 * only while their order sits at delivered: reconcile holds them while a
 * return is open and voids them when the order ends. Reconcile runs when a
 * browser asks for it after a status change, so when that call never came (a
 * dropped request, or a modified browser writing the return request straight
 * to Firestore) an unlocked entry could be spent while its goods are on their
 * way back. This looks up the orders behind the entries that would count as
 * available now and holds each one whose order is not at delivered - the step
 * reconcile takes, with the same labels on the order and the card, so the
 * customer's live balance and pages show it too - and returns their ids.
 * Reconcile releases them once the order is back at delivered, and voids them
 * if it ended.
 *
 * Each hold is a transaction that re-reads the order and the entry, so it
 * cannot land after a cancelled return put the order back at delivered (and
 * its reconcile found nothing to release).
 */
export async function holdEarnedOffDelivered(
  db: firestore.Firestore,
  uid: string,
  docs: LedgerSnap[],
  nowMs: number,
): Promise<Set<string>> {
  const orderOf = (d: LedgerSnap) => String(d.data().orderId || '');
  const due = docs.filter((d) => {
    const x = d.data();
    const unlockAtMs = typeof x.unlockAt?.toMillis === 'function' ? x.unlockAt.toMillis() : 0;
    return (
      x.kind === 'earn' &&
      x.status === 'active' &&
      x.held !== true &&
      Number(x.amount) > 0 &&
      unlockAtMs <= nowMs &&
      /^[\w-]{1,128}$/.test(orderOf(d))
    );
  });
  const held = new Set<string>();
  if (!due.length) return held;
  // One read for all the orders (earn_X and scratch_X share one).
  const ids = [...new Set(due.map(orderOf))];
  const snaps = await db.getAll(...ids.map((id) => db.collection('orders').doc(id)));
  const statusOf = new Map(ids.map((id, i) => [id, snaps[i].data()?.status]));
  await Promise.all(
    due
      .filter((d) => offDelivered(statusOf.get(orderOf(d))))
      .map(async (d) => {
        const id = orderOf(d);
        const orderRef = db.collection('orders').doc(id);
        const cardRef = db.collection('users').doc(uid).collection('scratchCards').doc(id);
        const isEarn = d.id === `earn_${id}`;
        const isPrize = d.id === `scratch_${id}`;
        const did = await db.runTransaction(async (tx) => {
          const order = (await tx.get(orderRef)).data();
          const entry = (await tx.get(d.ref)).data();
          const card = isPrize ? (await tx.get(cardRef)).data() : undefined;
          if (!order || !offDelivered(order.status) || entry?.status !== 'active' || entry.held === true) return false;
          tx.update(d.ref, { held: true });
          if (isEarn && order.pointsEarnedState === 'active') tx.update(orderRef, { pointsEarnedState: 'held' });
          if (card?.prizeState === 'active') tx.update(cardRef, { prizeState: 'held' });
          return true;
        });
        if (did) held.add(d.id);
      }),
  );
  return held;
}

/** Price the customer's opted-in points/cashback against their ledger as it stands. */
async function priceRewards(
  uid: string,
  input: Omit<RedemptionInput, 'balances' | 'settings'>,
): Promise<Redemption> {
  const { db } = await adminSdk();
  const [settingsSnap, ledgerSnap] = await withTimeout(
    Promise.all([
      db.collection('siteSettings').doc('rewards').get(),
      db.collection('users').doc(uid).collection('rewardLedger').get(),
    ]),
    ADMIN_TIMEOUT_MS,
    'Rewards lookup',
  );
  const settings = normaliseRewardSettings(
    settingsSnap.exists ? (settingsSnap.data() as Partial<RewardSettings>) : null,
  );
  const nowMs = Date.now();
  // The reservation re-reads the ledger, so it sees these holds as well.
  const held = await withTimeout(
    holdEarnedOffDelivered(db, uid, ledgerSnap.docs, nowMs),
    ADMIN_TIMEOUT_MS,
    'Rewards check',
  );
  const balances = summariseRewards(
    ledgerSnap.docs.map((d) => (held.has(d.id) ? { ...toLedgerLike(d), held: true } : toLedgerLike(d))),
    nowMs,
  );
  return computeRedemption({ ...input, balances, settings });
}

const spendNote = (currency: RewardCurrency, amount: number) =>
  currency === 'points' ? `Used ${amount} points on an order` : `Used ₹${amount} wallet cashback on an order`;

/**
 * Reserve the redemption for this Razorpay order: spend entries with
 * hold: true, written in a transaction that re-reads the ledger and writes the
 * customer's lock document, so concurrent checkouts are serialised and each
 * sees the others' holds. Returns false when the balance no longer covers it.
 */
async function reserveRewards(
  uid: string,
  razorpayOrderId: string,
  want: { points: number; cashback: number },
): Promise<boolean> {
  const { admin, db } = await adminSdk();
  const user = db.collection('users').doc(uid);
  const ledger = user.collection('rewardLedger');
  const lock = user.collection('rewardState').doc('lock');
  return withTimeout(
    db.runTransaction(async (tx) => {
      await tx.get(lock);
      const snap = await tx.get(ledger);
      const nowMs = Date.now();
      const balances = summariseRewards(snap.docs.map(toLedgerLike), nowMs);
      if (
        want.points > Math.floor(balances.points.available) ||
        want.cashback > Math.floor(balances.cashback.available)
      ) {
        return false;
      }
      const now = admin.firestore.Timestamp.fromMillis(nowMs);
      tx.set(lock, { updatedAt: now, lastRazorpayOrderId: razorpayOrderId }, { merge: true });
      for (const currency of ['points', 'cashback'] as const) {
        const amount = want[currency];
        if (amount <= 0) continue;
        tx.create(ledger.doc(`spend_${razorpayOrderId}_${currency}`), {
          currency,
          amount: -amount,
          kind: 'spend',
          status: 'active',
          hold: true,
          holdUntil: admin.firestore.Timestamp.fromMillis(nowMs + HOLD_MS),
          unlockAt: now,
          razorpayOrderId,
          note: spendNote(currency, amount),
          createdAt: now,
          createdBy: 'server',
        });
      }
      return true;
    }),
    RESERVE_TIMEOUT_MS,
    'Rewards reservation',
  );
}

/**
 * The rw_partner note: "uid|CODE|sales|units|f|savings". sales is what the
 * customer paid for the products (after the partner discount, points and
 * cashback; delivery excluded). Exported for tests.
 */
export function partnerNote(
  use: PartnerCodeUse,
  subtotal: number,
  redemption: { pointsValue: number; cashback: number },
  items: Array<{ quantity?: unknown }>,
): string {
  const sales = partnerSalesValue({ subtotal, discount: use.discount, pointsValue: redemption.pointsValue, cashback: redemption.cashback });
  const units = items.reduce((t, l) => t + Math.max(0, Math.floor(Number(l.quantity) || 0)), 0);
  return [use.partnerUid, use.code, sales, units, use.family ? 1 : 0, use.family ? use.discount : 0].join('|');
}

/** Notes the browser may add to the Razorpay order: a few short ones, never rw_*. */
function clientNotes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(([k, v]) => !k.startsWith('rw_') && (typeof v === 'string' || typeof v === 'number'))
      .slice(0, 5)
      .map(([k, v]) => [k.slice(0, 40), String(v).slice(0, 200)]),
  );
}

// ── Pricing helpers: must mirror src/hooks/useCheckoutPricing.ts ─────────────

// Copy of DEFAULT_DELIVERY in src/services/siteSettingsService.ts (api/ files stay standalone, so no import).
// homeState must equal BRAND.state in src/config/brand.ts: tests/brand-parity.test.ts checks it.
const DEFAULT_DELIVERY = {
  enabled: true,
  homeState: 'Telangana',
  withinStateCharge: 50,
  outsideStateCharge: 100,
  stateRates: [] as Array<{ state: string; charge: number }>,
  freeDeliveryAbove: 999,
};
/** Must mirror DEFAULT_GST in src/services/siteSettingsService.ts. */
const DEFAULT_GST = { enabled: false, rate: 3, inclusive: false };

const normState = (v: unknown) => String(v || '').trim().toLowerCase();

/**
 * Per-product delivery charge - mirrors `computeItemDeliveryCharge` in
 * src/services/siteSettingsService.ts. Keep the two in step: the client's total
 * is cross-checked against this one and a divergence blocks checkout.
 */
function itemDeliveryCharge(product: any, destState: string, s: any): number {
  const cfg = product?.delivery;
  if (cfg && cfg.chargeEnabled === false) return 0;

  const isHome = !destState || normState(destState) === normState(s.homeState);

  if (!isHome) {
    const rates = Array.isArray(s.stateRates) ? s.stateRates : [];
    const override = rates.find((r: any) => normState(r?.state) === normState(destState));
    if (override) return Math.max(0, Number(override.charge) || 0);
  }

  if (cfg && cfg.chargeEnabled) {
    return Math.max(0, Number(isHome ? cfg.withinState : cfg.outsideState) || 0);
  }

  if (!s.enabled) return 0;
  return Math.max(0, Number(isHome ? s.withinStateCharge : s.outsideStateCharge) || 0);
}

/**
 * Bring a stored delivery document up to the current shape - mirrors
 * `normalizeDelivery` in src/services/siteSettingsService.ts.
 *
 * This must run on the RAW document, before defaults are merged in: after a
 * merge `withinStateCharge` is always set, so a legacy tiers-only document
 * would silently be priced at the default rate instead of its own, and the
 * client/server totals would disagree - which blocks checkout outright.
 */
function normalizeDelivery(raw: Record<string, any> | null) {
  const merged: any = { ...DEFAULT_DELIVERY, ...(raw || {}) };

  if (raw && raw.withinStateCharge === undefined && Array.isArray(raw.tiers) && raw.tiers.length) {
    const legacy = Number(raw.tiers[0]?.charge) || 0;
    merged.withinStateCharge = legacy;
    merged.outsideStateCharge = legacy;
  }

  merged.enabled = raw?.enabled ?? true;
  merged.stateRates = Array.isArray(merged.stateRates) ? merged.stateRates : [];
  return merged;
}

/** A cart is one parcel, so it pays the highest line charge - never the sum. */
function computeDeliveryCharge(
  subtotal: number,
  s: any,
  products: any[],
  destState: string,
): number {
  if (s.freeDeliveryAbove > 0 && subtotal >= s.freeDeliveryAbove) return 0;

  const lines = products.length ? products : [null];
  return lines.reduce(
    (max: number, p: any) => Math.max(max, itemDeliveryCharge(p, destState, s)),
    0,
  );
}

/**
 * GST added on top of the subtotal.
 *
 * When the admin marks prices GST-inclusive the tax is already inside the item
 * prices, so nothing is added - the checkout only shows how much of the total
 * is tax. Returning a figure here in that case double-charged the customer.
 */
function computeGstOnTop(subtotal: number, gst: any): number {
  if (!gst?.enabled || !(gst.rate > 0) || gst.inclusive) return 0;
  return Math.round((subtotal * gst.rate) / 100);
}

function computeSilverPrice(sp: any, ratePerGram: number): number {
  const x = (sp.weightGrams || 0) * ratePerGram;
  const y = x * ((sp.wastagePercent || 0) / 100);
  return Math.ceil(x + y + (sp.makingCharges || 0));
}

/**
 * Does the cart contain anything this coupon applies to?
 *
 * Mirrors the same check in src/services/couponService.ts. An empty or absent
 * list means "everything". Compared case-insensitively because the admin stores
 * category names, not ids.
 *
 * Both lists must be satisfied when both are set: `applicableSubcategories`
 * narrows within `applicableCategories` ("Category One, but only Subcategory 1A"),
 * it does not widen the offer.
 */
function couponCoversCart(coupon: any, products: any[]): boolean {
  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
  const matches = (list: unknown, field: 'category' | 'subcategory') => {
    const allowed = Array.isArray(list) ? list.map(norm) : [];
    if (allowed.length === 0) return true;
    return products.some((p) => allowed.includes(norm(p?.[field])));
  };
  return (
    matches(coupon.applicableCategories, 'category') &&
    matches(coupon.applicableSubcategories, 'subcategory')
  );
}

function couponDiscount(coupon: any, subtotal: number): number {
  if (coupon.type === 'percent') {
    let d = Math.floor((subtotal * coupon.value) / 100);
    if (coupon.maxDiscount > 0) d = Math.min(d, coupon.maxDiscount);
    return d;
  }
  return Math.min(coupon.value, subtotal);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = (req.body || {}) as {
    items?: Array<{ productId?: string; quantity?: unknown }>;
    paymentMethod?: string;
    shippingState?: string;
    couponCode?: string;
    /** Spend available loyalty points (capped by the shop's rules). */
    usePoints?: boolean;
    /** Spend available wallet cashback. */
    useCashback?: boolean;
    /** How the browser priced the cart: dealer prices or regular ones. */
    pricing?: unknown;
    amount?: unknown;
    /** The browser's total before points/cashback, so a cart problem is told apart from a rewards one. */
    amountBeforeRewards?: unknown;
    currency?: unknown;
    receipt?: unknown;
    notes?: Record<string, string>;
  };

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return res.status(400).json({ error: 'items[] is required to price this order' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  // The customer sees `error` in the checkout toast, so it says what to do; the
  // missing variable names go to the server log for the owner.
  if (!keyId || !keySecret) {
    console.error('[create-order] RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured');
    return res.status(503).json({ error: PAYMENTS_UNAVAILABLE });
  }

  if (!PROJECT_ID || !WEB_API_KEY) {
    console.error('[create-order] Firebase project id / web API key are not configured');
    return res.status(503).json({ error: PAYMENTS_UNAVAILABLE });
  }

  // Validate every cart line before spending any network calls on it. A
  // product id is one path segment of the REST read below: a slash or dot
  // segment would reach another document (fetch removes "../" and "%2e%2e/"),
  // e.g. a review the customer wrote, so anything else is refused before any read.
  for (const line of items) {
    const quantity = Number(line.quantity);
    if (typeof line.productId !== 'string' || !SAFE_DOC_ID.test(line.productId)) {
      return res.status(400).json({ error: 'Invalid cart line: unknown product id' });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return res.status(400).json({ error: `Invalid cart line for product ${line.productId}` });
    }
  }

  // ── Who is paying ── (before pricing: an approved dealer pays dealer prices)
  // Sent whenever the customer is signed in. It binds the payment to them
  // (rw_uid), which is what lets an order be recorded as paid and earn points.
  // A failed check is only fatal for rewards and dealer prices: otherwise the
  // customer can still pay, and the order is recorded for a manual check.
  const claimsDealer = body.pricing === 'dealer';
  let uid: string | null = null;
  let uidError: string | null = null;
  try {
    uid = await customerUid(req);
  } catch (error: unknown) {
    uidError = error instanceof Error ? error.message : 'Sign-in check failed';
  }
  if (uidError && claimsDealer) return res.status(503).json({ ...DEALER_UNAVAILABLE, detail: uidError });

  let serverTotal: number;
  let quote: DealerQuote;
  let partnerUse: PartnerCodeUse | null = null;
  // Kept for the rewards step, which prices after the coupon and delivery.
  let parts = {
    subtotal: 0,
    discount: 0,
    deliveryCharge: 0,
    gstAmount: 0,
    gst: { enabled: false, inclusive: false, rate: 0 },
  };
  try {
    // ── Settings (admin-managed documents, never client-supplied) ──
    const [deliveryDoc, gstDoc, silverDoc, dealerDoc] = await Promise.all([
      getDoc('siteSettings/delivery'),
      getDoc('siteSettings/gst'),
      getDoc('siteSettings/silverRate'),
      getDoc('siteSettings/dealer'),
    ]);
    const delivery = normalizeDelivery(deliveryDoc);
    const gst = { ...DEFAULT_GST, ...(gstDoc || {}) };
    const ratePerGram = Number(silverDoc?.manualPricePerGramInr) || 0;

    // ── Subtotal from stored product prices ──
    const products = await Promise.all(
      items.map((line) => getDoc(`products/${encodeURIComponent(String(line.productId))}`)),
    );

    const lines: DealerLine[] = [];
    for (let i = 0; i < items.length; i++) {
      const productId = String(items[i].productId);
      const p = products[i];
      if (!p) {
        return res.status(400).json({ error: `Product ${productId} no longer exists` });
      }
      if (p.flags?.isActive === false) {
        return res.status(400).json({ error: `Product ${productId} is no longer available` });
      }

      // Stock was previously checked only when the order document was written,
      // which happens AFTER this payment is captured. Refusing here means an
      // oversold item costs the customer nothing instead of leaving them
      // charged with no order.
      const stock = Number(p.inventory?.stock ?? 0);
      if (stock < Number(items[i].quantity)) {
        return res.status(400).json({
          error:
            stock <= 0
              ? `${p.name || 'An item in your cart'} is out of stock`
              : `Only ${stock} left in stock for ${p.name || 'an item in your cart'}`,
        });
      }

      const sp = p.silverPricing;
      const unit =
        sp?.enabled && ratePerGram > 0 ? computeSilverPrice(sp, ratePerGram) : Number(p.price);
      if (!Number.isFinite(unit) || unit < 0) {
        return res.status(400).json({ error: `Product ${productId} has no valid price` });
      }
      lines.push({ productId, unit, quantity: Number(items[i].quantity) });
    }

    // ── Dealer prices (approved dealers, programme on, big enough at regular prices) ──
    let dealer: { approved: boolean; pricing: DealerPricing | null } = { approved: false, pricing: null };
    try {
      dealer = await loadDealer(uid, normaliseDealerSettings(dealerDoc as Partial<DealerSettings> | null));
    } catch (error: unknown) {
      if (claimsDealer) {
        return res.status(503).json({ ...DEALER_UNAVAILABLE, detail: error instanceof Error ? error.message : undefined });
      }
      console.warn('[create-order] dealer check failed, pricing at regular prices:', error instanceof Error ? error.message : error);
    }
    quote = dealerQuote(lines, normaliseDealerSettings(dealerDoc as Partial<DealerSettings> | null), dealer.pricing, dealer.approved);
    const refusal = dealerCheck(quote, body);
    if (refusal) return res.status(refusal.status).json(refusal.body);
    const subtotal = quote.subtotal;

    // ── Coupon, re-validated server-side ──
    let discount = 0;
    const code = typeof body.couponCode === 'string' ? body.couponCode.trim().toUpperCase() : '';
    if (code) {
      const resp = await fetch(`${firestoreBase()}:runQuery?key=${WEB_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'coupons' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'code' },
                op: 'EQUAL',
                value: { stringValue: code },
              },
            },
            limit: 1,
          },
        }),
      });
      const rows = resp.ok ? ((await resp.json()) as any[]) : [];
      const found = rows.find((r) => r?.document?.fields);
      const coupon = found ? decodeFields(found.document.fields) : null;
      const now = new Date();
      const usable =
        coupon &&
        coupon.active &&
        (!coupon.validFrom || coupon.validFrom <= now) &&
        (!coupon.validTo || coupon.validTo >= now) &&
        !(coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) &&
        subtotal >= (coupon.minOrderValue || 0) &&
        couponCoversCart(coupon, products);
      if (usable) discount = couponDiscount(coupon, subtotal);
      // Not a store coupon: maybe an academy partner's code (coupons win a clash).
      if (!coupon) {
        try {
          partnerUse = await resolvePartnerCode(code, uid, subtotal);
        } catch (error: unknown) {
          return res.status(503).json({ ...PARTNER_UNAVAILABLE, detail: error instanceof Error ? error.message : undefined });
        }
        if (partnerUse) discount = partnerUse.discount;
      }
    }

    // The destination state comes from the customer's own shipping address, the
    // same value stored on the order document, and only selects a delivery rate.
    const destState = typeof body.shippingState === 'string' ? body.shippingState : '';
    const deliveryCharge = computeDeliveryCharge(subtotal, delivery, products, destState);
    const gstAmount = computeGstOnTop(subtotal, gst);

    parts = {
      subtotal,
      discount,
      deliveryCharge,
      gstAmount,
      gst: { enabled: gst.enabled === true, inclusive: gst.inclusive === true, rate: Number(gst.rate) || 0 },
    };
    serverTotal = Math.max(0, subtotal + deliveryCharge + gstAmount - discount);
  } catch (error: unknown) {
    return res.status(500).json({
      error: 'Could not price this order',
      detail: error instanceof Error ? error.message : 'Unknown pricing error',
    });
  }

  const wantsRewards = body.usePoints === true || body.useCashback === true;
  const conflict = (code: 'rewards_unavailable' | 'rewards_changed', detail?: string) =>
    res.status(409).json({
      code,
      error:
        code === 'rewards_changed'
          ? 'Your points or cashback balance just changed. Check the new total and pay again.'
          : 'Rewards are unavailable right now. Your balance is safe - pay without them or try again shortly.',
      ...(detail ? { detail } : {}),
    });

  // Cross-check the client's figure before rewards. A mismatch means the two
  // pricing paths have diverged (a bug) or someone is tampering - either way,
  // do not take payment.
  const mismatch = (claimed: number, server: number) =>
    Number.isFinite(claimed) && Math.abs(claimed - server) > AMOUNT_TOLERANCE_PAISE;
  const beforeRewardsPaise = Math.round(serverTotal * 100);
  const claimedBefore = Number(body.amountBeforeRewards);
  if (body.amountBeforeRewards != null && mismatch(claimedBefore, beforeRewardsPaise)) {
    return res.status(400).json({
      error: 'Order total mismatch. Please refresh your cart and try again.',
      detail: `client=${claimedBefore} server=${beforeRewardsPaise}`,
    });
  }

  if (uidError) {
    if (wantsRewards) return conflict('rewards_unavailable', uidError);
    console.warn('[create-order] could not verify the customer:', uidError);
  }
  if (wantsRewards && !uid) return conflict('rewards_unavailable', 'Sign in again to use your rewards');

  // ── Loyalty points / wallet cashback (only when the customer opted in) ──
  let redemption: Redemption = { points: 0, pointsValue: 0, cashback: 0, payable: serverTotal };
  if (wantsRewards && uid) {
    try {
      redemption = await priceRewards(uid, {
        subtotal: parts.subtotal,
        couponDiscount: parts.discount,
        deliveryCharge: parts.deliveryCharge,
        gstOnTop: parts.gstAmount,
        usePoints: body.usePoints === true,
        useCashback: body.useCashback === true,
      });
    } catch (error: unknown) {
      return conflict('rewards_unavailable', error instanceof Error ? error.message : undefined);
    }
  }
  const spendsRewards = redemption.points > 0 || redemption.cashback > 0;

  const amountInPaise = Math.round(redemption.payable * 100);
  if (amountInPaise < 100) {
    return res.status(400).json({ error: 'Order total is below the ₹1.00 minimum' });
  }

  // The final figure. With rewards in play a difference here means the
  // browser's view of the balance is out of date, not that the cart is wrong.
  const claimed = Number(body.amount);
  if (mismatch(claimed, amountInPaise)) {
    if (wantsRewards) return conflict('rewards_changed', `client=${claimed} server=${amountInPaise}`);
    return res.status(400).json({
      error: 'Order total mismatch. Please refresh your cart and try again.',
      detail: `client=${claimed} server=${amountInPaise}`,
    });
  }

  // Always rupees: every amount here is in paise, and the payment record
  // (amountPaise) is read as rupees x 100 for points and scratch cards.
  const currency = 'INR';
  const receipt =
    typeof body.receipt === 'string' && body.receipt ? body.receipt.slice(0, 40) : `rcpt_${Date.now()}`;

  // The server's facts about this payment. Only this function writes rw_* notes;
  // verify-payment copies them into payments/<razorpay order id>.
  const base = quote.applies
    ? 0
    : earnBase({
        subtotal: parts.subtotal,
        couponDiscount: parts.discount,
        pointsValue: redemption.pointsValue,
        cashback: redemption.cashback,
        gstEnabled: parts.gst.enabled,
        gstInclusive: parts.gst.inclusive,
        gstRate: parts.gst.rate,
      });
  const notes: Record<string, string> = {
    ...clientNotes(body.notes),
    rw_base: String(base),
    rw_sub: String(parts.subtotal),
    rw_cart: createHash('sha256').update(cartKey(items)).digest('hex'),
    ...(uid ? { rw_uid: uid } : {}),
    ...(quote.applies ? { rw_dealer: '1', rw_regular: String(quote.regularSubtotal) } : {}),
    ...(spendsRewards
      ? {
          rw_points: String(redemption.points),
          rw_pv: String(redemption.pointsValue),
          rw_cashback: String(redemption.cashback),
        }
      : {}),
    ...(partnerUse ? { rw_partner: partnerNote(partnerUse, parts.subtotal, redemption, items) } : {}),
  };

  let orderId: string;
  let orderAmount: number | undefined;
  let orderCurrency: string | undefined;
  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const resp = await fetch(`${RAZORPAY_API_BASE}/orders`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountInPaise, currency, receipt, notes }),
    });

    const data = (await resp.json().catch(() => ({}))) as {
      id?: string;
      amount?: number;
      currency?: string;
      error?: { description?: string };
    };

    if (!resp.ok || !data.id) {
      const detail = data?.error?.description || `Razorpay API error (HTTP ${resp.status})`;
      if (resp.status === 401) {
        return res.status(401).json({ error: 'Razorpay authentication failed', detail });
      }
      return res.status(500).json({ error: 'Failed to create Razorpay order', detail });
    }
    orderId = data.id;
    orderAmount = data.amount;
    orderCurrency = data.currency;
  } catch (error: unknown) {
    return res.status(500).json({
      error: 'Failed to create Razorpay order',
      detail: error instanceof Error ? error.message : 'Unknown Razorpay error',
    });
  }

  // ── Reserve what this payment spends ──
  // Until this succeeds the browser has no order id, so an order that loses
  // the race (or times out) can never be paid; Razorpay lets it lapse.
  if (spendsRewards && uid) {
    try {
      const reserved = await reserveRewards(uid, orderId, {
        points: redemption.points,
        cashback: redemption.cashback,
      });
      if (!reserved) return conflict('rewards_changed');
    } catch (error: unknown) {
      return conflict('rewards_unavailable', error instanceof Error ? error.message : undefined);
    }
  }

  return res.status(200).json({
    order_id: orderId,
    amount: orderAmount,
    currency: orderCurrency,
    key_id: keyId,
    pointsApplied: redemption.points,
    pointsValue: redemption.pointsValue,
    cashbackApplied: redemption.cashback,
  });
}
