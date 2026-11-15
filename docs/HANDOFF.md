# Handoff: read this first

ICONOIQ: online store for the client, made from the Dream Team Ecommerce Template (React 18, Vite, TypeScript, Tailwind, shadcn/ui, Firebase, Vercel functions, Razorpay).

This file holds the working state between chats. The working rules live in `~/.claude/CLAUDE.md`, not here. Older state and decisions: `docs/archive/HANDOFF-history-2026-10-22.md` (look, catalogue, R2, Vercel and domain details).

- **At the start of a chat:** read this file, then do the first open item under "Next steps", unless the user asks for something else.
- **At the end of a task:** update "State", "Next steps" and "Last updated".

Last updated: 2026-11-15 (live = fbcf4f2; Razorpay REJECTED iconoiq.com on Javani's account; waiting for the owner's UPI ID to switch to UPI.)

## State

- **Manual UPI mode (2026-11-15, live at 108b382):** Admin > Commerce settings > Payments switches Razorpay / UPI QR (`siteSettings/payment {mode, upiId, payeeName}`, default razorpay). UPI: `api/create-order.ts` makes a `upi_...` id + `manualPayments/<id>` (no Razorpay); checkout dialog `src/components/checkout/UpiPayDialog.tsx` shows the QR for the exact amount, takes UTR + screenshot (R2 `payments/<uid>/`), `/api/notify-order` `upi-claim`; order saved as payment pending. Admin order page `UpiPaymentReview` → `review-upi-payment` (admin only) writes `payments/<id>` (method upi) and sets paid, or rejects. Duplicate UTRs flagged; points/cashback can't be spent in UPI mode. Tests `tests/upi-payment.test.ts`. Rules released 2026-11-15 with `node scripts/qa/deploy-rules.mjs` (the `firebase` CLI gets 403: other account; always use this script). **Left: the owner enters the real UPI ID + payee name in Admin and switches to UPI** (the store stays on Razorpay until then).
- **SEO pass (2026-11-15, same commits):** `/llms.txt` (vercel rewrite → `api/media?llms=1`), `BRAND.homeTitle`, og:image size/alt tags, Product + Breadcrumb JSON-LD, category/about/contact titles, `useNoindex()` on private routes, robots.txt blocks account pages. Live: `/llms.txt`, robots, sitemap = 200, new home title + og:image tags served. PageSpeed mobile not re-run yet. Needs from client: public address + hours (LocalBusiness), social links.
- **Razorpay REJECTED iconoiq.com (seen 2026-11-15 in Javani's dashboard > Websites & API keys):** "business model deviation… create a new account" for this URL. The Javani live keys will not take payments on iconoiq.com. Plan: UPI QR mode now; a separate Razorpay account for ICONOIQ (owner's KYC) only if cards are needed later.
- **Live = fbcf4f2 (Vercel success, 2026-11-15).** Lighthouse mobile (home): SEO, Accessibility, Best Practices 100 (the mobile search button's name fix is in fbcf4f2). PageSpeed API daily quota was used up; Lighthouse ran through Chrome DevTools. Coin card, SEO pass, Academy programme are live. Vercel Hobby + private repo blocks pushes whose head commit author is not `iconoiq-lab` (b35ea64..cc19727 were Blocked): after any push, check Vercel > Deployments shows Ready.
- **Programme switches ON (2026-11-06):** `siteSettings/dealer.enabled` (Admin > Commerce settings > Dealers) and `partnerSettings/main.enabled` (Admin > Partners > Settings: Silver 15%, customer discount 0%, hold 0 days). Live `/dealer` shows "Become a partner". No real partners yet.
- **Partner live check** `node scripts/qa/partner-live.mjs [BASE] [OUT] [--leave-on]` (dev server on BASE): admin switches on, shopper applies on /dealer, admin approves (code PREV3210), a customer order with the code credits 15% only on delivery, held until the return window ends, no double credit; own-code order = 15% off, no commission; partner area at 4 sizes/themes; Admin > Categories move down/up and the home strip follows. Writes live Firestore and deletes everything after; restores switches unless `--leave-on`. Discounts are whole rupees (floor), commission keeps paise.
- **Self-referral fix (2026-11-06, live):** on delivery `reconcilePartner` calls `partnerSelfMatch` (`api/notify-order.ts`). Order phone (shipping/alternative/account/buyer's user doc) or email = the partner's (application, user doc, saved addresses) → family: Rs 0, no units, no unlock credit (`partnerPrivate/<uid>/orders/<rzp>.selfOrder`). Only the delivery name or a saved address (line + pincode) matches → credited with `review: 'pending'`: not unlocked, not in "To settle", "N orders to check" badge in Admin > Partners and a "Check before paying" box in Manage with "Pay it" / "Their own order" (`/api/notify-order` action `review-partner-earning`, admins only). Phones compare on the last 10 digits, names/addresses on letters+digits only. Not caught: a buyer with a different phone, email, name and address (a friend) — accepted, that is a real referral in practice.
- **Lakshmi coin card:** live; spec `docs/specs/lakshmi-coin-gift.md`; switch it on in Admin > Commerce settings > Lakshmi coin when the owner says so.
- **SEO:** report `docs/seo/SEO-2026-11-05.md`; sitemap/catalog served by `api/media.ts`.

- **Branch:** main, local commits ahead of `origin` (github.com/iconoiq-lab/iconoiq; Vercel `javani1/iconoiq` deploys from it, so push = deploy). The template is the `template` remote.
- **Done:** Phases 0-3 (look "Temple Modern"); Firebase `iconoiq-85b53` with rules, 12 indexes and the dummy catalogue (`node scripts/seed-iconoiq.mjs`, all `demo: true`); Cloudflare R2 + analytics token; Vercel vars; domain iconoiq.com on Vercel (www). Details in the archive file.
- **Phase 5 open:** Razorpay keys (KYC in progress) and a test order; DNS move to Cloudflare waits on the owner switching GoDaddy's nameservers to gene/trey.ns.cloudflare.com; after that: R2 custom domain media.iconoiq.com, `CLOUDFLARE_ZONE_ID`, cache purge on the token, `R2_PUBLIC_URL`, `scripts/rewrite-media-urls.mjs` (the catalog rewrite now goes through `/api/media?catalog=1`, so it no longer needs moving).
- **Rewards:** turned on in Admin (owner's yes, 2026-10-22).
- **Admins:** admin@iconoiq.com (password equals the email: the owner must change it) and iconoiq@gmail.com (client sets a password with "Forgot password"). Order-alert WhatsApp (`siteSettings/adminNotification.whatsappNumber`) = 918106670346 (owner, 2026-11-06).
- **Test data: removed (2026-11-06)** with `node scripts/qa/ui-fixtures.mjs remove-all` (13 fixture orders, temp admin, preview shopper with cart/wishlist/login history; `scripts/qa/*.local` deleted). Firebase now: 0 orders, 3 accounts (admin@iconoiq.com, iconoiq@gmail.com, thedreamteamservicespvt@gmail.com). The demo catalogue (`demo: true` products, banners, collections, showcases) stays until Phase 6. **Live checks (`partner-live`, `coin-gift-live`, `ui-shots --as`...) need the test logins: run `node scripts/qa/ui-fixtures.mjs seed` first (recreates the shopper + temp admin + fixture orders), then `remove-all` after.**
- **COD = no (2026-11-06, Claude's call on the owner's "do the best"):** online payment only (checkout never had a COD option). Terms and Refund pages no longer mention COD (live).
- **Unfinished or uncommitted work:** none.
- **How to run and check it:** `npm run dev` (port 5182: `npx vite --port 5182 --strictPort --host 127.0.0.1`); `node scripts/check.mjs` runs tests, build and screenshots.

## Next steps (in order)

| # | Step | Ultracode? | Effort |
|---|---|---|---|
| 0 | Owner sends the UPI ID + payee name → Claude saves `siteSettings/payment {mode:'upi', upiId, payeeName}`, checks the live checkout QR, then one real small UPI order + admin approve | No | Medium |
| 1 | Razorpay: Javani's account REJECTED iconoiq.com. Only if the owner wants cards: a new Razorpay account for ICONOIQ (owner's KYC), then swap the keys on Vercel | No | High |
| 2 | Pre-launch: done except the owner's own items: change the admin@iconoiq.com password (Account page or "Forgot password"), send social links (then `BRAND.social` in `src/config/brand.ts`) | No | Low |
| 3 | Tell the client: sign in at `/admin` with iconoiq@gmail.com after "Forgot password"; ask whether the four "Shop for" cards point at the right shelves | — | — |

**Message for the next chat:** `Read docs/HANDOFF.md and do Next step 0 (UPI ID set by the owner: test one real UPI order)`.

## Waiting on the client or the user

- The UPI ID + payee name (step 0). GoDaddy nameserver switch.
- The [NEED] list at the end of `PROGRESS.md` (WhatsApp number, public address, hours, social links, launch date, offers).

## Gotchas

- `tests/template-clean.test.ts` fails on any past-client name in a tracked file, docs included: call the other store "the other client store" here.
- `node scripts/check.mjs` takes about 2 minutes and prints two "still the template's" warnings (`replyWithin`, `shipsTo`): expected, the owner's provisional choice.
- `npx tsc -p tsconfig.app.json --noEmit` needs `--ignoreDeprecations 5.0`; 7 type errors are old (template baseline). `npm run lint` reports 48 old errors.
- Firestore rules: deploy with `node scripts/qa/deploy-rules.mjs` (Admin SDK); `npx firebase deploy` fails 403 here.
- Product ids are random: never re-run the full seed (it breaks carts, wishlists and order links); use `--add-missing-products`.
- New Firestore indexes are made in the console (ICONOIQ Chrome, `docs/setup/ICONOIQ_INDEXES.md`): the admin key cannot create them and the CLI login is another account.
- Categories: the slug never changes on rename (the name is copied onto products, coupons, footer links); `order` unset sorts after every numbered one (so `createCategory` saves the others' positions too); seeding only fills an EMPTY collection, so a removed default stays removed; storefront readers drop `hidden`, admin pickers pass `{ includeHidden: true }` (a test checks it).
- A category the admin adds later gets the "more" icon in the strip; give it one in `DEFAULT_ICONS` (`CategoryIconNav.tsx`) or draw one in `IconoIcons.tsx`.
- Dev server port: if 5182 is busy, use another; `check.mjs` uses 5183 for its preview. Dev pages never reach network idle: in Playwright wait for `load` plus a short fixed wait.
- Browsers: creative work and both live admin sessions are in the DREAM TEAM SERVICES Chrome; the client's own accounts (Firebase, Cloudflare, Vercel) in the ICONOIQ Chrome.
- After any push, confirm the build: `gh api repos/iconoiq-lab/iconoiq/commits/<sha>/status` (Vercel's status: "success" = deployed; or Vercel > Deployments "Ready"). The first live-check run can fail at "application saved as pending" (read too early; the script now waits). A push can be silently "Blocked" (Hobby + private repo + non-member commit author). Never write "deployed" from the push alone (lesson 2026-11-06: three deploys were wrongly marked live).
