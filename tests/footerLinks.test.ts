import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INFORMATION_LINKS, dedupeFooterLinks } from '../src/components/footer/footerLinks.ts';

test('dedupeFooterLinks keeps order and drops a repeated label or destination', () => {
  const out = dedupeFooterLinks([
    { name: 'Shop all', to: '/products' },
    { name: 'shop ALL ', to: '/search-results?q=shop%20all' },
    { name: 'Everything', to: '/products' },
    { name: 'Privacy policy', to: '/privacy-policy' },
    ...INFORMATION_LINKS,
  ]);
  assert.deepEqual(out.map((l) => l.name), ['Shop all', 'Privacy policy', 'Terms and conditions', 'Shipping policy', 'Cancellation and refunds']);
});

test('dedupeFooterLinks drops blank labels and leaves the input alone', () => {
  const input = [{ name: '  ', to: '/x' }, { name: 'New arrivals', to: '/products?tag=new-arrivals' }];
  assert.deepEqual(dedupeFooterLinks(input), [input[1]]);
  assert.equal(input.length, 2);
});

test('the information list has the four policy pages', () => {
  assert.equal(INFORMATION_LINKS.length, 4);
  for (const l of INFORMATION_LINKS) assert.ok(l.to.startsWith('/') && l.name.length > 3);
});
