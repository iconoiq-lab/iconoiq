/**
 * Converts the HSL triplets the theme tokens are written as (`24 8% 10%`, no `hsl()` around them) into the
 * hex colours that some APIs insist on: the browser-bar `theme-color` meta, the Razorpay checkout colour, the
 * shared receipt image. Pure and dependency-free, so a node test covers it.
 */

/** `'24 8% 10%'` -> `[24, 8, 10]`; null for anything else (a hex, an `hsl()` call, a missing percent sign). */
export function parseHslTriplet(value: string): [number, number, number] | null {
  const m = value.trim().match(/^(-?\d+(?:\.\d+)?)(?:deg)?\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!m) return null;
  const [h, s, l] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (s > 100 || l > 100) return null;
  return [h, s, l];
}

/** `'0 0% 100%'` -> `'#FFFFFF'` (upper case, rounded to 8 bits per channel); null when the triplet cannot be read. */
export function hslTripletToHex(value: string): string | null {
  const hsl = parseHslTriplet(value);
  if (!hsl) return null;
  const hue = (((hsl[0] % 360) + 360) % 360) / 60;
  const s = hsl[1] / 100;
  const l = hsl[2] / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue % 2) - 1));
  const m = l - c / 2;
  const sector: Array<[number, number, number]> = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]];
  const [r, g, b] = sector[Math.min(5, Math.floor(hue))];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}
