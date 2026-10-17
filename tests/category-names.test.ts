import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The store's category names live in one place: DEFAULT_CATEGORIES in
 * src/services/categoryService.ts. The template ships demo names ("Category One",
 * slug "category-one", "Subcategory 1A"), and a client's Phase 1 replaces them
 * there. Anything else in src/ that spells a demo name would keep showing it, so
 * this fails on any code line outside that file that does. Comments are ignored
 * (they may quote the demo names as examples); admin placeholders stay generic.
 */
const DEMO_NAME = /category[ -](?:one|two|three|four|five|six)\b|subcategory[ -]?\d+[a-z]?\b/i;
const OWNER = 'src/services/categoryService.ts';

/** Blanks out block comments (keeping line numbers) and `// ...` comments. URLs such as https:// are not comments. */
function codeOnly(text: string): string[] {
  const noBlocks = text.replace(/\/\*[^]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.split(/\r?\n/).map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'));
}

test('the matcher sees demo names in code and ignores them in comments', () => {
  assert.ok(DEMO_NAME.test("const a = 'Category One';"));
  assert.ok(DEMO_NAME.test('to: "/category/category-four"'));
  assert.ok(DEMO_NAME.test("{ name: 'Subcategory 1A' }"));
  assert.ok(!DEMO_NAME.test('Category name'));
  const lines = codeOnly('a // Category One\n/* category-one\n category-two */ b\nc');
  assert.equal(lines.length, 4);
  assert.ok(lines.every((l) => !DEMO_NAME.test(l)), 'comments are ignored');
  assert.ok(!DEMO_NAME.test(codeOnly('a // Category One\r\nb')[0]), 'comments end at a Windows line break too');
  assert.ok(DEMO_NAME.test(codeOnly("href='https://x.test/category-one'")[0]), 'a URL is code, not a comment');
});

test('no demo category name is spelled in src/ outside categoryService.ts', () => {
  const files = (readdirSync('src', { recursive: true }) as string[])
    .map((f) => join('src', f).replace(/\\/g, '/'))
    .filter((f) => /\.tsx?$/.test(f) && f !== OWNER);
  assert.ok(files.length > 100, 'found the src files');
  const hits: string[] = [];
  for (const f of files) {
    codeOnly(readFileSync(f, 'utf8')).forEach((line, i) => {
      if (DEMO_NAME.test(line)) hits.push(`${f}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(
    hits,
    [],
    `Demo category names outside ${OWNER}. Derive them from DEFAULT_CATEGORIES (or use a generic placeholder):\n${hits.join('\n')}`,
  );
});
