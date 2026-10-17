import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { SECTIONS, SECTION_VERSIONS, SECTION_INFO, parseSectionOverride, resolveSections, type SectionKey } from '../src/config/sections.ts';

const keys = Object.keys(SECTION_VERSIONS) as SectionKey[];

test('every section has classic first plus at least one other version', () => {
  for (const k of keys) {
    assert.equal(SECTION_VERSIONS[k][0], 'classic', k);
    assert.ok(SECTION_VERSIONS[k].length >= 2 && SECTION_VERSIONS[k].length <= 3, k);
  }
});

// A client copy sets its picks in Phase 2, so "every pick is a known version" must hold everywhere;
// "classic everywhere" holds only in the template repo. docs/template/client/ exists only there
// (new-client and template-update leave it out of copies), the same switch tests/progress.test.ts uses.
const inTemplateRepo = existsSync('docs/template/client/PROGRESS.md');

test('every pick in SECTIONS is one of its versions', () => {
  for (const k of keys) {
    assert.ok((SECTION_VERSIONS[k] as readonly string[]).includes(SECTIONS[k]), `${k}: ${SECTIONS[k]}`);
  }
});

test('the template ships with classic everywhere', { skip: inTemplateRepo ? false : 'client copy: picks are set in Phase 2' }, () => {
  for (const k of keys) assert.equal(SECTIONS[k], 'classic', k);
});

test('every version has a label and a when-to-pick line', () => {
  for (const k of keys) for (const v of SECTION_VERSIONS[k]) {
    const info = (SECTION_INFO[k] as Record<string, { label: string; pick: string }>)[v];
    assert.ok(info?.label && info.pick.length > 20, `${k}.${v}`);
  }
});

test('parseSectionOverride keeps only known keys and versions', () => {
  assert.deepEqual(parseSectionOverride('?sections=header:centered,hero:split'), { header: 'centered', hero: 'split' });
  assert.deepEqual(parseSectionOverride('?sections=header:nope,bogus:classic,footer:compact'), { footer: 'compact' });
  assert.deepEqual(parseSectionOverride('?q=1'), {});
  assert.deepEqual(parseSectionOverride(''), {});
  assert.equal(parseSectionOverride('?sections=reset'), 'reset');
});

test('parseSectionOverride ignores inherited key names instead of throwing', () => {
  assert.deepEqual(parseSectionOverride('?sections=toString:x,constructor:x,__proto__:x,footer:compact'), { footer: 'compact' });
});

test('resolveSections lays the override over the store picks', () => {
  const r = resolveSections(SECTIONS, { productCard: 'compact' });
  assert.equal(r.productCard, 'compact');
  assert.equal(r.header, SECTIONS.header);
});
