# ICNO-IQ: progress

**Overall: 0% (0 of 27 steps done, 1 waiting)**

✅ done · ⏳ to do or in progress · ⛔ waiting on the client or the owner (say what in the line). After ticking steps, run `node scripts/progress.mjs` to update the line above. Add or remove steps to fit the client (new features go under Phase 4).

## Plan and estimate (filled in Phase 0)

- Chats: [NEED: range]
- Working days: [NEED: range]
- Share of a week's usage allowance: [NEED: rough %]
- Based on: [NEED: sizes added up from FEATURES.md and ESTIMATES.md]

## Phase 0. Brief

- ⏳ Read `client-brief/` and fill in `REQUIREMENTS.md`
- ⏳ List the gaps (`[NEED: ...]`)
- ⛔ Owner answers the gaps (Phase 1-3 and long-lead items now; the rest when their phase starts)
- ⏳ Plan and estimate (above)

## Phase 1. Setup

- ⏳ `src/config/brand.ts` (name, contact details, state, price ranges, `description`, member prefix) and the name copies (`docs/template/PHASE1.md`)
- ⏳ Feature switches in `src/config/features.ts`
- ⏳ Categories and subcategories (`DEFAULT_CATEGORIES`)
- ⏳ Delivery and support defaults (`DEFAULT_DELIVERY` and its copy in `api/create-order.ts`, `BRAND.replyWithin` and `BRAND.shipsTo`)
- ⏳ Checks pass (`node scripts/check.mjs`)

## Phase 2. Look

- ⏳ Palette, fonts, radius and motion chosen (`ui-ux-pro-max`)
- ⏳ Homepage mockup at 390 px and 1440 px, light and dark
- ⏳ Client's yes on the mockup

## Phase 3. Apply look

- ⏳ Design tokens and fonts
- ⏳ Logo files built from `brand-assets/`
- ⏳ Every page checked at 390 px and 1440 px, light and dark

## Phase 4. New features

- ⏳ List new features, one line each from `REQUIREMENTS.md` (write "none" and tick this when there are none)

## Phase 5. Accounts

- ⏳ Client's Firebase project, rules and indexes (no demo products: categories seed from `DEFAULT_CATEGORIES` on the first admin visit)
- ⏳ Razorpay keys (test, then live)
- ⏳ Vercel project and env vars
- ⏳ Domain and `VITE_SITE_URL`

## Phase 6. Content

- ⏳ Real products and photos
- ⏳ Policy pages (privacy, terms, shipping, cancellation and refunds) and the About page, rewritten from the client's answers (the template's policy text is generic)
- ⏳ Every `[NEED: ...]` cleared
- ⏳ No demo data in the client's project

## Phase 7. Launch

- ⏳ Full check and security audit
- ⏳ Go live
- ⏳ Admin guide handed to the client

## Waiting on the client ([NEED] list)

- [NEED: filled in Phase 0]
