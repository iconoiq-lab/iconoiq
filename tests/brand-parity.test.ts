import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BRAND } from '../src/config/brand.ts';

/**
 * Phase 1 copies the store's name and delivery numbers into files that cannot import
 * src/config/brand.ts (api functions, index.html, the manifest, a service worker, a script).
 * These tests fail when a copy is left behind, so a miss shows up in `npm test`.
 */

for (const f of ['api/media.ts', 'api/whatsapp-send.ts', 'api/send-call-notification.ts']) {
  test(`${f} STORE_NAME matches BRAND.name`, () => {
    const m = readFileSync(f, 'utf8').match(/const STORE_NAME = '([^']*)';/);
    assert.ok(m, `${f} has no "const STORE_NAME = '...';"`);
    assert.equal(m[1], BRAND.name);
  });
}

test('scripts/test-whatsapp-otp.mjs STORE_NAME matches BRAND.name', () => {
  const m = readFileSync('scripts/test-whatsapp-otp.mjs', 'utf8').match(/const STORE_NAME = '([^']*)';/);
  assert.ok(m, `scripts/test-whatsapp-otp.mjs has no "const STORE_NAME = '...';"`);
  assert.equal(m[1], BRAND.name);
});

test('index.html theme key matches BRAND.storageKeys.theme', () => {
  assert.ok(readFileSync('index.html', 'utf8').includes(`localStorage.getItem('${BRAND.storageKeys.theme}')`));
});

test('index.html title, og:title and author match BRAND.name', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.ok(html.includes(`<title>${BRAND.name}</title>`), 'index.html <title>');
  assert.ok(html.includes(`<meta property="og:title" content="${BRAND.name}"`), 'index.html og:title');
  assert.ok(html.includes(`<meta name="author" content="${BRAND.name}"`), 'index.html author');
});

test('public/manifest.webmanifest names match BRAND', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.name, BRAND.name);
  assert.equal(manifest.short_name, BRAND.shortName);
});

test('public/robots.txt comment and the push service worker fallback title match BRAND.name', () => {
  assert.equal(readFileSync('public/robots.txt', 'utf8').split(/\r?\n/)[0], `# ${BRAND.name}`);
  const sw = readFileSync('public/firebase-messaging-sw.js', 'utf8');
  assert.ok(sw.includes(`|| '${BRAND.name}';`), 'public/firebase-messaging-sw.js notification title fallback');
});

/**
 * The DEFAULT_DELIVERY object in each file. The api copy holds `Array<{ ... }>`, so a pattern
 * that stops at the first closing brace would cut it short: read up to the line that is
 * just `};` instead.
 */
const deliveryBlock = (file: string, re: RegExp) => {
  const block = readFileSync(file, 'utf8').match(re);
  assert.ok(block, `${file}: no DEFAULT_DELIVERY block found`);
  return block[0];
};
const SRC_DELIVERY = /export const DEFAULT_DELIVERY[^]*?\n\};/;
const API_DELIVERY = /const DEFAULT_DELIVERY = \{[^]*?\n\};/;

test('api/create-order.ts default home state matches BRAND.state', () => {
  const m = deliveryBlock('api/create-order.ts', API_DELIVERY).match(/homeState: '([^']*)'/);
  assert.ok(m, 'api/create-order.ts DEFAULT_DELIVERY has no homeState');
  assert.equal(m[1], BRAND.state);
});

test('api/create-order.ts default delivery numbers match DEFAULT_DELIVERY in siteSettingsService.ts', () => {
  const pick = (block: string) => {
    const num = (key: string) => Number(block.match(new RegExp(`${key}: (\\d+(?:\\.\\d+)?)`))?.[1]);
    return {
      enabled: block.match(/enabled: (true|false)/)?.[1],
      within: num('withinStateCharge'),
      outside: num('outsideStateCharge'),
      freeAbove: num('freeDeliveryAbove'),
    };
  };
  const src = pick(deliveryBlock('src/services/siteSettingsService.ts', SRC_DELIVERY));
  const api = pick(deliveryBlock('api/create-order.ts', API_DELIVERY));
  for (const [key, value] of Object.entries(src)) {
    assert.ok(value !== undefined && !Number.isNaN(value), `src DEFAULT_DELIVERY: ${key} not found`);
  }
  assert.deepEqual(api, src);
});
