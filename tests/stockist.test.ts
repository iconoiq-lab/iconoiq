import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthSalesValue, restockState, salesNewestFirst, stockLeft, stockRows, type StockSale } from '../src/lib/stockist.ts';

const NOW = Date.UTC(2026, 10, 15, 6, 0, 0);
const bought = [
  { productId: 'a', name: 'Kolam kit', quantity: 10, regularPrice: 500 },
  { productId: 'b', name: 'Tanjore set', quantity: 5, regularPrice: 1200 },
  { productId: 'a', name: 'Kolam kit', quantity: 10, regularPrice: 550 },
];
const sale = (id: string, productId: string, qty: number, atMs: number, unitPrice = 500): StockSale => ({ id, productId, qty, unitPrice, atMs });

test('stock left per product = bought in delivered dealer orders − logged sales', () => {
  const rows = stockRows(bought, [sale('1', 'a', 3, NOW), sale('2', 'a', 2, NOW), sale('3', 'b', 9, NOW), sale('4', 'zzz', 4, NOW)]);
  assert.deepEqual(rows.map((r) => [r.productId, r.bought, r.sold, r.left, r.regularPrice]), [
    ['a', 20, 5, 15, 550],
    ['b', 5, 9, 0, 1200],
  ]);
  assert.equal(stockLeft(rows, 'a'), 15);
  assert.equal(stockLeft(rows, 'b'), 0, 'never below zero');
  assert.equal(stockLeft(rows, 'nope'), 0);
});

test('restock alert at 40% of all purchased units sold', () => {
  assert.deepEqual(restockState(stockRows(bought, [])), { bought: 25, sold: 0, share: 0, alert: false });
  assert.equal(restockState(stockRows(bought, [sale('1', 'a', 9, NOW)])).alert, false, '9/25 = 36%');
  const at = restockState(stockRows(bought, [sale('1', 'a', 10, NOW)]));
  assert.equal(at.share, 0.4);
  assert.equal(at.alert, true, 'exactly 40% alerts');
  assert.equal(restockState(stockRows(bought, [sale('1', 'b', 50, NOW)])).sold, 5, 'oversold lines count only what was bought');
  assert.equal(restockState([]).alert, false, 'nothing bought, no alert');
});

test("this month's sales value (units × regular price) in India time; history newest first", () => {
  const sales = [
    sale('old', 'a', 4, Date.UTC(2026, 9, 31, 18, 29), 500), // 31 Oct 23:59 IST
    sale('new', 'a', 2, Date.UTC(2026, 9, 31, 18, 30), 500), // 1 Nov 00:00 IST
    sale('b', 'b', 1, NOW, 1200),
  ];
  assert.deepEqual(monthSalesValue(sales, NOW), { value: 2200, units: 3 });
  assert.deepEqual(salesNewestFirst(sales).map((s) => s.id), ['b', 'new', 'old']);
});
