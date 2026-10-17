import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridLayout } from '../scripts/lib/sheetLayout.mjs';

test('cells fill rows left to right; a row is as tall as its tallest cell', () => {
  const r = gridLayout([100, 300, 50, 80], { cols: 3, cellWidth: 200, gap: 10 });
  assert.deepEqual(r.places, [
    { left: 10, top: 10 }, { left: 220, top: 10 }, { left: 430, top: 10 },
    { left: 10, top: 320 },
  ]);
  assert.equal(r.width, 10 + 3 * 210);
  assert.equal(r.height, 10 + 300 + 10 + 80 + 10);
});

test('fewer images than columns make a narrower sheet, with no empty column', () => {
  const r = gridLayout([120, 90], { cols: 3, cellWidth: 200, gap: 10 });
  assert.equal(r.width, 10 + 2 * 210);
  assert.equal(r.height, 10 + 120 + 10);
});
