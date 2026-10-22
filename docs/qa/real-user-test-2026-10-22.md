# Real-user test, 2026-10-22 (live sites, DREAM TEAM SERVICES browser)

Sites: https://www.iconoiq.com and https://www.ishaputra.in. Signed in as the Dream Team Google account (a customer on both; not an admin).
Rules from the owner: admin login only, no real payments (COD, or stop at the Razorpay screen), delete test data afterwards, local commits only.
Covered: desktop 1440 in Chrome (home, listing, sort/filter, search, product, wishlist, cart, checkout up to payment, addresses, wallet, account), and 11 public pages per site at 390 px light + dark (headless Playwright: overflow, console errors, failed requests).
Not covered: the admin consoles (email + password sign-in; Claude may not enter passwords). Needs the owner to sign in, then a second pass.

## ICONOIQ

Context: mid Phase 5 (Razorpay keys pending, KYC in progress); Phase 6 (real catalogue, policies) not started. So checkout and content gaps are phase items, not regressions.

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Checkout cannot take payment: `/api/create-order` fails, Razorpay keys are not on Vercel | Blocker | Phase 5 (owner: keys) |
| 2 | That failure showed the raw text "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured" to the customer | High | **Fixed** (503 + customer message) |
| 3 | `/catalog/products.json` returned index.html (no rewrite in `vercel.json`), so every visit fell back to Firestore reads | Medium (cost/speed) | **Fixed** (needs deploy) |
| 4 | Product, About and policy pages show `[NEED: ...]` and "Sample listing for the store preview" to the public | Blocker for marketing | Phase 6 (client content) |
| 5 | "Save and deliver here" at checkout opened a second "Delivery address" picker; a new non-default address was not the one selected | Medium | **Fixed** |
| 6 | Silver-rate Firestore listener ran on a store that sells no silver | Low (cost) | **Fixed** |
| 7 | Wallet: no member card, tiers, points or cashback (the Ishaputra wallet has all of them). Same code; the rewards runtime setting is off | Owner decision | Owner turns on Rewards in Admin (it is a money promise) |
| 8 | Only Razorpay; no Cash on Delivery | Owner decision | New feature if wanted (both stores) |
| 9 | Contact page "Website" shows iconoiq.vercel.app | Low | Owner clicks Redeploy in Vercel (`VITE_SITE_URL` is already www) |
| 10 | Footer has no social links | Low | `[NEED]` from client |
| 11 | PIN code does not fill city/state in the address form | Improvement | Not in any store yet |
| 12 | 390 px, light + dark: no overflow, no console errors on 11 pages | — | OK |

Working well: home sections, sort and price filter, wishlist heart, add to cart (toast + count), "View cart" pill, address add/delete with confirm dialog, empty states (cart, wishlist, addresses).

## Ishaputra

Context: live with **live** Razorpay keys.

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | All 12 products are demo listings while live payments are on | Blocker for marketing | Owner: real products |
| 2 | "Himalayan Shilajit Resin" sells at ₹1 (100% off), a leftover test price | Blocker (money) | Owner: fix price in Admin |
| 3 | Contact details are dummy (owner's choice) | Blocker for marketing | Owner: real details |
| 4 | Razorpay checkout shows an "I" instead of the logo | Low | Owner: upload logo in Razorpay dashboard |
| 5 | Same checkout address double-picker bug as ICONOIQ | Medium | **Fixed** |
| 6 | Same raw env-var payment error text | High | **Fixed** |
| 7 | Same silver-rate listener | Low | **Fixed** |
| 8 | Delivery shows "Free" until an address is chosen, then ₹100 | Low (surprise at checkout) | Recommendation: show "from ₹X" or "calculated at address" |
| 9 | Delivery dashboard has no labels for "refunded" and "deliveryFailed" statuses (type error) | Low | Open |
| 10 | Known from its handoff: stock bug with 2+ products, payment/rules hardening, customer 2-step only enforced in the browser, security audit not run | High | Open (money/security) |
| 11 | 390 px, light + dark: no overflow, no console errors | — | OK |

Working well: Wallet & rewards (member card, 4 tiers with progress, points/pending/cashback, earn rules) is the reference ICONOIQ should match once Rewards is on.

## Fixed (local commits, NOT deployed)

- ICONOIQ: `vercel.json`, `api/create-order.ts`, `api/verify-payment.ts`, `src/contexts/SilverRateContext.tsx`, `src/pages/Checkout.tsx`. `node scripts/check.mjs`: tests, build, preview, screenshots all ok.
- Ishaputra (commit `ead0d3f`): the same four source files. `npm test` 170/170, `npm run build` ok; typecheck has only older errors outside these files.

## Test data (all deleted)

- ICONOIQ: address "TEST Order Claude", Lakshmi Iconography Learning Kit in cart and wishlist: deleted 2026-10-22.
- Ishaputra: address "TEST Order Claude", Ashwagandha in cart: deleted 2026-10-22.
- No orders were placed on either site.
