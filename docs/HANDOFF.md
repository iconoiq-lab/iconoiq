# Handoff: read this first

ICONOIQ: online store for the client, made from the Dream Team Ecommerce Template (React 18, Vite, TypeScript, Tailwind, shadcn/ui, Firebase, Vercel functions, Razorpay).

This file holds the working state between chats, so a new chat never needs the old one. The working rules (workflows, ultracode, effort, new chat or continue) live in `~/.claude/CLAUDE.md`, not here.

- **At the start of a chat:** read this file, then do the first open item under "Next steps", unless the user asks for something else.
- **At the end of a task:** update "State", "Next steps" and "Last updated".

Last updated: 2026-10-17 (UI finished: signed-in pages checked, "Shop for" block, own category icons, word band, wishlist banner, card detail line; Razorpay and Vercel wait for the owner)

## State

- **Branch and last commit:** main, local only. The template is the `template` git remote.
- **Done:** Phase 0 (answers in `REQUIREMENTS.md`, plan and [NEED] list in `PROGRESS.md`), Phase 1 (brand, categories, delivery, name copies; contact details follow Admin > Commerce > Support via `useCustomerSupport`), Phase 2 (owner said yes to `docs/look/home-mockup.html`), Phase 3 (look applied, below).
- **Phase 3, the look ("Temple Modern"):** tokens from the mockup in `src/index.css` (plus derived popover/secondary/accent/sidebar values and a `--gold` token), radius 28/18/pill/pill, Marcellus + Figtree (`index.html`, `data-heading-weight="light"`, both heading weights 400 because Marcellus has one weight; the light-weight rule also covers inline `--font-heading` styles, so no fake bold), theme colours `#F8F2E8`/`#120C08`, manifest `#794120`. Contrast 62/62. Logo: the client's picture logo (`brand-assets/logo.png`, `logo-light.png`; `build-logo-assets.mjs` now uses `logo-light.png` for the light wordmark instead of a negative) and a Marcellus "IQ" monogram (`mark.svg`). Home page per the mockup notes: facts strip on; top deals, Editor's picks, scrolling word band and phrase band off; category tiles moved to straight after the hero (`src/pages/Index.tsx`), six across with arch tops; kolam dots behind the hero text; hero lines from the mockup (`HeroBanner.tsx`); category strip icons for all six.
- **Firebase `iconoiq-85b53` (owner OK 2026-10-17):** `.firebaserc` now names it. Firestore rules deployed (through the Rules API with the project's admin key: the `firebase` CLI here is logged in with another Google account). Email sign-in was already on. The 6 categories and the dummy catalogue are seeded by `node scripts/seed-iconoiq.mjs` (content in `scripts/iconoiq/content.mjs`; 15 products, 2 hero slides, 6 category tiles, 6 collections, 1 schools banner; all `demo: true`; `--remove` clears them; photo URLs cached in `scripts/iconoiq/images.json`, Cloudinary folder `iconoiq-85b53/dummy`). Product specs are `[NEED]`; descriptions say "Sample listing". **Indexes:** all 12 from `firestore.indexes.json` are enabled (made in the Firebase console in the ICONOIQ Chrome with the links in `docs/setup/ICONOIQ_INDEXES.md`, 2026-10-17; the admin key may not create indexes). Home hero, schools banner and reviews load; checked at 390/1440 light/dark.
- **Home page, owner 2026-10-17 ("make it look like a shopping website"):** hero switched from `split` to `classic` (`src/config/sections.ts`): a full-width photo with the text on it, improved in `HeroBanner.tsx` with a gold label ("Indian iconography learning kits"), a supporting line per slide (`HERO_SUBLINES`), a solid cream button, a slow photo push-in (`.hero-drift` in `src/index.css`, off under reduced motion) and the words rising in after each slide lands. Editor's picks switched on (`src/config/homeBlocks.ts`). Top deals stays off until there are real discounts.
- **UI finish (2026-10-17, owner: "look like a shopping website, like sreerasthusilvers.com and ishaputra.in, but not a copy"):** the card's "500 g" line is gone (`CARD_SHOWS_WEIGHT = false` in `src/config/sections.ts`); the Detailed card shows a real short spec, else "Free delivery" when the item alone reaches the free-delivery amount (`src/hooks/useFreeDeliveryAbove.ts`, one shared listener), else nothing. New home block "Shop for / Who is learning?" after Most loved (`src/components/ShopForSection.tsx`, cards in `src/config/shopFor.ts`, `tests/shop-for.test.ts`): Young learners, Classrooms, Dance academies, Temples, linking to category shelves (provisional, the client may re-point them). Scrolling word band back on with the kits' subjects and a lotus mark. ICONOIQ's own line icons for the category strip (`src/components/icons/IconoIcons.tsx`). Wishlist banner replaced the `[NEED: wishlist image]` placeholder. Art made in ChatGPT (DREAM TEAM SERVICES browser): originals `client-brief/generated/iq-shopfor-*.png`, `iq-banner-wishlist.png`; web copies in `public/art/`. Account, orders, order details, cart, checkout, addresses and wishlist checked signed in at 390/1440 light/dark: no faults beyond the fixture photos (fixed in `scripts/qa/ui-fixtures.mjs`, which also reads the key file now).
- **Test data in iconoiq-85b53 (remove before launch):** shopper `preview.shopper@iconoiq-test.invalid` (login in `scripts/qa/shopper.local`, git-ignored; its user doc has `uiFixtureShopper: true`), 13 fixture orders and a temporary admin from `node scripts/qa/ui-fixtures.mjs seed`. Remove with `node scripts/qa/ui-fixtures.mjs remove`, then delete the shopper in Firebase Auth and `users/`.
- **Admin:** iconoiq@gmail.com is an admin (made with the admin SDK as a verified email login, then given a random password nobody knows). The client signs in at `/admin` after "Forgot password" sets their own. All admin pages checked; the only console error is `/api/media` 503 (R2 not set up yet). Firebase Storage is not used by the app, so `storage.rules` was not deployed.
- **Photos:** all 15 dummy product photos done (ChatGPT, DREAM TEAM SERVICES browser); originals in `client-brief/generated/iq-*.png` (git-ignored), web copies in `docs/look/img/`.
- **Still the template's until later phases:** policy text and About/Contact photos (`[NEED]` placeholders, Phase 6), the Contact page's "Website example.com" (until `VITE_SITE_URL`, Phase 5).
- **Unfinished or uncommitted work:** none.
- **How to run and check it:** `npm run dev` (port 5182: `npx vite --port 5182 --strictPort --host 127.0.0.1`); `node scripts/check.mjs` runs tests, build and screenshots.

## Next steps (in order)

| # | Step | Ultracode? | Effort |
|---|---|---|---|
| 1 | Phase 5 accounts, planned with the owner for 2026-10-18: Razorpay test keys (ICONOIQ Chrome, into `.env` only), Vercel project and env vars (owner to choose the account), image storage (Cloudflare R2 keys) and `VITE_SITE_URL`; then a test order end to end (`docs/setup/`) | No | High |
| 2 | Tell the client: sign in at `/admin` with iconoiq@gmail.com after "Forgot password"; and ask whether the four "Shop for" cards point at the right shelves | — | — |

**Message for the next chat:** `Read docs/HANDOFF.md and do Next step 1 (Phase 5 accounts: Razorpay test keys, Vercel, R2, VITE_SITE_URL).`

## Waiting on the client or the user

- The [NEED] list at the end of `PROGRESS.md` (WhatsApp number, public address, hours, social links, domain name, launch date, offers). Razorpay KYC is in progress; the owner connects the domain when it is ready.

## Decisions (and why)

- 2026-10-17: Started from the template as is. Why: Phase 0 decides what changes.
- 2026-10-17: Features exactly the template defaults, and no new features (owner: no functionality changes). Loyalty card purchase, scratch prizes beyond points and paid dealer membership are Phase 4, only if the client asks.
- 2026-10-17: Selling rules are the template defaults, marked provisional in `REQUIREMENTS.md` (owner: "keep what you think best for now, we change later"). Confirm in Phase 6.
- 2026-10-17: One place to edit contact details. Customer-facing code reads phone, email, WhatsApp and hours through `useCustomerSupport()` (`src/hooks/useCustomerSupport.ts`), never `BRAND`; `tests/contact-follows-support.test.ts` fails on a direct read. Why: pages that read `BRAND` ignored the admin's edit. The footer editor's phone, email and hours are now an optional override (empty = the support values).

- 2026-10-17: Look "Temple Modern" (see State). Dummy catalogue (owner: dummy products with ChatGPT photos for now, real ones in Phase 6): Learning Kits: Nataraja Iconography Learning Kit ₹1,499, Ganesha Form & Symbol Kit ₹1,299, Temple Gopuram Build-and-Learn Kit ₹2,499, Hasta Mudra Learning Cards ₹999; Templates & Stencils: Deity Proportion Drawing Templates ₹799, Brass Temple Motif Stencil Set ₹1,899; Books & Charts: Shilpa Shastra Picture Book ₹449, Navagraha Wall Chart Set ₹349, Trace & Colour Activity Book ₹299; Games & Puzzles: Dashavatara Jigsaw Puzzle ₹599, Gods & Symbols Memory Game ₹399; Art & Stationery: Temple Art Colouring Kit ₹549, Kolam & Rangoli Stencil Pack ₹249; School & Academy Packs: Classroom Iconography Pack ₹4,999, Natyam Academy Mudra Pack ₹3,499.
- 2026-10-17 (owner): ChatGPT and other creative work runs in the "DREAM TEAM SERVICES" Chrome; the client's own accounts (Cloudinary, Firebase) in the "ICONOIQ" Chrome.

- 2026-10-17: Home blocks follow the mockup's notes (owner's yes): top deals off (no real offers, and it said "Savings" and "Deal of the week"), Editor's picks, the scrolling word band and the phrase band off; facts strip on. Switch top deals back on only with real discounts.
- 2026-10-17 (owner): the hero must feel like a shop's (full photo, text on it), not an editorial split; Editor's picks back on for a fuller shop home.
- 2026-10-17 (owner: shop-like, not a copy): word band back on with the kits' subjects; "Shop for" block added; card detail line is a spec or "Free delivery", never the weight. Top deals stays off (no real discounts) and testimonials stay hidden (no real reviews), even though both reference sites show them.
- 2026-10-17: Firebase indexes are made in the console (ICONOIQ Chrome, links file), because the admin key cannot create them and the CLI login is another account. A new index in `firestore.indexes.json` needs the same: add a row to the links file or use the console.

