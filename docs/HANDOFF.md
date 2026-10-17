# Handoff: read this first

ICONOIQ: online store for the client, made from the Dream Team Ecommerce Template (React 18, Vite, TypeScript, Tailwind, shadcn/ui, Firebase, Vercel functions, Razorpay).

This file holds the working state between chats, so a new chat never needs the old one. The working rules (workflows, ultracode, effort, new chat or continue) live in `~/.claude/CLAUDE.md`, not here.

- **At the start of a chat:** read this file, then do the first open item under "Next steps", unless the user asks for something else.
- **At the end of a task:** update "State", "Next steps" and "Last updated".

Last updated: 2026-10-17 (Phases 0-1 done; Phase 2 mockup made and waiting for the owner's yes; dummy-product photos half made)

## State

- **Branch and last commit:** main, local only. The template is the `template` git remote.
- **Done:** Phase 0 closed (owner's answers are in `REQUIREMENTS.md`, plan and [NEED] list in `PROGRESS.md`). Phase 1 set: `brand.ts` (name, contact, address, price bands, member prefix `IQ`), the six default categories, delivery days 4-7, every name copy. Features are the template defaults. Phone, email, WhatsApp and hours now follow Admin > Commerce > Support on every customer-facing page (`useCustomerSupport`; the footer shows the support values unless its own editor fields are filled).
- **Still the template's until later phases:** the look and logo (Phases 2-3), the demo Firebase project's categories and products (Phase 5), the template's policy text (Phase 6).
- **Phase 2 (look):** `docs/look/home-mockup.html` ("Temple Modern": ivory, chocolate, bronze, gold; Marcellus headings, Figtree body; arch-topped image frames, kolam dot texture, pillar-diamond dividers; pill buttons), shots in `docs/look/shots/`, contrast 40/40 pass. Section picks set in `src/config/sections.ts`: header centered, hero split, productCard detailed, categoryDisplay tiles (product page and footer classic). The `ui-ux-pro-max` search suggested a kids' blue/pink/Comic Neue system: rejected, the client's own palette (proposal: bronze, gold, chocolate, beige) wins.
- **Own Firebase now:** the owner created `iconoiq-85b53`; `.env` holds its web config and the Cloudinary values (cloud `kufiymn0`, unsigned preset `iconoiq`); the admin key file `iconoiq-85b53-firebase-adminsdk-*.json` is in the root (git-ignored). `.firebaserc` still names the demo project: switch it before any deploy. Firestore, Auth and Storage setup, rules and indexes are not done yet (Phase 5 work, pulled forward for the dummy products).
- **Images (ChatGPT, Dream Team browser):** logos `client-brief/generated/iconoiq-logo-on-dark.png` (true transparent, white letters) and `iconoiq-logo-on-light.png` (derived from it in Python: grey tones recoloured to chocolate). Product and banner originals in `client-brief/generated/iq-*.png` (git-ignored), web copies in `docs/look/img/*.webp`. Done: hero-1/2, classroom, p01 nataraja kit, p02 gopuram kit, p03 mudra cards, p04 drawing templates, p05 brass stencils, p06 picture book, p07 navagraha charts, p09 avatar puzzle, p11 colouring kit, p15 ganesha kit. Requested but not yet downloaded (open ChatGPT chats in the DREAM TEAM SERVICES browser, or regenerate): p08 activity book, p10 memory card game, p12 kolam stencils, p13 classroom pack. Still to request: p14 Natyam academy pack.
- **Unfinished or uncommitted work:** none. The Phase 1 step "Checks pass" waits for `node scripts/check.mjs` (tests and build already pass).
- **How to run and check it:** `npm run dev` (port 5182: `npx vite --port 5182 --strictPort --host 127.0.0.1`; if it is busy, see Gotchas); `node scripts/check.mjs` runs tests, build and screenshots (light and dark, 390 px and 1440 px).

## Next steps (in order)

| # | Step | Ultracode? | Effort |
|---|---|---|---|
| 1 | Owner's yes on `docs/look/home-mockup.html` (or changes). Then tick Phase 2 in `PROGRESS.md` | No | High |
| 2 | Finish the dummy catalogue photos (list above; same ChatGPT style prompt: square studio photo on #F3EADB ivory backdrop, soft window light from the left), download into `client-brief/generated/` and make webp copies | No | High |
| 3 | Phase 3 (apply the look) per `docs/template/PHASE3.md`: paste the mockup token block into `src/index.css`, fonts in `index.html`, manifest colours, logo assets from the two PNGs (`brand-assets/`, `node scripts/build-logo-assets.mjs`; the logo is a wide 3:1 picture logo, so check header/footer sizes), the arch/kolam/pillar layer on the template's blocks (visual only, no feature changes), category strip icons, then every page at 390/1440 light/dark and `node scripts/check.mjs` | No | High |
| 4 | Set up `iconoiq-85b53` (Firestore, Auth email sign-in, rules and indexes deployed with the owner's OK, `.firebaserc`), upload the photos to Cloudinary and add the 15 dummy products (names and prices in the Decisions below), marked as dummies | No | High |

**Message for the next chat:** `Read docs/HANDOFF.md and do Next step 1 (my answer on the mockup: <yes or changes>), then steps 2-4.`

## Waiting on the client or the user

- The [NEED] list at the end of `PROGRESS.md` (WhatsApp number, public address, hours, social links, domain name, launch date, offers). Razorpay KYC is in progress; the owner connects the domain when it is ready.

## Decisions (and why)

- 2026-10-17: Started from the template as is. Why: Phase 0 decides what changes.
- 2026-10-17: Features exactly the template defaults, and no new features (owner: no functionality changes). Loyalty card purchase, scratch prizes beyond points and paid dealer membership are Phase 4, only if the client asks.
- 2026-10-17: Selling rules are the template defaults, marked provisional in `REQUIREMENTS.md` (owner: "keep what you think best for now, we change later"). Confirm in Phase 6.
- 2026-10-17: One place to edit contact details. Customer-facing code reads phone, email, WhatsApp and hours through `useCustomerSupport()` (`src/hooks/useCustomerSupport.ts`), never `BRAND`; `tests/contact-follows-support.test.ts` fails on a direct read. Why: pages that read `BRAND` ignored the admin's edit. The footer editor's phone, email and hours are now an optional override (empty = the support values).

- 2026-10-17: Look "Temple Modern" (see State). Dummy catalogue (owner: dummy products with ChatGPT photos for now, real ones in Phase 6): Learning Kits: Nataraja Iconography Learning Kit ₹1,499, Ganesha Form & Symbol Kit ₹1,299, Temple Gopuram Build-and-Learn Kit ₹2,499, Hasta Mudra Learning Cards ₹999; Templates & Stencils: Deity Proportion Drawing Templates ₹799, Brass Temple Motif Stencil Set ₹1,899; Books & Charts: Shilpa Shastra Picture Book ₹449, Navagraha Wall Chart Set ₹349, Trace & Colour Activity Book ₹299; Games & Puzzles: Dashavatara Jigsaw Puzzle ₹599, Gods & Symbols Memory Game ₹399; Art & Stationery: Temple Art Colouring Kit ₹549, Kolam & Rangoli Stencil Pack ₹249; School & Academy Packs: Classroom Iconography Pack ₹4,999, Natyam Academy Mudra Pack ₹3,499.
- 2026-10-17 (owner): ChatGPT and other creative work runs in the "DREAM TEAM SERVICES" Chrome; the client's own accounts (Cloudinary, Firebase) in the "ICONOIQ" Chrome.

## Gotchas

- `node scripts/check.mjs` prints two "still the template's" warnings (`replyWithin` '24 hours' and `shipsTo`): expected, those values are the owner's provisional choice for now.
- `api/` has no copy of the phone, email or WhatsApp number (only `STORE_NAME`, the home state and the delivery numbers), so nothing server-side needs changing when the admin edits them.
- The category strip has icons for the first four categories only; the other two get the "more" icon until Phase 3 swaps the icon list in `CategoryIconNav.tsx`.
- `node scripts/check.mjs` takes about 2 minutes. The home page logs one 404 for `/catalog/products.json` until a catalogue snapshot is published: expected, not a failure.
- `npx tsc -p tsconfig.app.json --noEmit` needs `--ignoreDeprecations 5.0`; 7 type errors are old (template baseline).
- `npm run lint` reports 48 old errors from the template's source store.
- `.env` now points at ICONOIQ's own project, so the old warning about the demo project no longer applies to the preview; still never deploy until `.firebaserc` is switched. (Old note: and opening a category page or the product form as admin calls `seedDefaultCategories()`, which writes `DEFAULT_CATEGORIES` to that project.
- Dev server port: if 5182 is busy, use another (`npx vite --port 5184 --strictPort --host 127.0.0.1`); `check.mjs` uses 5183 for its preview.
- Dev pages never reach network idle (Firebase listeners keep running): in Playwright scripts wait for `load` plus a short fixed wait, never `networkidle`.
