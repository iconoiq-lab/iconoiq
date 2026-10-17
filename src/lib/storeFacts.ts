/**
 * The facts strip under the home hero: what delivery costs, how long it takes, how fast the shop replies.
 * Nothing here is typed in. The delivery numbers come from the store's delivery settings (Admin > Commerce >
 * Delivery and GST), the reply time from its support settings (the first value is BRAND.replyWithin), and the
 * "ships to" and opening-hours lines from BRAND. A fact with no value behind it is left out rather than
 * guessed. Pure and dependency-free (it only needs the shape of the delivery settings).
 *
 * Every delivery line must be exactly true for what checkout charges (computeDeliveryCharge in
 * src/services/siteSettingsService.ts, mirrored by api/create-order.ts):
 *   1. an order whose subtotal is the free-delivery amount or more ships free, whatever the products or
 *      the state (`>=`, checked first), so "Free delivery on orders of X or more" is always true;
 *   2. below that, the cart pays its highest line charge, and a line is priced by (in order) the product's
 *      own "free" flag, the state's `stateRates` entry (states other than the home state), the product's own
 *      charges, then the store-wide charge (home state or elsewhere; zero when it is switched off).
 * The settings alone cannot say what a product with its own charge costs, so the lines describe the
 * STANDARD delivery charge (the store-wide one plus the state rates) and say "standard"; a state with its
 * own rate is never covered by "elsewhere" (the line says "other states vary" instead).
 */
export interface FactsDelivery {
  enabled: boolean;
  homeState: string;
  withinStateCharge: number;
  outsideStateCharge: number;
  /** Exact charges for named states other than the home state (checkout prices these before the store-wide charge). */
  stateRates?: Array<{ state: string; charge: number }>;
  /** 0 = no free-delivery amount. */
  freeDeliveryAbove: number;
  estimatedDays?: string;
}

export interface StoreFact {
  id: 'delivery' | 'days' | 'reply';
  title: string;
  detail?: string;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const clamp = (n: unknown) => Math.max(0, Number(n) || 0);
const norm = (v?: string) => (v || '').trim().toLowerCase();
/** "free" for 0, else the amount. */
const chargeText = (n: number) => (n === 0 ? 'free' : rupees(n));
const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * The delivery line, or null when the settings do not make any line true. See the file comment for the
 * checkout rules each branch follows.
 */
function deliveryFact(d: FactsDelivery): StoreFact | null {
  const home = d.homeState?.trim() || 'the home state';
  // The store-wide charge is zero while it is switched off; state rates still apply (checkout reads them first).
  const within = d.enabled ? clamp(d.withinStateCharge) : 0;
  const outside = d.enabled ? clamp(d.outsideStateCharge) : 0;
  // A rate for the home state is never used (checkout prices the home state with the store-wide charge).
  const stateCharges = (d.stateRates ?? [])
    .filter((r) => norm(r?.state) && norm(r.state) !== norm(d.homeState))
    .map((r) => clamp(r.charge));
  const all = [within, outside, ...stateCharges];

  // Nothing is charged anywhere (a product with its own charge is the one exception, hence "standard").
  if (all.every((n) => n === 0)) return { id: 'delivery', title: 'Free standard delivery' };

  const single = stateCharges.length === 0 && within === outside;
  const where = stateCharges.length
    ? `${chargeText(within)} in ${home}; other states vary`
    : `${chargeText(within)} in ${home}, ${chargeText(outside)} elsewhere`;
  const standard = single ? `${rupees(within)} per order` : where;

  // Above the free-delivery amount every order ships free, so this line is true whatever else is set.
  if (d.freeDeliveryAbove > 0) {
    return {
      id: 'delivery',
      title: `Free delivery on orders of ${rupees(d.freeDeliveryAbove)} or more`,
      detail: `Below that, standard delivery is ${standard}`,
    };
  }
  if (single) return { id: 'delivery', title: `Standard delivery ${rupees(within)} per order` };
  const lowest = Math.min(...all);
  return {
    id: 'delivery',
    // "from" only when the lowest charge is a real amount; a free zone reads better as a plain statement.
    title: lowest > 0 ? `Standard delivery from ${rupees(lowest)}` : 'Delivery charge depends on your state',
    detail: capital(where),
  };
}

export function storeFacts(input: {
  delivery: FactsDelivery;
  /** Support settings' reply time, e.g. "Within 24 hours". */
  responseTime?: string;
  /** BRAND.shipsTo, e.g. "Shipped across India". */
  shipsTo?: string;
  /** The support settings' opening hours. */
  hours?: string;
}): StoreFact[] {
  const d = input.delivery;
  const facts: StoreFact[] = [];

  const delivery = deliveryFact(d);
  if (delivery) facts.push(delivery);

  const days = (d.estimatedDays ?? '').trim();
  if (days) facts.push({ id: 'days', title: `Delivered in ${days}`, detail: input.shipsTo?.trim() || undefined });

  const reply = (input.responseTime ?? '').trim();
  if (reply) {
    // "Within 24 hours" reads as "We reply within 24 hours"; free text ("Same day") keeps a plain label.
    const title = /^within\b/i.test(reply) ? `We reply ${reply.toLowerCase()}` : `Reply time: ${reply}`;
    facts.push({ id: 'reply', title, detail: input.hours?.trim() || undefined });
  }
  return facts;
}
