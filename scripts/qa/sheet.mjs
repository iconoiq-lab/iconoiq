// Contact sheet: N images scaled into one grid image, so a review of many screenshots costs one
// image read instead of N. Run from the repo root:
//   node scripts/qa/sheet.mjs --out <sheet.png> [--cols 3] [--width 1800] [--gap 8] [--bg "#808080"] <image> [<image> ...]
// Every image is scaled down to the cell width (never enlarged, and its height follows its own
// proportions); a row is as tall as its tallest image. The images go left to right, top to bottom in the order given, and the
// command prints that order. Keep the sheet under about 1600 px wide if you want to read small text
// in it: image viewers shrink anything larger. For a long page, pass its slices (-s01, -s02 ...).
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { gridLayout } from '../lib/sheetLayout.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const valued = new Set(['out', 'cols', 'width', 'gap', 'bg']);
const files = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && valued.has(args[i - 1].replace(/^--/, ''))));
const OUT = opt('out');
if (!OUT || files.length === 0) {
  console.log('usage: node scripts/qa/sheet.mjs --out <sheet.png> [--cols 3] [--width 1800] [--gap 8] [--bg "#808080"] <image> ...');
  process.exit(1);
}
const gap = Number(opt('gap', '8'));
const cols = Math.min(Number(opt('cols', '3')), files.length);
const width = Number(opt('width', '1800'));
const cellWidth = Math.floor((width - gap * (cols + 1)) / cols);

const cells = [];
for (const file of files) {
  const input = await sharp(file).resize({ width: cellWidth, withoutEnlargement: true }).png().toBuffer();
  const { height } = await sharp(input).metadata();
  cells.push({ file, input, height });
}
const { places, width: sheetW, height: sheetH } = gridLayout(cells.map((c) => c.height), { cols, cellWidth, gap });
mkdirSync(dirname(OUT), { recursive: true });
await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: opt('bg', '#808080') } })
  .composite(cells.map((c, i) => ({ input: c.input, ...places[i] })))
  .png()
  .toFile(OUT);
console.log(`${OUT}: ${files.length} image(s), ${cols} column(s), ${sheetW} x ${sheetH}`);
files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
