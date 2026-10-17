import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SECTION_VERSIONS, type SectionKey } from '../src/config/sections.ts';

const rows = readFileSync('docs/template/SECTIONS.md', 'utf8').split(/\r?\n/).filter((l) => l.startsWith('|'));

test('SECTIONS.md has one row per version', () => {
  for (const k of Object.keys(SECTION_VERSIONS) as SectionKey[]) for (const v of SECTION_VERSIONS[k]) {
    const mine = rows.filter((r) => r.includes('`' + k + '`') && r.includes('`' + v + '`'));
    assert.equal(mine.length, 1, `${k}.${v}: expected one table row`);
  }
});
