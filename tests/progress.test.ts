import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { countSteps, overallLine, updateProgress } from '../scripts/lib/progress.mjs';

test('counts only step lines', () => {
  const md = '✅ done · ⏳ to do\n- ✅ a\n- ⏳ b\n- ⛔ c (logo)\n  - ✅ nested\nnot - ✅ a step';
  assert.deepEqual(countSteps(md), { done: 2, todo: 1, waiting: 1 });
});

test('overall line rounds and handles zero', () => {
  assert.equal(overallLine({ done: 1, todo: 2, waiting: 0 }), '**Overall: 33% (1 of 3 steps done, 0 waiting)**');
  assert.equal(overallLine({ done: 0, todo: 0, waiting: 0 }), '**Overall: 0% (0 of 0 steps done, 0 waiting)**');
});

test('updateProgress rewrites only the overall line', () => {
  const md = '# X\n\n**Overall: 0% (0 of 0 steps done, 0 waiting)**\n\n- ✅ a\n- ⏳ b\n';
  assert.equal(updateProgress(md), '# X\n\n**Overall: 50% (1 of 2 steps done, 0 waiting)**\n\n- ✅ a\n- ⏳ b\n');
});

test('updateProgress refuses a file without the overall line', () => {
  assert.throws(() => updateProgress('- ✅ a'), /Overall/);
});

test('this store\'s PROGRESS.md (or the template starter) has steps and an overall line', () => {
  const file = existsSync('PROGRESS.md') ? 'PROGRESS.md' : 'docs/template/client/PROGRESS.md';
  const md = readFileSync(file, 'utf8');
  const c = countSteps(md);
  assert.ok(c.done + c.todo + c.waiting > 0);
  assert.doesNotThrow(() => updateProgress(md));
});

// docs/template/client/ exists only in the template repo: new-client and template-update leave it
// out of client copies, so these two starter tests skip there instead of failing with ENOENT.
const hasStarter = existsSync('docs/template/client/PROGRESS.md');
const skipStarter = hasStarter ? false : 'no docs/template/client/ (client copy)';
const starter = () => readFileSync('docs/template/client/PROGRESS.md', 'utf8');
const phase = (md: string, heading: string) => md.split(/^## /m).find((s) => s.startsWith(heading)) ?? '';

test('starter: Phase 0 keeps Claude\'s gap list and the owner\'s answers as two steps', { skip: skipStarter }, () => {
  const lines = phase(starter(), 'Phase 0').split(/\r?\n/);
  assert.ok(lines.some((l) => /^- ⏳ List the gaps/.test(l)), 'a to-do step for listing the gaps');
  assert.ok(lines.some((l) => /^- ⛔ Owner answers the gaps/.test(l)), 'a waiting step for the owner');
});

test('starter: a store with no new features can reach 100%', { skip: skipStarter }, () => {
  const md = starter();
  const p4 = phase(md, 'Phase 4').split(/\r?\n/).filter((l) => /^- (✅|⏳|⛔)/u.test(l));
  assert.equal(p4.length, 1, 'one Phase 4 step to start with');
  assert.match(p4[0], /"none"/, 'it says to write "none" and tick it');
  // ticking every step (including that one) gives 100%
  const allDone = md.replace(/^(\s*[-*]\s+)(?:⏳|⛔)/gmu, '$1✅');
  assert.match(updateProgress(allDone), /\*\*Overall: 100% /);
});
