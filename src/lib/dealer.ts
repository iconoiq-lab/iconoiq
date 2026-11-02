/**
 * Dealer prices, shared by the storefront and api/create-order.ts. Pure and
 * dependency-free.
 *
 * The block between the dealer-core markers is copied verbatim into
 * api/create-order.ts (npm run sync:rewards). tests/rewards-parity.test.ts
 * fails if the copy drifts.
 */

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

export type { DealerTier, DealerSettings, DealerPricing, DealerLine, DealerQuote };
export {
  DEFAULT_DEALER_SETTINGS,
  DEFAULT_DEALER_PRICING,
  DEFAULT_DEALER_TIERS,
  normaliseDealerTiers,
  normaliseDealerSettings,
  normaliseDealerPricing,
  dealerTierFor,
  dealerUnitPrice,
  dealerQuote,
};
