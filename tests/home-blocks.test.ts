import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { HOME_BLOCKS, HOME_BLOCK_RESERVE } from '../src/config/homeBlocks.ts';

// src/config/homeBlocks.ts says which blocks the home page shows; Index.tsx must read every flag and every
// reserved height, or a flag would do nothing (a block stays on or off whatever the file says) and a
// reserve would be a number nobody reads.
const index = readFileSync('src/pages/Index.tsx', 'utf8');

test('every home block flag is a boolean and is read by the home page', () => {
  for (const [name, value] of Object.entries(HOME_BLOCKS)) {
    assert.equal(typeof value, 'boolean', `${name} must be true or false`);
    assert.ok(index.includes(`HOME_BLOCKS.${name}`), `Index.tsx never reads HOME_BLOCKS.${name}`);
  }
});

test('every reserved height is a Tailwind height class and is read by the home page', () => {
  for (const [name, value] of Object.entries(HOME_BLOCK_RESERVE)) {
    assert.match(value, /^h-/, `${name}: a reserve is a list of h-* classes`);
    assert.ok(index.includes(`HOME_BLOCK_RESERVE.${name}`), `Index.tsx never reads HOME_BLOCK_RESERVE.${name}`);
  }
});

test('Index.tsx has no height reserve of its own: they all live in homeBlocks.ts', () => {
  assert.ok(!/reserve="/.test(index), 'a literal reserve="..." is back in Index.tsx; put it in HOME_BLOCK_RESERVE');
});

// A client copy switches blocks in Phase 3, so "every block is a boolean" holds everywhere; the shipped
// defaults hold only in the template repo (docs/template/client/ exists only there, as in sections.test.ts).
const inTemplateRepo = existsSync('docs/template/client/PROGRESS.md');

test('the template ships every home block on', { skip: inTemplateRepo ? false : 'client copy: blocks are switched in Phase 3' }, () => {
  for (const [name, value] of Object.entries(HOME_BLOCKS)) {
    if (name === 'facts') continue; // new, off by default: asserted below
    assert.equal(value, true, `${name} must default to true in the template`);
  }
});

test('the facts strip is the one block that ships off', { skip: inTemplateRepo ? false : 'client copy: blocks are switched in Phase 3' }, () => {
  assert.equal(HOME_BLOCKS.facts, false);
});
