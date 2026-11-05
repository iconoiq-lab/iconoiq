import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sitemapXml } from '../api/media.ts';

const live = { id: 'abc123', flags: { isActive: true }, updatedAt: { seconds: 1793000000 }, media: { images: ['https://img.example/a.jpg?x=1&y=2'] } };

test('sitemap lists the public pages, categories and live products only', () => {
  const xml = sitemapXml('https://www.iconoiq.com', [
    live,
    { id: 'demo1', demo: true, flags: { isActive: true } },
    { id: 'hidden1', flags: { isActive: false } },
    { flags: { isActive: true } },
  ], ['learning-kits']);
  assert.match(xml, /<loc>https:\/\/www\.iconoiq\.com\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/www\.iconoiq\.com\/category\/learning-kits<\/loc>/);
  assert.match(xml, /<loc>https:\/\/www\.iconoiq\.com\/product\/abc123<\/loc><lastmod>2026-1[01]-\d\d<\/lastmod>/);
  assert.match(xml, /<image:loc>https:\/\/img\.example\/a\.jpg\?x=1&amp;y=2<\/image:loc>/);
  assert.doesNotMatch(xml, /demo1|hidden1|undefined/);
  assert.doesNotMatch(xml, /\/admin|\/account|\/checkout/);
});
