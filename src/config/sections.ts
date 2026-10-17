/**
 * Section versions: which layout this store uses for each big page section.
 * "classic" is the template's own look. Pick versions in Phase 2 (look) with the
 * client; docs/template/SECTIONS.md shows each one. Preview any version without
 * editing this file: add ?sections=header:centered,hero:split to a URL in dev, or
 * on a build made with VITE_SECTION_PREVIEW=1. ?sections=reset clears the preview.
 *
 * Pure module (no imports): the tests load it directly.
 */
export const SECTION_VERSIONS = {
  header: ['classic', 'centered'],
  hero: ['classic', 'split'],
  productCard: ['classic', 'compact', 'detailed'],
  categoryDisplay: ['classic', 'tiles'],
  productPage: ['classic', 'stacked'],
  footer: ['classic', 'compact'],
} as const;

export type SectionKey = keyof typeof SECTION_VERSIONS;
export type SectionVersion<K extends SectionKey> = (typeof SECTION_VERSIONS)[K][number];
export type SectionChoice = { [K in SectionKey]: SectionVersion<K> };

/** This store's picks. */
export const SECTIONS: SectionChoice = {
  header: 'centered',
  hero: 'split',
  productCard: 'detailed',
  categoryDisplay: 'tiles',
  productPage: 'classic',
  footer: 'classic',
};

type Info = { label: string; pick: string };
export const SECTION_INFO: { [K in SectionKey]: Record<SectionVersion<K>, Info> } = {
  header: {
    classic: { label: 'Classic', pick: 'Search-first stores: logo left, a wide search box in the middle, icons right.' },
    centered: { label: 'Centred logo', pick: 'Brand-led stores with a strong logo: the logo sits in the centre, search moves left.' },
  },
  hero: {
    classic: { label: 'Classic', pick: 'Banners made as full photos: the image fills the width and the text sits on it.' },
    split: { label: 'Split', pick: 'Product photos on plain backgrounds, or busy photos where text on top is hard to read.' },
  },
  productCard: {
    classic: { label: 'Classic', pick: 'Most stores: square photo, name, stars and price, with the add button beside the price.' },
    compact: { label: 'Compact', pick: 'Large catalogues where shoppers scan many products and add straight from the grid.' },
    detailed: { label: 'Detailed', pick: 'Considered purchases: category, one key detail and a separate wishlist button.' },
  },
  categoryDisplay: {
    classic: { label: 'Classic', pick: 'Few categories with strong photos: a large first tile and a mixed-size grid.' },
    tiles: { label: 'Tiles', pick: 'Many categories, or photos of mixed quality: equal tiles with the name below the photo.' },
  },
  productPage: {
    classic: { label: 'Classic', pick: 'Most products: a photo with thumbnails beside the buying details, half and half.' },
    stacked: { label: 'Stacked photos', pick: 'Products sold on detail (fabric, finish, texture): every photo large, details stay in view.' },
  },
  footer: {
    classic: { label: 'Classic', pick: 'Stores with many pages and a shop address: link columns, contact details and a map.' },
    compact: { label: 'Compact', pick: 'Small stores with few pages: one centred block with the key links and contact line.' },
  },
};

/** Reads ?sections=key:version,... Unknown keys or versions are dropped. */
export function parseSectionOverride(query: string): Partial<SectionChoice> | 'reset' {
  const raw = new URLSearchParams(query).get('sections');
  if (!raw) return {};
  if (raw === 'reset') return 'reset';
  const out: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const [k, v] = pair.split(':');
    // Own keys only: toString, constructor and __proto__ would otherwise find an inherited non-array.
    const allowed = Object.prototype.hasOwnProperty.call(SECTION_VERSIONS, k)
      ? (SECTION_VERSIONS as Record<string, readonly string[]>)[k]
      : undefined;
    if (allowed?.includes(v)) out[k] = v;
  }
  return out as Partial<SectionChoice>;
}

export function resolveSections(base: SectionChoice, override: Partial<SectionChoice>): SectionChoice {
  return { ...base, ...override };
}
