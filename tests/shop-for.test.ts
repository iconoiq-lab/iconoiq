import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { SHOP_FOR } from '../src/config/shopFor.ts';

/**
 * The home page's "Shop for" cards link to category shelves and show art from public/.
 * A renamed category or a missing photo would leave a card leading to an empty page or
 * showing a blank box, so every link must name a slug from DEFAULT_CATEGORIES (and its
 * ?sub= one of that category's subcategory slugs) and every photo must exist.
 */
const services = readFileSync('src/services/categoryService.ts', 'utf8');
const slugs = new Set([...services.matchAll(/slug: '([a-z0-9-]+)'/g)].map((m) => m[1]));

test('every Shop for card links to a real category and shows a real photo', () => {
  assert.ok(SHOP_FOR.length > 0);
  for (const item of SHOP_FOR) {
    const url = new URL(item.href, 'https://store.test');
    const match = url.pathname.match(/^\/category\/([a-z0-9-]+)$/);
    assert.ok(match, `${item.title}: ${item.href} is not a /category/<slug> link`);
    assert.ok(slugs.has(match[1]), `${item.title}: no category with slug ${match[1]}`);
    const sub = url.searchParams.get('sub');
    if (sub) assert.ok(slugs.has(sub), `${item.title}: no subcategory with slug ${sub}`);
    assert.ok(existsSync(`public${item.image}`), `${item.title}: public${item.image} is missing`);
    assert.ok(item.line.trim().length > 0 && !/\[need/i.test(item.line), `${item.title}: needs a real line`);
  }
});
