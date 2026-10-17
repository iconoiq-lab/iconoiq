// node scripts/make-placeholders.mjs
// Neutral SVG placeholders for demo images: a soft two-tone panel with a label.
// The label sits in the upper part, clear of hero headings and inside every object-cover crop.
// Client copies replace them with real photos (or URLs from their media store).
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'public/demo';
const SIZES = { hero: [1600, 900], collection: [800, 1000], about: [1200, 900], contact: [1600, 600], wishlist: [1600, 600], banner: [1600, 600] };
const LIST = [
  ['hero-1', 'hero'], ['banner', 'banner'], ['contact', 'contact'], ['wishlist', 'wishlist'],
  ...Array.from({ length: 5 }, (_, i) => [`collection-${i + 1}`, 'collection']),
  ...Array.from({ length: 14 }, (_, i) => [`about-${i + 1}`, 'about']),
];

mkdirSync(OUT, { recursive: true });
for (const [name, kind] of LIST) {
  const [w, h] = SIZES[kind];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e7e5e4"/><stop offset="1" stop-color="#d6d3d1"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<text x="50%" y="26%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui, sans-serif" font-size="${Math.round(h / 24)}" fill="#57534e">[NEED: ${name} image]</text>
</svg>`;
  writeFileSync(`${OUT}/${name}.svg`, svg);
}
console.log(`wrote ${LIST.length} placeholders to ${OUT}`);
