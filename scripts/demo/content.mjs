/**
 * Demo content for the template's own demo Firebase project (the preview
 * store): what `scripts/seed-demo.mjs` writes there.
 *
 * Neutral template content: four starter categories, twelve sample products,
 * and placeholder images from `public/demo/*.svg`. No ratings, reviews, stock
 * claims or discounts: unknown facts are `[NEED: ...]` markers.
 *
 * Not for a client's Firebase project: a client gets no demo products. Its
 * categories come from `DEFAULT_CATEGORIES` (seeded on the first admin visit)
 * and its products are added in Phase 6.
 *
 * An item's `image` is a local `/demo/` path and is used as-is (nothing is
 * generated, downloaded or uploaded). An item without `image` may instead
 * carry a `photo` (Pexels id) or a `prompt` for the AI generator; those
 * results are cached in `scripts/demo/images.json`.
 */

/** Appended to every image prompt so the whole set shares one art direction. */
export const STYLE = 'clean, neutral product photography on a light background, soft daylight';

/**
 * Written to `categories/<slug>`. Same names as `DEFAULT_CATEGORIES` in
 * `src/services/categoryService.ts`, so seeded products match the default subcategories.
 */
export const CATEGORIES = [
  { name: 'Category One', slug: 'category-one', subs: ['Subcategory 1A', 'Subcategory 1B', 'Subcategory 1C'] },
  { name: 'Category Two', slug: 'category-two', subs: ['Subcategory 2A', 'Subcategory 2B', 'Subcategory 2C'] },
  { name: 'Category Three', slug: 'category-three', subs: ['Subcategory 3A', 'Subcategory 3B', 'Subcategory 3C'] },
  { name: 'Category Four', slug: 'category-four', subs: ['Subcategory 4A', 'Subcategory 4B', 'Subcategory 4C'] },
];

// Home rows pick products by flag: T = isTopDeal, B = isBestSeller, F = isFeatured,
// N = isNewArrival, R = isTrendProduct. Each flag is on 6-7 products so every row fills.
// Prices are spread so every price-range band in BRAND.priceRanges (src/config/brand.ts)
// has products. originalPrice equals price on purpose: no made-up "was" price, no discount.
const sample = (n, category, subcategory, price, flags) => ({
  name: `Sample product ${n}`,
  category,
  subcategory,
  price,
  originalPrice: price,
  stock: 50,
  weight: '100',
  flags,
  description: '[NEED: product description]',
  specs: { size: '[NEED: size]', material: '[NEED: material]' },
  image: `/demo/collection-${((n - 1) % 5) + 1}.svg`,
});

export const PRODUCTS = [
  sample(1, 'Category One', 'Subcategory 1A', 299, 'TBN'),
  sample(2, 'Category One', 'Subcategory 1B', 749, 'BFR'),
  sample(3, 'Category One', 'Subcategory 1C', 1599, 'TFN'),
  sample(4, 'Category Two', 'Subcategory 2A', 349, 'BNR'),
  sample(5, 'Category Two', 'Subcategory 2B', 649, 'TFR'),
  sample(6, 'Category Two', 'Subcategory 2C', 1299, 'TBN'),
  sample(7, 'Category Three', 'Subcategory 3A', 499, 'BFR'),
  sample(8, 'Category Three', 'Subcategory 3B', 899, 'TFN'),
  sample(9, 'Category Three', 'Subcategory 3C', 2299, 'BNR'),
  sample(10, 'Category Four', 'Subcategory 4A', 1099, 'TFR'),
  sample(11, 'Category Four', 'Subcategory 4B', 1799, 'BFN'),
  sample(12, 'Category Four', 'Subcategory 4C', 2499, 'TR'),
];

/** Hero carousel (`banners`). Desktop 16:9, mobile 4:5. Images only; the section shows no text. */
export const HERO_BANNERS = [
  { link: '/category/category-one', image: '/demo/hero-1.svg' },
  { link: '/category/category-two', image: '/demo/hero-1.svg' },
  { link: '/products', image: '/demo/hero-1.svg' },
];

/** Category showcase tiles (`showcases`). `subtitle` is the category slug the tile links to. */
export const SHOWCASES = [
  {
    title: 'Category One', subtitle: 'category-one', cta: 'Shop now',
    description: '[NEED: showcase description]',
    image: '/demo/collection-1.svg',
  },
  {
    title: 'Category Two', subtitle: 'category-two', cta: 'Shop now',
    description: '[NEED: showcase description]',
    image: '/demo/collection-2.svg',
  },
  {
    title: 'Category Three', subtitle: 'category-three', cta: 'Shop now',
    description: '[NEED: showcase description]',
    image: '/demo/collection-3.svg',
  },
];

/** "Our Collections" cards (`homeCollections`), portrait 3:4. Mirrors src/data/defaultHomeCollections.ts. */
export const COLLECTIONS = [
  { eyebrow: 'Category', title: 'Category One', subtitle: '[NEED: short blurb for Category One]', link: '/category/category-one', image: '/demo/collection-1.svg' },
  { eyebrow: 'Category', title: 'Category Two', subtitle: '[NEED: short blurb for Category Two]', link: '/category/category-two', image: '/demo/collection-2.svg' },
  { eyebrow: 'Category', title: 'Category Three', subtitle: '[NEED: short blurb for Category Three]', link: '/category/category-three', image: '/demo/collection-3.svg' },
  { eyebrow: 'Category', title: 'Category Four', subtitle: '[NEED: short blurb for Category Four]', link: '/category/category-four', image: '/demo/collection-4.svg' },
  { eyebrow: 'Everything', title: 'Shop all', subtitle: '[NEED: short blurb for the full range]', link: '/products', image: '/demo/collection-5.svg' },
];

/** Wide banner near the bottom of the home page (`homeBanners`, slot collection-wide). */
export const COLLECTION_BANNER = {
  eyebrow: 'Collection',
  title: '[NEED: banner headline]',
  subtitle: '[NEED: banner line]',
  ctaLabel: 'Shop now',
  ctaLink: '/products',
  image: '/demo/banner.svg',
};

/**
 * One clearly marked placeholder so the reviews section shows in the preview.
 * The section labels `demo: true` entries "Sample review" and hides the stars
 * (rating 0). Removed with the rest of the demo data. No invented customer quotes.
 */
export const TESTIMONIALS = [
  { title: '[NEED: review title]', quote: '[NEED: customer review]', author: '[NEED: customer name]', role: '[NEED: city]', rating: 0 },
];

/**
 * Photos the page code uses directly (About, Contact, Wishlist). The pages already
 * point at these local files; the seed only lists them.
 */
export const PAGE_PHOTOS = {
  ...Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`about-${i + 1}`, { image: `/demo/about-${i + 1}.svg` }])),
  'contact-banner': { image: '/demo/contact.svg' },
  'wishlist-banner': { image: '/demo/wishlist.svg' },
};
