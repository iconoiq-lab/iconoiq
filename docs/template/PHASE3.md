# Phase 3 checklist (apply the look)

What Phase 3 changes to turn the client's agreed mockup (`docs/look/home-mockup.html`) into the store, and where. Token names stay; only values change, so no component needs editing. All colours are HSL triplets without `hsl()` (`24 8% 10%`), light in `:root` and dark in `.dark`. The mockup's token block uses the same names, so it pastes across.

| Set | Where | Notes |
|---|---|---|
| Colours, light and dark | `src/index.css`, the `:root` and `.dark` blocks of the first `@layer base` | Include `--highlight-soft` (accent text on the dark bands, and the focus ring there: a lighter twin of `--highlight`) and, if the palette clashes with them, the status tones (`--status-*`) further down the file |
| Radius | `--radius-panel`, `--radius-card`, `--radius-control`, `--radius-chip` in `src/index.css` | One file: `rounded-panel`, `-card`, `-control` and `-chip` all read these variables |
| Textures | `--texture-opacity` in `src/index.css` | 1 keeps the paper, sheet, slate and contour textures as shipped; 0 turns them off for a flat, matte store. The film grain is separate: `--grain-opacity` (light and dark) |
| Fonts | `--font-heading` and `--font-body` in `src/index.css`; the Google Fonts `<link>` in `index.html`; `fontFamily` in `tailwind.config.ts` follows the variables | Components ask for heading weights 600 to 700 (`font-semibold`, `font-bold`), so a light serif needs a decision: see "Heading weights" below |
| Browser colours | `index.html` (`theme-color`, one for light and one for dark) and `public/manifest.webmanifest` (`theme_color`, `background_color`) | These are hex values, not tokens: copy them from the new `--background` and `--primary`. They stay a hand edit (a manifest cannot read CSS). Once the app is running, `ThemeContext` rewrites the `theme-color` metas from the tokens |
| Logo | `brand-assets/palette.json` (ink, paper, tile and the three bag colours of the empty-cart picture), the art in `brand-assets/` (`logo.svg`, `mark.svg`), then `node scripts/build-logo-assets.mjs` | The tile colour is its own value (a clay tile can carry umber ink). The build also writes `src/config/logoSize.ts`: the header, footers and invoice read the wordmark's size from it. No logo from the client: see below |
| Matte or calm store | `--sheen`, `--hover-lift` and `--gradient-gold` in `src/index.css`, next to `--texture-opacity` | See "A matte or calm store" below: one number each, all defaulting to the template's look |
| Heading weights | `--heading-weight-lg` and `--heading-weight-sm` in `src/index.css`, plus `data-heading-weight="light"` on `<html>` in `index.html` | A hand edit, like the browser colours. Without the attribute nothing changes. See "Heading weights" below |
| Home blocks | `src/config/homeBlocks.ts` | One true/false per home block, each with a one-line comment; the template ships them all on. A hidden block is not rendered and loads nothing. The height each lazy block reserves while it loads sits in the same file (`HOME_BLOCK_RESERVE`). Testimonials and video stories are whole features: switch them in `src/config/features.ts`. The blocks that fill from products or admin content also hide themselves while empty |
| Contrast | `node scripts/qa/contrast.mjs` | Prints WCAG ratios for the standard pairs in both themes (text 4.5:1, form borders and focus rings 3:1) and exits 1 on a fail. `npm test` fails the same pairs, so a failing palette cannot ship |

## Where else the look is read (nothing to edit)

