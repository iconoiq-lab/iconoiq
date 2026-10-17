# ICONOIQ: progress

**Overall: 56% (15 of 27 steps done, 2 waiting)**

✅ done · ⏳ to do or in progress · ⛔ waiting on the client or the owner (say what in the line). After ticking steps, run `node scripts/progress.mjs` to update the line above. Add or remove steps to fit the client (new features go under Phase 4).

## Plan and estimate (filled in Phase 0)

- Chats: about 4-6 for Phases 0-3 (0 and 1 together: 1, 2: 1-2, 3: 2-3), then about 4-8 more for Phases 5-7, which wait on the owner's logins and the real content. Total about 10-15 (the 8-13 base plus about 2 for setting up dealers, rewards, video calls and the WhatsApp inbox).
- Working days: about 3-8 of chats, plus the time spent waiting on the owner.
- Share of a week's usage allowance: Phases 0-3 about 12-36% of one week; the whole job about 30-70%. A first guess: read `/usage` before and after and put the real numbers in `docs/template/ESTIMATES.md`.
- Based on: no new features (Phase 4 is "none for now"); the phases table in ESTIMATES.md (S, S, M, L, then M, M, M); template features kept: dealers M, rewards M, video calls M, WhatsApp inbox L.

## Phase 0. Brief

- ✅ Read `client-brief/` and fill in `REQUIREMENTS.md`
- ✅ List the gaps (`[NEED: ...]`)
- ✅ Owner answers the gaps (Phase 1-3 and long-lead items now; the rest when their phase starts). Answered 2026-10-17; what is left is in the list at the end
- ✅ Plan and estimate (above)

## Phase 1. Setup

- ✅ `src/config/brand.ts` (name, contact details, state, price ranges, `description`, member prefix) and the name copies (`docs/template/PHASE1.md`)
- ✅ Feature switches in `src/config/features.ts` (the template defaults, as the owner asked)
- ✅ Categories and subcategories (`DEFAULT_CATEGORIES`)
- ✅ Delivery and support defaults (`DEFAULT_DELIVERY` and its copy in `api/create-order.ts`, `BRAND.replyWithin` and `BRAND.shipsTo`)
- ✅ Checks pass (`node scripts/check.mjs`; 2026-10-17)

## Phase 2. Look

- ✅ Palette, fonts, radius and motion chosen (`ui-ux-pro-max`)
- ✅ Homepage mockup at 390 px and 1440 px, light and dark
- ✅ Client's yes on the mockup (owner, 2026-10-17: yes)

## Phase 3. Apply look

- ✅ Design tokens and fonts (Temple Modern: palette, Marcellus + Figtree, radius, home blocks and order from the mockup)
- ✅ Logo files built from `brand-assets/` (the client's picture logo + an IQ monogram)
- ⛔ Every page checked at 390 px and 1440 px, light and dark: done except the hero slides and the schools banner, which wait on the Firestore indexes (owner: the links in `docs/setup/ICONOIQ_INDEXES.md`); signed-in pages wait for Phase 5

## Phase 4. New features

- ✅ List new features, one line each from `REQUIREMENTS.md`: none for now (owner, 2026-10-17: no functionality changes). Later, only if the client asks: loyalty card purchase, scratch prizes beyond points, paid dealer membership

## Phase 5. Accounts

- ⛔ Client's Firebase project, rules and indexes: rules deployed, email sign-in on, `.firebaserc` switched, categories and 15 dummy products seeded (2026-10-17); the 12 indexes wait on the owner (`docs/setup/ICONOIQ_INDEXES.md`)
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

- [NEED: confirm the WhatsApp number] (the phone number, 918106670346, is used for now)
- [NEED: confirm the Udyam address may be shown publicly] (it is in the footer, contact and policy pages)
- [NEED: opening or support hours]
- [NEED: social links (Instagram, Facebook, YouTube)]
- [NEED: the domain name] (the owner owns it and connects it in Phase 5)
- [NEED: launch date]
- [NEED: launch coupons or offers, or "none"]
- [NEED: processing time before dispatch]
- [NEED: reference sites and dislikes for the look] (Phase 2; "choose for us" works)
- [NEED: GST: confirm no GST is charged, and what changes once the client registers]
- Provisional selling rules, to confirm in Phase 6: delivery ₹50 inside Telangana and ₹100 outside, free above ₹999, 4-7 business days, 7-day returns for any reason, reply within 24 hours, the template's policy pages
- Phase 5: Firebase project created (iconoiq-85b53), setup pending, Razorpay KYC (in progress), Vercel, WhatsApp Business API account, Gemini API key, image storage (Cloudinary or Cloudflare R2)
- Phase 6: real product count and photos (the catalogue is dummy for now), about story, real reviews, FAQ
