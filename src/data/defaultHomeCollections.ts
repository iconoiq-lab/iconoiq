import type { HomeCollection } from "@/services/homeContentService";
import { DEFAULT_CATEGORIES } from "@/services/categoryService";

/**
 * Starter cards for Admin > Home Collections (its "add the defaults" button writes these as real
 * collections): one card per category in DEFAULT_CATEGORIES (so a store's Phase 1 category list shows
 * here with no further edit) plus "Shop all". The home page itself shows only collections the admin has
 * saved, so these markers never reach a customer unless the admin adds them. Images are local
 * placeholders (public/demo) and the blurbs are [NEED: ...] markers -
 * TODO(client): swap in the store's own photos and copy.
 */
const TINT = "from-charcoal/85 via-charcoal/30 to-transparent";

/** Five placeholder images ship in public/demo; a store with more categories reuses them until Phase 3. */
const PLACEHOLDER_IMAGES = 5;
const placeholder = (index: number) => `/demo/collection-${(index % PLACEHOLDER_IMAGES) + 1}.svg`;

export const DEFAULT_HOME_COLLECTIONS: Array<
  Omit<HomeCollection, "id" | "createdAt" | "updatedAt">
> = [
  ...DEFAULT_CATEGORIES.map((category, index) => ({
    eyebrow: "Category",
    title: category.name,
    subtitle: `[NEED: short blurb for ${category.name}]`,
    ctaLabel: "Shop now",
    ctaLink: `/category/${category.slug}`,
    imageUrl: placeholder(index),
    tint: TINT,
    active: true,
    order: index,
  })),
  {
    eyebrow: "Everything",
    title: "Shop all",
    subtitle: "[NEED: short blurb for the full range]",
    ctaLabel: "Shop all",
    ctaLink: "/products",
    imageUrl: placeholder(DEFAULT_CATEGORIES.length),
    tint: TINT,
    active: true,
    order: DEFAULT_CATEGORIES.length,
  },
];
