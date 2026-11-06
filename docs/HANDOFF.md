# Handoff: read this first

ICONOIQ: online store for the client, made from the Dream Team Ecommerce Template (React 18, Vite, TypeScript, Tailwind, shadcn/ui, Firebase, Vercel functions, Razorpay).

This file holds the working state between chats. The working rules live in `~/.claude/CLAUDE.md`, not here. Older state and decisions: `docs/archive/HANDOFF-history-2026-10-22.md` (look, catalogue, R2, Vercel and domain details).

- **At the start of a chat:** read this file, then do the first open item under "Next steps", unless the user asks for something else.
- **At the end of a task:** update "State", "Next steps" and "Last updated".

Last updated: 2026-11-06 (Next step 2 done: dealer + partner programme switches ON in live Firestore; partner flow and category move checked with `node scripts/qa/partner-live.mjs`, PASS. Bing sitemap: Success, 15 URLs. Google Search Console: verified, sitemap Success.)

## State

- **Live = e282b8e (Ready on Vercel).** Coin card, SEO pass, Academy programme are live. Vercel Hobby + private repo blocks pushes whose head commit author is not `iconoiq-lab` (b35ea64..cc19727 were Blocked): after any push, check Vercel > Deployments shows Ready.
- **Programme switches ON (2026-11-06):** `siteSettings/dealer.enabled` (Admin > Commerce settings > Dealers) and `partnerSettings/main.enabled` (Admin > Partners > Settings: Silver 15%, customer discount 0%, hold 0 days). Live `/dealer` shows "Become a partner". No real partners yet.
- **Partner live check** `node scripts/qa/partner-live.mjs [BASE] [OUT] [--leave-on]` (dev server on BASE): admin switches on, shopper applies on /dealer, admin approves (code PREV3210), a customer order with the code credits 15% only on delivery, held until the return window ends, no double credit; own-code order = 15% off, no commission; partner area at 4 sizes/themes; Admin > Categories move down/up and the home strip follows. Writes live Firestore and deletes everything after; restores switches unless `--leave-on`. Discounts are whole rupees (floor), commission keeps paise.
- **Lakshmi coin card:** live; spec `docs/specs/lakshmi-coin-gift.md`; switch it on in Admin > Commerce settings > Lakshmi coin when the owner says so.
- **SEO:** report `docs/seo/SEO-2026-11-05.md`; sitemap/catalog served by `api/media.ts`.

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
| 1 | **Security follow-up (2026-11-03 review):** a partner can check out as a guest or from a second account with their own code and earn commission plus unlock credit (`api/create-order.ts` `resolvePartnerCode` only treats it as family when the uid matches). Fix: match the shipping phone/address against the partner application and treat a match as family (no commission), and add an admin review flag before payout. Now urgent: the programme is ON | No | Extra high |
| 2 | Razorpay = Javani's live account (owner 2026-11-03). Done: iconoiq.com submitted for website approval (24-48 h), the 3 keys are in local `.env`. Keys are on Vercel (redeployed, `8bcff1c`). Left: after approval a real small test order + refund | No | High |
| 3 | Before launch: remove the test data (above); owner changes the admin@iconoiq.com password and sets the alert WhatsApp number (Admin > Settings); social links; COD yes/no (some COD code exists in `orderStatus.ts`/`orderService.ts`) | No | Medium |
| 4 | Tell the client: sign in at `/admin` with iconoiq@gmail.com after "Forgot password"; ask whether the four "Shop for" cards point at the right shelves | — | — |

**Message for the next chat:** `Read docs/HANDOFF.md and do Next step 1 (partner self-referral fix).` Step 2 waits on Razorpay website approval.

## Waiting on the client or the user

- Razorpay website approval (step 2). GoDaddy nameserver switch.
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
- After any push, open Vercel > Deployments and confirm "Ready": a push can be silently "Blocked" (Hobby + private repo + non-member commit author). Never write "deployed" from the push alone (lesson 2026-11-06: three deploys were wrongly marked live).
