# ICNO-IQ: requirements

Filled in by Claude in Phase 0 from the documents in `client-brief/`; the owner can edit it by hand at any time. Later chats read this file, not the brief. Unknown facts stay `[NEED: ...]` until the client answers; never guess them.

## 1. Business

| Item | Answer |
|---|---|
| Store name (as customers see it) | [NEED: store name] |
| Short name (app icon, 12 letters max) | [NEED: short name] |
| Legal name (invoices) | [NEED: legal name] |
| What they sell, in one line | [NEED: products in one line] |
| Who buys (age, city or online, gift or self) | [NEED: customers] |
| Tagline (only if the client has one) | [NEED: tagline or "none"] |
| State and state code (GST place of supply, home state for delivery charges) | [NEED: state] |
| GSTIN (or "not registered") | [NEED: GSTIN] |
| Support email | [NEED: email] |
| Phone numbers | [NEED: phones] |
| WhatsApp number | [NEED: WhatsApp or "none"] |
| Address (or "online only") | [NEED: address] |
| Opening or support hours | [NEED: hours] |
| Instagram, Facebook, YouTube links | [NEED: social links] |
| Domain (bought? where?) | [NEED: domain] |
| Wanted launch date | [NEED: launch date] |

## 2. Catalogue

| Item | Answer |
|---|---|
| Categories and subcategories | [NEED: category list] |
| Number of products at launch | [NEED: product count] |
| Lowest and highest price (sets the price filter bands) | [NEED: price range] |
| Variants (size, colour, weight) | [NEED: variants or "none"] |
| Stock tracked in the store? | [NEED: yes/no] |
| Product photos: who provides them, in what form | [NEED: photo source] |

## 3. Selling rules

Every number here is shown to customers, so each one must come from the client.

| Item | Answer |
|---|---|
| Delivery charge inside the home state / outside it | [NEED: charges] |
| Free delivery above (₹) | [NEED: amount or "never"] |
| Payment | Online only (Razorpay); the template has no cash on delivery. |
| Delivery time (days), and processing time before dispatch (days) | [NEED: days] |
| Returns: the window in days, and returns for any reason within it, or only for damage or a wrong item? The template supports the window (`src/lib/returnWindow.ts`) and returns for any reason; damage-only rules are a Phase 4 item (size S) | [NEED: returns] |
| Support reply time | [NEED: reply time] |
| Prices include GST? Rate? | [NEED: GST] |
| Launch coupons or offers | [NEED: offers or "none"] |

## 4. Features

Every feature the template has, with its default. Write keep or off; details per feature are in `docs/template/FEATURES.md`. A feature the brief is silent on that needs an account or key: propose off and confirm with the owner.

| Feature | Template default | Client wants | Notes |
|---|---|---|---|
| Delivery partners (own delivery staff) | off | [NEED] | |
| Live metal-rate pricing (silver jewellery) | off | [NEED] | |
| Dealer membership | on (runtime off) | [NEED] | |
| Rewards and loyalty card | on (runtime off) | [NEED] | |
| Scratch & Win (needs rewards) | on (runtime off) | [NEED] | |
| Gift cards | on | [NEED] | |
| Video consultations | on | [NEED] | |
| Newsletter | on | [NEED] | |
| WhatsApp inbox (needs WhatsApp Business API) | on | [NEED] | |
| Sign-up: phone checked by a WhatsApp code (needs a WhatsApp Business API account) or email-only? | on | [NEED: WhatsApp code or email-only] | Switch `whatsappOtp` |
| WhatsApp enquiry button (needs a WhatsApp number) | on | [NEED] | |
| AI image prompts (needs a Gemini key) | on | [NEED] | |
| Testimonials (real ones only) | on | [NEED] | |
| Video stories (YouTube) | on | [NEED] | |
| Gallery | on | [NEED] | |

**New features (not in the template):** each gets a size (S, M or L, see `docs/template/ESTIMATES.md`) and its own short spec in Phase 4.

| Feature | Why the client wants it | Size |
|---|---|---|
| [NEED: new features or "none"] | | |

## 5. Look and feel

| Item | Answer |
|---|---|
| Logo files (SVG or large PNG, light and dark versions) | [NEED: logo] |
| Brand colours (hex, if they have them) | [NEED: colours or "choose for us"] |
| Fonts (if they have them) | [NEED: fonts or "choose for us"] |
| Sites they like, and what they like about each | [NEED: reference sites] |
| Sites or styles they dislike | [NEED: dislikes] |
| Three words for the feel (for example calm, premium, playful) | [NEED: mood words] |
| Photo style (studio, lifestyle, flat lay) | [NEED: photo style] |

## 6. Accounts (Phase 5)

Write only "ready", "not yet" or who owns it. Never paste passwords or keys into this file.

| Account | Status |
|---|---|
| Google account for the client's Firebase project | [NEED] |
| Razorpay (KYC done?) | [NEED] |
| Vercel | [NEED] |
| Domain registrar login | [NEED] |
| WhatsApp Business API (only if the WhatsApp inbox or the sign-up WhatsApp check stays on) | [NEED] |
| Gemini API key (only if AI image prompts stay on) | [NEED] |
| Image storage (Cloudinary or Cloudflare R2) | [NEED] |

## 7. Content (Phase 6)

| Item | Answer |
|---|---|
| About story (who they are, since when, why) | [NEED: about story] |
| Privacy, terms, shipping, returns and cancellation policies (theirs, or approve ours). Either way Phase 6 rewrites the template's generic policy pages from the answers in this file (for example, the template says damaged products are not returned) | [NEED: policies] |
| Real customer reviews, with permission to show them | [NEED: reviews or "none yet"] |
| FAQ | [NEED: FAQ or "none"] |

## 8. Open questions

- [NEED: anything else the brief left unclear]
