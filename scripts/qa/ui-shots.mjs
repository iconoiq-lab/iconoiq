// Screenshots for the UI review: each page at each width and theme, cut into
// readable slices, with console errors, failed requests and (optionally) axe
// accessibility results in a log next to the images. Run from the repo root with
// the dev server up (never port 5173):
//   node scripts/qa/ui-shots.mjs --out <dir> [--as guest|shopper|admin] [--widths 390,1440]
//     [--themes light,dark] [--axe] [--full] [--fold] [--mode viewport|full] [--max 14]
//     [--with-loader] [--prefix x-] [--base http://127.0.0.1:5182] [--block-firestore] <path> [<path> ...]
// Default: one image per screen while scrolling (-v01, -v02...), as a visitor sees it.
// --mode full: two-screen slices of the full page (-s01...), fewer images, but fixed bars
// show where they sat in the first screen (the fixed grain overlay is hidden in these
// captures: it would show as a lighter band at every slice join). --fold: first screen only.
// --full: also save the whole page as one image. Git Bash: prefix MSYS_NO_PATHCONV=1 so "/"
// paths survive.
// --block-firestore aborts every Firestore request: what a fresh client Firebase (no products,
// categories or home content yet) looks like. The preview otherwise shows the demo data. The requests are
// aborted, not answered with empty collections, so a block may stay in its loading skeleton or use its defaults
// instead of hiding: this does not prove a block hides when its collection is empty.
// A blank slice almost always means a lazy chunk had not loaded yet (the dev server compiles
// each one on first request): run it again before calling it a page bug.
// --axe loads axe-core from cdnjs at run time, so it needs a network.
// To read many images cheaply, tile them into one: node scripts/qa/sheet.mjs --out sheet.png <images...>
// Logins: shopper from scripts/qa/shopper.local, admin from scripts/qa/admin.local
// (written by ui-fixtures.mjs). Neither is printed.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { THEME_KEY } from '../lib/brand.mjs';
import { countIssues } from '../lib/checkReport.mjs';

const { chromium } = createRequire('C:/Users/chala/AppData/Roaming/npm/node_modules/playwright/package.json')('playwright');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);
const valued = new Set(['out', 'as', 'widths', 'themes', 'prefix', 'base', 'mode', 'max']);
const paths = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && valued.has(args[i - 1].replace(/^--/, ''))));

const BASE = opt('base', 'http://127.0.0.1:5182');
const OUT = opt('out');
const AS = opt('as', 'guest');
const WIDTHS = opt('widths', '390,1440').split(',').map(Number);
const THEMES = opt('themes', 'light,dark').split(',');
const PREFIX = opt('prefix', '');
if (!OUT || paths.length === 0) {
  console.log('usage: node scripts/qa/ui-shots.mjs --out <dir> [--as guest|shopper|admin] <path> ...');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const creds = AS === 'shopper' ? JSON.parse(readFileSync('scripts/qa/shopper.local', 'utf8'))
  : AS === 'admin' ? JSON.parse(readFileSync('scripts/qa/admin.local', 'utf8')) : null;
const HEIGHT = (w) => (w < 768 ? 844 : w < 1200 ? 1024 : 900);
const slug = (p) => (p === '/' ? 'home' : p.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '')) || 'home';

