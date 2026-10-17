// node scripts/template-update.mjs   (npm run template-update)
// Run in a client copy. Takes the template's fixes since the commit in .template-base:
// - fetches the `template` remote (fetch only; pushing to it is disabled);
// - lists the template's changes as plain adds, edits and deletes (a rename is a delete plus an add, so
//   the old file goes too) and patches them in ONE FILE AT A TIME (git apply --3way on that file's own
//   diff), so a file that cannot apply never blocks the others;
// - skips the template's own files (its CLAUDE.md, README.md, docs/HANDOFF.md, docs/template/build/,
//   docs/template/client/) and reports as "already done" a deleted file the copy no longer has and an
//   added or edited file the copy already has in its new form;
// - for every file that still fails (a conflict, or a file the copy no longer has), prints the exact
//   `git diff` to merge by hand;
// - lists changed starter files (runbook, REQUIREMENTS, PROGRESS, README, HANDOFF): the copy's
//   versions hold client data, so port those changes by hand with the printed git diff command;
// - writes the new template commit into .template-base only when every file was applied or was
//   already done. Otherwise it stays at the old commit: merge the listed files, then write the printed
//   commit into .template-base yourself (until then a re-run skips what is already done).
// Then run `node scripts/check.mjs` and commit.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { splitTemplateChanges } from './lib/newClient.mjs';
import {
  classifyApplyFailure,
  manualDiffCommand,
  parseNameStatus,
  planFile,
  summarizeUpdate,
} from './lib/templateUpdate.mjs';

const fail = (msg) => {
  console.error(`template-update: ${msg}`);
  process.exit(1);
};
// File names are literal paths, never patterns (a file called [slug].tsx is not a glob).
const env = { ...process.env, GIT_LITERAL_PATHSPECS: '1' };
const run = (args, input, encoding = 'utf8') => {
  const r = spawnSync('git', args, { encoding, input, env, maxBuffer: 256 * 1024 * 1024 });
  return { ok: r.status === 0, out: r.stdout ?? (encoding === 'utf8' ? '' : Buffer.alloc(0)), err: String(r.stderr ?? '') };
};
const git = (args, input) => run(args, input);
const must = (args) => {
  const r = git(args);
  if (!r.ok) fail(`git ${args.join(' ')} failed:\n${r.err}`);
  return r.out;
};

if (!existsSync('.template-base')) fail('run this from the root of a client copy (no .template-base here).');
if (must(['status', '--porcelain', '--untracked-files=no']).trim()) fail('commit or stash your changes first.');

// A copy made before the push URL was disabled could still push into the template: fix that here.
const pushUrl = git(['remote', 'get-url', '--push', 'template']);
if (!pushUrl.ok) fail('this copy has no `template` remote (git remote add template <path to the Ecommerce Template>).');
if (pushUrl.out.trim() !== 'DISABLED') {
  must(['remote', 'set-url', '--push', 'template', 'DISABLED']);
  console.log('Disabled the push URL of the `template` remote (it is fetch-only).');
}
must(['fetch', 'template']);

const base = readFileSync('.template-base', 'utf8').trim();
const head = must(['rev-parse', 'template/main']).trim();
if (base === head) {
  console.log(`Up to date with the template (${head.slice(0, 7)}).`);
  process.exit(0);
}

const changes = parseNameStatus(must(['diff', '--no-renames', '--name-status', '-z', base, head]));
const statusOf = new Map(changes.map((c) => [c.path, c.status]));
const { apply, starters } = splitTemplateChanges(changes.map((c) => c.path));
console.log(`Template ${base.slice(0, 7)} -> ${head.slice(0, 7)}: ${changes.length} changed file(s), ${apply.length} to patch in.`);

/** True when the copy's file is byte for byte the template's new version (line endings as git stores them). */
const sameAsHead = (file) => {
  const mine = git(['hash-object', '--', file]);
  const theirs = git(['rev-parse', '--verify', '--quiet', `${head}:${file}`]);
  return mine.ok && theirs.ok && mine.out.trim() === theirs.out.trim();
};

const results = [];
for (const file of apply) {
  const status = statusOf.get(file);
  const inCopy = existsSync(file);
  const plan = planFile({ status, inCopy, sameAsHead: inCopy && status !== 'D' && sameAsHead(file) });
  if (plan.action === 'done') {
    results.push({ file, outcome: 'done', note: plan.reason });
    continue;
  }
  if (plan.action === 'manual') {
    results.push({ file, outcome: 'manual', note: plan.reason });
    continue;
  }
  const patch = run(['diff', '--no-renames', '--binary', base, head, '--', file], undefined, 'buffer');
  if (!patch.ok) fail(`git diff for ${file} failed:\n${patch.err}`);
  const r = run(['apply', '--3way', '--whitespace=nowarn'], patch.out, 'buffer');
  if (r.ok) {
    results.push({ file, outcome: 'applied' });
    continue;
  }
  const hasUnmergedEntry = git(['ls-files', '--unmerged', '--', file]).out.trim() !== '';
  const detail = r.err.split(/\r?\n/).filter((l) => /^(error|warning):/.test(l)).join(' / ');
  results.push({ file, outcome: 'manual', note: `${classifyApplyFailure({ hasUnmergedEntry })}${detail ? ` (${detail})` : ''}` });
}

const { applied, done, manual, advance } = summarizeUpdate(results);
if (applied.length) {
  console.log(`\nPatched in (${applied.length}), staged:`);
  for (const r of applied) console.log(`  ${r.file}`);
}
if (done.length) {
  console.log(`\nAlready done in this copy (${done.length}):`);
  for (const r of done) console.log(`  ${r.file}  (${r.note})`);
}
if (manual.length) {
  console.log(`\nNeeds a manual merge (${manual.length}). Everything else above was applied; these were not:`);
  for (const r of manual) {
    console.log(`  ${r.file}: ${r.note}`);
    console.log(`    ${manualDiffCommand(base, head, r.file)}`);
  }
  console.log(`\n.template-base stays at ${base.slice(0, 7)}, because the files above are not merged yet.`);
  console.log(`After you have merged them and run the checks, set it to the new commit (Git Bash: echo ${head} > .template-base).`);
} else {
  writeFileSync('.template-base', `${head}\n`);
  console.log(`\nEvery changed file is applied or already done; .template-base is now ${head.slice(0, 7)}.`);
}

if (starters.length) {
  console.log('\nStarter files changed in the template. Port what applies to this store by hand:');
  for (const s of starters) console.log(`  ${s.to}:  git diff ${base.slice(0, 7)} ${head.slice(0, 7)} -- ${s.from}`);
}
console.log('\nNext: node scripts/check.mjs, then commit ("chore: template update to ' + head.slice(0, 7) + '").');
if (!advance) process.exit(1);
