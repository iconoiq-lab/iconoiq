import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withSupportContact } from '../src/lib/footerContact.ts';
import type { FooterSettings } from '../src/services/siteSettingsService.ts';

/**
 * The store's phone, email, WhatsApp number and opening hours are edited by the admin in
 * Admin > Commerce > Support (Firestore siteSettings/customerSupport). BRAND only holds the
 * starting values (DEFAULT_SUPPORT in the settings service reads them). A page that reads BRAND
 * directly would keep showing the old value after an admin edit, so customer-facing code reads
 * the saved settings through useCustomerSupport (or getCustomerSupportSettings in a service).
 */
const ALLOWED = new Set(['src/config/brand.ts', 'src/services/siteSettingsService.ts']);
const CONTACT_READ = /\bBRAND\s*(?:\.\s*(?:email|phones|whatsapp|hours)\b|\[\s*['"`](?:email|phones|whatsapp|hours)['"`]\s*\])/;
const BRAND_DESTRUCTURED = /\{[^}]*\b(?:email|phones|whatsapp|hours)\b[^}]*\}\s*=\s*BRAND\b/;

/** Blanks out block comments (keeping line numbers) and `// ...` comments. URLs such as https:// are not comments. */
function codeOnly(text: string): string[] {
  const noBlocks = text.replace(/\/\*[^]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.split(/\r?\n/).map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'));
}

test('the matcher sees direct BRAND contact reads in code and ignores comments', () => {
  assert.ok(CONTACT_READ.test('const p = BRAND.phones[0];'));
  assert.ok(CONTACT_READ.test('href={`mailto:${BRAND.email}`}'));
  assert.ok(CONTACT_READ.test("BRAND['whatsapp']"));
  assert.ok(CONTACT_READ.test('{BRAND.hours && <p/>}'));
  assert.ok(BRAND_DESTRUCTURED.test('const { email, phones } = BRAND;'));
  assert.ok(!CONTACT_READ.test('BRAND.name + BRAND.addressLines + BRAND.emailLabel'));
  assert.ok(!CONTACT_READ.test('support.email || DEFAULT_SUPPORT.whatsapp'));
  assert.ok(codeOnly('a // BRAND.email\n/* BRAND.phones */ b').every((l) => !CONTACT_READ.test(l)));
});

test('no customer-facing file in src/ reads BRAND.email, phones, whatsapp or hours directly', () => {
  const files = (readdirSync('src', { recursive: true }) as string[])
    .map((f) => join('src', f).replace(/\\/g, '/'))
    .filter((f) => /\.tsx?$/.test(f) && !ALLOWED.has(f));
  assert.ok(files.length > 100, 'found the src files');
  const hits: string[] = [];
  for (const f of files) {
    codeOnly(readFileSync(f, 'utf8')).forEach((line, i) => {
      if (CONTACT_READ.test(line) || BRAND_DESTRUCTURED.test(line)) hits.push(`${f}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(
    hits,
    [],
    `These read BRAND contact details directly, so an admin edit in Admin > Commerce > Support never reaches them. Use useCustomerSupport() (src/hooks/useCustomerSupport.ts):\n${hits.join('\n')}`,
  );
});

const footer = (over: Partial<FooterSettings> = {}): FooterSettings => ({
  brandTagline: '',
  addressLines: [],
  phones: [],
  emails: [],
  businessHours: '',
  mapEmbedUrl: '',
  shopLinks: [],
  categoryLinks: [],
  socialLinks: [],
  ...over,
});
const support = { phone: '+91 81066 70346', email: 'iconoiq@gmail.com', hours: 'Mon to Sat, 10 am to 6 pm' };

test('the footer shows the support phone, email and hours when it has none of its own', () => {
  const out = withSupportContact(footer(), support);
  assert.deepEqual(out.phones, ['+91 81066 70346']);
  assert.deepEqual(out.emails, ['iconoiq@gmail.com']);
  assert.equal(out.businessHours, 'Mon to Sat, 10 am to 6 pm');
});

test('a footer saved with its own phone, email or hours keeps them (the override)', () => {
  const out = withSupportContact(
    footer({ phones: ['+91 99999 11111'], emails: ['shop@example.com'], businessHours: 'Daily 9 to 9' }),
    support,
  );
  assert.deepEqual(out.phones, ['+91 99999 11111']);
  assert.deepEqual(out.emails, ['shop@example.com']);
  assert.equal(out.businessHours, 'Daily 9 to 9');
});

test('each footer field falls back on its own, and blank rows count as empty', () => {
  const out = withSupportContact(footer({ phones: ['  ', ''], emails: ['shop@example.com'] }), support);
  assert.deepEqual(out.phones, ['+91 81066 70346']);
  assert.deepEqual(out.emails, ['shop@example.com']);
});

test('with nothing set anywhere the footer contact fields stay empty (the footer hides them)', () => {
  const out = withSupportContact(footer(), { phone: '', email: ' ', hours: '' });
  assert.deepEqual(out.phones, []);
  assert.deepEqual(out.emails, []);
  assert.equal(out.businessHours, '');
});

test('the rest of the footer settings pass through unchanged', () => {
  const input = footer({ brandTagline: 'Hello', addressLines: ['A', 'B'], shopLinks: ['Shop all'] });
  const out = withSupportContact(input, support);
  assert.equal(out.brandTagline, 'Hello');
  assert.deepEqual(out.addressLines, ['A', 'B']);
  assert.deepEqual(out.shopLinks, ['Shop all']);
  assert.deepEqual(input.phones, [], 'the input is not changed');
});

test('the Footer reads the support settings through withSupportContact', () => {
  const src = readFileSync('src/components/Footer.tsx', 'utf8');
  assert.ok(src.includes('useCustomerSupport()') && src.includes('withSupportContact('));
});
