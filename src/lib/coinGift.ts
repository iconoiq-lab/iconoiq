/**
 * Lakshmi coin gift (client brief, 2026-11-05 voice notes): every paid order
 * whose goods come to the minimum or more (before any coupon) ships with a
 * printed coin card. The customer's coin orders 1-3 get a silver coin, every
 * 4th a gold one. After paying, the customer scratches a card on screen to
 * see which coin is on its way. Spec: docs/specs/lakshmi-coin-gift.md.
 *
 * The block between the coin-core markers is copied verbatim into
 * api/notify-order.ts by `npm run sync:rewards`; tests/rewards-parity.test.ts
 * fails if it drifts. Pure and dependency-free.
 */

// >>> coin-core
type CoinType = 'silver' | 'gold';

interface CoinGiftSettings {
  enabled: boolean;
  /** Rupees of goods (cart value before coupons, delivery and rewards) at or above which an order gets a coin. */
  minOrder: number;
  /** Every Nth coin order is gold (4: orders 4, 8, 12 ...). */
  goldEvery: number;
}

const DEFAULT_COIN_SETTINGS: CoinGiftSettings = { enabled: false, minOrder: 3500, goldEvery: 4 };

function normaliseCoinSettings(raw: Partial<CoinGiftSettings> | null | undefined): CoinGiftSettings {
  const whole = (v: unknown, fallback: number, min: number, max: number) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;
  };
  const d = DEFAULT_COIN_SETTINGS;
  return {
    enabled: raw?.enabled === true,
    minOrder: whole(raw?.minOrder, d.minOrder, 0, 10_000_000),
    goldEvery: whole(raw?.goldEvery, d.goldEvery, 1, 100),
  };
}

/** The coin for place `seq` (1-based) in the customer's current run of coins; the run ends with a gold one. */
function coinTypeFor(seq: number, s: CoinGiftSettings): CoinType {
  return seq >= s.goldEvery ? 'gold' : 'silver';
}

/** One of the customer's other coins that is still active. */
interface CoinSeen {
  type: CoinType;
  /** When it was decided, ms. */
  decidedAtMs: number;
}

/**
 * The next coin's place in the customer's current run: one more than the
 * active coins decided since their latest active gold. A cancelled coin drops
 * out, so cancelling an earlier order can never give two golds in a row.
 */
function nextRunPlace(others: CoinSeen[]): number {
  const lastGold = others.reduce((t, c) => (c.type === 'gold' ? Math.max(t, c.decidedAtMs) : t), -Infinity);
  return others.filter((c) => c.decidedAtMs > lastGold).length + 1;
}

interface CoinGiftRecord {
  type: CoinType;
  /** Its place in the customer's run of coins (1-based; gold ends the run). */
  seq: number;
  status: 'active' | 'void';
  voidedBy?: string;
}

interface CoinPlanInput {
  settings: CoinGiftSettings;
  /** The payment's existing gift, if one was given. */
  gift: CoinGiftRecord | null;
  /** Rupees of goods before coupons (payments.subtotal). */
  goodsRupees: number;
  /** A dealer-priced order. */
  dealer: boolean;
  /** Cancelled, returned or refunded. */
  ended: boolean;
  /** payments.verifiedAt in ms (0 when unknown). */
  paidAtMs: number;
  /** When the switch was last turned on (siteSettings/coinGift.enabledAt), 0 when unknown. */
  enabledAtMs: number;
  /** The customer's other coin gifts that are still active. */
  others: CoinSeen[];
}

type CoinPlan =
  | { action: 'create'; type: CoinType; seq: number }
  | { action: 'void' }
  | { action: 'restore' }
  | { action: 'none' };

/**
 * What reconcile does with an order's coin. A coin is decided once and never
 * changes type (the card may already be packed); it is voided when the order
 * ends, so it no longer counts towards the next gold, and restored if the shop
 * reopens the order. A coin voided by the shop by hand is left alone.
 */
function planCoinGift(i: CoinPlanInput): CoinPlan {
  const g = i.gift;
  if (g) {
    if (g.status === 'active' && i.ended) return { action: 'void' };
    if (g.status === 'void' && g.voidedBy === 'server' && !i.ended) return { action: 'restore' };
    return { action: 'none' };
  }
  if (!i.settings.enabled || i.ended || i.dealer) return { action: 'none' };
  if (!(i.goodsRupees >= i.settings.minOrder)) return { action: 'none' };
  // No coins for orders paid while the switch was off (deviceless server times: a minute's slack).
  if (i.paidAtMs > 0 && i.paidAtMs < i.enabledAtMs - 60_000) return { action: 'none' };
  const seq = nextRunPlace(i.others);
  return { action: 'create', type: coinTypeFor(seq, i.settings), seq };
}
// <<< coin-core

/** The coin as the order pages show it (order.coinGift, written by the server). */
interface OrderCoinGift {
  type: CoinType;
  seq: number;
  status: 'active' | 'void';
  revealed: boolean;
}

function readOrderCoinGift(raw: unknown): OrderCoinGift | null {
  const g = (raw || null) as Record<string, unknown> | null;
  if (!g || (g.type !== 'silver' && g.type !== 'gold')) return null;
  return {
    type: g.type,
    seq: Math.max(1, Math.floor(Number(g.seq) || 1)),
    status: g.status === 'void' ? 'void' : 'active',
    revealed: g.revealedAt != null,
  };
}

const coinName = (t: CoinType) => (t === 'gold' ? 'Gold Lakshmi coin' : 'Silver Lakshmi coin');

/** Coin orders still to go before the next gold one, counting this one as done (0 = this was gold). */
function ordersToGold(seq: number, goldEvery: number): number {
  const every = Math.max(1, Math.floor(goldEvery) || 4);
  return Math.max(0, every - seq);
}

export type { CoinType, CoinGiftSettings, CoinGiftRecord, CoinSeen, CoinPlanInput, CoinPlan, OrderCoinGift };
export {
  DEFAULT_COIN_SETTINGS,
  normaliseCoinSettings,
  coinTypeFor,
  nextRunPlace,
  planCoinGift,
  readOrderCoinGift,
  coinName,
  ordersToGold,
};
