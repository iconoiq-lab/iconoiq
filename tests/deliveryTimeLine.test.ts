import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deliveryTimeLine } from '../src/lib/deliveryTimeLine.ts';

test('the shipping policy delivery-time line uses the store\'s estimated days', () => {
  assert.equal(deliveryTimeLine('4-7 days'), 'Estimated delivery time is 4-7 days, depending on location.');
  assert.equal(deliveryTimeLine('  3-5 business days '), 'Estimated delivery time is 3-5 business days, depending on location.');
});

test('with no days set the line makes no promise about them', () => {
  const generic = 'Estimated delivery time depends on your location.';
  assert.equal(deliveryTimeLine(undefined), generic);
  assert.equal(deliveryTimeLine(''), generic);
  assert.equal(deliveryTimeLine('   '), generic);
});
