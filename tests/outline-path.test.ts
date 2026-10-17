import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathData } from '../scripts/lib/outlinePath.mjs';

// opentype.js 2.0.0's Path.toPathData() wrote "NaN" for some points, which draws a broken glyph.
// make-wordmark.mjs serialises the outline commands itself and refuses a bad point.
const commands = [
  { type: 'M', x: 0, y: 0 },
  { type: 'L', x: 10.123, y: 5 },
  { type: 'Q', x1: 1, y1: 2, x: 3, y: 4 },
  { type: 'C', x1: 1.006, y1: 2, x2: 3, y2: 4, x: 5, y: 6.999 },
  { type: 'Z' },
];

test('pathData writes each command with its points, rounded to two decimals', () => {
  assert.equal(pathData({ commands }), 'M0 0L10.12 5Q1 2 3 4C1.01 2 3 4 5 7Z');
});

test('pathData throws on a point that is not a finite number instead of writing NaN', () => {
  for (const bad of [NaN, Infinity, undefined]) {
    assert.throws(() => pathData({ commands: [{ type: 'M', x: 0, y: 0 }, { type: 'L', x: bad, y: 1 }] }), /not a number/);
  }
});
