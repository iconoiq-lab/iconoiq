import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  lastDeclaration, themeToken, tokenHex, themeColor, checkoutColor, receiptPalette, fontStack, type RuleLike,
} from '../src/lib/lookTokens.ts';
import { hslTripletToHex } from '../src/lib/hslColor.ts';
import { LOOK_FALLBACK } from '../src/config/lookFallback.ts';
import { parseTokenBlocks } from '../scripts/lib/contrast.mjs';

/** A style rule as the browser would give it. */
const rule = (selectorText: string, props: Record<string, string>): RuleLike => ({
  selectorText,
  style: { getPropertyValue: (name: string) => props[name] ?? '' },
});
/** A grouping rule (@media, @layer, @supports): no selector, inner rules. */
const group = (...cssRules: RuleLike[]): RuleLike => ({ cssRules });

test('lastDeclaration: the later rule wins, and other selectors and other properties are ignored', () => {
  const rules = [
    rule(':root', { '--primary': '1 1% 1%', '--card': '9 9% 9%' }),
    rule('.dark', { '--primary': '2 2% 2%' }),
    rule(':root', { '--primary': '3 3% 3%' }),
    rule('.card', { '--primary': '4 4% 4%' }),
  ];
  assert.equal(lastDeclaration(rules, ':root', '--primary'), '3 3% 3%');
  assert.equal(lastDeclaration(rules, ':root', '--card'), '9 9% 9%');
  assert.equal(lastDeclaration(rules, '.dark', '--primary'), '2 2% 2%');
  assert.equal(lastDeclaration(rules, ':root', '--missing'), null);
});

test('lastDeclaration: looks inside @layer and @media blocks, and into selector lists', () => {
  const rules = [
    group(rule(':root', { '--background': '60 8% 98%' })),
    group(group(rule('html, :root', { '--background': '0 0% 100%' }))),
  ];
  assert.equal(lastDeclaration(rules, ':root', '--background'), '0 0% 100%');
});

test('lastDeclaration: an @media block that does not apply now is skipped (print, a preference the visitor has not set)', () => {
  const media = (mediaText: string, ...cssRules: RuleLike[]): RuleLike => ({ media: { mediaText }, cssRules });
  const rules = [
    rule(':root', { '--primary': '1 1% 1%' }),
    media('print', rule(':root', { '--primary': '5 5% 5%' })),
    media('(prefers-contrast: more)', rule(':root', { '--primary': '6 6% 6%' })),
    media('(min-width: 1024px)', rule(':root', { '--primary': '7 7% 7%' })),
  ];
  assert.equal(lastDeclaration(rules, ':root', '--primary', () => false), '1 1% 1%', 'no media applies');
  assert.equal(lastDeclaration(rules, ':root', '--primary', (q) => q === '(min-width: 1024px)'), '7 7% 7%', 'a matching block wins by order');
  assert.equal(lastDeclaration(rules, ':root', '--primary', (q) => q === 'print'), '5 5% 5%');
  assert.equal(lastDeclaration(rules, ':root', '--primary', (q) => q !== 'print'), '7 7% 7%', 'print stays out');
  // an @import or @layer with no condition is always read
  assert.equal(lastDeclaration([media('', rule(':root', { '--x': '2 2% 2%' }))], ':root', '--x', () => false), '2 2% 2%');
  // no window (a node test): no media query matches, the default
  assert.equal(lastDeclaration(rules, ':root', '--primary'), '1 1% 1%');
});

test('themeToken: when no stylesheet is readable it says so once, and returns null (the template defaults apply)', () => {
  const unreadable = { get cssRules(): ArrayLike<RuleLike> { throw new Error('SecurityError'); } };
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.join(' ')); };
  try {
    assert.equal(themeToken([unreadable], 'primary', 'light'), null);
    assert.equal(themeToken([unreadable, unreadable], 'primary', 'dark'), null);
    assert.equal(themeToken([], 'primary', 'light'), null);
  } finally {
    console.warn = original;
  }
  assert.equal(warnings.length, 1, 'one warning, not one per call');
  assert.match(warnings[0], /no stylesheet is readable/);
});

