/**
 * Footer link lists shared by the Classic and Compact footers.
 * Pure module (no imports): the tests load it directly.
 */
export interface FooterLink {
  name: string;
  to: string;
}

/** The policy pages every store has: the Classic "Information" column and the end of the Compact row. */
export const INFORMATION_LINKS: readonly FooterLink[] = [
  { name: "Privacy policy", to: "/privacy-policy" },
  { name: "Terms and conditions", to: "/terms-conditions" },
  { name: "Shipping policy", to: "/shipping-policy" },
  { name: "Cancellation and refunds", to: "/cancellation-refund-policy" },
];

/** Keeps the first link for each label and each destination, so the one-row footer never repeats itself. */
export function dedupeFooterLinks(links: readonly FooterLink[]): FooterLink[] {
  const names = new Set<string>();
  const targets = new Set<string>();
  const out: FooterLink[] = [];
  for (const link of links) {
    const name = link.name.trim().toLowerCase();
    if (!name || names.has(name) || targets.has(link.to)) continue;
    names.add(name);
    targets.add(link.to);
    out.push(link);
  }
  return out;
}
