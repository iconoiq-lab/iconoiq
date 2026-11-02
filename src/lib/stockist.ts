/**
 * Stockist inventory (docs/specs/academy-dealership-programme.md, decision 10).
 * Pure: purchased stock = the items of the stockist's delivered dealer
 * orders; sold = the sales the stockist logs on their page.
 */
import { partnerMonthKey } from './partner.ts';

export interface StockPurchaseLine {
  productId: string;
  name: string;
  quantity: number;
  /** Regular unit price (rupees), for the sales value. */
  regularPrice: number;
}

export interface StockSale {
  id: string;
  productId: string;
  qty: number;
  /** The regular unit price when the sale was logged (rupees). */
  unitPrice: number;
  atMs: number;
}

export interface StockRow {
  productId: string;
  name: string;
  bought: number;
  sold: number;
  left: number;
  regularPrice: number;
}

/** The share of all purchased units sold that raises the restock alert. */
export const RESTOCK_SHARE = 0.4;

const units = (n: unknown) => Math.max(0, Math.floor(Number(n) || 0));

/** Stock per product, bought − sold (never below 0), in the order first bought. */
export function stockRows(purchases: StockPurchaseLine[], sales: StockSale[]): StockRow[] {
  const by = new Map<string, StockRow>();
  for (const p of purchases) {
    if (!p.productId) continue;
    const r = by.get(p.productId) || { productId: p.productId, name: p.name, bought: 0, sold: 0, left: 0, regularPrice: 0 };
    r.bought += units(p.quantity);
    if (Number(p.regularPrice) > 0) r.regularPrice = Number(p.regularPrice);
    if (!r.name && p.name) r.name = p.name;
    by.set(p.productId, r);
  }
  for (const s of sales) {
    const r = by.get(s.productId);
    if (r) r.sold += units(s.qty);
  }
  return [...by.values()].map((r) => ({ ...r, left: Math.max(0, r.bought - r.sold) }));
}

/** Units that can still be logged as sold for a product. */
export const stockLeft = (rows: StockRow[], productId: string) => rows.find((r) => r.productId === productId)?.left ?? 0;

/** The share of purchased units sold (0–1), and whether the restock alert shows (40% or more). */
export function restockState(rows: StockRow[]): { bought: number; sold: number; share: number; alert: boolean } {
  let bought = 0;
  let sold = 0;
  for (const r of rows) {
    bought += r.bought;
    sold += Math.min(r.sold, r.bought);
  }
  const share = bought > 0 ? sold / bought : 0;
  return { bought, sold, share, alert: bought > 0 && share >= RESTOCK_SHARE };
}

/** Sales value of a month (units × regular price), in India's calendar. */
export function monthSalesValue(sales: StockSale[], nowMs: number): { value: number; units: number } {
  const month = partnerMonthKey(nowMs);
  let value = 0;
  let n = 0;
  for (const s of sales) {
    if (partnerMonthKey(s.atMs) !== month) continue;
    value += units(s.qty) * (Number(s.unitPrice) || 0);
    n += units(s.qty);
  }
  return { value: Math.round(value * 100) / 100, units: n };
}

/** Sale history, newest first. */
export const salesNewestFirst = (sales: StockSale[]) => [...sales].sort((a, b) => b.atMs - a.atMs);
