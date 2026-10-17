import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hslTripletToHex, parseHslTriplet } from '../src/lib/hslColor.ts';

test('the template tokens convert to the hexes the code used to hard-code', () => {
  assert.equal(hslTripletToHex('60 8% 98%'), '#FAFAF9'); // --background, light
  assert.equal(hslTripletToHex('20 13% 4%'), '#0C0A09'); // --background, dark
  assert.equal(hslTripletToHex('24 8% 10%'), '#1C1917'); // --primary and --foreground, light
  assert.equal(hslTripletToHex('0 0% 100%'), '#FFFFFF'); // --card, light
});

test('primary colours and greys, at the sector edges', () => {
  assert.equal(hslTripletToHex('0 0% 0%'), '#000000');
  assert.equal(hslTripletToHex('0 100% 50%'), '#FF0000');
  assert.equal(hslTripletToHex('60 100% 50%'), '#FFFF00');
  assert.equal(hslTripletToHex('120 100% 50%'), '#00FF00');
  assert.equal(hslTripletToHex('180 100% 50%'), '#00FFFF');
  assert.equal(hslTripletToHex('240 100% 50%'), '#0000FF');
  assert.equal(hslTripletToHex('300 100% 50%'), '#FF00FF');
  assert.equal(hslTripletToHex('0 0% 50%'), '#808080');
});

test('hue wraps around the circle', () => {
  assert.equal(hslTripletToHex('360 100% 50%'), '#FF0000');
  assert.equal(hslTripletToHex('-60 100% 50%'), hslTripletToHex('300 100% 50%'));
  assert.equal(hslTripletToHex('420 100% 50%'), hslTripletToHex('60 100% 50%'));
});

test('decimals, extra spaces and a deg unit are read', () => {
  assert.deepEqual(parseHslTriplet('  60.5   3%  96.25% '), [60.5, 3, 96.25]);
  assert.deepEqual(parseHslTriplet('24deg 8% 10%'), [24, 8, 10]);
  assert.equal(hslTripletToHex('  24   8%  10% '), '#1C1917');
});

test('anything that is not a bare HSL triplet gives null, so the caller falls back', () => {
  for (const bad of ['', '#1c1917', 'hsl(24 8% 10%)', '24 8 10', '24, 8%, 10%', '24 8% 10% / 0.5', '24 8% 120%', '24 120% 10%', 'red']) {
    assert.equal(parseHslTriplet(bad), null, bad);
    assert.equal(hslTripletToHex(bad), null, bad);
  }
});
