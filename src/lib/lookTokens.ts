/**
 * Reads the store look from its own CSS instead of keeping a second copy in code: the browser-bar colour, the
 * Razorpay checkout colour, the shared receipt palette and the canvas fonts all come from the tokens in
 * src/index.css, so Phase 3 changes the look in one file. With no document (a test run) they fall back to the
 * template defaults in src/config/lookFallback.ts.
 *
 * Colours are read from the stylesheet rules (`:root` for light, `.dark` for dark), not from the computed style of
 * <html>, because a few places need the OTHER theme than the one showing (the receipt is always light, the
 * theme-color metas carry both).
 */
import { hslTripletToHex } from './hslColor.ts';
import { LOOK_FALLBACK } from '../config/lookFallback.ts';

export type ThemeName = 'light' | 'dark';

/** The part of a CSSRule this file looks at, so a test can pass plain objects. */
export interface RuleLike {
  selectorText?: string;
  style?: { getPropertyValue(name: string): string };
  cssRules?: ArrayLike<RuleLike>;
  /** On @media rules (and @import): the condition, e.g. "print" or "(min-width: 1024px)". */
  media?: { mediaText: string };
}

/** Does this media query apply right now? A test passes its own; with no window nothing matches. */
export type MediaMatcher = (query: string) => boolean;
const browserMatches: MediaMatcher = (query) => typeof matchMedia === 'function' && matchMedia(query).matches;

/**
 * The last value `property` gets from a rule whose selector list contains `selector`, looking inside @media,
 * @layer and @supports blocks too. Later rules win, as in the cascade. An @media block whose condition does
 * not apply now (print, another screen width, a contrast preference the visitor has not set) is skipped, so
 * its override cannot win for everyone.
 */
export function lastDeclaration(
  rules: ArrayLike<RuleLike>,
  selector: string,
  property: string,
  matches: MediaMatcher = browserMatches,
): string | null {
  let found: string | null = null;
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (typeof rule.selectorText === 'string') {
      const selectors = rule.selectorText.split(',').map((s) => s.trim());
      const value = selectors.includes(selector) ? rule.style?.getPropertyValue(property).trim() : '';
      if (value) found = value;
    }
    if (rule.cssRules) {
      const condition = rule.media?.mediaText?.trim();
      if (condition && !matches(condition)) continue;
      const inner = lastDeclaration(rule.cssRules, selector, property, matches);
      if (inner) found = inner;
    }
  }
  return found;
}

let warnedUnreadable = false;

/** The HSL triplet of token `name` (without the dashes) in `theme`; dark falls back to the light value. Null when absent. */
export function themeToken(
  sheets: ArrayLike<{ cssRules?: ArrayLike<RuleLike> }>,
  name: string,
  theme: ThemeName,
  matches?: MediaMatcher,
): string | null {
  const property = `--${name}`;
  let light: string | null = null;
  let dark: string | null = null;
  let readable = 0;
  for (let i = 0; i < sheets.length; i++) {
    let rules: ArrayLike<RuleLike>;
    try {
      rules = sheets[i].cssRules ?? [];
    } catch {
      continue; // a cross-origin stylesheet (the fonts) cannot be read
    }
    readable++;
    light = lastDeclaration(rules, ':root', property, matches) ?? light;
    dark = lastDeclaration(rules, '.dark', property, matches) ?? dark;
  }
  if (sheets.length > 0 && readable === 0 && !warnedUnreadable) {
    // The store's CSS is served from another origin: the browser will not let the page read its tokens.
    warnedUnreadable = true;
    console.warn("lookTokens: no stylesheet is readable (cross-origin CSS?), so the browser-bar, Razorpay and receipt colours use the template defaults, not this store's.");
  }
  return theme === 'dark' ? dark ?? light : light;
}

const pageSheets = () =>
  typeof document === 'undefined' ? [] : (Array.from(document.styleSheets) as unknown as Array<{ cssRules?: ArrayLike<RuleLike> }>);

/** Token `name` as a hex colour in `theme`, or `fallback` when the page CSS has no readable HSL triplet for it. */
export function tokenHex(name: string, theme: ThemeName, fallback: string): string {
  const triplet = themeToken(pageSheets(), name, theme);
  return (triplet && hslTripletToHex(triplet)) || fallback;
}

/** The browser-bar colour of a theme: its page background. */
export const themeColor = (theme: ThemeName): string => tokenHex('background', theme, LOOK_FALLBACK.themeColor[theme]);

/** Razorpay checkout accent: the brand colour of the light theme (the checkout window is light in both themes). */
export const checkoutColor = (): string => tokenHex('primary', 'light', LOOK_FALLBACK.checkoutColor);

export interface ReceiptPalette {
  text: string;
  muted: string;
  rule: string;
  panel: string;
  accent: string;
  discount: string;
  paper: string;
}

/** The shared receipt image colours: the light theme tokens, whatever theme the shopper is in. */
export function receiptPalette(): ReceiptPalette {
  const f = LOOK_FALLBACK.receipt;
  return {
    text: tokenHex('foreground', 'light', f.text),
    muted: tokenHex('muted-foreground', 'light', f.muted),
    rule: tokenHex('border', 'light', f.rule),
    panel: tokenHex('background', 'light', f.panel),
    accent: tokenHex('primary', 'light', f.accent),
    discount: f.discount, // no token is this green, so it stays as shipped (see lookFallback.ts)
    paper: tokenHex('card', 'light', f.paper),
  };
}

/** A font stack for canvas drawing (`ctx.font`): the store --font-heading or --font-body. */
export function fontStack(which: 'heading' | 'body'): string {
  if (typeof document === 'undefined') return LOOK_FALLBACK.fonts[which];
  return getComputedStyle(document.documentElement).getPropertyValue(`--font-${which}`).trim() || LOOK_FALLBACK.fonts[which];
}
