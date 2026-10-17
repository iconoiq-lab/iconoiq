// Pure helpers for scripts/template-update.mjs (tested in tests/template-update.test.ts).
// The script does the git work; the decisions are made here so they can be tested without git.

/**
 * `git diff --no-renames --name-status -z` output as [{ status, path }]. status is the first letter:
 * A (added), M (modified), D (deleted), T (type changed). --no-renames means a rename is a D plus an A.
 */
export function parseNameStatus(out) {
  const parts = out.split('\0');
  const changes = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    if (!parts[i]) break;
    changes.push({ status: parts[i][0], path: parts[i + 1] });
  }
  return changes;
}

/**
 * What to do with one changed template file in a client copy:
 * - `apply`: patch it in (git apply --3way, this file's own diff, so one file never blocks another);
 * - `done`: the copy is already where the template went, nothing to do;
 * - `manual`: the patch cannot apply here; merge by hand.
 * inCopy: the copy has a file at that path. sameAsHead: that file is identical to the template's new version.
 */
export function planFile({ status, inCopy, sameAsHead }) {
  if (status === 'D') {
    return inCopy
      ? { action: 'apply' }
      : { action: 'done', reason: 'the template deleted it and this copy no longer has it' };
  }
  if (status === 'A') {
    if (!inCopy) return { action: 'apply' };
    return sameAsHead
      ? { action: 'done', reason: 'the template added it and this copy already has the same file' }
      : { action: 'manual', reason: 'the template added it, but this copy already has a different file there' };
  }
  // M, T: the file changed in the template
  if (!inCopy) {
    return {
      action: 'manual',
      reason: 'the template changed it, but this copy no longer has it (deleted or moved); if you removed it on purpose there is nothing to merge',
    };
  }
  return sameAsHead
    ? { action: 'done', reason: 'this copy already has the template\'s new version' }
    : { action: 'apply' };
}

/** After `git apply --3way` failed for one file: conflict markers were written, or git refused and wrote nothing. */
export function classifyApplyFailure({ hasUnmergedEntry }) {
  return hasUnmergedEntry
    ? 'conflict: git left conflict markers in the file; resolve them, then `git add` it'
    : 'refused: git could not apply the change and left the file as it was';
}

/** A path as one shell word (Git Bash and PowerShell): quoted when it holds spaces or glob characters. */
export function shellPath(file) {
  const literal = /[*?[\\]/.test(file) ? `:(literal)${file}` : file;
  return /^[A-Za-z0-9_./@%+=:,-]+$/.test(literal) ? literal : `"${literal.replaceAll('"', '\\"')}"`;
}

/** The exact command that shows the template's change to one file, to merge by hand. */
export function manualDiffCommand(base, head, file) {
  return `git diff --no-renames ${base.slice(0, 7)} ${head.slice(0, 7)} -- ${shellPath(file)}`;
}

/**
 * Group per-file results ({ file, outcome: 'applied' | 'done' | 'manual', note }) for the report.
 * `advance` is true only when every file was applied or was already done: only then may the script
 * write the new commit into .template-base (otherwise the unmerged files would be skipped for good).
 */
export function summarizeUpdate(results) {
  const applied = results.filter((r) => r.outcome === 'applied');
  const done = results.filter((r) => r.outcome === 'done');
  const manual = results.filter((r) => r.outcome === 'manual');
  return { applied, done, manual, advance: manual.length === 0 };
}