async function login(ctx) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}${AS === 'admin' ? '/admin' : '/login'}`, { waitUntil: 'load' });
  await page.locator('input[type="email"]').first().fill(creds.email);
  await page.locator('input[type="password"]').first().fill(creds.password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => (AS === 'admin' ? /dashboard/.test(u.pathname) : !/login/.test(u.pathname)), { timeout: 30000 })
    .catch(() => console.log('login did not redirect; continuing'));
  await page.waitForTimeout(2000);
  return page;
}

async function settle(page) {
  // Real content, no full-screen spinner, nothing marked busy (the dev server can take ~6 s).
  // The 404 page has under 200 characters, so its own heading counts as content too.
  await page.waitForFunction(() => (document.body.innerText.length > 200 || /page not found/i.test(document.body.innerText))
    && !document.querySelector('.min-h-screen > .animate-spin, .min-h-screen .animate-spin:only-child, [aria-busy="true"]'),
  null, { timeout: 30000 }).catch(() => console.log('  still loading after 30 s'));
  // Scroll through so lazy images and scroll-revealed sections render as a visitor sees them.
  // Twice, and until the page height stops changing: on the dev server a lazy home section
  // compiles on its first request (seconds), so one quick pass leaves blank gaps.
  for (let pass = 0; pass < 2; pass++) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 200)); // faster than this and lazy sections stay blank
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(pass === 0 ? 3000 : 1200);
  }
  let last = -1;
  for (let i = 0; i < 8; i++) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    if (h === last) break;
    last = h;
    await page.waitForTimeout(500);
  }
}

const browser = await chromium.launch();
try {
  for (const theme of THEMES) {
    for (const w of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: HEIGHT(w) }, colorScheme: theme, deviceScaleFactor: 1 });
      await ctx.addInitScript(([k, t, skipLoader]) => {
        try {
          localStorage.setItem(k, t);
          if (skipLoader) sessionStorage.setItem('appLoaded', 'true');
        } catch { /* storage unavailable */ }
      }, [THEME_KEY, theme, !flag('with-loader')]);
      if (flag('block-firestore')) await ctx.route('**/firestore.googleapis.com/**', (r) => r.abort());
      const page = creds ? await login(ctx) : await ctx.newPage();
      for (const path of paths) {
        const name = `${PREFIX}${slug(path)}-${w}-${theme}`;
        const log = { url: path, width: w, theme, as: AS, consoleErrors: [], pageErrors: [], failedRequests: [] };
        const onConsole = (m) => { if (m.type() === 'error') log.consoleErrors.push(m.text().slice(0, 300)); };
        const onError = (e) => log.pageErrors.push(String(e).slice(0, 300));
        const onResponse = (r) => { if (r.status() >= 400) log.failedRequests.push(`${r.status()} ${r.url().slice(0, 200)}`); };
        page.on('console', onConsole);
        page.on('pageerror', onError);
        page.on('response', onResponse);
        await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
        await settle(page);
        log.finalUrl = new URL(page.url()).pathname;
        const total = await page.evaluate(() => document.documentElement.scrollHeight);
        if (flag('fold')) {
          await page.screenshot({ path: `${OUT}/${name}-fold.png` });
          log.slices = 1;
        } else if (opt('mode', 'viewport') === 'full') {
          // Two screens per image. Fixed bars (header, bottom nav, sticky buy bar) stay where
          // they sat in the first screen, so judge overlaps from viewport shots instead.
          const sliceH = HEIGHT(w) * 2;
          // The grain overlay is position: fixed, so in a fullPage capture it covers only the first screen.
          await page.addStyleTag({ content: 'body::after { display: none !important; }' });
          let n = 1;
          for (let y = 0; y < total; y += sliceH) {
            const height = Math.min(sliceH, total - y);
            if (height < 40) break;
            await page.screenshot({ path: `${OUT}/${name}-s${String(n++).padStart(2, '0')}.png`, fullPage: true, clip: { x: 0, y, width: w, height } });
          }
          log.slices = n - 1;
        } else {
          // What a visitor sees at each scroll position; screens overlap by 100px so
          // nothing hides under the sticky header.
          const step = HEIGHT(w) - 100;
          const max = Number(opt('max', '14'));
          let n = 1;
          for (let y = 0; y < total && n <= max; y += step) {
            await page.evaluate((top) => window.scrollTo(0, top), y);
            await page.waitForTimeout(450);
            await page.screenshot({ path: `${OUT}/${name}-v${String(n++).padStart(2, '0')}.png` });
            if (y + HEIGHT(w) >= total) break;
          }
          log.slices = n - 1;
          await page.evaluate(() => window.scrollTo(0, 0));
        }
        if (flag('full')) await page.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true });
        if (flag('axe')) {
          await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' }).catch(() => {});
          log.axe = await page.evaluate(async () => {
            if (!window.axe) return 'axe did not load';
            const r = await window.axe.run(document, { resultTypes: ['violations'] });
            return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, count: v.nodes.length,
              examples: v.nodes.slice(0, 4).map((n) => ({ target: n.target.join(' '), summary: (n.failureSummary || '').slice(0, 240) })) }));
          });
        }
        page.off('console', onConsole);
        page.off('pageerror', onError);
        page.off('response', onResponse);
        writeFileSync(`${OUT}/${name}.log.json`, JSON.stringify(log, null, 2));
        const issues = countIssues(log); // a failed response and its console error count once; the log file keeps both
        console.log(`shot ${name} (${log.slices ?? 1} image(s)${issues ? `, ${issues} console/network issue(s)` : ''}${log.finalUrl !== path.split('?')[0] ? `, ended at ${log.finalUrl}` : ''})`);
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
process.exit(0);
