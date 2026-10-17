/**
 * The delivery-time sentence on the shipping policy page. The days come from the store's
 * delivery setting (`estimatedDays`, Admin > Commerce > Delivery and GST; the first value is
 * `DEFAULT_DELIVERY.estimatedDays`), so Phase 1 and the admin change it in one place. With no
 * days set it promises none. Pure and dependency-free.
 */
export function deliveryTimeLine(estimatedDays?: string): string {
  const days = (estimatedDays ?? '').trim();
  return days
    ? `Estimated delivery time is ${days}, depending on location.`
    : 'Estimated delivery time depends on your location.';
}
