// End-to-end check of Admin > Business partners, as a real admin in a browser.
//   node scripts/qa/business-partners-e2e.mjs [BASE] [OUT]
// Needs scripts/qa/admin.local (run `node scripts/qa/ui-fixtures.mjs seed` first).
// Adds two test partners (one with a photo), an over-100 % share that must be
// refused, a dealer income and an expense; checks the profit split on screen;
// screenshots 390/1440 light/dark; then removes everything it added via the UI.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { THEME_KEY } from '../lib/brand.mjs';

const { chromium } = createRequire('C:/Users/chala/AppData/Roaming/npm/node_modules/playwright/package.json')('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:5182';
const OUT = process.argv[3] || 'docs/look/shots/business-partners';
mkdirSync(OUT, { recursive: true });
const creds = JSON.parse(readFileSync('scripts/qa/admin.local', 'utf8'));
const money = (s) => Number(String(s).replace(/[^0-9.-]/g, '').replace(/^-?$/, '0')) * (/[−-]/.test(s) ? -1 : 1);
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
const ok = (m) => console.log('ok:', m);

const browser = await chromium.launch({ headless: true });
const errors = [];
async function open(theme, width) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 800 ? 844 : 900 }, colorScheme: theme });
  await ctx.addInitScript(([k, t]) => { try { localStorage.setItem(k, t); sessionStorage.setItem('appLoaded', 'true'); } catch {} }, [THEME_KEY, theme]);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/admin`, { waitUntil: 'load' });
  await page.locator('input[type="email"]').first().fill(creds.email);
  await page.locator('input[type="password"]').first().fill(creds.password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/dashboard/, { timeout: 40000 });
  return { ctx, page };
}
const tile = async (page, label) => money(await page.locator('section[aria-label="Summary"] > div', { hasText: label }).locator('p').nth(1).innerText());

try {
  const { ctx, page } = await open('light', 1440);
  // 1. The menu link opens the page.
  await page.getByRole('link', { name: 'Business partners' }).first().click();
  await page.waitForURL(/business-partners/);
  await page.getByRole('heading', { name: 'Business partners' }).waitFor();
  await page.waitForTimeout(2500);
  ok('menu link opens the page');

  // 2. Add partner A with a photo, 60 %.
  await page.getByRole('button', { name: 'Add partner' }).first().click();
  await page.getByLabel('Partner photo').setInputFiles('public/og-image.jpg');
  await page.locator('[role="dialog"] img').waitFor({ timeout: 40000 });
  ok('photo uploaded and previewed');
  await page.getByLabel('Name').fill('E2E Partner A');
  await page.getByLabel('Share %').fill('60');
  await page.getByLabel('Phone').fill('9000000001');
  await page.getByLabel('Role (optional)').fill('Founder');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('E2E Partner A').waitFor();
  ok('partner A saved');

  // 3. Partner B, 40 %, no photo (initials).
  await page.getByRole('button', { name: 'Add partner' }).first().click();
  await page.getByLabel('Name').fill('E2E Partner B');
  await page.getByLabel('Share %').fill('40');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('E2E Partner B').waitFor();
  ok('partner B saved');
  if (!(await page.getByText('Shares total 100 %').isVisible())) fail('shares total should read 100 %');

  // 4. Partner C at 10 % must be refused (would be 110 %).
  await page.getByRole('button', { name: 'Add partner' }).first().click();
  await page.getByLabel('Name').fill('E2E Partner C');
  await page.getByLabel('Share %').fill('10');
  await page.getByRole('button', { name: 'Save' }).click();
  const refused = await page.getByText(/Shares would total 110/).waitFor({ timeout: 5000 }).then(() => true, () => false);
  if (!refused) fail('over-100 % share was not refused');
  else ok('110 % share refused');
  await page.getByRole('button', { name: 'Cancel' }).click();

  // 5. Income + expense, then check the split.
  const before = { store: await tile(page, 'Store sales'), dealer: await tile(page, 'Dealer sales'), exp: await tile(page, 'Expenses') };
  await page.getByRole('button', { name: 'Add income' }).click();
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: /Dealer sales/ }).click();
  await page.getByLabel('Amount (₹)').fill('10000');
  await page.getByLabel('Note (optional)').fill('E2E dealer cash');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('E2E dealer cash').waitFor();
  await page.getByRole('button', { name: 'Add expense' }).click();
  await page.getByLabel('Amount (₹)').fill('2500');
  await page.getByLabel('Note (optional)').fill('E2E rent');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('E2E rent').waitFor();
  await page.waitForTimeout(800);
  const after = { store: await tile(page, 'Store sales'), dealer: await tile(page, 'Dealer sales'), exp: await tile(page, 'Expenses'), profit: await tile(page, 'Profit to share') };
  if (after.dealer - before.dealer !== 10000) fail(`dealer sales went ${before.dealer} -> ${after.dealer}`); else ok('dealer income counted');
  if (after.exp - before.exp !== 2500) fail(`expenses went ${before.exp} -> ${after.exp}`); else ok('expense counted');
  if (Math.abs(after.profit - (after.store + after.dealer - after.exp)) > 0.01) fail('profit != store + dealer - expenses'); else ok(`profit ${after.profit} = ${after.store} + ${after.dealer} - ${after.exp}`);
  const cardA = page.locator('li', { hasText: 'E2E Partner A' });
  const amtA = money(await cardA.locator('p.text-lg').innerText());
  if (Math.abs(amtA - Math.round(after.profit * 60) / 100) > 0.01) fail(`partner A got ${amtA}, expected 60 % of ${after.profit}`); else ok(`partner A 60 % = ${amtA}`);

  await page.screenshot({ path: `${OUT}/bp-1440-light.png`, fullPage: true });
  for (const [theme, w] of [['dark', 1440], ['light', 390], ['dark', 390]]) {
    const o = await open(theme, w);
    await o.page.goto(`${BASE}/admin/business-partners`, { waitUntil: 'load' });
    await o.page.getByText('E2E Partner A').waitFor({ timeout: 30000 });
    await o.page.waitForTimeout(1500);
    const overflow = await o.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) fail(`${theme} ${w}: page scrolls sideways by ${overflow}px`);
    await o.page.screenshot({ path: `${OUT}/bp-${w}-${theme}.png`, fullPage: true });
    await o.ctx.close();
  }
  ok('screenshots saved');

  // 6. Clean up through the UI (tests the remove flow).
  for (const label of ['E2E rent', 'E2E dealer cash']) {
    await page.locator('li', { hasText: label }).getByRole('button', { name: 'Remove entry' }).click();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await page.getByText(label).waitFor({ state: 'detached' });
  }
  for (const name of ['E2E Partner A', 'E2E Partner B']) {
    await page.getByRole('button', { name: `Remove ${name}` }).click();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await page.getByText(name).waitFor({ state: 'detached' });
  }
  ok('test partners and entries removed');
  await ctx.close();
} catch (e) {
  fail(e.message);
} finally {
  const real = errors.filter((e) => !/favicon|ERR_BLOCKED|net::ERR_ABORTED|gtag|googletagmanager/i.test(e));
  if (real.length) { console.log('console errors:'); real.slice(0, 10).forEach((e) => console.log(' -', e.slice(0, 200))); }
  else ok('no console errors');
  await browser.close();
}
