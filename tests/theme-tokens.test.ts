import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Phase 3 re-skins a store by editing token values, not component classes. These checks keep the
 * radius scale and the texture strength reachable from one CSS variable each:
 * rounded-panel/-card/-control/-chip read --radius-*, and the page textures (tx-paper, tx-sheet,
 * tx-slate) all go through --texture-opacity (1 = the template's look, 0 = off).
 */
const css = readFileSync('src/index.css', 'utf8').replace(/\r\n/g, '\n');
const tailwind = readFileSync('tailwind.config.ts', 'utf8');

const declared = (name: string) => css.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm'))?.[1].trim();

test('the four radius tokens exist and Tailwind reads them all from CSS variables', () => {
  for (const k of ['panel', 'card', 'control', 'chip']) {
    assert.ok(declared(`radius-${k}`), `--radius-${k} is declared in src/index.css`);
    assert.match(tailwind, new RegExp(`${k}:\\s*"var\\(--radius-${k}\\)"`), `rounded-${k} uses var(--radius-${k})`);
  }
});

// ICONOIQ (Phase 3, "Temple Modern" mockup): softer panels and cards, pill controls and chips
// (the template ships panel 18, card 12, control 6, chip 4 px).
test('the radius values are ICONOIQ\'s: panel 28, card 18, control and chip pill', () => {
  assert.deepEqual(
    ['panel', 'card', 'control', 'chip'].map((k) => declared(`radius-${k}`)),
    ['28px', '18px', '999px', '999px'],
  );
});

test('--texture-opacity defaults to 1 and every texture rule goes through a veil that reads it', () => {
  assert.equal(declared('texture-opacity'), '1');
  const veils = [...css.matchAll(/^\s*(--tx-veil-[a-z]+):\s*([^;]+);/gm)];
  assert.ok(veils.length >= 3, 'veil tokens exist');
  for (const [, name, value] of veils) assert.match(value, /var\(--texture-opacity\)/, `${name} reads --texture-opacity`);
  for (const selector of ['.tx-paper', '.dark .tx-paper', '.tx-sheet', '.dark .tx-sheet', '.tx-slate']) {
    const rule = css.match(new RegExp(`^\\s*${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'm'))?.[1] ?? '';
    assert.match(rule, /var\(--tx-veil-/, `${selector} lays a veil over its texture`);
  }
});

test('the contour rings and the slate highlight scale with --texture-opacity too', () => {
  const contour = [...css.matchAll(/^\s*--contour-ink:\s*([^;]+);/gm)].map((m) => m[1]);
  assert.equal(contour.length, 2, 'light and dark values');
  for (const v of contour) assert.match(v, /var\(--texture-opacity\)/);
  const slate = css.match(/^\s*\.tx-slate\s*\{([^}]*)\}/m)?.[1] ?? '';
  assert.match(slate, /radial-gradient\(.*calc\(0\.07 \* var\(--texture-opacity\)\)/);
});
