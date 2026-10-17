/**
 * Which blocks the home page shows. Nothing is deleted: set a flag to false to hide a block, to true to bring it back.
 * The home page (src/pages/Index.tsx) reads this; the ORDER of the blocks is set there and is part of the look,
 * so a store that wants another order edits Index.tsx on purpose (compare with the mockup first).
 *
 * The blocks that fill from products or admin content also hide themselves while they have nothing to show,
 * so a new store with no deals, banner or collections yet shows no empty box. A block switched off here is
 * not rendered at all, so it costs no gap and loads nothing.
 *
 * The template ships every block on except the facts strip, which a store switches on when it wants it. Two more home sections are whole features and are
 * switched in src/config/features.ts instead: `testimonials` and `videoStories`.
 */
export const HOME_BLOCKS = {
  /** "Top deals" panel: products flagged as a top deal in the admin product form. */
  topDeals: false, // ICONOIQ mockup (2026-10-17)
  /** "Most loved right now": products flagged as best sellers (admin product form). */
  bestSellers: true,
  /** "Editor's picks": a dark photo band of featured products. */
  featured: false, // ICONOIQ mockup (2026-10-17)
  /** "New arrivals": products flagged as new arrivals (admin product form). */
  newArrivals: true,
  /** "Trending now": a second product shelf (products flagged as trending). */
  trending: true,
  /** The scrolling word band: always moving, with generic words. Turn it off for a calm, still store. */
  marquee: false, // ICONOIQ mockup (2026-10-17)
  /** Category tiles (or the other category display picked in src/config/sections.ts). */
  categories: true,
  /** Four generic promise cards ("Crafted around you"). The facts strip says the same with real numbers. */
  promiseCards: true,
  /** "Our collections": one photo and a line of copy per collection (Admin > Home collections). */
  collections: true,
  /** A thin band of generic phrases ("Delivery across India"). */
  serviceBand: false, // ICONOIQ mockup (2026-10-17)
  /** The wide banner near the foot (admin: home banner "collection-wide"). Shows only once the admin sets one. */
  banner: true,
  /** Delivery charge, delivery time and reply time under the hero, read from the delivery and support settings and BRAND. Off until a store wants it. */
  facts: true, // ICONOIQ mockup (2026-10-17)
} as const;

export type HomeBlock = keyof typeof HOME_BLOCKS;

/**
 * The height each lazy block keeps free until it loads (per breakpoint), so nothing jumps when it arrives.
 * They match each block's usual height with the template's content: change one when a block's content changes
 * a lot (taller cards, more rows). A hidden block is never rendered, so it never leaves a reserved gap.
 */
export const HOME_BLOCK_RESERVE = {
  marquee: 'h-[50px] md:h-[70px]',
  categoriesTiles: 'h-[784px] md:h-[643px] lg:h-[631px] xl:h-[711px] min-[1440px]:h-[761px]',
  categoriesShowcase: 'h-[1047px] md:h-[705px]',
  promiseCards: 'h-0 md:h-[503px] lg:h-[464px] xl:h-[449px]',
  collections: 'h-[552px] md:h-[840px] lg:h-[893px]',
  serviceBand: 'h-0 md:h-[47px]',
  testimonials: 'h-[925px] md:h-[985px] lg:h-[677px] xl:h-[631px]',
  banner: 'h-[364px] md:h-[516px]',
  videoStories: 'h-0',
} as const;

export type HomeBlockReserve = keyof typeof HOME_BLOCK_RESERVE;
