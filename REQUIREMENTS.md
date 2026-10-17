# ICONOIQ: requirements

Filled in by Claude in Phase 0 from the documents in `client-brief/`; the owner can edit it by hand at any time. Later chats read this file, not the brief. Unknown facts stay `[NEED: ...]` until the client answers; never guess them.

## 1. Business

| Item | Answer |
|---|---|
| Store name (as customers see it) | ICONOIQ |
| Short name (app icon, 12 letters max) | ICONOIQ |
| Legal name (invoices) | ICONOIQ (proprietor: Vanitha). Udyam registration UDYAM-TS-20-0190744 (Micro, proprietorship). `brand.ts` `legalName` is `ICONOIQ` (what invoices and policies print) |
| What they sell, in one line | Indian iconography learning kits rooted in Shilpa Shastra and temple heritage: kits, templates, stencils, books and charts, games and toys, stationery. (The Udyam registration also lists craftwork and religious articles, and fabricated metal articles.) |
| Who buys (age, city or online, gift or self) | Schools, nursery schools, Natyam academies, temples, ashrams, toy and stationery stores (institutional and retail buyers), plus families. Online, all India. |
| Tagline (only if the client has one) | Indian Iconography Learning Kits (from the logo) |
| State and state code (GST place of supply, home state for delivery charges) | Telangana, 36 |
| GSTIN (or "not registered") | Not registered |
| Support email | iconoiq@gmail.com |
| Phone numbers | +91 81066 70346. The owner can change it later in Admin > Commerce > Support; every page follows that setting (`BRAND` is only the starting value) |
| WhatsApp number | 918106670346 (the phone number, for now). [NEED: confirm WhatsApp number] |
| Address (or "online only") | Plot No. 7 & 8, Raghava Kalyan Estate, Chandragiri Colony, Yapral, Secunderabad, Medchal Malkajgiri, Telangana 500094 (from the Udyam certificate). [NEED: confirm the address may be shown publicly] |
| Opening or support hours | [NEED: opening or support hours] |
| Instagram, Facebook, YouTube links | [NEED: social links] |
| Domain (bought? where?) | Owned by the owner, who connects it in Phase 5. [NEED: the domain name] |
| Wanted launch date | [NEED: launch date] |

## 2. Catalogue

