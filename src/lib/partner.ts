/**
 * Academy partner programme (docs/specs/academy-dealership-programme.md).
 * Pure and dependency-free.
 *
 * The block between the partner-core markers is the money logic. It is
 * copied verbatim into api/create-order.ts and api/notify-order.ts
 * (npm run sync:rewards); tests/rewards-parity.test.ts fails if a copy
 * drifts. Everything below the block is for the screens only.
 */

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

export type { PartnerTier, PartnerMoneySettings, PartnerEarningLike, PartnerTotals, PerkId, PerkRule, PartnerView };
export {
  DEFAULT_PARTNER_MONEY,
  normalisePartnerMoney,
  partnerTierFor,
  partnerRate,
  partnerCommission,
  partnerDiscountPercent,
  partnerDiscount,
  partnerSalesValue,
  partnerMonthKey,
  partnerTotals,
  partnerUnlocked,
  partnerFieldsFromNote,
  DEFAULT_PERK_RULES,
  DEFAULT_SILVER_STEP,
  silverGrams,
  partnerView,
};

// ─── Screens only ──────────────────────────────────────────────────────────

/** Codes: 4 to 16 letters and digits, upper case. */
export const PARTNER_CODE_RE = /^[A-Z0-9]{4,16}$/;

export const cleanPartnerCode = (raw: unknown) => String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * The partner's code: the first 4 letters of the name (A–Z, padded with X)
 * and the last 4 digits of the phone (padded with 0). "Ravi Kumar",
 * "90000 13210" → RAVI3210.
 */
export function partnerCodeFor(name: string, phone: string): string {
  const letters = String(name || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4).padEnd(4, 'X');
  const digits = String(phone || '').replace(/\D/g, '').slice(-4).padStart(4, '0');
  return letters + digits;
}

/** Candidates when the code is taken: RAVI3210, RAVI32102, RAVI32103, … */
export const partnerCodeCandidate = (base: string, attempt: number) => (attempt <= 0 ? base : `${base}${attempt + 1}`);


/** How a perk is claimed: once, a counted number of times, or once per calendar month. */
export type PerkKind = 'once' | 'count' | 'monthly';

export interface PerkDef {
  id: PerkId;
  title: string;
  body: string;
  kind: PerkKind;
  /** Where the perk shows: Business support, or the My claims tab. */
  tab: 'support' | 'claims';
  /** Label of the button. */
  action: string;
  /** Count perks only: name the next one in the button ("Redeem class 2 of 6"). Passes are interchangeable, so they don't. */
  numbered?: boolean;
}

export const PERKS: PerkDef[] = [
  { id: 'catalogue', title: 'Digital catalogue', body: 'The full range as a catalogue to share with your students and parents.', kind: 'once', tab: 'support', action: 'Redeem' },
  { id: 'photos', title: 'Product photographs', body: 'Photos of the range for your posts and notice board.', kind: 'once', tab: 'support', action: 'Redeem' },
  { id: 'pamphlets', title: 'Pamphlets', body: 'Printed pamphlets with your partner code.', kind: 'once', tab: 'support', action: 'Redeem' },
  { id: 'masterclass', title: 'Masterclasses', body: 'Six masterclasses for you and your students. [NEED: masterclass names]', kind: 'count', tab: 'support', action: 'Redeem class', numbered: true },
  { id: 'passGroup', title: 'Competition passes: group', body: 'National competitions and stage performance passes for groups.', kind: 'count', tab: 'support', action: 'Redeem a pass' },
  { id: 'passSolo', title: 'Competition passes: solo', body: 'National competitions and stage performance passes for solo performers.', kind: 'count', tab: 'support', action: 'Redeem a pass' },
  { id: 'promoTeam', title: 'Promotion team', body: 'One interview, four videos and four posters each month.', kind: 'monthly', tab: 'support', action: 'Request this month' },
  { id: 'onlinePromo', title: 'Online promotion', body: 'We promote your outlet and your code online.', kind: 'once', tab: 'support', action: 'Redeem' },
  { id: 'standee', title: 'Product standee', body: 'A standee for your academy or outlet.', kind: 'once', tab: 'support', action: 'Redeem' },
  { id: 'uniforms', title: 'Uniforms', body: 'Uniforms for your academy.', kind: 'once', tab: 'support', action: 'Redeem' },
  { id: 'trip', title: 'International trip', body: 'A trip to an Asian country. [NEED: the trip terms]', kind: 'once', tab: 'claims', action: 'Claim: I am eligible' },
];




export interface PartnerSettings extends PartnerMoneySettings {
  perks: Record<PerkId, PerkRule>;
  /** Rupees of lifetime sales per 1 g silver coin. */
  silverStep: number;
}

export const DEFAULT_PARTNER_SETTINGS: PartnerSettings = {
  ...DEFAULT_PARTNER_MONEY,
  perks: DEFAULT_PERK_RULES,
  silverStep: DEFAULT_SILVER_STEP,
};

export function normalisePartnerSettings(raw: Partial<PartnerSettings> | null | undefined): PartnerSettings {
  const perks = {} as Record<PerkId, PerkRule>;
  const src = raw?.perks && typeof raw.perks === 'object' ? (raw.perks as Record<string, Partial<PerkRule>>) : {};
  for (const p of PERKS) {
    const d = DEFAULT_PERK_RULES[p.id];
    const r = src[p.id] || {};
    perks[p.id] = {
      unlockAt: Math.round(partnerNum(r.unlockAt, d.unlockAt, 0, 1_000_000_000)),
      count: p.kind === 'count' ? Math.round(partnerNum(r.count, d.count, 1, 100)) : 1,
    };
  }
  return {
    ...normalisePartnerMoney(raw),
    perks,
    silverStep: Math.round(partnerNum(raw?.silverStep, DEFAULT_SILVER_STEP, 100, 10_000_000)),
  };
}


