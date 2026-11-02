# ICONOIQ Academy & Dealership Programme (spec, 2026-11-02)

Source: the client's `PLANS.pdf` (2 pages, sent by the owner 2026-11-02). Phase 4 feature. Tagline on the page: "Learn. Teach. Earn. Explore!": "Partner with ICONOIQ to bring Indian heritage, creative learning and educational products to your academy."

Two roles, both behind `features.dealers` and its runtime switch:

- **Stockist**: buys stock in bulk at a margin, then resells it. This extends the existing dealer membership.
- **Partner**: an academy or teacher with a personal code. Earns a percentage of every delivered sale made with that code, and unlocks business-support perks and gifts as sales grow.

## Decisions (changes from the PDF are marked ⚑)

1. ⚑ **Partner login = the normal store account** (phone/email sign-in). The PDF wants user ID = first 4 letters of the name + phone, and password = the coupon code. The coupon is handed to every customer, so anyone holding it could open the partner's earnings. The code stays the partner's ID and coupon. Code format: first 4 letters of the name (A–Z, uppercase, padded with X) + the last 4 digits of the phone, for example `RAVI3210`. The admin can edit it; it is unique across partner codes and store coupons.
2. **Partner tiers:** Silver 15% for everyone from approval. Gold 30% is applied automatically once the partner's lifetime delivered sales pass ₹2,00,000; until then Gold is not shown at all ("appear only after"). The new rate applies to orders delivered after the switch (not retroactive). The admin can override the tier. All numbers are admin settings, defaulting to the PDF's values.
3. **Sales value** = what the customer paid for the products on an order placed with the partner's code (after discounts; delivery excluded). It counts only once the order is **delivered** and is removed again if the order is returned or refunded. The month is the delivered month.
4. **Customer discount with a partner code:** an admin setting, default 0%, `[NEED: does a customer get a discount when using a partner's code? how much?]`. The code goes in the existing coupon box at checkout.
5. **Family discount (Claims page):** when the partner uses their OWN code while signed in, they get their tier % off (15% Silver, 30% Gold) and earn no commission on that order. The savings show under Pending claims → "savings on product purchases".
6. **The partner never sees ICONOIQ's sales value** (red line in the PDF). Partner screens show only their earnings, products sold (units), and each perk as locked or unlocked with the threshold as the rule ("unlocks at ₹10,000 in sales"), never their current sales total.
7. **Payouts:** earnings are credited when an order is delivered and stay held until the return window ends (same unlock as reward points). The admin records a payout (amount, date, note). The partner sees "₹X sent" with a **Received** button. Clicking it confirms the payout. "Total to be settled" = unlocked earnings − payouts confirmed received.
8. **Perks and claims** = a one-time **Redeem** button (or a counted button) that creates a claim request. The admin marks it fulfilled in Admin. Thresholds are lifetime delivered sales:

| Perk | Unlocks at | Button |
|---|---|---|
| Digital catalogue | everyone | one-time redeem |
| Product photographs | everyone | one-time redeem |
| Pamphlets | ₹10,000 | one-time redeem |
| Masterclasses | ₹20,000 | 6 redeem buttons (one per class) |
| National competitions & stage performance passes | ₹30,000 | 20 group passes + 4 solo passes (redeemed one at a time, counter shown) |
| Promotion team (1 interview + 4 videos + 4 posters per month) | ₹30,000 | one request per calendar month |
| Online promotion for your outlet & code | ₹30,000 | one-time redeem |
| Product standee | ₹50,000 | one-time redeem |
| Uniforms | ₹1,00,000 | one-time redeem |
| International trip (any Asian country) | ₹1,00,000 | "Eligible" claim button |
| Silver pot: 1 g silver coin per ₹10,000 in sales | every ₹10,000 | claim the coins earned and not yet claimed |

   - Pending claims: silver coins earned and not yet claimed, plus family-discount savings.
   - History of gifts: silver coins earned to date, as one running total (not month-wise), plus fulfilled claims.
