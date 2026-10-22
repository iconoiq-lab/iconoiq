# Real-user test, 2026-10-22 (live www.iconoiq.com, DREAM TEAM SERVICES browser)

Rules from the owner: no real payments (stop at the Razorpay screen), delete test data afterwards, local commits only, deploy only on a yes. The other client store tested the same day has its own report in its own repo.

Context: mid Phase 5 (Razorpay keys pending, KYC in progress); Phase 6 (real catalogue, policies) not started. So checkout and content gaps are phase items, not regressions. Dummy products are intentional (owner).

## Shopper pass (signed in as the Dream Team Google account, a customer)

Covered: desktop 1440 in Chrome (home, listing, sort/filter, search, product, wishlist, cart, checkout up to payment, addresses, wallet, account), and 11 public pages at 390 px light + dark (headless Playwright: overflow, console errors, failed requests).

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Checkout cannot take payment: `/api/create-order` fails, Razorpay keys are not on Vercel | Blocker | Phase 5 (owner: keys) |
| 2 | That failure showed the raw text "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured" to the customer | High | **Fixed** (503 + customer message) |
| 3 | `/catalog/products.json` returned index.html (no rewrite in `vercel.json`), so every visit fell back to Firestore reads | Medium (cost/speed) | **Fixed** (needs deploy) |
| 4 | Product, About and policy pages show `[NEED: ...]` and "Sample listing for the store preview" to the public | Blocker for marketing | Phase 6 (client content) |
| 5 | "Save and deliver here" at checkout opened a second "Delivery address" picker; a new non-default address was not the one selected | Medium | **Fixed** |
| 6 | Silver-rate Firestore listener ran on a store that sells no silver | Low (cost) | **Fixed** |
| 7 | Wallet: no member card, tiers, points or cashback (the rewards runtime setting was off) | Owner decision | **Done**: owner said yes; Rewards turned on in Admin 2026-10-22 (wallet now shows card, tiers, points, cashback) |
| 8 | Only Razorpay; no Cash on Delivery | Owner decision | Owner: COD yes/no |
| 9 | Contact page "Website" shows iconoiq.vercel.app | Low | Owner clicks Redeploy in Vercel (`VITE_SITE_URL` is already www) |
| 10 | Footer has no social links | Low | `[NEED]` from client |
| 11 | PIN code does not fill city/state in the address form | Improvement | Not in any store yet |
| 12 | 390 px, light + dark: no overflow, no console errors on 11 pages | — | OK |
| 13 | Razorpay checkout had no store logo (the other store's showed an "I") | Low | **Fixed**: the app icon is passed as `image` (needs deploy) |
| 14 | Delivery read "Free" in the cart and checkout before an address was chosen, even where the charge depends on the state | Low (surprise at checkout) | **Fixed**: "Calculated at address" until an address is chosen (`tests/deliveryQuote.test.ts`; needs deploy) |

Working well: home sections, sort and price filter, wishlist heart, add to cart (toast + count), "View cart" pill, address add/delete with confirm dialog, empty states (cart, wishlist, addresses).

## Admin pass (admin@iconoiq.com, signed in by the owner)

| # | Finding | Severity | Status |
|---|---|---|---|
| A1 | About 30 admin routes (dashboard, products, product add/edit, orders + detail, customers + detail, media, banners, showcases, testimonials, gallery, coupons, gift cards, reviews, home banners/collections, videos, site settings, commerce settings with every tab, marketing, WhatsApp, settings, newsletter, storage): no console errors, no failed requests, no "NaN"/"undefined" text | — | OK |
| A2 | Product add → edit → delete: every step saved; the test product was deleted | — | OK |
| A3 | A hidden product stays reachable by its direct link and shows "unavailable" (`ProductDetail.tsx`), so old links and orders do not break | — | OK, by design |
| A4 | Rewards turned on and saved (Commerce settings); the shopper wallet shows the member card, tiers, points and cashback | — | **Done** |
| A5 | Admin > Settings showed the signed-in admin's own profile WhatsApp number, but saving wrote the store-wide order-alert number: a second admin saw an empty field, and saving it (e.g. to change a name) wiped the alert number. It also copied the number into the admin's profile, where it means "verified by a WhatsApp code" | High (alerts silently stop) | **Fixed**: loads and saves `siteSettings/adminNotification` only; a failed read never clears it (`tests/admin-alert-number.test.ts`; needs deploy) |
| A6 | The order-alert WhatsApp number is empty, so new-order alerts go only to the support WhatsApp (Commerce > Support) when one is set | High before launch | Owner: the store's WhatsApp number (`[NEED]`) |
| A7 | Categories: subcategories can be added in the product form but not renamed or removed; top-level categories cannot be added, renamed or removed in Admin (`/admin/categories` does not exist; `categoryService` has the functions, no screen uses them). Same in every store from the template | Medium | Open: a small "Categories" admin page, in the template first |
| A8 | Dashboard and Orders show the 13 fixture orders (₹6,446) from `scripts/qa/ui-fixtures.mjs` | Must go before launch | `node scripts/qa/ui-fixtures.mjs remove` (handoff, test data) |
| A9 | Banners: 2, both live. Social links, opening hours and map are empty | Low | `[NEED]` from client |
| A10 | Customers lists 1 shopper (only `role: 'user'` accounts; admins are left out) | — | OK |
| A11 | admin@iconoiq.com has a password equal to its email | High before launch | Owner: change the password |

## Fixed (local commits, NOT deployed)

- Shopper pass: `vercel.json`, `api/create-order.ts`, `api/verify-payment.ts`, `src/contexts/SilverRateContext.tsx`, `src/pages/Checkout.tsx` (commit `03bfd00`).
- Admin pass: `src/services/razorpayService.ts` (logo), `src/services/siteSettingsService.ts` + `src/hooks/useCheckoutPricing.ts` + `src/pages/Checkout.tsx` + `src/components/ShoppingCart.tsx` ("Calculated at address"), `src/pages/admin/AdminSettings.tsx` (alert number). The same changes were made in the other client store.

## Test data (all deleted)

- Shopper pass: address "TEST Order Claude", Lakshmi Iconography Learning Kit in cart and wishlist: deleted 2026-10-22.
- Admin pass: the test product: deleted 2026-10-22.
- No orders were placed.