## Gotchas

- `node scripts/check.mjs` prints two "still the template's" warnings (`replyWithin` '24 hours' and `shipsTo`): expected, those values are the owner's provisional choice for now.
- `api/` has no copy of the phone, email or WhatsApp number (only `STORE_NAME`, the home state and the delivery numbers), so nothing server-side needs changing when the admin edits them.
- A category the admin adds later gets the "more" icon in the strip; give it one in `DEFAULT_ICONS` (`CategoryIconNav.tsx`) or draw one in `IconoIcons.tsx`.
- `node scripts/check.mjs` takes about 2 minutes. The home page logs one 404 for `/catalog/products.json` until a catalogue snapshot is published: expected, not a failure.
- `npx tsc -p tsconfig.app.json --noEmit` needs `--ignoreDeprecations 5.0`; 7 type errors are old (template baseline).
- `npm run lint` reports 48 old errors from the template's source store.
- `.env` and `.firebaserc` both name ICONOIQ's own project `iconoiq-85b53` now.
- Dev server port: if 5182 is busy, use another (`npx vite --port 5184 --strictPort --host 127.0.0.1`); `check.mjs` uses 5183 for its preview.
- Dev pages never reach network idle (Firebase listeners keep running): in Playwright scripts wait for `load` plus a short fixed wait, never `networkidle`.
