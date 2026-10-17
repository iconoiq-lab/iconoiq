import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyAttribute, specEntries } from '../src/lib/productSpecs.ts';

test('specEntries drops empty values and ranks net quantity first, directions last', () => {
  const e = specEntries({ directions: 'Apply daily', colour: 'Blue', 'net quantity': '50 ml', blank: ' ' });
  assert.deepEqual(e.map(([k]) => k), ['net quantity', 'colour', 'directions']);
});

test('keyAttribute is the top-ranked short spec value', () => {
  assert.equal(keyAttribute({ colour: 'Blue', 'net quantity': '50 ml' }), '50 ml');
});

test('keyAttribute skips long values and directions', () => {
  assert.equal(keyAttribute({ directions: 'Apply daily', notes: 'x'.repeat(41) }), undefined);
});

test('keyAttribute falls back to weight, then nothing', () => {
  assert.equal(keyAttribute({}, '250', 'grams'), '250 g');
  assert.equal(keyAttribute({}, '1.5', 'kgs'), '1.5 kg');
  assert.equal(keyAttribute(undefined, '', 'grams'), undefined);
  assert.equal(keyAttribute(undefined), undefined);
});

test('keyAttribute never shows a [NEED: ...] placeholder value', () => {
  assert.equal(keyAttribute({ size: '[NEED: size]', colour: 'Blue' }), 'Colour: Blue');
  assert.equal(keyAttribute({ material: '[need: material]' }, '250', 'grams'), '250 g');
  assert.equal(keyAttribute({ material: '[NEED: material]' }), undefined);
});

test('specEntries orders equal-rank keys alphabetically, whatever order the data arrives in', () => {
  const a = specEntries({ size: '10 cm', material: 'Clay' }).map(([k]) => k);
  const b = specEntries({ material: 'Clay', size: '10 cm' }).map(([k]) => k);
  assert.deepEqual(a, ['material', 'size']);
  assert.deepEqual(b, ['material', 'size']);
});

test('keyAttribute labels any value that is not a quantity, so it never reads as a bare word', () => {
  assert.equal(keyAttribute({ material: 'Clay' }), 'Material: Clay');
  assert.equal(keyAttribute({ purity: '92.5' }), 'Purity: 92.5');
  assert.equal(keyAttribute({ dimensions: '10 x 5 cm' }), 'Size: 10 x 5 cm');
  assert.equal(keyAttribute({ warranty: '1 year' }), 'Warranty: 1 year');
});

test('keyAttribute keeps a quantity (net ...) and the weight fallback bare', () => {
  assert.equal(keyAttribute({ 'net quantity': '50 ml' }), '50 ml');
  assert.equal(keyAttribute({ 'Net weight': '100 g', material: 'Clay' }), '100 g');
  assert.equal(keyAttribute({}, '250', 'grams'), '250 g');
});

test('keyAttribute limits the value, not the label, to 40 characters', () => {
  assert.equal(keyAttribute({ notes: 'x'.repeat(40) }), 'Notes: ' + 'x'.repeat(40));
  assert.equal(keyAttribute({ notes: 'x'.repeat(41) }), undefined);
});