| Item | Answer |
|---|---|
| Categories and subcategories | 1 Learning Kits (Deity Iconography, Temple Architecture, Mudras & Natyam); 2 Templates & Stencils (Drawing Templates, Metal Stencils); 3 Books & Charts (Picture Books, Wall Charts, Activity Books); 4 Games & Puzzles (Puzzles, Card Games); 5 Art & Stationery (Colouring, Craft Supplies); 6 School & Academy Packs (Classroom Packs, Academy Packs). Proposed from the brief; the client can rename them in Phase 6 |
| Number of products at launch | Dummy products for now (owner's instruction); the real products come in Phase 6. [NEED: real product count] |
| Lowest and highest price (sets the price filter bands) | ₹199 to ₹4,999 (dummy catalogue; check against the real prices in Phase 6) |
| Variants (size, colour, weight) | None |
| Stock tracked in the store? | Yes (template default) |
| Product photos: who provides them, in what form | Dummy catalogue images generated with ChatGPT for now. [NEED: real product photos (Phase 6)] |

## 3. Selling rules

Every number here is shown to customers, so each one must come from the client. The owner (2026-10-17) said "keep what you think best for now, we change later", so the numbers below are the template defaults, marked provisional.

| Item | Answer |
|---|---|
| Delivery charge inside the home state / outside it | ₹50 inside Telangana / ₹100 outside. Provisional (owner, 2026-10-17): confirm with client in Phase 6 |
| Free delivery above (₹) | ₹999. Provisional (owner, 2026-10-17): confirm with client in Phase 6 |
| Payment | Online only (Razorpay); the template has no cash on delivery. |
| Delivery time (days), and processing time before dispatch (days) | "4-7 business days", shipped all-India from Hyderabad. Provisional (owner, 2026-10-17): confirm with client in Phase 6. [NEED: processing time before dispatch] |
| Returns: the window in days, and returns for any reason within it, or only for damage or a wrong item? The template supports the window (`src/lib/returnWindow.ts`) and returns for any reason; damage-only rules are a Phase 4 item (size S) | 7 days, returns for any reason. Provisional (owner, 2026-10-17): confirm with client in Phase 6 |
| Support reply time | Within 24 hours. Provisional (owner, 2026-10-17): confirm with client in Phase 6 |
| Prices include GST? Rate? | Not GST-registered, so the store charges no GST (the template's `DEFAULT_GST` is off). [NEED: confirm with the client, and what changes once they register] |
| Launch coupons or offers | [NEED: offers or "none"] |

## 4. Features

Every feature the template has, with its default. Write keep or off; details per feature are in `docs/template/FEATURES.md`. A feature the brief is silent on that needs an account or key: propose off and confirm with the owner.

Owner (2026-10-17): the same features as his earlier store, which are the template defaults: delivery partners off, live metal-rate pricing off, everything else on.

| Feature | Template default | Client wants | Notes |
|---|---|---|---|
| Delivery partners (own delivery staff) | off | off | Template default |
| Live metal-rate pricing (silver jewellery) | off | off | Template default |
| Dealer membership | on (runtime off) | keep | The admin turns the programme on when ready |
| Rewards and loyalty card | on (runtime off) | keep | Member prefix `IQ` |
| Scratch & Win (needs rewards) | on (runtime off) | keep | |
| Gift cards | on | keep | |
| Video consultations | on | keep | |
| Newsletter | on | keep | |
| WhatsApp inbox (needs WhatsApp Business API) | on | keep | [NEED: WhatsApp Business API account (Phase 5)] |
| Sign-up: phone checked by a WhatsApp code (needs a WhatsApp Business API account) or email-only? | on | keep (WhatsApp code) | Switch `whatsappOtp`. Needs the same WhatsApp Business API account (Phase 5); if it is not ready at launch, switch it off for email-only |
| WhatsApp enquiry button (needs a WhatsApp number) | on | keep | Uses the support WhatsApp number |
| AI image prompts (needs a Gemini key) | on | keep | [NEED: Gemini API key (Phase 5)] |
| Testimonials (real ones only) | on | keep | The section stays hidden until real ones are added |
| Video stories (YouTube) | on | keep | |
| Gallery | on | keep | |

**New features (not in the template):** each gets a size (S, M or L, see `docs/template/ESTIMATES.md`) and its own short spec in Phase 4.

| Feature | Why the client wants it | Size |
|---|---|---|
| None for now | Owner (2026-10-17): no functionality changes beyond the template's feature set | |

Later, only if the client asks (Phase 4, not built; the proposal mentions them):

- Loyalty card purchase: customers buy a loyalty card.
- Scratch prizes beyond points: Scratch & Win gives point prizes only today.
- Paid dealer membership: dealer membership today is free to apply, and the admin approves.

## 5. Look and feel

| Item | Answer |
|---|---|
| Logo files (SVG or large PNG, light and dark versions) | Provided: `client-brief/logo.jpeg`, a raster JPEG on a black background with a stray mark. A clean version will be regenerated in Phase 3 |
| Brand colours (hex, if they have them) | From the proposal: bronze, gold, chocolate brown, beige. No hex codes; the exact values are chosen in Phase 2 |
| Fonts (if they have them) | Choose for us (Phase 2) |
| Sites they like, and what they like about each | [NEED: reference sites] |
| Sites or styles they dislike | [NEED: dislikes] |
| Three words for the feel (for example calm, premium, playful) | Young, premium, culturally rooted, modern. A modern interpretation of Indian temple architecture, strong storytelling; product pages explain the concept |
| Photo style (studio, lifestyle, flat lay) | Studio product shots plus lifestyle (kids, classrooms). Generated for now |

## 6. Accounts (Phase 5)

Write only "ready", "not yet" or who owns it. Never paste passwords or keys into this file.

| Account | Status |
|---|---|
| Google account for the client's Firebase project | The owner is creating a new Firebase project himself. Not connected yet |
| Razorpay (KYC done?) | In progress (KYC) |
| Vercel | [NEED] |
| Domain registrar login | Domain owned; the owner connects it in Phase 5 |
| WhatsApp Business API (only if the WhatsApp inbox or the sign-up WhatsApp check stays on) | [NEED] (both stay on) |
| Gemini API key (only if AI image prompts stay on) | [NEED] (it stays on) |
| Image storage (Cloudinary or Cloudflare R2) | [NEED] |

## 7. Content (Phase 6)

| Item | Answer |
|---|---|
| About story (who they are, since when, why) | [NEED: about story] |
| Privacy, terms, shipping, returns and cancellation policies (theirs, or approve ours). Either way Phase 6 rewrites the template's generic policy pages from the answers in this file (for example, the template says damaged products are not returned) | Provisional: the template's policies for now (owner, 2026-10-17); rewritten in Phase 6 |
| Real customer reviews, with permission to show them | [NEED: reviews or "none yet"] |
| FAQ | [NEED: FAQ or "none"] |

## 8. Open questions

- [NEED: confirm the WhatsApp number (the phone number is used for now)]
- [NEED: confirm the Udyam address may be shown publicly]
- [NEED: opening or support hours, social links, launch date, the domain name]
- Provisional selling rules (delivery charges, free-delivery amount, delivery time, 7-day returns, 24-hour reply, template policies): confirm with the client in Phase 6.
