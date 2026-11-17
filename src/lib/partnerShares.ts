/**
 * Business partners (the owners of ICONOIQ) and how the profit is split.
 *
 * Only store sales and dealer sales are shared. "Other" income (a loan, money
 * a partner puts in) is shown but never split. Profit to share =
 * store sales + dealer sales - expenses; each partner gets their share % of it.
 */

export type IncomeSource = 'sales' | 'dealers' | 'other';
export type LedgerKind = 'income' | 'expense';

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  /** Income only. */
  source?: IncomeSource;
  /** Expense only: rent, salary, stock, ads... */
  category?: string;
  amount: number;
  /** yyyy-mm-dd */
  date: string;
  note?: string;
}

export interface BusinessPartner {
  id: string;
  name: string;
  phone?: string;
  role?: string;
  photoUrl?: string;
  sharePercent: number;
}

/** A paid order, cut down to what the split needs. */
export interface OrderLike {
  total: number;
  status: string;
  paymentStatus?: string;
  pricing?: 'dealer';
  /** yyyy-mm-dd */
  date: string;
}

/** Orders that never brought money in, or gave it back. */
const NOT_INCOME = new Set(['cancelled', 'returned', 'refunded', 'deliveryFailed']);

export interface Period {
  /** yyyy-mm-dd, inclusive; null = no limit */
  from: string | null;
  to: string | null;
}

export const inPeriod = (date: string, p: Period) =>
  (!p.from || date >= p.from) && (!p.to || date <= p.to);

export interface Totals {
  storeSales: number;
  dealerSales: number;
  otherIncome: number;
  expenses: number;
  /** store + dealer - expenses */
  profit: number;
  storeOrders: number;
  dealerOrders: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeTotals(orders: OrderLike[], entries: LedgerEntry[], period: Period): Totals {
  let storeSales = 0, dealerSales = 0, otherIncome = 0, expenses = 0, storeOrders = 0, dealerOrders = 0;
  for (const o of orders) {
    if (o.paymentStatus !== 'paid' || NOT_INCOME.has(o.status) || !inPeriod(o.date, period)) continue;
    const t = Number(o.total) || 0;
    if (o.pricing === 'dealer') { dealerSales += t; dealerOrders++; } else { storeSales += t; storeOrders++; }
  }
  for (const e of entries) {
    if (!inPeriod(e.date, period)) continue;
    const a = Number(e.amount) || 0;
    if (e.kind === 'expense') expenses += a;
    else if (e.source === 'dealers') dealerSales += a;
    else if (e.source === 'other') otherIncome += a;
    else storeSales += a;
  }
  return {
    storeSales: round2(storeSales),
    dealerSales: round2(dealerSales),
    otherIncome: round2(otherIncome),
    expenses: round2(expenses),
    profit: round2(storeSales + dealerSales - expenses),
    storeOrders,
    dealerOrders,
  };
}

export const totalSharePercent = (partners: Pick<BusinessPartner, 'sharePercent'>[]) =>
  round2(partners.reduce((s, p) => s + (Number(p.sharePercent) || 0), 0));

/** Each partner's part of the profit. A loss is split the same way (negative). */
export const partnerAmount = (profit: number, sharePercent: number) =>
  round2((profit * (Number(sharePercent) || 0)) / 100);

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export type PeriodKey = 'thisMonth' | 'lastMonth' | 'thisYear' | 'all';

export function periodFor(key: PeriodKey, now = new Date()): Period {
  const y = now.getFullYear(), m = now.getMonth();
  if (key === 'thisMonth') return { from: isoDate(new Date(y, m, 1)), to: isoDate(new Date(y, m + 1, 0)) };
  if (key === 'lastMonth') return { from: isoDate(new Date(y, m - 1, 1)), to: isoDate(new Date(y, m, 0)) };
  // Indian financial year: 1 April to 31 March.
  if (key === 'thisYear') {
    const start = m >= 3 ? y : y - 1;
    return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
  }
  return { from: null, to: null };
}
