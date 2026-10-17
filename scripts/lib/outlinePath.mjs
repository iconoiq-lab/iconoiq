// SVG path data from an opentype.js path, for scripts/make-wordmark.mjs (tested in tests/outline-path.test.ts).
// opentype.js 2.0.0's Path.toPathData() wrote "NaN" for some points, so the outline commands are
// serialised here, and a point that is not a finite number is an error instead of a broken glyph.

export const round = (n) => Math.round(n * 100) / 100;

const num = (n) => {
  if (!Number.isFinite(n)) throw new Error('Bad outline: a point is not a number');
  return String(round(n));
};

const KEYS = { M: ['x', 'y'], L: ['x', 'y'], Q: ['x1', 'y1', 'x', 'y'], C: ['x1', 'y1', 'x2', 'y2', 'x', 'y'], Z: [] };

/** `path.commands` as an SVG `d` string, numbers rounded to two decimals. */
export const pathData = (path) =>
  path.commands.map((c) => c.type + KEYS[c.type].map((k) => num(c[k])).join(' ')).join('');
