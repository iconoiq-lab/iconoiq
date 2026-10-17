import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tallStickyTop } from '../src/lib/stickyTop.ts';

test('tallStickyTop leaves the default offset until the column is measured', () => {
  assert.equal(tallStickyTop(0), undefined);
  assert.equal(tallStickyTop(-5), undefined);
});

test('tallStickyTop is the header offset or, for a tall column, the point where its bottom is in view', () => {
  assert.equal(tallStickyTop(700), 'min(var(--sticky-top), calc(100vh - 700px - 16px))');
  assert.equal(tallStickyTop(1234.2), 'min(var(--sticky-top), calc(100vh - 1235px - 16px))');
});
