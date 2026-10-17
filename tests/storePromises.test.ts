import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storePromises } from '../src/lib/storePromises.ts';
import { RETURN_WINDOW_DAYS, RETURNS_CHIP_LABEL } from '../src/lib/returnWindow.ts';

test('the "What we promise" values come from the store settings, not from literals', () => {
  const p = storePromises({ responseTime: 'Within 2 hours', estimatedDays: '6-9 days', returnWindowDays: 14 });
  assert.deepEqual(p, [
    { value: 'Within 2 hours', label: 'Support reply time' },
    { value: 'Razorpay', label: 'Secure checkout' },
    { value: '14 days', label: 'Returns from delivery' },
    { value: '6-9 days', label: 'Delivery time' },
  ]);
});

test('a promise with no value behind it is left out', () => {
  const p = storePromises({ responseTime: '  ', estimatedDays: undefined, returnWindowDays: 7 });
  assert.deepEqual(p.map((x) => x.label), ['Secure checkout', 'Returns from delivery']);
});

test('one day is "1 day"', () => {
  assert.equal(storePromises({ returnWindowDays: 1 }).find((x) => x.label === 'Returns from delivery')?.value, '1 day');
});

test('the returns chip names the same window as the rule', () => {
  assert.equal(RETURNS_CHIP_LABEL, `${RETURN_WINDOW_DAYS}-day returns`);
});
