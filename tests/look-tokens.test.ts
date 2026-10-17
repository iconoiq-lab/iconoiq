import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

/**
 * The matte-store tokens (--sheen, --hover-lift, the heading weights) and the tokenised look classes.
 * Every one defaults to the template's own look; Phase 3 turns a store calm by changing a number in
 * src/index.css (docs/template/PHASE3.md). These checks keep each dial wired to what it claims to turn.
 */
const css = readFileSync('src/index.css', 'utf8').replace(/\r\n/g, '\n');
const noComments = css.replace(/\/\*[^]*?\*\//g, '');

const declared = (name: string) => css.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm'))?.[1].trim();

/** The body of the first rule whose selector is exactly `selector` (comments stripped). */
const ruleBody = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const at = noComments.search(new RegExp(`(^|\\n)\\s*${escaped}\\s*\\{`));
  assert.ok(at >= 0, `rule ${selector} exists`);
  const open = noComments.indexOf('{', at);
  return noComments.slice(open + 1, noComments.indexOf('}', open));
};

test('--sheen, --hover-lift and the heading weights exist and default to the template\'s look', () => {
  assert.equal(declared('sheen'), '1');
  assert.equal(declared('hover-lift'), '3px');
  assert.equal(declared('hover-lift-sm'), 'calc(var(--hover-lift) * 2 / 3)'); // 2px by default
  assert.equal(declared('hover-lift-lg'), 'calc(var(--hover-lift) * 4 / 3)'); // 4px by default
  assert.equal(declared('heading-weight-lg'), '400');
  // ICONOIQ (Phase 3): Marcellus has one weight, so the small headings stay at 400 too (template: 500).
  assert.equal(declared('heading-weight-sm'), '400');
});

test('the foil sweep, the contour rings and the offer foil all scale with --sheen', () => {
  assert.match(ruleBody('.btn-copper::after'), /calc\(0\.35 \* var\(--sheen\)\)/);
  assert.match(ruleBody('.offer-ticket__foil'), /calc\(0\.5 \* var\(--sheen\)\)/);
  const contour = [...css.matchAll(/^\s*--contour-ink:\s*([^;]+);/gm)].map((m) => m[1]);
  assert.equal(contour.length, 2, 'light and dark values');
  for (const v of contour) assert.match(v, /var\(--sheen\)/, '--contour-ink reads --sheen');
});

test('every hover lift reads --hover-lift: the card, the rank tag and the four storefront files', () => {
  assert.match(ruleBody('.card-product:hover'), /translateY\(calc\(var\(--hover-lift\) \* -1\)\)/);
  const files = [
    'src/pages/About.tsx', 'src/pages/CustomerSupport.tsx', 'src/components/FeatureIcons.tsx',
    'src/components/YouTubeShowcase.tsx', 'src/components/BestSellers.tsx',
  ];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.match(src, /translate-y-\[var\(--hover-lift(-sm|-lg)?\)\]/, `${f} lifts by the token`);
    assert.ok(!/hover:-translate-y-(\d|\[\d)|rank:-translate-y-\[\d/.test(src), `${f} still has a lift in a fixed number`);
  }
});

test('the look classes carry no template colour as a literal: they read --charcoal, --primary, --highlight-soft and friends', () => {
  // #000 is allowed: it is the opaque stop of a mask, not a palette colour.
  const literal = /hsl\(\s*\d|rgba\(\s*(28|12|10)\b|#(?!000\b)[0-9a-f]{3,6}\b/i;
  for (const selector of ['.photo-scrim', '.photo-scrim-side', '.on-photo', '.offer-ribbon', '.offer-ribbon__engraving', '.product-offer', '.dark .product-offer']) {
    assert.ok(!literal.test(ruleBody(selector)), `${selector} still has a hard-coded colour`);
  }
  for (const name of ['shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-gold', 'shadow-panel', 'shadow-card-hover', 'gradient-gold']) {
    for (const [, value] of css.matchAll(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'gm'))) {
      assert.ok(!/hsl\(\s*\d/.test(value), `--${name} has a hard-coded hsl colour: ${value}`);
      assert.ok(!/rgba\(\s*(28|12|10)\b/.test(value), `--${name} has the template's ink as a literal: ${value}`);
    }
  }
  // The dark theme no longer re-declares the gradient: the primary's three steps already swap in .dark.
  assert.equal([...css.matchAll(/^\s*--gradient-gold:/gm)].length, 1);
});

test('the heading-weight rule is opt-in (data-heading-weight="light") and sits outside every @layer', () => {
  const rules = [...noComments.matchAll(/:is\(h1, h2\):is\(\.font-medium[^{]*\{/g)];
  assert.equal(rules.length, 1, 'one h1/h2 weight rule');
  const at = rules[0].index!;
  const lineStart = noComments.lastIndexOf('\n', at) + 1;
  assert.ok(noComments.slice(lineStart, at).includes('html[data-heading-weight="light"]'), 'the rule is guarded by the attribute');
  assert.match(
    noComments,
    /html\[data-heading-weight="light"\] :is\(h3, h4, h5, h6, \.font-heading, \.font-serif(, \[style\*="--font-heading"\])?\):not\(h1, h2\):is\(/,
    'the -sm rule keeps :not(h1, h2)',
  );
  // Brace depth at the rule: 0 means it is not inside an @layer or @media block, so it comes after
  // Tailwind's utilities in the output and wins over them.
  let depth = 0;
  for (const ch of noComments.slice(0, lineStart)) depth += ch === '{' ? 1 : ch === '}' ? -1 : 0;
  assert.equal(depth, 0);
});

// A client copy may switch the attribute on in index.html (a Phase 3 hand edit); the template never does.
const inTemplateRepo = existsSync('docs/template/client/PROGRESS.md');

test('the template ships with the heading-weight attribute off', { skip: inTemplateRepo ? false : 'client copy: the look is set in Phase 3' }, () => {
  assert.ok(!/<html[^>]*data-heading-weight/.test(readFileSync('index.html', 'utf8')));
});