9. **Stockist margin tiers** (replaces the single dealer percent): one order worth ₹1,50,000 or more at regular prices → 40% off. ₹2,50,000 or more → 50% off. The highest tier met wins. Per-product fixed dealer prices still win over the tier. Below the first tier, regular prices apply. The tiers are admin-editable. This is money code: change `dealer-core` in `src/lib/dealer.ts`, `npm run sync:rewards` to copy it into `api/create-order.ts`, and keep the parity test green.
10. **Stockist inventory:** purchased stock = the items of the stockist's delivered dealer orders. The stockist logs each sale (product, quantity, date) on their page. Shown:
    - stock left per product;
    - sales value of the current month (units × regular price);
    - sale history, newest first;
    - a **restock alert** once 40% or more of all purchased units are sold.
11. **No new file under `api/`.** The project already has 12 functions, the Vercel Hobby limit. Partner crediting runs inside the existing `reconcile-rewards` action in `api/notify-order.ts` (Admin SDK, idempotent per order). Coupon attribution runs in `api/create-order.ts`.

## Screens

- **`/dealer`** (programme page): the tagline, then two cards, "Become a stockist" (the existing application) and "Become a partner" (new application: name, academy/business, phone, city, state). Each shows the PDF's offer.
- **Partner area** at `/account/partner`, tabs:
  - **My account:** coupon number, signed up on (dd/mm/yyyy), my percentage, products sold, my share this month (₹), total to be settled + payouts awaiting **Received**, earnings history (total by default, month dropdown).
  - **Business support:** the perks table as cards (locked/unlocked, Redeem, redeemed/fulfilled state).
  - **My claims:** the family discount code + %, the international trip, the silver pot, pending claims, history of gifts.
- **Stockist area** (approved dealers): current margin tiers, stock inventory, a log-a-sale form, sales this month, sale history, the restock alert.
- **Admin > Dealers:** add margin tiers to the settings and show each stockist's inventory and sales (read-only).
- **Admin > Partners** (new):
  - applications (approve, reject, edit the code);
  - partner list (tier, lifetime sales, earnings, outstanding);
  - record a payout;
  - a claims queue (mark fulfilled);
  - settings (Silver %, Gold %, Gold threshold, customer discount %, perk thresholds and counts, silver gram step).

## Data (Firestore)

- `partners/{uid}`: application + status (pending/approved/rejected/suspended), `code`, `tier`, `tierOverride?`, `createdAt`, `approvedAt`, plus server-maintained totals: `lifetimeSales`, `unitsSold`, `earnedTotal`, `receivedTotal`, `familySavings`. The owner reads it and can create a pending application. Only admin and server write the totals.
- `partnerCodes/{CODE}` → `{ uid }`, for unique codes and the checkout lookup. Readable by anyone for a single document; not listable.
- `partners/{uid}/earnings/{orderId}`: `{ amount, rate, sales, units, month, state: held|active|void, unlockAt }`. Server writes only; the owner reads.
- `partners/{uid}/payouts/{id}`: the admin creates; the owner may only set `receivedAt` once.
- `partners/{uid}/claims/{id}`: `{ perk, index?, status: requested|fulfilled, createdAt }`. The owner creates (the server-side or rules check enforces the unlock threshold and counts, see Security); the admin fulfils.
- `partnerSettings/main`: public read, admin write.
- `dealers/{uid}/sales/{id}`: `{ productId, qty, unitPrice, at }`. The owner creates and deletes; the admin reads.
- Orders gain `partnerCode`, `partnerUid` and `partnerFamily: boolean`, set by the server only.

## Security

- The client never decides money: the commission rate, sales value, discount and tier come from the server (create-order and reconcile).
- A claim's unlock is checked against the server-maintained `lifetimeSales` and counts in `firestore.rules` (or the claim is created through the server); a partner can never raise their own totals or tier.
- Emulator tests in `tests/` for the new rules (partner can't write totals, can't read another partner, can't confirm a payout twice, can't claim a locked perk).

## Not in scope (ask later)

- `[NEED]` from the client:
  - the customer discount % with a partner code;
  - whether stockist purchase tiers are per order (assumed) or cumulative;
  - the trip's terms;
  - how the silver coins are delivered;
  - the masterclass names.
- Real payout transfers (the admin pays outside the site and records it).
