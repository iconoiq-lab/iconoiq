import { describe, it, expect } from 'vitest';
import { computeTotals, partnerAmount, periodFor, totalSharePercent, type LedgerEntry, type OrderLike } from '../src/lib/partnerShares';

const all = { from: null, to: null };

describe('business partner shares', () => {
  const orders: OrderLike[] = [
    { total: 1000, status: 'delivered', paymentStatus: 'paid', date: '2026-11-02' },
    { total: 500, status: 'pending', paymentStatus: 'paid', pricing: 'dealer', date: '2026-11-03' },
    { total: 900, status: 'cancelled', paymentStatus: 'paid', date: '2026-11-04' },
    { total: 700, status: 'pending', paymentStatus: 'pending', date: '2026-11-05' },
    { total: 300, status: 'refunded', paymentStatus: 'refunded', date: '2026-11-05' },
  ];
  const entries: LedgerEntry[] = [
    { id: 'a', kind: 'income', source: 'dealers', amount: 2000, date: '2026-11-06' },
    { id: 'b', kind: 'income', source: 'other', amount: 50000, date: '2026-11-06' },
    { id: 'c', kind: 'expense', category: 'Rent', amount: 1500, date: '2026-11-07' },
    { id: 'd', kind: 'expense', category: 'Ads', amount: 400, date: '2026-10-07' },
  ];

  it('shares only paid store and dealer sales, minus expenses', () => {
    const t = computeTotals(orders, entries, all);
    expect(t.storeSales).toBe(1000);
    expect(t.dealerSales).toBe(2500);
    expect(t.otherIncome).toBe(50000);
    expect(t.expenses).toBe(1900);
    expect(t.profit).toBe(1600);
  });

  it('filters by period', () => {
    const t = computeTotals(orders, entries, { from: '2026-11-01', to: '2026-11-30' });
    expect(t.expenses).toBe(1500);
    expect(t.profit).toBe(2000);
  });

  it('splits by share percent', () => {
    expect(partnerAmount(2000, 60)).toBe(1200);
    expect(partnerAmount(-1000, 25)).toBe(-250);
    expect(totalSharePercent([{ sharePercent: 60 }, { sharePercent: 40 }])).toBe(100);
  });

  it('uses the Indian financial year', () => {
    expect(periodFor('thisYear', new Date(2026, 10, 17))).toEqual({ from: '2026-04-01', to: '2027-03-31' });
    expect(periodFor('thisYear', new Date(2027, 1, 1))).toEqual({ from: '2026-04-01', to: '2027-03-31' });
    expect(periodFor('lastMonth', new Date(2026, 0, 15))).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });
});