export interface ClaimLike {
  id: string;
  perk: PerkId | 'silver';
  index?: number;
  month?: string;
  from?: number;
  to?: number;
  status: 'requested' | 'fulfilled';
  createdAtMs?: number;
}

/**
 * Whether a claim is still covered by the partner's unlocked sales (sales past
 * their return window): a perk needs its unlockAt, silver needs to × silverStep.
 * The rules check this when the claim is made; a return afterwards can take
 * the partner back under it, so the admin queue checks again before fulfilling.
 */
export function claimQualifies(
  c: Pick<ClaimLike, 'perk' | 'to'>,
  unlockedSales: number,
  s: Pick<PartnerSettings, 'perks' | 'silverStep'>,
): { ok: boolean; needs: number } {
  const needs = c.perk === 'silver' ? (Number(c.to) || 0) * s.silverStep : s.perks[c.perk]?.unlockAt ?? 0;
  return { ok: (Number(unlockedSales) || 0) >= needs, needs };
}

/** The document id of a claim. Deterministic, so the same claim can't be made twice. */
export function claimId(perk: PerkId, opts: { index?: number; month?: string } = {}): string {
  const def = PERKS.find((p) => p.id === perk);
  if (def?.kind === 'count') return `${perk}_${opts.index}`;
  if (def?.kind === 'monthly') return `${perk}_${opts.month}`;
  return perk;
}

export interface PerkState {
  def: PerkDef;
  rule: PerkRule;
  unlocked: boolean;
  /** Claims made (any status). For monthly perks: this month's (0 or 1). */
  used: number;
  /** Claims available now. */
  left: number;
  /** The next index to claim for counted perks. */
  nextIndex: number | null;
  fulfilled: number;
}

/** Each perk's state for the screens, from the unlocked perks the server wrote on partners/<uid>. */
export function perkStates(perksUnlocked: readonly string[], s: PartnerSettings, claims: ClaimLike[], nowMs: number): PerkState[] {
  const month = partnerMonthKey(nowMs);
  return PERKS.map((def) => {
    const rule = s.perks[def.id];
    const unlocked = perksUnlocked.includes(def.id);
    const mine = claims.filter((c) => c.perk === def.id);
    const scoped = def.kind === 'monthly' ? mine.filter((c) => c.month === month) : mine;
    const total = def.kind === 'count' ? rule.count : 1;
    const used = Math.min(total, scoped.length);
    const taken = new Set(mine.map((c) => c.index));
    let nextIndex: number | null = null;
    if (def.kind === 'count') {
      for (let i = 1; i <= rule.count; i++) if (!taken.has(i)) { nextIndex = i; break; }
    }
    return {
      def,
      rule,
      unlocked,
      used,
      left: unlocked ? Math.max(0, total - used) : 0,
      nextIndex,
      fulfilled: scoped.filter((c) => c.status === 'fulfilled').length,
    };
  });
}

/** Silver coins: earned to date, claimed (the chain of silver claims), and waiting to be claimed. */
export function silverPot(silverGramsEarned: number, claims: ClaimLike[]) {
  const earned = Math.max(0, Math.floor(Number(silverGramsEarned) || 0));
  const chain = claims.filter((c) => c.perk === 'silver');
  const claimed = chain.reduce((m, c) => Math.max(m, Number(c.to) || 0), 0);
  const last = chain.find((c) => (Number(c.to) || 0) === claimed) || null;
  return { earned, claimed, unclaimed: Math.max(0, earned - claimed), lastFrom: last ? Number(last.from) || 0 : null };
}

export interface PayoutLike {
  id: string;
  amount: number;
  receivedAtMs?: number;
}

export interface EarningRow extends PartnerEarningLike {
  id: string;
  rate: number;
  month: string;
  unlockAtMs: number;
}

/** Unlocked earnings: active and past the hold. */
export const unlockedEarnings = (rows: EarningRow[], nowMs: number) =>
  partnerMoney(rows.reduce((t, r) => (r.state === 'active' && r.unlockAtMs <= nowMs ? t + (Number(r.amount) || 0) : t), 0));

/** Payouts the partner confirmed as received. */
export const receivedTotal = (payouts: PayoutLike[]) =>
  partnerMoney(payouts.reduce((t, p) => (p.receivedAtMs ? t + (Number(p.amount) || 0) : t), 0));

/** Total to be settled = unlocked earnings − payouts confirmed received (never below 0). */
export const settledAmount = (rows: EarningRow[], payouts: PayoutLike[], nowMs: number) =>
  Math.max(0, partnerMoney(unlockedEarnings(rows, nowMs) - receivedTotal(payouts)));

/** Earnings per month (not void), newest month first. */
export function earningsByMonth(rows: EarningRow[]): { month: string; amount: number; units: number }[] {
  const by = new Map<string, { amount: number; units: number }>();
  for (const r of rows) {
    if (r.state === 'void' || r.family) continue;
    const m = by.get(r.month) || { amount: 0, units: 0 };
    m.amount += Number(r.amount) || 0;
    m.units += Math.max(0, Math.floor(Number(r.units) || 0));
    by.set(r.month, m);
  }
  return [...by.entries()]
    .map(([month, v]) => ({ month, amount: partnerMoney(v.amount), units: v.units }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));
}

/** "2026-11" → "November 2026". */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
