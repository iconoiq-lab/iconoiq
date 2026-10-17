import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RETURN_WINDOW_DAYS,
  returnWindowEnd,
  isWithinReturnWindow,
  returnRequestTiming,
  unlockDaysAfterDelivery,
} from '../src/lib/returnWindow.ts';

test('points unlock no sooner than the return window closes', () => {
  assert.equal(unlockDaysAfterDelivery(0), RETURN_WINDOW_DAYS);
  assert.equal(unlockDaysAfterDelivery(3), 7);
  assert.equal(unlockDaysAfterDelivery(14), 14);
});

const DAY = 86_400_000;
const delivered = new Date('2026-10-01T10:00:00Z');
const at = (ms: number) => new Date(delivered.getTime() + ms);

/**
 * One return window, three copies: the storefront reads RETURN_WINDOW_DAYS, firestore.rules refuses
 * a return request after it, and api/notify-order.ts holds earned points until it closes. Change
 * all three together; a mismatch tells customers they can return an order the rules then refuse,
 * or unlocks points while the order can still be returned.
 */
const TOGETHER =
  "Change the return window in all three places together: src/lib/returnWindow.ts (RETURN_WINDOW_DAYS), firestore.rules (isValidReturnRequest: duration.value(N, 'd')) and api/notify-order.ts (const RETURN_WINDOW_DAYS).";

test('the return window in firestore.rules equals RETURN_WINDOW_DAYS', () => {
  const rules = readFileSync('firestore.rules', 'utf8');
  const m = rules.match(/deliveredAt\s*\+\s*duration\.value\(\s*(\d+)\s*,\s*'d'\s*\)/);
  assert.ok(m, `firestore.rules: no "deliveredAt + duration.value(N, 'd')" in isValidReturnRequest. ${TOGETHER}`);
  assert.equal(Number(m[1]), RETURN_WINDOW_DAYS, `firestore.rules says ${m[1]} days, src/lib/returnWindow.ts says ${RETURN_WINDOW_DAYS}. ${TOGETHER}`);
});

test('the return window in api/notify-order.ts equals RETURN_WINDOW_DAYS', () => {
  const api = readFileSync('api/notify-order.ts', 'utf8');
  const m = api.match(/const\s+RETURN_WINDOW_DAYS\s*(?::\s*number\s*)?=\s*(\d+)\s*;/);
  assert.ok(m, `api/notify-order.ts: no "const RETURN_WINDOW_DAYS = N;". ${TOGETHER}`);
  assert.equal(Number(m[1]), RETURN_WINDOW_DAYS, `api/notify-order.ts says ${m[1]} days, src/lib/returnWindow.ts says ${RETURN_WINDOW_DAYS}. ${TOGETHER}`);
});

test('a return can be requested until 7 days after delivery', () => {
  assert.equal(isWithinReturnWindow(delivered, at(0)), true);
  assert.equal(isWithinReturnWindow(delivered, at(7 * DAY - 1000)), true);
});

test('the window closes at exactly 7 days, like the rule (request.time < deliveredAt + 7d)', () => {
  assert.equal(isWithinReturnWindow(delivered, at(7 * DAY)), false);
  assert.equal(isWithinReturnWindow(delivered, at(30 * DAY)), false);
});

test('a missing or unreadable delivery time closes the window, as the rules do', () => {
  for (const value of [null, undefined, '', 'not a date', {}, Number.NaN]) {
    assert.equal(isWithinReturnWindow(value, at(0)), false, String(value));
    assert.equal(returnWindowEnd(value), null, String(value));
  }
});

test('reads Firestore Timestamps, {seconds} objects, Dates, ISO strings and epoch millis', () => {
  const end = delivered.getTime() + 7 * DAY;
  const forms: unknown[] = [
    delivered,
    { toDate: () => delivered },
    { seconds: delivered.getTime() / 1000, nanoseconds: 0 },
    delivered.toISOString(),
    delivered.getTime(),
  ];
  for (const form of forms) assert.equal(returnWindowEnd(form)?.getTime(), end, JSON.stringify(form));
});

test('returnRequestTiming tells the shop whether a request came in time', () => {
  assert.equal(returnRequestTiming(delivered, at(2 * DAY)), 'in-window');
  assert.equal(returnRequestTiming(delivered, at(9 * DAY)), 'late');
  assert.equal(returnRequestTiming(null, at(2 * DAY)), 'unknown');
  assert.equal(returnRequestTiming(delivered, undefined), 'unknown');
});
