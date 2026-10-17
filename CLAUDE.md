# ICONOIQ: client store

Client store made from the Dream Team Ecommerce Template on 2026-10-17 (template commit `2ba27f9`). React 18, Vite, TypeScript, Tailwind, shadcn/ui, Firebase, Vercel functions, Razorpay.

## When the owner types "Proceed"

1. Read `docs/HANDOFF.md` and `PROGRESS.md`. Work on the current phase only, one phase per chat. Exception: the owner's answers to the Phase 0 gate arrive with `Proceed`; write them into `REQUIREMENTS.md` (closing Phase 0; re-check the plan and estimate in `PROGRESS.md` if the answers change them), then do Phase 1 in the same chat.
2. Read only what the phase needs: `REQUIREMENTS.md` always; `docs/template/FEATURES.md` for switches, files and sizes; `docs/template/ESTIMATES.md` in Phase 0; `client-brief/` in Phase 0 only (read once, then work from `REQUIREMENTS.md`).
3. At an owner gate (⛔ in `PROGRESS.md`) stop and ask only for the `[NEED: ...]` items, one short question each. Phase 0 asks only what Phases 1-3 need plus long-lead items (Razorpay KYC, domain, launch date); other `[NEED]`s wait for their phase.
4. Finish every chat: `node scripts/check.mjs` passes, commit, tick `PROGRESS.md` and run `node scripts/progress.mjs`, update `docs/HANDOFF.md`, then end with `Done: …`, `Waiting on: …` and the `Next: start a new chat … and send: …` line from the global rules.

## Phases

| # | Work | Owner gate |
|---|---|---|
| 0 Brief | Read `client-brief/`, fill in `REQUIREMENTS.md`, mark gaps `[NEED: ...]`; plan and estimate in `PROGRESS.md` (feature sizes from `FEATURES.md` × `ESTIMATES.md`) | Answers to the Phase 1-3 and long-lead gaps |
| 1 Setup | The checklist in `docs/template/PHASE1.md`: `brand.ts` (incl. `description`), the name copies (api `STORE_NAME`s, `index.html`, manifest, `robots.txt`, push service worker), switches, `DEFAULT_CATEGORIES`, delivery defaults (`DEFAULT_DELIVERY` and its copy in `api/create-order.ts`) and the reply time (`BRAND.replyWithin`, which `DEFAULT_SUPPORT.responseTime` follows) with `BRAND.shipsTo`; `npm test` catches a missed name, delivery number or category. The preview keeps the demo project's categories, products and logo until Phases 3 and 5 | — |
| 2 Look | `ui-ux-pro-max` search for palette, fonts, radius, motion: a starting point only (derive HSL tokens with the template's role names, then measure contrast with `node scripts/qa/contrast.mjs <mockup.html>`). Section versions from `docs/template/SECTIONS.md`, set in `src/config/sections.ts` now, together with the mockup, so `check.mjs` proves the combination renders; a "no" from the client changes them. ONE homepage mockup: copy `docs/template/mockups/home-mockup-starter.html` to `docs/look/home-mockup.html` (photos are drawn placeholders; it proposes which home blocks stay), shots `docs/look/shots/home-{390,1440}-{light,dark}.png`. Judge the look from the mockup: the preview shows demo data until Phase 5 | The client's yes |
| 3 Apply look | The checklist in `docs/template/PHASE3.md`: tokens in `src/index.css` (colours, radius, `--highlight-soft`, `--texture-opacity`) and `tailwind.config.ts` (keep token names), `index.html` (theme-color, fonts link) and `public/manifest.webmanifest` (theme and background colour); run `node scripts/qa/contrast.mjs` (`npm test` fails a palette under 4.5:1); logo: `brand-assets/palette.json` and art, then `node scripts/build-logo-assets.mjs` (no logo from the client: fetch the font, `node scripts/make-wordmark.mjs`, then the build); every page checked, also the fresh-store state (`ui-shots.mjs --block-firestore`) | — |
| 4 New features | Only what the template lacks; each gets a short spec and plan before code | Decisions per feature |
| 5 Accounts | The client's Firebase (point `.firebaserc` at it), Razorpay, Vercel, domain and env vars (`docs/setup/`). The client's Firebase gets no demo products: categories come from `DEFAULT_CATEGORIES` (seeded on the first admin visit); products come in Phase 6 | Logins and keys |
| 6 Content | Real products and photos; policy pages rewritten from the client's answers (the template's text is generic); clear every `[NEED: ...]`; no demo data in the client's project | Client content |
| 7 Launch | Full check, `security-audit` skill, go live, admin guide for the client | Go-ahead |

## Store rules

- Real content only: no invented reviews, ratings, stats, badges, stock or deadlines, and no `aggregateRating` schema without real reviews. Unknown facts are `[NEED: ...]` and go in the list at the end of `PROGRESS.md`.
- Features are switched off in `src/config/features.ts`, never deleted. Rewards, Scratch & Win and dealers also have a runtime setting that starts off; the client's admin turns them on.
- Until Phase 5 this copy previews the Dream Team demo Firebase project (read-only web config in `.env`, no admin key; `.firebaserc` names it too). Never write or deploy to it from client work (no `firebase deploy` before Phase 5 changes `.firebaserc`), and never put another client's keys here.
- `client-brief/` is git-ignored (it can hold private documents). What matters goes into `REQUIREMENTS.md`.
- Template fixes: `node scripts/template-update.mjs` patches in what the template changed since `.template-base`, one file at a time (a rename or delete in the template removes the old file here too; a file this copy already deleted or already has in the new form is skipped as "already done"). It prints the starter-file changes to port by hand, and for every file it cannot apply the exact `git diff` to merge by hand. `.template-base` moves to the new commit only when every file was applied or already done; otherwise merge the listed files, run the checks, then set `.template-base` to the commit it prints. Then run the checks and commit. A fix made here that every store needs goes back to the template by hand.
