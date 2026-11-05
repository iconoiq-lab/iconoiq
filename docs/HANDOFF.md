# Handoff: read this first

ICONOIQ: online store for the client, made from the Dream Team Ecommerce Template (React 18, Vite, TypeScript, Tailwind, shadcn/ui, Firebase, Vercel functions, Razorpay).

This file holds the working state between chats. The working rules live in `~/.claude/CLAUDE.md`, not here. Older state and decisions: `docs/archive/HANDOFF-history-2026-10-22.md` (look, catalogue, R2, Vercel and domain details).

- **At the start of a chat:** read this file, then do the first open item under "Next steps", unless the user asks for something else.
- **At the end of a task:** update "State", "Next steps" and "Last updated".

Last updated: 2026-11-05 (Lakshmi coin card + SEO pass committed locally, NOT pushed; deploy waits on the owner's yes).

## State

- **Lakshmi coin card (2026-11-05, done, not deployed):** client voice notes in `client sent voice notes/` (not committed). Spec `docs/specs/lakshmi-coin-gift.md`. Live test `node scripts/qa/coin-gift-live.mjs` passed (writes to live Firestore, cleans up). After deploy: `firebase deploy --only firestore:rules` (owner's yes), then Admin > Commerce settings > Lakshmi coin > switch on.
- **SEO pass (2026-11-05, not deployed):** `/sitemap.xml` and `/catalog/products.json` now served by `api/media.ts` (`?sitemap=1`, `?catalog=1`); the old external rewrite to r2.dev returned index.html on Vercel, so every visit read Firestore. robots.txt has the Sitemap line; sample (`demo`) products are noindex and left out of the sitemap; home has a keyword title + Organization/WebSite JSON-LD; og:site_name/og:locale. Search Console: property `https://www.iconoiq.com/` added in the ICONOIQ Chrome, verification file `public/google5781a126ae83ed58.html` (needs the deploy, then click VERIFY). Report: `docs/seo/SEO-2026-11-05.md`.
- **Academy & Dealership Programme (2026-11-02, deployed b35ea64):** spec `docs/specs/academy-dealership-programme.md`; open questions in the PROGRESS.md [NEED] list.

- **Branch:** main, local commits ahead of `origin` (github.com/iconoiq-lab/iconoiq; Vercel `javani1/iconoiq` deploys from it, so push = deploy). The template is the `template` remote.
- **Done:** Phases 0-3 (look "Temple Modern"); Firebase `iconoiq-85b53` with rules, 12 indexes and the dummy catalogue (`node scripts/seed-iconoiq.mjs`, all `demo: true`); Cloudflare R2 + analytics token; Vercel vars; domain iconoiq.com on Vercel (www). Details in the archive file.
- **Phase 5 open:** Razorpay keys (KYC in progress) and a test order; DNS move to Cloudflare waits on the owner switching GoDaddy's nameservers to gene/trey.ns.cloudflare.com; after that: R2 custom domain media.iconoiq.com, `CLOUDFLARE_ZONE_ID`, cache purge on the token, `R2_PUBLIC_URL`, `scripts/rewrite-media-urls.mjs` (the catalog rewrite now goes through `/api/media?catalog=1`, so it no longer needs moving).
- **Rewards:** turned on in Admin (owner's yes, 2026-10-22).
- **Admins:** admin@iconoiq.com (password equals the email: the owner must change it) and iconoiq@gmail.com (client sets a password with "Forgot password"). The order-alert WhatsApp number is empty.
- **Test data in iconoiq-85b53 (remove before launch):** shopper `preview.shopper@iconoiq-test.invalid` (login in `scripts/qa/shopper.local`, git-ignored), 13 fixture orders and a temporary admin from `node scripts/qa/ui-fixtures.mjs seed`. Remove with `node scripts/qa/ui-fixtures.mjs remove`, then delete the shopper in Firebase Auth and `users/`.
- **Unfinished or uncommitted work:** none.
- **How to run and check it:** `npm run dev` (port 5182: `npx vite --port 5182 --strictPort --host 127.0.0.1`); `node scripts/check.mjs` runs tests, build and screenshots.

## Next steps (in order)

| # | Step | Ultracode? | Effort |
|---|---|---|---|
| 1 | **Deploy, only on the owner's yes:** `git push origin main` (Vercel builds it). Includes the coin card and the SEO pass. After it: `curl https://www.iconoiq.com/catalog/products.json` is JSON, `/sitemap.xml` lists the categories; Search Console (ICONOIQ Chrome) > VERIFY, submit `sitemap.xml`; Bing Webmaster Tools > import from Search Console; deploy `firestore.rules`; switch the coin card on. Then on www.iconoiq.com: Admin > Settings shows the alert number field from the store setting; cart says "Calculated at address" before an address; the Razorpay screen shows the logo once keys exist. The other store deploys from its own repo on a separate yes | No | Medium |
| 1b | **Security follow-up (2026-11-03 review):** a partner can check out as a guest or from a second account with their own code and earn commission plus unlock credit (`api/create-order.ts:916` only treats it as family when the uid matches). Fix: match the shipping phone/address against the partner application and treat a match as family (no commission), and add an admin review flag before payout. Effort Extra high | No | Extra high |
| 2 | After the deploy: Admin > Settings turns on the dealers switch (programme); apply as a partner with a test account, approve it in Admin > Partners, place an order with the code, mark delivered, check the earning shows held. Also open Admin > Categories, move one category and back, and check the menu strip follows; the other store gets the same check after its own deploy | No | Medium |
| 3 | Razorpay = Javani's live account (owner 2026-11-03). Done: iconoiq.com submitted for website approval (24-48 h), the 3 keys are in local `.env`. Keys are on Vercel (redeployed, `8bcff1c`). Left: after approval a real small test order + refund | No | High |
| 4 | Before launch: remove the test data (above); owner changes the admin@iconoiq.com password and sets the alert WhatsApp number (Admin > Settings); social links; COD yes/no (some COD code exists in `orderStatus.ts`/`orderService.ts`) | No | Medium |
| 5 | Tell the client: sign in at `/admin` with iconoiq@gmail.com after "Forgot password"; ask whether the four "Shop for" cards point at the right shelves | — | — |

**Message for the next chat:** `Read docs/HANDOFF.md and do Next step 1 (deploy + Search Console verify), only after the owner's yes.` Step 3 waits on the Razorpay keys.

## Waiting on the client or the user

- Deploy yes (step 1). Razorpay KYC and keys. GoDaddy nameserver switch.
- The [NEED] list at the end of `PROGRESS.md` (WhatsApp number, public address, hours, social links, launch date, offers).

## Gotchas

- `tests/template-clean.test.ts` fails on any past-client name in a tracked file, docs included: call the other store "the other client store" here.
- `node scripts/check.mjs` takes about 2 minutes and prints two "still the template's" warnings (`replyWithin`, `shipsTo`): expected, the owner's provisional choice.
- `npx tsc -p tsconfig.app.json --noEmit` needs `--ignoreDeprecations 5.0`; 7 type errors are old (template baseline). `npm run lint` reports 48 old errors.
- Product ids are random: never re-run the full seed (it breaks carts, wishlists and order links); use `--add-missing-products`.
- New Firestore indexes are made in the console (ICONOIQ Chrome, `docs/setup/ICONOIQ_INDEXES.md`): the admin key cannot create them and the CLI login is another account.
- Categories: the slug never changes on rename (the name is copied onto products, coupons, footer links); `order` unset sorts after every numbered one (so `createCategory` saves the others' positions too); seeding only fills an EMPTY collection, so a removed default stays removed; storefront readers drop `hidden`, admin pickers pass `{ includeHidden: true }` (a test checks it).
- A category the admin adds later gets the "more" icon in the strip; give it one in `DEFAULT_ICONS` (`CategoryIconNav.tsx`) or draw one in `IconoIcons.tsx`.
- Dev server port: if 5182 is busy, use another; `check.mjs` uses 5183 for its preview. Dev pages never reach network idle: in Playwright wait for `load` plus a short fixed wait.
- Browsers: creative work and both live admin sessions are in the DREAM TEAM SERVICES Chrome; the client's own accounts (Firebase, Cloudflare, Vercel) in the ICONOIQ Chrome.
