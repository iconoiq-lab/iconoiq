import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitTemplateChanges } from '../scripts/lib/newClient.mjs';
import {
  classifyApplyFailure,
  manualDiffCommand,
  parseNameStatus,
  planFile,
  summarizeUpdate,
} from '../scripts/lib/templateUpdate.mjs';

test('template update applies store files, lists starter changes, skips template-only files', () => {
  const r = splitTemplateChanges([
    'src/App.tsx',
    'docs/template/FEATURES.md',
    'docs/HANDOFF.md',
    'CLAUDE.md',
    'README.md',
    'docs/template/build/plan.md',
    'scripts/qa/template-shots.sh',
    'docs/template/client/CLAUDE.md',
    'docs/template/client/PROGRESS.md',
  ]);
  assert.deepEqual(r.apply, ['src/App.tsx', 'docs/template/FEATURES.md']);
  assert.deepEqual(r.starters, [
    { from: 'docs/template/client/CLAUDE.md', to: 'CLAUDE.md' },
    { from: 'docs/template/client/PROGRESS.md', to: 'PROGRESS.md' },
  ]);
});

test('template update with no changes', () => {
  assert.deepEqual(splitTemplateChanges([]), { apply: [], starters: [] });
});

// ---- per-file decisions (pure) ----

test('parseNameStatus reads git diff --name-status -z (names with spaces and brackets stay whole)', () => {
  const out = ['M', 'src/App.tsx', 'D', 'src/old name.tsx', 'A', 'src/[slug].tsx', ''].join('\0');
  assert.deepEqual(parseNameStatus(out), [
    { status: 'M', path: 'src/App.tsx' },
    { status: 'D', path: 'src/old name.tsx' },
    { status: 'A', path: 'src/[slug].tsx' },
  ]);
  assert.deepEqual(parseNameStatus(''), []);
});

test('planFile: a deleted file is deleted when the copy has it and already done when it does not', () => {
  assert.deepEqual(planFile({ status: 'D', inCopy: true, sameAsHead: false }), { action: 'apply' });
  assert.equal(planFile({ status: 'D', inCopy: false, sameAsHead: false }).action, 'done');
});

test('planFile: an added file is applied when new, done when identical, manual when the copy has another file there', () => {
  assert.deepEqual(planFile({ status: 'A', inCopy: false, sameAsHead: false }), { action: 'apply' });
  assert.equal(planFile({ status: 'A', inCopy: true, sameAsHead: true }).action, 'done');
  assert.equal(planFile({ status: 'A', inCopy: true, sameAsHead: false }).action, 'manual');
});

test('planFile: an edited file is applied, done when the copy already has the new version, manual when the copy lost the file', () => {
  assert.deepEqual(planFile({ status: 'M', inCopy: true, sameAsHead: false }), { action: 'apply' });
  assert.equal(planFile({ status: 'M', inCopy: true, sameAsHead: true }).action, 'done');
  const gone = planFile({ status: 'M', inCopy: false, sameAsHead: false });
  assert.equal(gone.action, 'manual');
  assert.match(gone.reason ?? '', /no longer has it/);
  assert.equal(planFile({ status: 'T', inCopy: true, sameAsHead: false }).action, 'apply');
});

test('summarizeUpdate moves .template-base on only when no file is left to merge', () => {
  const ok = summarizeUpdate([
    { file: 'a', outcome: 'applied' },
    { file: 'b', outcome: 'done' },
  ]);
  assert.equal(ok.advance, true);
  assert.equal(ok.applied.length, 1);
  assert.equal(ok.done.length, 1);
  const stuck = summarizeUpdate([
    { file: 'a', outcome: 'applied' },
    { file: 'b', outcome: 'manual' },
  ]);
  assert.equal(stuck.advance, false);
  assert.deepEqual(stuck.manual.map((r) => r.file), ['b']);
  assert.equal(summarizeUpdate([]).advance, true);
});

test('manualDiffCommand prints the exact git diff, quoting names that need it', () => {
  const base = 'a'.repeat(40);
  const head = 'b'.repeat(40);
  assert.equal(manualDiffCommand(base, head, 'src/App.tsx'), 'git diff --no-renames aaaaaaa bbbbbbb -- src/App.tsx');
  assert.equal(manualDiffCommand(base, head, 'src/my file.tsx'), 'git diff --no-renames aaaaaaa bbbbbbb -- "src/my file.tsx"');
  assert.equal(manualDiffCommand(base, head, 'src/[slug].tsx'), 'git diff --no-renames aaaaaaa bbbbbbb -- ":(literal)src/[slug].tsx"');
});

