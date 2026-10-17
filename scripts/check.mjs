// node scripts/check.mjs [--no-shots] [path ...]          (npm run check -- [args])
// The "done" check for a store: tests, build, then screenshots of the built site at 390 px and
// 1440 px, light and dark (first screen of each page). Exit code 1 when any step fails.
// Screenshots go to ../<this folder's name>-shots/check-<date-time>/, each with its console and
// network log beside it (a failed request and its console error count as one issue). The built site is served by `vite preview` on 127.0.0.1:5183 (never
// 5173, never 0.0.0.0) and stopped afterwards. Default pages: / /products /cart /about /contact
// /auth/login; pass others (for example /product/<id>). Git Bash: prefix MSYS_NO_PATHCONV=1 when
// passing paths.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { failedTestNames, templateDefaultsLeft } from './lib/checkReport.mjs';

const args = process.argv.slice(2);
const SHOTS = !args.includes('--no-shots');
const given = args.filter((a) => a.startsWith('/'));
const PAGES = given.length ? given : ['/', '/products', '/cart', '/about', '/contact', '/auth/login'];
const PORT = 5183;
const BASE = `http://127.0.0.1:${PORT}`;
const WIN = process.platform === 'win32';

// npm and npx are .cmd files on Windows and need a shell; their arguments here have no spaces.
const npm = (...a) => spawnSync(WIN ? 'npm.cmd' : 'npm', a, { stdio: 'inherit', shell: WIN }).status === 0;
// node runs without a shell, so paths with spaces stay one argument.
const node = (...a) => spawnSync(process.execPath, a, { stdio: 'inherit' }).status === 0;

// `npm test`, echoed as it runs and kept so the summary can name the failing tests (TAP "not ok" lines).
function runTests() {
  return new Promise((done) => {
    const child = spawn(WIN ? 'npm.cmd' : 'npm', ['test', '--', '--test-reporter=tap'], { stdio: ['inherit', 'pipe', 'pipe'], shell: WIN });
    let output = '';
    const keep = (chunk) => {
      process.stdout.write(chunk);
      output += chunk;
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    child.on('close', (code) => done({ ok: code === 0, output }));
  });
}

const results = [];
const step = (name, ok, details = []) => {
  results.push([name, ok, details]);
  console.log(`\n== ${name}: ${ok ? 'ok' : 'FAILED'} ==\n`);
  return ok;
};

async function waitFor(url, ms = 60_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const tests = await runTests();
const failing = failedTestNames(tests.output);
step('tests', tests.ok, tests.ok ? [] : failing.length ? failing : ['(no "not ok" line found: read the test output above)']);
const built = step('build', npm('run', 'build'));

let shotsDir = '';
if (SHOTS && !built) console.log('Screenshots skipped: the build failed.');
if (SHOTS && built) {
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`; // local time
  shotsDir = resolve('..', `${basename(process.cwd())}-shots`, `check-${stamp}`);
  const server = spawn(WIN ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', shell: WIN });
  try {
    if (step('preview server', await waitFor(BASE))) {
      step('screenshots', node('scripts/qa/ui-shots.mjs', '--out', shotsDir, '--widths', '390,1440', '--themes', 'light,dark', '--fold', '--base', BASE, ...PAGES));
    }
  } finally {
    if (WIN) spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    else server.kill();
  }
}

console.log('\nCheck summary');
for (const [name, ok, details] of results) {
  console.log(`  ${ok ? 'ok    ' : 'FAILED'} ${name}`);
  for (const line of details) console.log(`           ${line}`);
}
if (shotsDir) console.log(`  screenshots: ${shotsDir} (read the images and the .log.json beside each)`);
// In a client copy (no docs/template/client/), warn while template promises are still set. Not a failure:
// Phase 0 runs before Phase 1 replaces them, but nothing should launch with them.
if (!existsSync('docs/template/client')) {
  const left = templateDefaultsLeft(readFileSync('src/config/brand.ts', 'utf8'), readFileSync('src/services/siteSettingsService.ts', 'utf8'));
  for (const line of left) console.log(`  warning: ${line} (replace it in Phase 1: docs/template/PHASE1.md)`);
}
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
