/**
 * The shop's payment switch: siteSettings/payment (Admin -> Commerce settings
 * -> Payments).
 *   razorpay  Razorpay Standard Checkout (the default)
 *   upi       a manual UPI transfer: the customer scans a QR for the exact
 *             amount, then sends the UTR and a screenshot; the shop checks it
 *             and approves the payment by hand.
 * api/create-order.ts reads the same document (its own copy of these rules),
 * so a stale page can never pay the wrong way.
 */

export type PaymentMode = 'razorpay' | 'upi';

export interface PaymentSettings {
  mode: PaymentMode;
  /** The shop's UPI ID (VPA), e.g. shopname@okaxis. */
  upiId: string;
  /** The account holder's name shown in the customer's UPI app. */
  payeeName: string;
}

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = { mode: 'razorpay', upiId: '', payeeName: '' };

/** Same pattern as api/create-order.ts UPI_ID. */
export const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,64}$/;

/** A UPI transaction reference: 12 digits in most apps (letters in a few). Same as api/notify-order.ts. */
export const UTR_PATTERN = /^[A-Za-z0-9]{8,30}$/;

export const normalisePaymentSettings = (raw: unknown): PaymentSettings => {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    mode: d.mode === 'upi' ? 'upi' : 'razorpay',
    upiId: String(d.upiId ?? '').trim(),
    payeeName: String(d.payeeName ?? '').trim().slice(0, 60),
  };
};

/** Why the UPI details cannot be saved with UPI switched on, or null when they can. */
export const upiSettingsProblem = (s: PaymentSettings): string | null => {
  if (s.mode !== 'upi') return null;
  if (!UPI_ID_PATTERN.test(s.upiId)) return 'Enter a valid UPI ID, like shopname@okaxis.';
  if (!s.payeeName) return 'Enter the name on the UPI account.';
  return null;
};

export const cleanUtr = (raw: string) => raw.replace(/\s+/g, '').toUpperCase();

/**
 * The upi://pay link a UPI app opens (NPCI "UPI linking specification"):
 * pa payee address, pn payee name, am amount with 2 decimals, cu INR, tn note.
 */
export const upiPayLink = (p: { upiId: string; payeeName: string; amount: number; note?: string }) => {
  const params = new URLSearchParams({
    pa: p.upiId,
    pn: p.payeeName,
    am: (Math.round(p.amount * 100) / 100).toFixed(2),
    cu: 'INR',
    ...(p.note ? { tn: p.note.slice(0, 50) } : {}),
  });
  // URLSearchParams writes spaces as "+", which some UPI apps show literally.
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
};
