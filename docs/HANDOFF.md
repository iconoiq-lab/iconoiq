# Handoff: read this first

ICONOIQ: online store for the client, made from the Dream Team Ecommerce Template (React 18, Vite, TypeScript, Tailwind, shadcn/ui, Firebase, Vercel functions, Razorpay).

This file holds the working state between chats, so a new chat never needs the old one. The working rules (workflows, ultracode, effort, new chat or continue) live in `~/.claude/CLAUDE.md`, not here.

- **At the start of a chat:** read this file, then do the first open item under "Next steps", unless the user asks for something else.
- **At the end of a task:** update "State", "Next steps" and "Last updated".

Last updated: 2026-10-17 (Phase 0 closed, Phase 1 done except the `check.mjs` run)

## State

- **Branch and last commit:** main, local only. The template is the `template` git remote.
- **Done:** Phase 0 closed (owner's answers are in `REQUIREMENTS.md`, plan and [NEED] list in `PROGRESS.md`). Phase 1 set: `brand.ts` (name, contact, address, price bands, member prefix `IQ`), the six default categories, delivery days 4-7, every name copy. Features are the template defaults. Phone, email, WhatsApp and hours now follow Admin > Commerce > Support on every customer-facing page (`useCustomerSupport`; the footer shows the support values unless its own editor fields are filled).
- **Still the template's until later phases:** the look and logo (Phases 2-3), the demo Firebase project's categories and products (Phase 5), the template's policy text (Phase 6).
- **Unfinished or uncommitted work:** none. The Phase 1 step "Checks pass" waits for `node scripts/check.mjs` (tests and build already pass).
- **How to run and check it:** `npm run dev` (port 5182: `npx vite --port 5182 --strictPort --host 127.0.0.1`; if it is busy, see Gotchas); `node scripts/check.mjs` runs tests, build and screenshots (light and dark, 390 px and 1440 px).

## Next steps (in order)

| # | Step | Ultracode? | Effort |
|---|---|---|---|
| 1 | Run `node scripts/check.mjs`, fix what it reports, tick "Checks pass" in `PROGRESS.md` | No | High |
| 2 | Phase 2 (Look): `ui-ux-pro-max` search, section versions, ONE homepage mockup at 390 and 1440 px, light and dark. Stop for the client's yes | No | High |

**Message for the next chat:** `Proceed` (the Phase 2 look is the next phase once the check passes).

## Waiting on the client or the user

- The [NEED] list at the end of `PROGRESS.md` (WhatsApp number, public address, hours, social links, domain name, launch date, offers). The owner is creating the Firebase project; Razorpay KYC is in progress.

## Decisions (and why)

- 2026-10-17: Started from the template as is. Why: Phase 0 decides what changes.
- 2026-10-17: Features exactly the template defaults, and no new features (owner: no functionality changes). Loyalty card purchase, scratch prizes beyond points and paid dealer membership are Phase 4, only if the client asks.
- 2026-10-17: Selling rules are the template defaults, marked provisional in `REQUIREMENTS.md` (owner: "keep what you think best for now, we change later"). Confirm in Phase 6.
- 2026-10-17: One place to edit contact details. Customer-facing code reads phone, email, WhatsApp and hours through `useCustomerSupport()` (`src/hooks/useCustomerSupport.ts`), never `BRAND`; `tests/contact-follows-support.test.ts` fails on a direct read. Why: pages that read `BRAND` ignored the admin's edit. The footer editor's phone, email and hours are now an optional override (empty = the support values).

## Gotchas

- `node scripts/check.mjs` prints two "still the template's" warnings (`replyWithin` '24 hours' and `shipsTo`): expected, those values are the owner's provisional choice for now.
- `api/` has no copy of the phone, email or WhatsApp number (only `STORE_NAME`, the home state and the delivery numbers), so nothing server-side needs changing when the admin edits them.
- The category strip has icons for the first four categories only; the other two get the "more" icon until Phase 3 swaps the icon list in `CategoryIconNav.tsx`.
- `node scripts/check.mjs` takes about 2 minutes. The home page logs one 404 for `/catalog/products.json` until a catalogue snapshot is published: expected, not a failure.
- `npx tsc -p tsconfig.app.json --noEmit` needs `--ignoreDeprecations 5.0`; 7 type errors are old (template baseline).
- `npm run lint` reports 48 old errors from the template's source store.
- Never sign in as admin on the preview before Phase 5: it reads the demo Firebase project, and opening a category page or the product form as admin calls `seedDefaultCategories()`, which writes `DEFAULT_CATEGORIES` to that project.
- Dev server port: if 5182 is busy, use another (`npx vite --port 5184 --strictPort --host 127.0.0.1`); `check.mjs` uses 5183 for its preview.
- Dev pages never reach network idle (Firebase listeners keep running): in Playwright scripts wait for `load` plus a short fixed wait, never `networkidle`.
