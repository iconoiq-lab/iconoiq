import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_PERK_RULES, PERKS } from '../src/lib/partner.ts';

/**
 * Text checks on firestore.rules for the partner programme. The behaviour is
 * tested against the real emulator in partnerRules.emulator.test.ts (runs when
 * FIRESTORE_EMULATOR_HOST is set); these keep the guards from being dropped
 * by an edit when the emulator is not running.
 */

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('the perk thresholds in the rules match DEFAULT_PERK_RULES', () => {
  const m = rules.match(/function perkDefaults\(\) \{\n\s*return \{([\s\S]*?)\};/);
  assert.ok(m, 'perkDefaults() is in firestore.rules');
  const found: Record<string, { unlockAt: number; count: number }> = {};
  for (const row of m[1].matchAll(/'(\w+)': \{'unlockAt': (\d+), 'count': (\d+)\}/g)) {
    found[row[1]] = { unlockAt: Number(row[2]), count: Number(row[3]) };
  }
  assert.deepEqual(found, DEFAULT_PERK_RULES);
});

test('every perk kind is listed in the matching claim check', () => {
  for (const p of PERKS) {
    const fn = p.kind === 'once' ? 'onceClaim' : p.kind === 'count' ? 'countClaim' : 'monthlyClaim';
    const body = rules.match(new RegExp(`function ${fn}\\(d\\) \\{[\\s\\S]*?\\n        \\}`))?.[0] || '';
    assert.match(body, new RegExp(`'${p.id}'`), `${p.id} in ${fn}`);
  }
});

test('a new order cannot carry the server-only partner fields', () => {
  const create = rules.match(/function isValidOrderCreate\(\) \{[\s\S]*?\n      \}/)?.[0] || '';
  for (const key of ['partnerCode', 'partnerUid', 'partnerFamily']) assert.match(create, new RegExp(`'${key}'`), key);
});

test('earnings are server-only; a payout is confirmed once; partner codes are never listed', () => {
  assert.match(rules, /match \/earnings\/\{rzp\} \{\n\s*allow read: if isOwner\(uid\) \|\| isAdmin\(\);\n\s*allow write: if false;/);
  assert.match(rules, /!\('receivedAt' in resource\.data\)\n\s*&& request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\['receivedAt'\]\)/);
  assert.match(rules, /match \/partnerCodes\/\{code\} \{\n\s*allow get: if true;\n\s*allow list: if isAdmin\(\);/);
});
