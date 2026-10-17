/**
 * The store's identity and contact details, in one place.
 *
 * Everything customer-facing that names the business reads from here: footer
 * and support defaults, invoice header, checkout, WhatsApp messages, share
 * text. Admin can still override the footer and support details at runtime
 * (siteSettings in Firestore); these are the defaults.
 *
 * Leave a field empty ('' or []) until the client confirms it - the footer and
 * contact blocks hide empty fields instead of showing a placeholder.
 * (Empty text is written `'' as string` so code that checks it and then calls a
 * string method still type-checks; keep that when you fill a value in.)
 *
 * Not importable from api/*.ts (those files must stay standalone): the brand
 * name is repeated as STORE_NAME in api/media.ts, api/whatsapp-send.ts and
 * api/send-call-notification.ts. tests/brand-parity.test.ts checks that those
 * copies (and the theme key in index.html) match this file.
 */
const SLUG = 'demo-store';

export const BRAND = {
  /** [NEED: store name] Also update STORE_NAME in api/media.ts, api/whatsapp-send.ts, api/send-call-notification.ts. */
  name: 'Demo Store',
  shortName: 'Demo',
  /** Used for localStorage keys so two stores on one device don't share state. Also update index.html's theme key. */
  slug: SLUG,
  /** [NEED: registered business name for invoices and policies] */
  legalName: '' as string,
  /** [NEED: tagline] */
  tagline: '' as string,
  /** [NEED: one-sentence description of what the store sells] */
  description: 'An online store.',

  /** [NEED: live domain] VITE_SITE_URL overrides it, e.g. on a preview. */
  siteUrl: 'https://example.com',

  /** [NEED: contact details] Empty values are hidden on the site. */
  email: '' as string,
  phones: [] as string[],
  whatsapp: '' as string,
  addressLines: [] as string[],
  hours: '' as string,
  /**
   * How fast the shop answers messages ("24 hours"; empty = promise nothing). The first value of the support
   * reply time (Admin > Commerce > Support) as "Within <this>", shown in the home facts strip and on the
   * support page. Not a made-up number: confirm it with the client.
   */
  replyWithin: '24 hours' as string,
  /** Where orders ship to ("Shipped across India"), the line under the delivery time in the home facts strip. Empty hides the line. */
  shipsTo: 'Shipped across India' as string,
  mapEmbedUrl: '' as string,
  /** Never a made-up GSTIN: an empty value prints nothing on invoices. */
  gstin: '' as string,
  /** [NEED: the business's state] Decides IGST vs CGST+SGST on invoices. */
  state: 'Telangana',
  stateCode: '36',

  social: {
    instagram: '',
    facebook: '',
    youtube: '',
  },

  /**
   * "Price range" filter on the Products page, in rupees (min inclusive, max
   * exclusive). Sized to the demo catalogue (₹299 - ₹2,499); a jewellery
   * store would use far wider bands.
   */
  priceRanges: [
    { label: 'Under ₹400', min: 0, max: 400 },
    { label: '₹400 to ₹700', min: 400, max: 700 },
    { label: '₹700 to ₹1,000', min: 700, max: 1000 },
    { label: '₹1,000 to ₹2,000', min: 1000, max: 2000 },
    { label: 'Above ₹2,000', min: 2000, max: Infinity },
  ],

  /** Prefix of the loyalty card's member number. */
  memberPrefix: 'DS',

  /** localStorage keys - prefixed per store so two stores on one device don't share state. */
  storageKeys: {
    theme: `${SLUG}-theme`,
    searchHistory: `${SLUG}_search_history`,
    cart: `${SLUG}_cart`,
    wishlist: `${SLUG}_wishlist`,
  },
} as const;
