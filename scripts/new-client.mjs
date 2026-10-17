// node scripts/new-client.mjs "<Client Name>" [--dest <folder>] [--no-install]
//   (npm run new-client -- "<Client Name>")
// Makes a clean client copy of this template, then prints what to do next.
// - Files: the template's committed files only (git ls-files), so no .env, keys, node_modules,
//   dist or screenshots; minus the template-only files in scripts/lib/newClient.mjs.
// - Starters from docs/template/client/ at the copy's root, with the client name, date and template
//   commit filled in; an empty client-brief/ (git-ignored except its README).
// - .env: only the demo project's public web config, so the copy previews the demo data until
//   Phase 5. No admin key is copied.
// - A fresh git repo with one commit, this template as the `template` remote (fetch only: its push URL is
//   DISABLED), and .template-base holding the template commit (template fixes are taken as a patch from it;
//   see the copy's CLAUDE.md).
// - npm ci (skip with --no-install).
// Default folder: next to this template, named after the client. Commit the template first.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { BRIEF_README, STARTERS, fillTokens, previewEnv, shouldCopy, validateClientName } from './lib/newClient.mjs';
import { updateProgress } from './lib/progress.mjs';

const fail = (msg) => {
  console.error(`new-client: ${msg}`);
  process.exit(1);
};

let destArg = '';
let install = true;
const rest = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--dest') destArg = argv[++i] || '';
  else if (argv[i] === '--no-install') install = false;
  else rest.push(argv[i]);
}
const clientName = rest.join(' ').trim();
const problem = validateClientName(clientName);
if (problem) fail(`${problem}\nUsage: node scripts/new-client.mjs "<Client Name>" [--dest <folder>] [--no-install]`);

const git = (cwd, ...a) => {
  const r = spawnSync('git', a, { cwd, encoding: 'utf8' });
  if (r.status !== 0) fail(`git ${a.join(' ')} failed:\n${r.stderr}`);
  return r.stdout;
};

const TEMPLATE = process.cwd();
if (!existsSync(join(TEMPLATE, 'docs/template/client/CLAUDE.md'))) fail('run this from the Ecommerce Template folder.');
if (git(TEMPLATE, 'status', '--porcelain', '--untracked-files=no').trim()) fail('the template has uncommitted changes; commit them first so the copy matches a commit.');
const commit = git(TEMPLATE, 'rev-parse', 'HEAD').trim();
const short = commit.slice(0, 7);

const DEST = resolve(destArg || join(dirname(TEMPLATE), clientName));
if (DEST === TEMPLATE || DEST.startsWith(TEMPLATE + sep)) fail('the copy cannot go inside the template folder.');
if (existsSync(DEST) && readdirSync(DEST).length) fail(`${DEST} already exists and is not empty.`);

// 1. Files
const files = git(TEMPLATE, 'ls-files', '-z').split('\0').filter(Boolean).filter(shouldCopy);
for (const f of files) {
  mkdirSync(dirname(join(DEST, f)), { recursive: true });
  copyFileSync(join(TEMPLATE, f), join(DEST, f));
}

// 2. Starters, brief folder, template base, preview env
const now = new Date(); // local date: toISOString() is UTC, so before 05:30 in India it would print yesterday
const pad = (n) => String(n).padStart(2, '0');
const tokens = { clientName, date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`, templateCommit: short };
for (const [from, to] of Object.entries(STARTERS)) {
  let text = fillTokens(readFileSync(join(TEMPLATE, from), 'utf8'), tokens);
  if (to === 'PROGRESS.md') text = updateProgress(text);
  mkdirSync(dirname(join(DEST, to)), { recursive: true });
  writeFileSync(join(DEST, to), text);
}
mkdirSync(join(DEST, 'client-brief'), { recursive: true });
writeFileSync(join(DEST, 'client-brief', 'README.md'), BRIEF_README);
writeFileSync(join(DEST, '.template-base'), `${commit}\n`);
const envFile = join(TEMPLATE, '.env');
const hasEnv = existsSync(envFile);
if (hasEnv) writeFileSync(join(DEST, '.env'), previewEnv(readFileSync(envFile, 'utf8')));

// 3. Git
git(DEST, 'init', '-q', '-b', 'main');
git(DEST, 'add', '-A');
git(DEST, 'commit', '-q', '-m', `chore: ${clientName} store, copied from the Ecommerce Template ${short}`);
git(DEST, 'remote', 'add', 'template', TEMPLATE);
git(DEST, 'remote', 'set-url', '--push', 'template', 'DISABLED'); // fetch only: a stray `git push` must never write into the template
git(DEST, 'fetch', '-q', 'template');

// 4. Packages
if (install) {
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci'], { cwd: DEST, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) fail(`npm ci failed in ${DEST}; run it there by hand.`);
}

console.log(`
${clientName} is ready: ${DEST}
  ${files.length} files from template commit ${short}${hasEnv ? '; .env previews the demo project' : '; no .env (the template has none): add the demo web config before previewing'}
Next:
  1. Put the client's documents in ${join(DEST, 'client-brief')}
  2. Open that folder in VS Code
  3. Type: Proceed`);
