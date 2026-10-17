import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FEATURES, type FeatureKey } from '../src/config/features.ts';

const rows = readFileSync('docs/template/FEATURES.md', 'utf8').split(/\r?\n/).filter((l) => l.startsWith('|'));

test('every switch has exactly one row with its default and a size', () => {
  for (const key of Object.keys(FEATURES) as FeatureKey[]) {
    const mine = rows.filter((r) => r.includes('`' + key + '`'));
    assert.equal(mine.length, 1, `${key}: expected one table row`);
    assert.match(mine[0], new RegExp(`\|\s*${FEATURES[key] ? 'on' : 'off'}\s*\|`), `${key}: default cell`);
    assert.match(mine[0], /\|\s*[SML]\s*\|/, `${key}: size cell S, M or L`);
  }
});
