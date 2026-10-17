/**
 * Build every logo/icon file the site uses from the brand art in brand-assets/.
 *
 *   node scripts/build-logo-assets.mjs
 *
 * For a new client, replace brand-assets/logo.svg and mark.svg (or PNGs of the
 * same names) and run this. With no logo from the client, draw both from the
 * store name first: node scripts/make-wordmark.mjs (docs/template/PHASE3.md).
 *
 * The colours are in brand-assets/palette.json (ink, paper, tile, and the three
 * bag colours of the empty-cart picture); the template's own values are the
 * fallback when that file is absent. The tile is its own colour: a store can have
 * a clay tile and umber ink.
 *
 *   brand-assets/logo.svg  wordmark, drawn in the palette ink on transparent. The
 *                          light versions are made by swapping that ink for the paper colour.
 *   brand-assets/mark.svg  monogram: a tile (<rect>, the palette tile colour) with
 *                          the letter in the paper colour. The loading screen uses
 *                          the letter alone (no tile) because the image placeholder
 *                          uses it as a mask.
 *
 * PNG art is used as it is for the dark wordmark and the tile. The light wordmark
 * is brand-assets/logo-light.png when it exists (a multi-colour picture logo, whose
 * negative would turn the colours), otherwise the negative of logo.png. A mark PNG is used unchanged for the loading and
 * illustration files (supply an SVG if you need the letter alone).
 *
 * Outputs (see "Logo and image files" in CLAUDE.md):
 *   public/black_logo.png   wordmark, dark ink  - light backgrounds
 *   public/white_logo.png   wordmark, light ink - dark backgrounds
 *   public/black_logo_full.png, white_logo_full.png   the same again (admin image prompts)
 *   public/logo-new.png     wordmark, dark ink  - invoice PDF, white paper
 *   src/assets/dark.png     wordmark, dark ink  - auth pages (on a light page)
 *   public/loading_black.png / loading_white.png   monogram letter, dark / light
 *   public/favicon.png (48), public/favicon.ico (16, 32, 48), public/icon-192.png,
 *   public/apple-touch-icon.png (180, no transparency)
 *   public/og-image.jpg     1200 x 630 link-preview card
 *   src/assets/login-cart.png, shopping-bags.png  empty-cart illustration
 *   src/config/logoSize.ts  the wordmark's width and height (generated): the header,
 *                          footers and invoice read it, so a wordmark of any proportion fits
 */
import sharp from 'sharp';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';

const palette = existsSync('brand-assets/palette.json')
  ? JSON.parse(readFileSync('brand-assets/palette.json', 'utf8'))
  : { ink: '#1c1917', paper: '#fafaf9', tile: '#1c1917', band: '#292524', stone: '#a8a29e', stoneLight: '#e7e5e4' };
const INK = palette.ink; // wordmark ink (the art must use exactly this value)
const PAPER = palette.paper; // light ink, and the letter on the tile
const TILE = palette.tile ?? INK; // monogram tile, touch icon, the dark bag
const STONE_LIGHT = palette.stoneLight ?? '#e7e5e4'; // the light bag's outline in the illustration
const STONE = palette.stone ?? '#a8a29e'; // the bag handles
const INK_BAND = palette.band ?? '#292524'; // the dark bag's top band
const SVG_DENSITY = 288; // render vector art at 4x, then scale down: sharp edges
const PNG = { compressionLevel: 9 };

const swap = (text, from, to) => text.replace(new RegExp(from, 'gi'), to);

/** brand-assets/<name>.svg, else <name>.png. */
function readArt(name) {
  const svg = `brand-assets/${name}.svg`;
  const png = `brand-assets/${name}.png`;
  if (existsSync(svg)) return { svg: readFileSync(svg, 'utf8') };
  if (existsSync(png)) return { png: readFileSync(png) };
  throw new Error(`Missing brand-assets/${name}.svg (or ${name}.png)`);
}

const rasterSvg = (svg) => sharp(Buffer.from(svg), { density: SVG_DENSITY });

const logo = readArt('logo');
const mark = readArt('mark');

/** The wordmark in dark or light ink. */
function wordmark(light) {
  if (logo.svg) return rasterSvg(light ? swap(logo.svg, INK, PAPER) : logo.svg);
  if (light && existsSync('brand-assets/logo-light.png')) return sharp('brand-assets/logo-light.png');
  return light ? sharp(logo.png).negate({ alpha: false }) : sharp(logo.png);
}

/** The monogram tile as drawn. */
const tile = () => (mark.svg ? rasterSvg(mark.svg) : sharp(mark.png));

