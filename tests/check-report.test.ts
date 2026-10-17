import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countIssues, failedTestNames } from '../scripts/lib/checkReport.mjs';

test('failedTestNames lists the "not ok" lines of node:test TAP output, trimmed', () => {
  const tap = [
    'TAP version 13',
    '# Subtest: a suite',
    '    ok 1 - passes',
    '    not ok 2 - breaks',
    '    ---',
    "    error: 'boom'",
    '    ...',
    'not ok 1 - a suite',
    'ok 2 - skipped one # SKIP no starter',
    '1..2',
  ].join('\n');
  assert.deepEqual(failedTestNames(tap), ['not ok 2 - breaks', 'not ok 1 - a suite']);
  assert.deepEqual(failedTestNames('ok 1 - fine\r\n1..1\r\n'), []);
  assert.deepEqual(failedTestNames('not ok 3 - windows line ends\r\n'), ['not ok 3 - windows line ends']);
});

test('countIssues counts one failed response once, not as a request and a console error', () => {
  const four04 = 'Failed to load resource: the server responded with a status of 404 (Not Found)';
  assert.equal(countIssues({ consoleErrors: [four04], pageErrors: [], failedRequests: ['404 http://x.test/a.json'] }), 1);
});

test('countIssues still counts real console errors, page errors and other failed requests', () => {
  const four04 = 'Failed to load resource: the server responded with a status of 404 (Not Found)';
  assert.equal(
    countIssues({
      consoleErrors: [four04, 'Uncaught TypeError: x is undefined', 'Failed to load resource: net::ERR_CONNECTION_REFUSED'],
      pageErrors: ['Error: boom'],
      failedRequests: ['404 http://x.test/a.json', '500 http://x.test/b'],
    }),
    5,
  );
  assert.equal(countIssues({ consoleErrors: [], pageErrors: [], failedRequests: [] }), 0);
});

test('templateDefaultsLeft names template promises a client copy still carries', async () => {
  const { templateDefaultsLeft } = await import('../scripts/lib/checkReport.mjs');
  const brand = "  replyWithin: '24 hours' as string,\n  shipsTo: 'Shipped across India' as string,\n";
  const settings = "  estimatedDays: '3-5 business days',\n";
  assert.equal(templateDefaultsLeft(brand, settings).length, 3);
  const mine = "  replyWithin: '2 days' as string,\n  shipsTo: 'Shipped within Kerala' as string,\n";
  assert.deepEqual(templateDefaultsLeft(mine, "  estimatedDays: '4-7 days',\n"), []);
});
