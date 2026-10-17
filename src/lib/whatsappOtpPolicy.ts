/**
 * Rules for the WhatsApp number check (the `whatsappOtp` feature switch).
 *
 * Switch on: a phone typed at sign-up is verified with a WhatsApp code when the
 * customer keeps "same number for WhatsApp" ticked. Switch off: no WhatsApp
 * choice or code step appears anywhere, a typed phone is still checked as an
 * Indian mobile and saved as a plain phone, and it is never saved as a
 * WhatsApp number (nothing then treats it as a verified one).
 *
 * A phone changed while the switch is off is unverified, so the old WhatsApp number and the "verified"
 * mark are cleared with it (otherwise order messages would keep going to the old number).
 *
 * There is no customer 2-step sign-in: it was removed because it could only be enforced in the browser
 * (see docs/HANDOFF.md, Decisions). Sign-in never asks for a WhatsApp code.
 *
 * Pure functions: the pages pass `isOn('whatsappOtp')` in.
 */

/** A 10-digit Indian mobile number (first digit 6 to 9). */
export const isIndianMobile = (phone: string): boolean => /^[6-9]\d{9}$/.test(phone);

/** The WhatsApp choice that counts: always false when the switch is off, whatever the box says. */
export const effectiveWhatsAppChoice = (otpEnabled: boolean, wantsWhatsApp: boolean): boolean =>
  otpEnabled && wantsWhatsApp;

export type SignupPhoneCheck = 'ok' | 'invalid-phone' | 'needs-whatsapp-code';

/**
 * What the sign-up form should say about the phone box. No phone is fine (it is optional).
 * A typed phone must be a valid Indian mobile; only with the switch on, the box ticked and a
 * phone typed must the WhatsApp code also be verified.
 */
export function checkSignupPhone(input: {
  otpEnabled: boolean;
  phone: string;
  wantsWhatsApp: boolean;
  whatsappVerified: boolean;
}): SignupPhoneCheck {
  const { otpEnabled, phone, wantsWhatsApp, whatsappVerified } = input;
  if (!phone) return 'ok';
  if (!isIndianMobile(phone)) return 'invalid-phone';
  if (effectiveWhatsAppChoice(otpEnabled, wantsWhatsApp) && !whatsappVerified) return 'needs-whatsapp-code';
  return 'ok';
}

/** What the customer's account holds today, as far as a phone change is concerned. */
export interface PhoneOnFile {
  phone?: string;
  /** The WhatsApp number a code verified (profile.whatsappNumber). */
  whatsappNumber?: string;
  /** securitySettings.phoneVerified. */
  phoneVerified?: boolean;
}

const lastTen = (v?: string): string => (v ?? '').replace(/\D/g, '').slice(-10);

/** The number a code verified: the WhatsApp number, or the phone when it was marked verified. */
const verifiedNumber = (f: PhoneOnFile): string => lastTen(f.whatsappNumber) || (f.phoneVerified ? lastTen(f.phone) : '');

/**
 * Profile fields a "change phone number" save writes. With the switch on the number was verified
 * by a WhatsApp code, so it is also the WhatsApp number. With it off it is a plain phone only, and a
 * WhatsApp number saved earlier for a different number is cleared (order and broadcast messages prefer
 * it, so they would keep going to the old number). `tenDigits` is the number as typed; `countryPhone`
 * is the same with 91 in front (normalizePhoneNumber).
 */
export function changePhonePatch(
  otpEnabled: boolean,
  tenDigits: string,
  countryPhone: string,
  onFile: PhoneOnFile = {},
): { phone: string; whatsappNumber?: string } {
  if (otpEnabled) return { whatsappNumber: countryPhone, phone: countryPhone };
  const stale = lastTen(onFile.whatsappNumber) !== '' && lastTen(onFile.whatsappNumber) !== tenDigits;
  return stale ? { phone: tenDigits, whatsappNumber: '' } : { phone: tenDigits };
}

/**
 * Security settings a "change phone number" save must also write, or null for none. Only with the
 * switch off, a "verified" mark on file and a number that is not the verified one: the mark goes,
 * because no code checked the new number. Save this BEFORE the profile patch: if the second write
 * fails, the mark is already off rather than vouching for the old number.
 */
export function changePhoneSecurityPatch(
  otpEnabled: boolean,
  tenDigits: string,
  onFile: PhoneOnFile = {},
): { phoneVerified: false } | null {
  if (otpEnabled) return null;
  if (!onFile.phoneVerified) return null;
  if (verifiedNumber(onFile) === tenDigits) return null;
  return { phoneVerified: false };
}