/** The monogram letter alone, dark or light, cropped tight on a transparent background. */
async function letter(light) {
  if (!mark.svg) return sharp(mark.png).png().toBuffer();
  const noTile = mark.svg.replace(/<rect\b[^>]*\/>/, '');
  const drawn = await rasterSvg(light ? noTile : swap(noTile, PAPER, INK)).png().toBuffer();
  return sharp(drawn).trim().png().toBuffer();
}

/** ICO container holding PNG images (supported by every current browser). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

// Wordmarks (header, footer, cart, admin): 900px wide for sharp retina rendering.
await wordmark(false).resize(900).png(PNG).toFile('public/black_logo.png');
await wordmark(true).resize(900).png(PNG).toFile('public/white_logo.png');
await wordmark(false).resize(900).png(PNG).toFile('public/black_logo_full.png');
await wordmark(true).resize(900).png(PNG).toFile('public/white_logo_full.png');
await wordmark(false).resize(900).png(PNG).toFile('public/logo-new.png');

// The wordmark's own size, for the <img width height> of the header and footers (the browser reserves
// the right shape before the file loads) and the invoice. Any proportion works: nothing else assumes one.
const { width: logoWidth, height: logoHeight } = await sharp('public/black_logo.png').metadata();
await writeFile('src/config/logoSize.ts', `// Generated by scripts/build-logo-assets.mjs from brand-assets/logo.*: do not edit by hand.
// The size of public/black_logo.png. Use it only for the <img width height> attributes; the size on
// screen comes from the h-* class beside it.
export const LOGO = { width: ${logoWidth}, height: ${logoHeight} } as const;
`);

// Auth pages sit on a light page, so this one is dark ink as well.
await wordmark(false).resize(1000).png(PNG).toFile('src/assets/dark.png');

// Loading screen and image placeholder: the letter alone, dark and light.
const letterDark = await letter(false);
const letterLight = await letter(true);
await sharp(letterDark).resize({ height: 500 }).png(PNG).toFile('public/loading_black.png');
await sharp(letterLight).resize({ height: 500 }).png(PNG).toFile('public/loading_white.png');

// Favicons and app icons: the monogram tile.
await tile().resize(48, 48).png(PNG).toFile('public/favicon.png');
const icoPngs = [];
for (const size of [16, 32, 48]) icoPngs.push({ size, data: await tile().resize(size, size).png(PNG).toBuffer() });
await writeFile('public/favicon.ico', ico(icoPngs));
await tile().resize(192, 192).png(PNG).toFile('public/icon-192.png');
// iOS paints transparent pixels black, so the touch icon is a full square.
await tile().resize(180, 180).flatten({ background: TILE }).png(PNG).toFile('public/apple-touch-icon.png');

// Link-preview card: the wordmark on paper.
const ogWordmark = await wordmark(false).resize(1100).png().toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 3, background: PAPER } })
  .composite([{ input: ogWordmark, gravity: 'center' }])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile('public/og-image.jpg');

// Empty-cart illustration: two paper bags (tile colour and paper) with stone handles and the monogram.
const bags = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="319" viewBox="0 0 320 319">
  <g fill="none" stroke-width="7" stroke-linecap="round">
    <path d="M78 96 C78 40 150 40 150 96" stroke="${STONE}"/>
    <path d="M186 150 C186 106 246 106 246 150" stroke="${STONE}"/>
  </g>
  <path d="M40 92 H190 L200 292 H30 Z" fill="${TILE}"/>
  <path d="M40 92 H190 L193 118 H37 Z" fill="${INK_BAND}"/>
  <path d="M160 146 H274 L284 300 H150 Z" fill="${PAPER}" stroke="${STONE_LIGHT}" stroke-width="2"/>
</svg>`);

/** A composite entry that centres `art` (scaled to `height`) on (cx, cy). */
async function centred(art, height, cx, cy) {
  const input = await sharp(art).resize({ height }).png().toBuffer();
  const { width } = await sharp(input).metadata();
  return { input, left: Math.round(cx - width / 2), top: Math.round(cy - height / 2) };
}
await sharp(bags)
  .composite([await centred(letterLight, 64, 115, 205), await centred(letterDark, 50, 217, 232)])
  .png(PNG)
  .toFile('src/assets/login-cart.png');
// Same illustration for the empty-cart / empty-orders states.
await sharp('src/assets/login-cart.png').toFile('src/assets/shopping-bags.png');

console.log('Logo assets written.');
