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
const SLUG = 'iconoiq';

export const BRAND = {
  /** Also update STORE_NAME in api/media.ts, api/whatsapp-send.ts, api/send-call-notification.ts. */
  name: 'ICONOIQ',
  shortName: 'ICONOIQ',
  /** Used for localStorage keys so two stores on one device don't share state. Also update index.html's theme key. */
  slug: SLUG,
  /** Printed on invoices and policies. The proprietor is Vanitha (Udyam UDYAM-TS-20-0190744, Micro, proprietorship). */
  legalName: 'ICONOIQ' as string,
  /** From the logo. */
  tagline: 'Indian Iconography Learning Kits' as string,
  /** Real facts only. The footer tagline and the meta description; keep api/media.ts and index.html in step. */
  description: 'Indian iconography learning kits inspired by Shilpa Shastra and temple heritage, for children, schools, academies and temples.',

  /** The live domain (connected in Vercel). VITE_SITE_URL overrides it, e.g. on a preview. */
  siteUrl: 'https://www.iconoiq.com',

  /**
   * Contact details. Empty values are hidden on the site. These are only the starting values: the admin edits
   * the live phone, email, WhatsApp and hours in Admin > Commerce > Support, and every customer-facing page
   * follows that (useCustomerSupport); tests/contact-follows-support.test.ts keeps pages from reading these directly.
   */
  email: 'iconoiq@gmail.com' as string,
  phones: ['+91 81066 70346'] as string[],
  /** Digits with the country code, as wa.me wants them. [NEED: confirm WhatsApp number] (the phone number for now) */
  whatsapp: '918106670346' as string,
  /** From the Udyam certificate. [NEED: confirm the address may be shown publicly] */
  addressLines: [
    'Plot No. 7 & 8, Raghava Kalyan Estate',
    'Chandragiri Colony, Yapral',
    'Secunderabad, Medchal Malkajgiri',
    'Telangana 500094',
  ] as string[],
  /** [NEED: opening or support hours] */
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
  /** Decides IGST vs CGST+SGST on invoices. */
  state: 'Telangana',
  stateCode: '36',

  social: {
    instagram: '',
    facebook: '',
    youtube: '',
  },

  /**
   * "Price range" filter on the Products page, in rupees (min inclusive, max
   * exclusive). Sized to the dummy catalogue (₹199 - ₹4,999); re-check with the real prices in Phase 6.
   */
  priceRanges: [
    { label: 'Under ₹500', min: 0, max: 500 },
    { label: '₹500 to ₹1,000', min: 500, max: 1000 },
    { label: '₹1,000 to ₹2,000', min: 1000, max: 2000 },
    { label: '₹2,000 to ₹3,500', min: 2000, max: 3500 },
    { label: 'Above ₹3,500', min: 3500, max: Infinity },
  ],

  /** Prefix of the loyalty card's member number. */
  memberPrefix: 'IQ',

  /** localStorage keys - prefixed per store so two stores on one device don't share state. */
  storageKeys: {
    theme: `${SLUG}-theme`,
    searchHistory: `${SLUG}_search_history`,
    cart: `${SLUG}_cart`,
    wishlist: `${SLUG}_wishlist`,
  },
} as const;
