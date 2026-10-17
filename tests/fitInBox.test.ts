import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitInBox } from '../src/lib/fitInBox.ts';

test('a wide image is limited by the box width and centred up and down', () => {
  const r = fitInBox(900, 226, 55, 16);
  assert.ok(Math.abs(r.width - 55) < 1e-9);
  assert.ok(Math.abs(r.width / r.height - 900 / 226) < 1e-9, 'keeps its own proportions');
  assert.ok(Math.abs(r.offsetY - (16 - r.height) / 2) < 1e-9);
});

test('a tall image is limited by the box height', () => {
  const r = fitInBox(100, 400, 55, 16);
  assert.equal(r.height, 16);
  assert.equal(r.width, 4);
  assert.equal(r.offsetY, 0);
});

test('an image of the box shape fills it exactly', () => {
  assert.deepEqual(fitInBox(110, 32, 55, 16), { width: 55, height: 16, offsetY: 0 });
});
