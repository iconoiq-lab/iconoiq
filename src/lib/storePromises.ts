/**
 * The "What we promise" panel next to the testimonials. Every value comes from a store setting, so
 * Phase 1 (or the admin) changes it in one place: the reply time is `DEFAULT_SUPPORT.responseTime` (built from `BRAND.replyWithin`),
 * the delivery days are `DEFAULT_DELIVERY.estimatedDays`, the return window is `RETURN_WINDOW_DAYS`.
 * A promise with no value behind it is left out rather than guessed. Pure and dependency-free.
 */
export interface StorePromise {
  value: string;
  label: string;
}

export function storePromises(input: {
  responseTime?: string;
  estimatedDays?: string;
  returnWindowDays: number;
}): StorePromise[] {
  const reply = (input.responseTime ?? '').trim();
  const days = (input.estimatedDays ?? '').trim();
  const window = input.returnWindowDays;
  const promises: StorePromise[] = [];
  if (reply) promises.push({ value: reply, label: 'Support reply time' });
  promises.push({ value: 'Razorpay', label: 'Secure checkout' });
  promises.push({ value: `${window} ${window === 1 ? 'day' : 'days'}`, label: 'Returns from delivery' });
  if (days) promises.push({ value: days, label: 'Delivery time' });
  return promises;
}
