// Pure helpers behind `node scripts/qa/contrast.mjs`: read the colour tokens from the :root and .dark
// blocks of src/index.css and measure WCAG contrast for the pairs the store's UI rules promise.
// No imports and no file access, so tests/contrast.test.ts loads it directly.

const NUM = '(\\d+(?:\\.\\d+)?)';
const HSL_TRIPLET = new RegExp(`^${NUM}\\s+${NUM}%\\s+${NUM}%$`);

/** "24 8% 10%" (the triplet form the theme uses) to [h, s, l], or null for anything else. */
export function parseHsl(value) {
  const m = HSL_TRIPLET.exec(String(value).trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** [h (deg), s (%), l (%)] to [r, g, b] on a 0-255 scale (not rounded). */
export function hslToRgb([h, s, l]) {
  const S = s / 100;
  const L = l / 100;
  const a = S * Math.min(L, 1 - L);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return (L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return [f(0), f(8), f(4)];
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two [r, g, b] colours (1 to 21). Symmetric. */
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Colour `fg` at opacity `alpha` over `bg`, mixed channel by channel in sRGB as CSS does (text-foreground/60). */
export function blendOver(fg, alpha, bg) {
  return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));
}

/** The CSS inside the <style> tags of an HTML page (a mockup), joined; '' when there are none. */
export function extractStyles(html) {
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
}

const LIGHT_SELECTORS = [':root'];
const DARK_SELECTORS = ['.dark'];

/**
 * Colour tokens (HSL triplets only, name without the leading --) declared in `:root` and `.dark`
 * rules, at any depth (inside @layer or @media), after comments are removed. Later declarations win.
 * Returns { light, dark } with only what each block declares; use themeTokens() for the dark theme.
 */
export function parseTokenBlocks(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const light = {};
  const dark = {};
  const stack = [];
  let buf = '';
  let quote = null;
  let parens = 0;

  const declaration = () => {
    const top = stack[stack.length - 1];
    const m = /^\s*--([\w-]+)\s*:\s*([\s\S]*?)\s*$/.exec(buf);
    buf = '';
    if (!m || top === undefined || !parseHsl(m[2])) return;
    if (LIGHT_SELECTORS.includes(top)) light[m[1]] = m[2];
    else if (DARK_SELECTORS.includes(top)) dark[m[1]] = m[2];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      buf += ch;
      if (ch === '\\') buf += text[++i] ?? '';
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === '(') parens++;
    else if (ch === ')') parens = Math.max(0, parens - 1);
    if (parens > 0) { buf += ch; continue; }
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') { declaration(); stack.pop(); }
    else if (ch === ';') declaration();
    else buf += ch;
  }
  return { light, dark };
}

/** { light, dark } as parsed, to the full token set of each theme: dark keeps the light value of anything it does not override. */
export function themeTokens({ light, dark }) {
  return { light: { ...light }, dark: { ...light, ...dark } };
}

const TEXT = 4.5; // WCAG 1.4.3, normal-size text
const NON_TEXT = 3; // WCAG 1.4.11, form borders and focus indicators

/** fg and bg are token names; alpha mixes fg over bg first (the /60 text on charcoal). */
function pair(fg, bg, min, alpha) {
  const label = alpha === undefined ? `${fg} on ${bg}` : `${fg}/${Math.round(alpha * 100)} on ${bg}`;
  return { label, fg, bg, min, ...(alpha === undefined ? {} : { alpha }) };
}

const STATUS_TONES = ['success', 'danger', 'warning', 'info', 'returns', 'neutral'];

/** The pairs docs/ui-system.md promises, plus the foreground tokens that sit on their own surface. */
export const PAIRS = [
  // Body text on the three surfaces
  pair('foreground', 'background', TEXT),
  pair('foreground', 'card', TEXT),
  pair('foreground', 'muted', TEXT),
  pair('card-foreground', 'card', TEXT),
  pair('popover-foreground', 'popover', TEXT),
  pair('secondary-foreground', 'secondary', TEXT),
  pair('accent-foreground', 'accent', TEXT),
  // Secondary text: never lighter than 4.5:1 on any of them
  pair('muted-foreground', 'background', TEXT),
  pair('muted-foreground', 'card', TEXT),
  pair('muted-foreground', 'muted', TEXT),
  // Brand colour as a fill (buttons) and as text (links, text-primary)
  pair('primary-foreground', 'primary', TEXT),
  pair('primary', 'background', TEXT),
  pair('primary', 'card', TEXT),
  // Highlight: small emphasis text on the page and on cards; the light twin on dark bands
  pair('highlight', 'background', TEXT),
  pair('highlight', 'card', TEXT),
  pair('highlight-soft', 'charcoal', TEXT),
  // Charcoal bands: text, and the "at least /60" dim text rule
  pair('charcoal-foreground', 'charcoal', TEXT),
  pair('charcoal-foreground', 'charcoal', TEXT, 0.6),
  // Destructive
  pair('destructive', 'background', TEXT),
  pair('destructive-foreground', 'destructive', TEXT),
  // Status tones
  ...STATUS_TONES.map((t) => pair(`status-${t}-fg`, `status-${t}-bg`, TEXT)),
  // Form control borders and focus rings need 3:1 against what they sit on
  pair('input', 'background', NON_TEXT),
  pair('input', 'card', NON_TEXT),
  pair('input', 'muted', NON_TEXT),
  pair('ring', 'background', NON_TEXT),
  pair('ring', 'card', NON_TEXT),
];

/**
 * Measures every pair in both themes. `themes` is themeTokens(...). Each row:
 * { theme, label, fg, bg, min, ratio, pass }; ratio is null (and pass false) when a token is missing.
 * With { skipMissing: true } a pair whose token the page does not define is left out instead (a mockup
 * page carries only the tokens it draws with, not the status tones).
 */
export function checkPalette(themes, { skipMissing = false } = {}) {
  const rows = [];
  for (const theme of ['light', 'dark']) {
    const tokens = themes[theme] ?? {};
    const rgbOf = (name) => {
      const hsl = tokens[name] === undefined ? null : parseHsl(tokens[name]);
      return hsl ? hslToRgb(hsl) : null;
    };
    for (const p of PAIRS) {
      let fg = rgbOf(p.fg);
      const bg = rgbOf(p.bg);
      if (fg && bg && p.alpha !== undefined) fg = blendOver(fg, p.alpha, bg);
      if (skipMissing && !(fg && bg)) continue;
      const ratio = fg && bg ? contrastRatio(fg, bg) : null;
      rows.push({ theme, label: p.label, fg: p.fg, bg: p.bg, min: p.min, ratio, pass: ratio !== null && ratio >= p.min });
    }
  }
  return rows;
}
