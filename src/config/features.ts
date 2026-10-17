/**
 * Feature switches: one place to turn whole product areas on or off for a store.
 *
 * Off means: the pages redirect away (and are never loaded), the menu, footer,
 * account and admin links are hidden, and home-page sections don't render. The
 * code stays, so a client can turn a feature on later without a rebuild of it.
 *
 * Money features (rewards, scratchWin, dealers) also have a runtime setting an
 * admin turns on in the admin panel; it starts off. This switch decides whether
 * the feature exists in the store at all.
 */
export type FeatureKey =
  | 'deliveryPartners' | 'silverPricing' | 'dealers' | 'rewards' | 'scratchWin'
  | 'giftCards' | 'videoCalls' | 'newsletter' | 'whatsappInbox' | 'whatsappOtp' | 'whatsappEnquiry'
  | 'aiImagePrompts' | 'testimonials' | 'videoStories' | 'gallery';

export const FEATURES: Record<FeatureKey, boolean> = {
  deliveryPartners: false,
  silverPricing: false,
  dealers: true,
  rewards: true,
  scratchWin: true,
  giftCards: true,
  videoCalls: true,
  newsletter: true,
  whatsappInbox: true,
  whatsappOtp: true,
  whatsappEnquiry: true,
  aiImagePrompts: true,
  testimonials: true,
  videoStories: true,
  gallery: true,
};

export interface FeatureInfo {
  label: string;
  description: string;
  dependsOn?: FeatureKey[];
}

export const FEATURE_INFO: Record<FeatureKey, FeatureInfo> = {
  deliveryPartners: { label: 'Delivery partners', description: 'In-house delivery staff: delivery login, dashboard, route map and OTP handover; Admin > Delivery boys. Off = the admin updates order progress directly.' },
  silverPricing: { label: 'Live metal-rate pricing', description: 'Silver jewellery only: header rate widget, Admin > Silver rate, grams x rate on the product form.' },
  dealers: { label: 'Dealer membership', description: 'Businesses apply on /dealer; admin approves; approved dealers see dealer prices above a minimum order. Admin > Dealers.' },
  rewards: { label: 'Rewards and loyalty card', description: 'Points earned on delivered orders, tiers and the member card on the wallet page; points can be redeemed at checkout. Promises of points show only after an admin turns rewards on. The wallet page stays open while gift cards are on.' },
  scratchWin: { label: 'Scratch & Win', description: 'A scratch card after a delivered order, with point prizes.', dependsOn: ['rewards'] },
  giftCards: { label: 'Gift cards', description: 'Gift cards an admin issues to a customer in Admin > Gift cards; the customer sees the balance on the wallet page, which stays open even with rewards off. No customer purchase or checkout redemption yet.' },
  videoCalls: { label: 'Video consultations', description: 'Customers request a video call; /call pages, My video calls, Admin > Video calls.' },
  newsletter: { label: 'Newsletter', description: 'Footer sign-up form and Admin > Newsletter subscriber list.' },
  whatsappInbox: { label: 'WhatsApp inbox', description: 'Two-way WhatsApp messages and templates in Admin > WhatsApp (needs a WhatsApp Business API account).' },
  whatsappOtp: { label: 'WhatsApp number check', description: 'Sign-up and profile verify a phone number with a WhatsApp code before order updates go to WhatsApp (needs a WhatsApp Business API account). Off = a phone is just saved, no code.' },
  whatsappEnquiry: { label: 'WhatsApp enquiry button', description: 'The "Enquire on WhatsApp" button on product pages and support (needs BRAND.whatsapp).' },
  aiImagePrompts: { label: 'AI image prompts', description: 'Admin > AI prompts: writes banner image prompts with Gemini (needs GEMINI_API_KEY).' },
  testimonials: { label: 'Testimonials', description: 'Home-page testimonials section and Admin > Testimonials. Real testimonials only; the section hides when there are none.' },
  videoStories: { label: 'Video stories', description: 'Home-page YouTube showcase and Admin > Video stories.' },
  gallery: { label: 'Gallery', description: 'Admin > Gallery (upload and arrange gallery images). The home-page gallery component (InstagramGallery) exists but is not placed on the home page, so this switch adds no home-page section.' },
};

export function isOn(key: FeatureKey): boolean {
  return FEATURES[key] && (FEATURE_INFO[key].dependsOn ?? []).every(isOn);
}

/** True when at least one of the features is on: for a page or link that serves several (for example /wallet). */
export function isAnyOn(keys: readonly FeatureKey[]): boolean {
  return keys.some(isOn);
}
