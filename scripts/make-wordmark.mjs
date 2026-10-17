/**
 * Draw the wordmark (brand-assets/logo.svg) and the monogram (brand-assets/mark.svg)
 * from a font file, for a client who has no logo and wants the plain name.
 *
 *   node scripts/make-wordmark.mjs
 *   node scripts/make-wordmark.mjs --text "Clay Studio" --letter C --tracking 0.02
 *   node scripts/make-wordmark.mjs --pad-x 1.3 --pad-y 0.66   (empty space round the name, in em)
 *   node scripts/make-wordmark.mjs --font brand-assets/fonts/X.ttf --mark-font brand-assets/fonts/Y.ttf
 *   node scripts/make-wordmark.mjs --out some/folder      (write logo.svg and mark.svg there instead)
 *
 * The letters are converted to outlines (paths), so the result does not depend on any font being
 * installed on the machine. `build-logo-assets.mjs` (which rasterises SVG with sharp) then makes
 * every PNG, icon and the link-preview card from them.
 *
 * Defaults: the store name from src/config/brand.ts; the first letter of `shortName` as the
 * monogram; the font brand-assets/fonts/wordmark.ttf for the wordmark and
 * brand-assets/fonts/monogram.ttf for the monogram letter (wordmark.ttf again when there is no
 * monogram.ttf: a display cut of the same family looks best in the tile). Colours come from
 * brand-assets/palette.json (ink, paper, tile). Fonts must be free to embed (Google Fonts are OFL);
 * brand-assets/fonts/README.txt says how to fetch a static .ttf. Needs `opentype.js` (devDependency).
 *
 * Look at public/black_logo.png after build-logo-assets.mjs, and adjust with --tracking. The default
 * padding (0.2 em sideways, 0.3 em above and below) is tight, which suits a header logo. The
 * template's own "Demo Store" logo uses --pad-x 1.3 --pad-y 0.66 so it keeps the 4:1 shape and the
 * text size its header and footer classes (h-*) were tuned for.
 * Run it from the repo root. The wordmark's proportions follow the name, so the header, footers and
 * invoice read the size build-logo-assets.mjs writes to src/config/logoSize.ts.
 */
import opentype from 'opentype.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathData, round } from './lib/outlinePath.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const brand = existsSync('src/config/brand.ts') ? readFileSync('src/config/brand.ts', 'utf8') : '';
const name = args.text ?? brand.match(/^\s*name: '([^']*)'/m)?.[1];
const shortName = brand.match(/^\s*shortName: '([^']*)'/m)?.[1] ?? name;
const letter = args.letter ?? shortName?.[0] ?? name?.[0];
if (!name || !letter) throw new Error('No store name found: pass --text "<name>" --letter <X>');
const tracking = Number(args.tracking ?? 0.01); // em
const palette = JSON.parse(readFileSync('brand-assets/palette.json', 'utf8'));
const out = args.out ?? 'brand-assets';

const load = (path) => {
  if (!existsSync(path)) throw new Error(`No font at ${path}. brand-assets/fonts/README.txt says how to fetch a static .ttf.`);
  const buf = readFileSync(path);
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};
const wordPath = args.font ?? 'brand-assets/fonts/wordmark.ttf';
const monogramPath = 'brand-assets/fonts/monogram.ttf';
const markPath = args['mark-font'] ?? args.font ?? (existsSync(monogramPath) ? monogramPath : wordPath);
const wordFont = load(wordPath);
const markFont = markPath === wordPath ? wordFont : load(markPath);

// Wordmark: measure the outline, then centre it on a canvas with even padding.
const F = 100;
const probe = wordFont.getPath(name, 0, 0, F, { letterSpacing: tracking }).getBoundingBox();
const w = probe.x2 - probe.x1;
const h = probe.y2 - probe.y1;
const padX = Number(args['pad-x'] ?? 0.2) * F;
const padY = Number(args['pad-y'] ?? 0.3) * F;
const W = round(w + 2 * padX);
const H = round(h + 2 * padY);
const d = pathData(wordFont.getPath(name, padX - probe.x1, padY - probe.y1, F, { letterSpacing: tracking }));
const title = name.replace(/&/g, '&amp;').replace(/</g, '&lt;');
mkdirSync(out, { recursive: true });
writeFileSync(
  join(out, 'logo.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"><title>${title}</title><path d="${d}" fill="${palette.ink}"/></svg>\n`,
);

// Monogram: a rounded tile with the letter centred on its outline (not on the font box).
const TILE = 512;
const GLYPH = 270; // letter height in the tile
const mp = markFont.getPath(letter, 0, 0, 1000).getBoundingBox();
const scale = GLYPH / (mp.y2 - mp.y1);
const size = 1000 * scale;
const bb = markFont.getPath(letter, 0, 0, size).getBoundingBox();
const x = TILE / 2 - (bb.x1 + bb.x2) / 2;
const y = TILE / 2 - (bb.y1 + bb.y2) / 2;
const md = pathData(markFont.getPath(letter, x, y, size));
writeFileSync(
  join(out, 'mark.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}" role="img"><title>${title}</title><rect width="${TILE}" height="${TILE}" rx="112" fill="${palette.tile}"/><path d="${md}" fill="${palette.paper}"/></svg>\n`,
);

console.log(`${out}/logo.svg ${W} x ${H} (${round(W / H)}:1), mark.svg letter "${letter}". Next: node scripts/build-logo-assets.mjs`);