test('themeToken: dark falls back to the light value; cascade order runs across stylesheets; an unreadable sheet is skipped', () => {
  const sheets = [
    { cssRules: [rule(':root', { '--a': '1 1% 1%', '--b': '2 2% 2%' }), rule('.dark', { '--a': '8 8% 8%' })] },
    { get cssRules(): ArrayLike<RuleLike> { throw new Error('SecurityError'); } },
    { cssRules: [group(rule(':root', { '--b': '3 3% 3%' }))] },
  ];
  assert.equal(themeToken(sheets, 'a', 'light'), '1 1% 1%');
  assert.equal(themeToken(sheets, 'a', 'dark'), '8 8% 8%');
  assert.equal(themeToken(sheets, 'b', 'light'), '3 3% 3%');
  assert.equal(themeToken(sheets, 'b', 'dark'), '3 3% 3%');
  assert.equal(themeToken(sheets, 'missing', 'light'), null);
});

test('with no document (a node test) every reader returns the template fallback', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(tokenHex('primary', 'light', '#123456'), '#123456');
  assert.equal(themeColor('light'), LOOK_FALLBACK.themeColor.light);
  assert.equal(themeColor('dark'), LOOK_FALLBACK.themeColor.dark);
  assert.equal(checkoutColor(), LOOK_FALLBACK.checkoutColor);
  assert.deepEqual(receiptPalette(), LOOK_FALLBACK.receipt);
  assert.equal(fontStack('heading'), LOOK_FALLBACK.fonts.heading);
  assert.equal(fontStack('body'), LOOK_FALLBACK.fonts.body);
});

// The fallbacks mirror src/index.css as the template ships it. A client copy changes index.css in Phase 3 and
// never the fallbacks (a browser never uses them), so this holds only in the template repo.
const inTemplateRepo = existsSync('docs/template/client/PROGRESS.md');

test('the fallbacks match the token values in src/index.css', { skip: inTemplateRepo ? false : 'client copy: the look is set in Phase 3' }, () => {
  const { light, dark } = parseTokenBlocks(readFileSync('src/index.css', 'utf8'));
  const hex = (tokens: Record<string, string>, name: string) => hslTripletToHex(tokens[name]);
  assert.equal(hex(light, 'background'), LOOK_FALLBACK.themeColor.light);
  assert.equal(hex(dark, 'background'), LOOK_FALLBACK.themeColor.dark);
  assert.equal(hex(light, 'primary'), LOOK_FALLBACK.checkoutColor);
  const r = LOOK_FALLBACK.receipt;
  assert.equal(hex(light, 'foreground'), r.text);
  assert.equal(hex(light, 'background'), r.panel);
  assert.equal(hex(light, 'primary'), r.accent);
  assert.equal(hex(light, 'card'), r.paper);
  // The receipt grey and rule were stone shades picked by eye: within 2/255 of the tokens. The discount green has no
  // token and stays as shipped.
  const near = (a: string | null, b: string) => a !== null && [1, 3, 5].every((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 2);
  assert.ok(near(hex(light, 'muted-foreground'), r.muted), `muted-foreground ${hex(light, 'muted-foreground')} vs ${r.muted}`);
  assert.ok(near(hex(light, 'border'), r.rule), `border ${hex(light, 'border')} vs ${r.rule}`);
});

test('the fallback fonts name the first family of --font-heading and --font-body', { skip: inTemplateRepo ? false : 'client copy: the look is set in Phase 3' }, () => {
  const css = readFileSync('src/index.css', 'utf8');
  const first = (name: string) => css.match(new RegExp(`--font-${name}:\\s*'([^']+)'`))?.[1];
  assert.ok(LOOK_FALLBACK.fonts.heading.startsWith(first('heading') ?? '?'));
  assert.ok(LOOK_FALLBACK.fonts.body.startsWith(first('body') ?? '?'));
});
