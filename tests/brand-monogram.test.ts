import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandMonogram } from '../src/lib/brandMonogram.ts';

test('two or more words: first letters of the first two words', () => {
  assert.equal(brandMonogram('Demo Store'), 'DS');
  assert.equal(brandMonogram('  north  star   goods '), 'NS');
});

test('one word: its first letter', () => {
  assert.equal(brandMonogram('Acme'), 'A');
});

test('ignores leading punctuation and falls back to S when nothing usable', () => {
  assert.equal(brandMonogram('"The Shop"'), 'TS');
  assert.equal(brandMonogram(''), 'S');
  assert.equal(brandMonogram('   '), 'S');
});
