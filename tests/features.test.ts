import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES, FEATURE_INFO, isAnyOn, isOn, type FeatureKey } from '../src/config/features.ts';

const keys = Object.keys(FEATURES) as FeatureKey[];

test('every feature has a label and description', () => {
  assert.deepEqual(Object.keys(FEATURE_INFO).sort(), [...keys].sort());
  for (const k of keys) {
    assert.ok(FEATURE_INFO[k].label.length > 0, k);
    assert.ok(FEATURE_INFO[k].description.length > 10, k);
  }
});

test('dependencies point at real features and have no cycles', () => {
  const visit = (k: FeatureKey, seen: Set<FeatureKey>) => {
    assert.ok(!seen.has(k), `cycle at ${k}`);
    for (const d of FEATURE_INFO[k].dependsOn ?? []) {
      assert.ok(keys.includes(d), `${k} depends on unknown ${d}`);
      visit(d, new Set([...seen, k]));
    }
  };
  keys.forEach((k) => visit(k, new Set()));
});

test('isOn is false when a dependency is off', () => {
  for (const k of keys) {
    const deps = FEATURE_INFO[k].dependsOn ?? [];
    if (deps.some((d) => !isOn(d))) assert.equal(isOn(k), false, k);
    else assert.equal(isOn(k), FEATURES[k], k);
  }
});

test('scratch & win depends on rewards', () => {
  assert.ok(FEATURE_INFO.scratchWin.dependsOn?.includes('rewards'));
});

test('isAnyOn is true when at least one key is on, false for none or an empty list', () => {
  const on = keys.filter(isOn);
  const off = keys.filter((k) => !isOn(k));
  assert.ok(on.length > 0 && off.length > 0, 'the template has both on and off features');
  assert.equal(isAnyOn([]), false);
  assert.equal(isAnyOn([on[0]]), true);
  assert.equal(isAnyOn([off[0]]), false);
  assert.equal(isAnyOn([off[0], on[0]]), true);
  assert.equal(isAnyOn(off), false);
  // /wallet stays open while gift cards are on, even with rewards off
  assert.equal(isAnyOn(['rewards', 'giftCards']), isOn('rewards') || isOn('giftCards'));
});

test('the gallery description matches what the switch controls', () => {
  assert.match(FEATURE_INFO.gallery.description, /Admin > Gallery/);
  assert.doesNotMatch(FEATURE_INFO.gallery.description, /Home-page gallery and Admin/);
});

test('template defaults', () => {
  assert.equal(FEATURES.deliveryPartners, false);
  assert.equal(FEATURES.silverPricing, false);
});
