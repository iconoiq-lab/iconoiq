// Pure helpers for scripts/new-client.mjs (tested in tests/new-client.test.ts).

/** Tracked template paths that never go into a client copy. */
const LEAVE_OUT = [
  /^docs\/template\/build\//, // how the template itself was built
  /^docs\/template\/client\//, // starter files: installed at the copy's root instead
  /^CLAUDE\.md$/, // replaced by the client runbook
  /^README\.md$/, // replaced by the client README
  /^docs\/HANDOFF\.md$/, // replaced by a fresh client handoff
  /^scripts\/qa\/template-shots\.sh$/, // template-only screenshot set
];

export const shouldCopy = (path) => !LEAVE_OUT.some((re) => re.test(path));

/** Template starter file → its path in the client copy. */
export const STARTERS = {
  'docs/template/client/CLAUDE.md': 'CLAUDE.md',
  'docs/template/client/REQUIREMENTS.md': 'REQUIREMENTS.md',
  'docs/template/client/PROGRESS.md': 'PROGRESS.md',
  'docs/template/client/README.md': 'README.md',
  'docs/template/client/HANDOFF.md': 'docs/HANDOFF.md',
};

/**
 * Template update in a client copy (scripts/template-update.mjs): which changed template paths to
 * patch in (`apply`), and which starter files changed (`starters`: the copy's version holds client
 * data, so their changes are ported by hand).
 */
export function splitTemplateChanges(paths) {
  const apply = paths.filter(shouldCopy);
  const starters = paths.filter((p) => STARTERS[p]).map((p) => ({ from: p, to: STARTERS[p] }));
  return { apply, starters };
}

export const BRIEF_README = `# Client brief

Drop the client's documents here: PDFs, Word files, WhatsApp exports, photos of notes, logo files.
Claude reads them once in Phase 0 and writes what matters into REQUIREMENTS.md.
Everything in this folder except this file is git-ignored, so private documents never enter git.
`;

export function fillTokens(text, { clientName, date, templateCommit }) {
  return text
    .replaceAll('{{CLIENT_NAME}}', clientName)
    .replaceAll('{{DATE}}', date)
    .replaceAll('{{TEMPLATE_COMMIT}}', templateCommit);
}

/** The copy's .env: only the demo project's public web config, never admin or payment keys. */
export function previewEnv(templateEnv) {
  const lines = templateEnv.split(/\r?\n/).filter((l) => /^VITE_FIREBASE_[A-Z_]+=/.test(l));
  return [
    "# Dream Team demo Firebase project: a read-only preview until Phase 5 puts the client's own project here.",
    '# Public web config only; no admin key, so client work never writes to the demo project.',
    ...lines,
    '',
  ].join('\n');
}

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/** null when the name works as a Windows folder name, else what is wrong with it. */
export function validateClientName(name) {
  const n = (name ?? '').trim();
  if (n.length < 2) return 'Give the client name (at least 2 characters).';
  if (n.length > 60) return 'Keep the client name under 60 characters.';
  if (/[<>:"/\\|?*]/.test(n)) return 'The client name cannot contain < > : " / \\ | ? *';
  if (n === '.' || n === '..' || /[. ]$/.test(n)) return 'The client name cannot end with a dot or a space.';
  if (RESERVED.test(n)) return `"${n}" is a reserved Windows name.`;
  return null;
}
