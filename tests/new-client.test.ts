import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { BRIEF_README, STARTERS, fillTokens, previewEnv, shouldCopy, validateClientName } from '../scripts/lib/newClient.mjs';

test('copies store code and docs, leaves out template-only files', () => {
  for (const p of ['src/App.tsx', 'docs/template/FEATURES.md', 'docs/template/ESTIMATES.md', 'docs/template/mockups/home-mockup-starter.html', 'docs/template/mockups/product-card-versions.html', 'scripts/qa/contrast.mjs', 'scripts/lib/contrast.mjs', 'docs/setup/x.md', 'scripts/check.mjs', '.gitignore']) assert.ok(shouldCopy(p), p);
  for (const p of ['docs/template/build/plan.md', 'docs/template/client/CLAUDE.md', 'CLAUDE.md', 'README.md', 'docs/HANDOFF.md', 'scripts/qa/template-shots.sh']) assert.ok(!shouldCopy(p), p);
});

test('fills every token', () => {
  const out = fillTokens('{{CLIENT_NAME}} {{DATE}} {{TEMPLATE_COMMIT}} {{CLIENT_NAME}}', { clientName: 'Acme Foods', date: '2026-10-14', templateCommit: 'abc1234' });
  assert.equal(out, 'Acme Foods 2026-10-14 abc1234 Acme Foods');
});

test('preview env keeps only the public Firebase web config', () => {
  const env = '# c\nVITE_FIREBASE_API_KEY=k\nVITE_FIREBASE_PROJECT_ID=p\nFIREBASE_ADMIN_SDK_BASE64=SECRET\nRAZORPAY_KEY_SECRET=S2\nVITE_RAZORPAY_KEY_ID=r\nGEMINI_API_KEY=g\n';
  const out = previewEnv(env);
  assert.match(out, /^VITE_FIREBASE_API_KEY=k$/m);
  assert.match(out, /^VITE_FIREBASE_PROJECT_ID=p$/m);
  for (const bad of ['SECRET', 'S2', 'RAZORPAY', 'GEMINI']) assert.ok(!out.includes(bad), bad);
});

test('client names', () => {
  assert.equal(validateClientName('Acme Foods'), null);
  for (const bad of ['', ' ', 'A', 'a/b', 'a\\b', 'a:b', '..', 'CON', 'x'.repeat(61), 'name.']) assert.ok(validateClientName(bad), JSON.stringify(bad));
});

test('starter files exist in the template', { skip: !existsSync('docs/template/client') }, () => {
  for (const from of Object.keys(STARTERS)) assert.ok(existsSync(from), from);
  assert.ok(BRIEF_README.includes('git-ignored'));
});