A few places need a hex colour or a font name in code. They read the tokens in `src/index.css` while the app runs (`src/lib/lookTokens.ts`), so a re-skin reaches them with no edit: the `theme-color` metas `ThemeContext` keeps in step with the theme (the page `--background`), the Razorpay checkout colour (the light `--primary`), the shared receipt image on the order page (the light theme's `--foreground`, `--muted-foreground`, `--border`, `--background`, `--primary` and `--card`; its discount green has no token and stays as shipped in `src/config/lookFallback.ts`) and the fonts on the scratch card canvas (`--font-heading`, `--font-body`). `src/config/lookFallback.ts` holds the template's defaults for the one case with no page to read (a test run); a browser never uses it, so leave it alone. `npm test` (`tests/look-audit.test.ts`) fails if the template's ink or page hex, its font names or `hsl(24 8% 10%)` appear anywhere else in `src/`, or a storefront component uses an `emerald-*` or `bg-red-500` one-off colour. The admin and the delivery-staff app keep their own status colours.

## A matte or calm store

Every dial defaults to the template's own look, so a store that wants the template's shine changes nothing. All are in `src/index.css`:

| For this | Set | What it does |
|---|---|---|
| No paper, sheet, slate or contour textures | `--texture-opacity: 0` | Flat surfaces (set earlier in Phase 3). The film grain is `--grain-opacity` |
| No shine | `--sheen: 0` | Turns off the foil sweep across `.btn-copper` on hover, the topographic rings (`.tx-contour`) and the foil loop on the offer ticket. `0.5` keeps them half as strong |
| No card lift | `--hover-lift: 0px` | Product cards, the rank tag on a best seller and the lifting cards on About, Customer support, the promise cards and Video stories stay still on hover. Write the unit (`0px`, not `0`). The default is `3px`; the promise cards and Video stories rise a third more and the support cards a third less, in proportion |
| No gradient on the primary | `--gradient-gold: linear-gradient(hsl(var(--primary)), hsl(var(--primary)));` (and `--gradient-gold-shine: linear-gradient(transparent, transparent);`) | The "sheen" the primary text gradient and any gradient-gold surface use. Light and dark share one definition, built from `--primary-dark`, `--primary` and `--primary-light` |
| Softer shadows | `--shadow-sm` to `--shadow-xl`, `--shadow-gold`, `--shadow-panel` (light block) and `--shadow-panel` and `--shadow-card-hover` (the `.dark` block, further down) | Their ink is `--charcoal`, so a new charcoal already recolours them. Lower the alphas or the blur for a flatter look |

The scrim on photos (`.photo-scrim`, `.on-photo`), the offer ribbon and the product offer ticket read `--charcoal`, `--highlight-soft`, `--muted`, `--cream` and `--card` instead of fixed colours, so a re-skin recolours them with the tokens. `npm test` (`tests/look-tokens.test.ts`) fails if a fixed template colour comes back into one of them.

## Heading weights

Components ask for `font-semibold` and `font-bold` on about 200 headings, which is heavy for a light serif. Rather than edit those classes, set `<html lang="en" data-heading-weight="light">` in `index.html`: then `h1` and `h2` use `--heading-weight-lg` (400 as shipped) and `h3` to `h6` and other heading-font text use `--heading-weight-sm` (500). Change the two numbers for another weight. The rule is outside every `@layer`, so it comes after Tailwind's utilities and wins; headings that ask for `font-medium` keep it. Load those weights in the Google Fonts `<link>`. Without the attribute nothing changes.

## No logo from the client: draw the name

1. Fetch the heading font as a static `.ttf` into `brand-assets/fonts/` as `wordmark.ttf` (and a display cut as `monogram.ttf`, optional). The one-line `curl` for the Google Fonts CSS API is in `brand-assets/fonts/README.txt`. Fonts there are build inputs only: nothing in that folder ships.
2. Set the colours in `brand-assets/palette.json` from the new palette.
3. `node scripts/make-wordmark.mjs` draws `brand-assets/logo.svg` and `mark.svg` as outlines (so no font has to be installed). It takes the name and the monogram letter from `src/config/brand.ts`; `--text`, `--letter` and `--tracking` adjust them.
4. `node scripts/build-logo-assets.mjs` makes every PNG, the icons, the link-preview card and `src/config/logoSize.ts`. `npm test` fails a `<text>` or `NaN` in the art, art in other colours than `palette.json`, and a stale `logoSize.ts`.
5. Look at the header (390 px: is the logo clear of the icons?) and both footers. The `h-*` classes of the logo images in `Header.tsx`, `MobileHeader.tsx`, `header/CenteredHeaderBar.tsx`, `Footer.tsx` and `footer/CompactFooter.tsx` were tuned to the demo wordmark, which has wide empty margins. A drawn wordmark has tight margins and shows larger at the same class, so lower the `h-*` if it crowds.

## Check every page

Check every page at 390 and 1440 px, light and dark (`npm run check` takes the first-screen shots; `node scripts/qa/ui-shots.mjs` takes any page, and `node scripts/qa/sheet.mjs` tiles many shots into one image to read).

- The preview shows the demo project's products and photos until Phase 5, so judge the look against the mockup, not the demo images. Also check the fresh-store state: `MSYS_NO_PATHCONV=1 node scripts/qa/ui-shots.mjs --block-firestore --out <dir> /` aborts every Firestore request, which is what a new client Firebase looks like (no products, categories or home content), and shows the empty states and the fallbacks. It aborts the requests rather than serving empty collections, so a block may sit in its loading skeleton or fall back to its defaults instead of hiding: it shows the layout with no data, but it does not prove that a block hides when its collection is empty. That needs a Firebase project whose collections are really empty (Phase 5).
- The order of the home page is part of the look: compare it with the mockup, not only the colours and fonts. `src/config/homeBlocks.ts` switches blocks on and off but never reorders them: the order is the sequence in `src/pages/Index.tsx`, so a mockup with another order is an edit there, made on purpose.
- Signed-in pages and the admin cannot be checked on the preview (a login writes to the demo Firebase): they wait for Phase 5. `/cart`, `/checkout` and `/verify-email` also send a guest to `/login`, so their shots are the login page: list them as "guest redirect", not "checked".
- A blank slice in a full-page shot usually means a lazy chunk had not loaded yet; run it again before calling it a bug.
