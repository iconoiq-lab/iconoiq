import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Delivery days, the return window and the support reply time are promises to customers, and each has
 * one home: DEFAULT_DELIVERY.estimatedDays and DEFAULT_SUPPORT.responseTime (built from BRAND.replyWithin) in
 * src/services/siteSettingsService.ts (the admin edits both), and RETURN_WINDOW_DAYS in
 * src/lib/returnWindow.ts (firestore.rules enforces the same number). A literal "7-day returns" or
 * "3-7 days" anywhere else in src/ keeps promising the template's number after Phase 1 changed it, so
 * this fails on any code line outside those files that spells one. Comments are ignored; admin
 * placeholders (placeholder="...") stay generic examples.
 */
const PROMISE = /\b\d+[- ]days?\s+returns?\b|\b\d+\s*[-–]\s*\d+\s+(?:business\s+|working\s+)?days\b/i;
const OWNERS = ['src/services/siteSettingsService.ts', 'src/lib/returnWindow.ts'];

/** Blanks out block comments (keeping line numbers) and `// ...` comments. URLs such as https:// are not comments. */
function codeOnly(text: string): string[] {
  const noBlocks = text.replace(/\/\*[^]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.split(/\r?\n/).map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'));
}

test('the matcher sees literal promises in code and ignores comments and placeholders', () => {
  for (const hit of ['7-day returns', '7 day return', '30-days returns', 'delivery in 3-7 days', '4–7 days', '3-5 business days', '2 - 4 working days']) {
    assert.ok(PROMISE.test(`<span>${hit}</span>`), hit);
  }
  for (const ok of ['Returns', 'Within 24 hours', '30 days grace', 'the 7-day window', '{RETURNS_CHIP_LABEL}', 'Ships in 1 day']) {
    assert.ok(!PROMISE.test(`<span>${ok}</span>`), ok);
  }
  assert.ok(codeOnly('a // 7-day returns\n/* 3-5 days */ b').every((l) => !PROMISE.test(l)), 'comments are ignored');
  assert.ok(PROMISE.test(codeOnly("const label = '7-day returns';")[0]));
});

test('no literal "N-day returns" or "N-N days" in src/ outside the settings and the return window', () => {
  const files = (readdirSync('src', { recursive: true }) as string[])
    .map((f) => join('src', f).replace(/\\/g, '/'))
    .filter((f) => /\.tsx?$/.test(f) && !OWNERS.includes(f));
  assert.ok(files.length > 100, 'found the src files');
  const hits: string[] = [];
  for (const f of files) {
    codeOnly(readFileSync(f, 'utf8')).forEach((line, i) => {
      if (/placeholder\s*=/.test(line)) return;
      if (PROMISE.test(line)) hits.push(`${f}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(
    hits,
    [],
    `Hardcoded promises. Use RETURNS_CHIP_LABEL / RETURN_WINDOW_DAYS (src/lib/returnWindow.ts), storePromises (src/lib/storePromises.ts), or the delivery and support settings:\n${hits.join('\n')}`,
  );
});