test('classifyApplyFailure tells a conflict from a refusal', () => {
  assert.match(classifyApplyFailure({ hasUnmergedEntry: true }), /^conflict/);
  assert.match(classifyApplyFailure({ hasUnmergedEntry: false }), /^refused/);
});

// ---- the script, end to end, on two throwaway git repos ----

const SCRIPT = fileURLToPath(new URL('../scripts/template-update.mjs', import.meta.url));
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@example.com',
  GIT_TERMINAL_PROMPT: '0',
};
const gitIn = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd, env: GIT_ENV, encoding: 'utf8' }).trim();
const lines = (prefix: string, n = 12) => Array.from({ length: n }, (_, i) => `${prefix} line ${i + 1}`).join('\n') + '\n';
const put = (root: string, rel: string, text: string | Buffer) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};

/**
 * A "template" with two commits (the base; then an edit, a delete, a rename, adds, a bracketed file name
 * and an edit to a file the copy deleted) and a "copy" cloned from the base with its own changes: it
 * already deleted e.txt and already has d.txt exactly as the template adds it.
 */
function scenario(opts: { copyDeletesC: boolean; copyConflictsOnA: boolean }) {
  const root = mkdtempSync(join(tmpdir(), 'tpl-update-'));
  const tpl = join(root, 'template');
  const copy = join(root, 'copy');
  mkdirSync(tpl);
  gitIn(tpl, 'init', '-q', '-b', 'main');
  put(tpl, 'a.txt', lines('a'));
  put(tpl, 'b.txt', lines('b'));
  put(tpl, 'c.txt', lines('c'));
  put(tpl, 'e.txt', lines('e'));
  put(tpl, 'old-name.txt', lines('renamed'));
  put(tpl, 'dir/[slug].txt', lines('slug'));
  put(tpl, 'CLAUDE.md', 'template runbook\n');
  gitIn(tpl, 'add', '-A');
  gitIn(tpl, 'commit', '-q', '-m', 'base');
  const base = gitIn(tpl, 'rev-parse', 'HEAD');

  // the copy starts as a clone of the base and then goes its own way
  gitIn(root, 'clone', '-q', '-b', 'main', tpl, copy);
  gitIn(copy, 'config', 'core.autocrlf', 'false'); // the real copies pin LF with .gitattributes; keep this scenario independent of the machine's setting
  gitIn(copy, 'remote', 'rename', 'origin', 'template');
  put(copy, '.template-base', `${base}\n`);
  rmSync(join(copy, 'e.txt'));
  if (opts.copyDeletesC) rmSync(join(copy, 'c.txt'));
  put(copy, 'a.txt', opts.copyConflictsOnA ? lines('a').replace('a line 1\n', 'copy line 1\n') : lines('a') + 'copy footer\n');
  put(copy, 'd.txt', lines('d'));
  put(copy, 'CLAUDE.md', 'client runbook\n');
  gitIn(copy, 'add', '-A');
  gitIn(copy, 'commit', '-q', '-m', 'copy work');

  // the template's fixes: edit a, delete b and e, rename old-name, add d (same as the copy's) and a binary file,
  // edit the bracketed file, edit c, and change its own runbook
  put(tpl, 'a.txt', lines('a').replace('a line 1\n', 'template line 1\n'));
  rmSync(join(tpl, 'b.txt'));
  rmSync(join(tpl, 'e.txt'));
  gitIn(tpl, 'mv', 'old-name.txt', 'new-name.txt');
  put(tpl, 'd.txt', lines('d'));
  put(tpl, 'logo.bin', Buffer.from([0, 1, 2, 3, 255, 254, 0, 10]));
  put(tpl, 'dir/[slug].txt', lines('slug').replace('slug line 6\n', 'slug fixed 6\n'));
  put(tpl, 'c.txt', lines('c').replace('c line 3\n', 'c fixed 3\n'));
  put(tpl, 'CLAUDE.md', 'template runbook v2\n');
  gitIn(tpl, 'add', '-A');
  gitIn(tpl, 'commit', '-q', '-m', 'template fixes');
  const head = gitIn(tpl, 'rev-parse', 'HEAD');
  return { root, tpl, copy, base, head };
}

