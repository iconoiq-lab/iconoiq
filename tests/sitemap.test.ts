import { test } from 'node:test';
import assert from 'node:assert/strict';
import { llmsTxt, sitemapXml } from '../api/media.ts';

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

test('llms.txt lists contact, pages, collections and live real products only', () => {
  const txt = llmsTxt(
    'https://www.iconoiq.com',
    [
      { ...live, name: 'Mudra [Cards]\nSet', price: 1499, category: 'Learning Kits', description: 'Twenty-eight hand gestures.' },
      { id: 'free1', name: 'No Price Kit', flags: { isActive: true } },
      { id: 'demo1', name: 'Demo Kit', demo: true, flags: { isActive: true } },
      { id: 'hidden1', name: 'Hidden Kit', flags: { isActive: false } },
    ],
    [{ name: 'Learning Kits', slug: 'learning-kits', subcategories: ['Deity Iconography', 'Mudras & Natyam'] }],
    { email: 'shop@example.com', phone: '+91 90000 00000' },
  );
  assert.match(txt, /^# /);
  assert.match(txt, /- Email: shop@example\.com/);
  assert.match(txt, /- \[About\]\(https:\/\/www\.iconoiq\.com\/about\)/);
  assert.match(txt, /- \[Learning Kits\]\(https:\/\/www\.iconoiq\.com\/category\/learning-kits\): Deity Iconography, Mudras & Natyam/);
  assert.match(txt, /- \[Mudra Cards Set\]\(https:\/\/www\.iconoiq\.com\/product\/abc123\): ₹1,499\. Learning Kits\. Twenty-eight hand gestures\./);
  assert.match(txt, /- \[No Price Kit\]\(https:\/\/www\.iconoiq\.com\/product\/free1\)\n/);
  assert.doesNotMatch(txt, /Demo Kit|Hidden Kit|undefined|\/admin/);
});

test('llms.txt leaves out contact and products it does not have', () => {
  const txt = llmsTxt('https://www.iconoiq.com', [], []);
  assert.doesNotMatch(txt, /## Contact|## Products|## Collections/);
  assert.match(txt, /## Main pages/);
});
