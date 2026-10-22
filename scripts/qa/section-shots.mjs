// Screenshots of every section version, for docs/template/SECTIONS.md and for choosing versions
// with a client in Phase 2.
//   node scripts/qa/section-shots.mjs --product <id> [--out <dir>] [--only key[:version],...] [--base <url>]
// Needs the dev server up (never port 5173, never 0.0.0.0):
//   npx vite --port 5182 --strictPort --host 127.0.0.1
// --product  a product id for the product page shots (productPage only; without it those are skipped).
// --out      default .shots/sections (git-ignored: screenshots are never committed).
//            One folder per version: <out>/<key>-<version>/, for example <out>/header-centered/.
// --only     run only these keys or key:version pairs, for example --only footer,hero:split.
// Reads SECTION_VERSIONS from src/config/sections.ts (Node 22 strips the types), so a new version
// is picked up with no change here. For each version it runs scripts/qa/ui-shots.mjs at 390 and
// 1440 px, light and dark, with ?sections=<key>:<version> on the page:
//   header, hero              /                    first screen (--fold)
//   productCard               /products            first screen (--fold)
//   categoryDisplay, footer   /                    scrolling mode, --max 14 (-v01, -v02... down the page)
//   productPage               /product/<id>        --mode full --max 4
// categoryDisplay and footer sit far down the home page, behind lazy sections. ui-shots --mode full
// (the plan's first choice) takes its slices without scrolling, so those slices came out blank.
// The scrolling mode shows each section as a visitor sees it; the home page is about 11 screens, so
// --max 14 reaches the footer. The category display is in the middle images, the footer in the last.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { SECTION_VERSIONS } from '../../src/config/sections.ts';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const out = resolve(opt('out', '.shots/sections'));
const base = opt('base', 'http://127.0.0.1:5182');
const product = opt('product');
const only = opt('only')?.split(',').filter(Boolean);

const CATEGORY_FOOTER_ARGS = ['--max', '14'];
const FOLD = ['--fold'];
// Per section: the page and the shot arguments. The file name prefix keeps the home page shots
// readable (ui-shots would start their names with a dash).
const SHOTS = {
  header: { page: '/', shot: FOLD },
  hero: { page: '/', shot: FOLD },
  productCard: { page: '/products', shot: FOLD },
  categoryDisplay: { page: '/', shot: CATEGORY_FOOTER_ARGS },
  footer: { page: '/', shot: CATEGORY_FOOTER_ARGS },
  productPage: { page: product ? `/product/${product}` : null, shot: ['--mode', 'full', '--max', '4'] },
};

const picked = (key, version) =>
  !only || only.some((o) => o === key || o === `${key}:${version}`);

const failed = [];
let count = 0;
for (const [key, versions] of Object.entries(SECTION_VERSIONS)) {
  const spec = SHOTS[key];
  if (!spec) {
    failed.push(`${key}: no shot defined in this script`);
    continue;
  }
  for (const version of versions) {
    if (!picked(key, version)) continue;
    if (!spec.page) {
      console.log(`skip ${key}-${version}: pass --product <id> for the product page`);
      failed.push(`${key}-${version}: skipped (no --product)`);
      continue;
    }
    const url = `${spec.page}?sections=${key}:${version}`;
    const dir = `${out}/${key}-${version}`;
    console.log(`\n== ${key}:${version}  ${url}`);
    const prefix = spec.page === '/' ? ['--prefix', 'home'] : [];
    const r = spawnSync(
      process.execPath,
      ['scripts/qa/ui-shots.mjs', '--out', dir, '--widths', '390,1440', '--themes', 'light,dark', '--base', base, ...prefix, ...spec.shot, url],
      { stdio: 'inherit' },
    );
    count += 1;
    if (r.status !== 0) failed.push(`${key}-${version}: ui-shots exited with ${r.status}`);
  }
}

console.log(`\nSection shots: ${count} version(s) run, output in ${out}`);
if (failed.length) {
  console.log('Problems:');
  for (const f of failed) console.log(`  ${f}`);
  process.exit(1);
}