const runUpdate = (copy: string) => {
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: copy, env: GIT_ENV, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};
const read = (root: string, rel: string) => readFileSync(join(root, rel), 'utf8');

test('template-update: a delete the copy already did, a rename and an identical add never block the update', () => {
  const s = scenario({ copyDeletesC: false, copyConflictsOnA: false });
  try {
    const r = runUpdate(s.copy);
    assert.equal(r.code, 0, r.out);
    // e.txt (deleted on both sides) and d.txt (identical add) are reported as already done
    assert.match(r.out, /Already done in this copy \(2\)/);
    assert.match(r.out, /e\.txt {2}\(the template deleted it and this copy no longer has it\)/);
    assert.match(r.out, /d\.txt {2}\(the template added it and this copy already has the same file\)/);
    // the edit merged with the copy's own footer, the delete, the rename (old file gone, new file there),
    // the binary add, the bracketed name and the edit of c
    assert.equal(read(s.copy, 'a.txt'), lines('a').replace('a line 1\n', 'template line 1\n') + 'copy footer\n');
    assert.equal(existsSync(join(s.copy, 'b.txt')), false);
    assert.equal(existsSync(join(s.copy, 'old-name.txt')), false, 'a rename deletes the old file');
    assert.equal(read(s.copy, 'new-name.txt'), lines('renamed'));
    assert.deepEqual([...readFileSync(join(s.copy, 'logo.bin'))], [0, 1, 2, 3, 255, 254, 0, 10]);
    assert.match(read(s.copy, 'dir/[slug].txt'), /slug fixed 6/);
    assert.match(read(s.copy, 'c.txt'), /c fixed 3/);
    // the template's own file is not touched, and the base moves
    assert.equal(read(s.copy, 'CLAUDE.md'), 'client runbook\n');
    assert.equal(read(s.copy, '.template-base').trim(), s.head);
    assert.match(r.out, /\.template-base is now/);
    // after committing, a re-run has nothing to do
    gitIn(s.copy, 'add', '-A');
    gitIn(s.copy, 'commit', '-q', '-m', 'update');
    assert.match(runUpdate(s.copy).out, /Up to date/);
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
});

test('template-update: a file the copy deleted but the template edited is listed with its git diff, the rest still applies, .template-base stays', () => {
  const s = scenario({ copyDeletesC: true, copyConflictsOnA: false });
  try {
    const r = runUpdate(s.copy);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /Needs a manual merge \(1\)/);
    assert.match(r.out, /c\.txt: the template changed it, but this copy no longer has it/);
    assert.ok(r.out.includes(`git diff --no-renames ${s.base.slice(0, 7)} ${s.head.slice(0, 7)} -- c.txt`), r.out);
    assert.match(r.out, /\.template-base stays at/);
    assert.equal(read(s.copy, '.template-base').trim(), s.base, '.template-base is not moved');
    // the other files were applied anyway (what the old all-or-nothing apply got wrong)
    assert.equal(existsSync(join(s.copy, 'b.txt')), false);
    assert.equal(existsSync(join(s.copy, 'old-name.txt')), false);
    assert.equal(existsSync(join(s.copy, 'new-name.txt')), true);
    assert.match(read(s.copy, 'a.txt'), /template line 1/);
    assert.match(read(s.copy, 'dir/[slug].txt'), /slug fixed 6/);
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
});

test('template-update: a real conflict leaves markers in that file only and is listed as a conflict', () => {
  const s = scenario({ copyDeletesC: false, copyConflictsOnA: true });
  try {
    const r = runUpdate(s.copy);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /a\.txt: conflict: git left conflict markers/);
    assert.ok(r.out.includes('-- a.txt'), r.out);
    assert.match(read(s.copy, 'a.txt'), /<<<<<<<|>>>>>>>/);
    assert.equal(read(s.copy, '.template-base').trim(), s.base);
    assert.equal(existsSync(join(s.copy, 'new-name.txt')), true, 'the other files were still applied');
    assert.match(read(s.copy, 'c.txt'), /c fixed 3/);
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
});
