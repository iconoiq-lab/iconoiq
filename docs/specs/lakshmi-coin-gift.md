# Lakshmi coin card (client voice notes, 2026-11-05)

## What the client asked
- Every order of ₹3,500 or more ships with a printed Lakshmi coin card.
- After paying, the customer sees a popup and scratches the card (finger or mouse) to reveal the coin.
- The customer's 1st, 2nd and 3rd coin orders get silver, and the 4th gets gold. Then it repeats.
- Orders that use a coupon still count.

## Rules (decided)
- **Threshold:** goods total before coupons, delivery and rewards (`payments.subtotal`, from the `rw_sub` note), at or above `minOrder` (default ₹3,500).
- **Which coin:** the order's place in the customer's current run is the number of their active coins decided since their latest active gold, plus one. The coin is gold when that place reaches `goldEvery` (default 4), otherwise silver. `seq` stores the place. A cancelled coin drops out, so cancelling an earlier order can never give two golds in a row.
- **Decided once:** the coin is decided when the paid order is first reconciled (notify-order `reconcile-rewards`, step 4c), and its type never changes after that. Orders paid before the switch was turned on (`enabledAt`, with one minute of slack) get no coin.
- **Not eligible:** dealer orders, and orders already cancelled, returned or refunded when they are reconciled.
- **Void and restore:** when an order is cancelled, returned or refunded, its coin becomes void and stops counting. If the shop reopens the order, the coin comes back. A coin voided by hand is left alone.
- **Records:** `payments/<rzp>.coinGift` is the record and only the server writes it. `orders/<rzp>.coinGift` is a mirror for the order pages. The server overwrites the mirror on every reconcile, and the rules block customers from creating or updating it.
- **Reveal:** notify-order `coin-reveal` stamps `revealedAt` once, and only for the order's owner (anyone else gets 404). The reveal only stops the card being offered again; the coin itself is not secret.
- **Switch:** `siteSettings/coinGift` `{ enabled, minOrder, goldEvery, enabledAt }`, set in Admin → Commerce settings → Lakshmi coin. It starts off. Turning it off stops new coins; existing coins are kept.

## Screens
- **Checkout success** (mobile page and desktop dialog): the coin card opens by itself once, when the order has an unrevealed coin.
- **Customer order page:** "Scratch to see your coin", then "View card" after the reveal, or a line saying the card was cancelled.
- **Admin order page:** "Pack a Silver/Gold Lakshmi coin card", or "cancelled: do not pack it".
- **Admin settings tab:** the switch, the minimum, the gold interval, and silver and gold previews.

## Tests
- Unit: `node --test tests/coinGift.test.ts tests/rewards-parity.test.ts`.
- Live: `node scripts/qa/coin-gift-live.mjs`. It writes to the live Firestore and cleans up afterwards, so run it only with the owner's OK.
