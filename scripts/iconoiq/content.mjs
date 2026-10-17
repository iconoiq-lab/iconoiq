/**
 * ICONOIQ dummy catalogue for the preview (owner, 2026-10-17: dummy products with ChatGPT photos for now,
 * the real ones in Phase 6). Written by scripts/seed-iconoiq.mjs, every document with `demo: true`, so
 * `node scripts/seed-iconoiq.mjs --remove` clears it before launch.
 *
 * Real content only: no invented reviews, ratings, discounts, stock claims or product facts. Descriptions
 * say the listing is a sample; specifications are [NEED] until the client sends them. originalPrice equals
 * price, so no made-up "was" price. `photo` names a file in client-brief/generated/ (git-ignored originals).
 */

const SAMPLE = 'Sample listing for the store preview: the real photos, contents and details come from ICONOIQ.';
// T = isTopDeal, B = isBestSeller, F = isFeatured, N = isNewArrival, R = isTrendProduct (home rows pick by flag).
const p = (name, category, subcategory, price, flags, photo, idea) => ({
  name, category, subcategory, price, originalPrice: price, stock: 50, weight: '500', flags, photo,
  description: `${idea}\n\n${SAMPLE}`,
  specs: { material: '[NEED: material]', purity: '', dimensions: '[NEED: size]', 'Age group': '[NEED: age group]' },
});

export const PRODUCTS = [
  p('Nataraja Iconography Learning Kit', 'Learning Kits', 'Deity Iconography', 1499, 'TBF', 'iq-p01-nataraja-kit.png', 'A learning kit built around the Nataraja form: the pose, the hands and what each symbol in the image means.'),
  p('Ganesha Form & Symbol Kit', 'Learning Kits', 'Deity Iconography', 1299, 'BFN', 'iq-p15-ganesha-kit.png', 'A learning kit on the form of Ganesha and the meaning of each attribute he holds.'),
  p('Temple Gopuram Build-and-Learn Kit', 'Learning Kits', 'Temple Architecture', 2499, 'TFR', 'iq-p02-gopuram-kit.png', 'Build a temple gateway tower tier by tier and learn the names of its parts.'),
  p('Hasta Mudra Learning Cards', 'Learning Kits', 'Mudras & Natyam', 999, 'BNR', 'iq-p03-mudra-cards.png', 'Cards that show the classical hand gestures and what each one expresses.'),
  p('Deity Proportion Drawing Templates', 'Templates & Stencils', 'Drawing Templates', 799, 'TFN', 'iq-p04-drawing-templates.png', 'Drawing templates that teach the traditional proportions used to draw deity figures.'),
  p('Brass Temple Motif Stencil Set', 'Templates & Stencils', 'Metal Stencils', 1899, 'BFR', 'iq-p05-brass-stencils.png', 'A set of metal stencils of classic temple motifs for drawing and craft.'),
  p('Shilpa Shastra Picture Book', 'Books & Charts', 'Picture Books', 449, 'TBN', 'iq-p06-picture-book.png', 'A picture book that tells how temple sculptors learned and worked.'),
  p('Navagraha Wall Chart Set', 'Books & Charts', 'Wall Charts', 349, 'FNR', 'iq-p07-navagraha-charts.png', 'Wall charts of the nine Navagraha forms and their symbols.'),
  p('Trace & Colour Activity Book', 'Books & Charts', 'Activity Books', 299, 'TBR', 'iq-p08-activity-book.png', 'An activity book of temple motifs and deity outlines to trace and colour.'),
  p('Dashavatara Jigsaw Puzzle', 'Games & Puzzles', 'Puzzles', 599, 'TFN', 'iq-p09-avatar-puzzle.png', 'A jigsaw puzzle of the ten avatars of Vishnu.'),
  p('Gods & Symbols Memory Game', 'Games & Puzzles', 'Card Games', 399, 'BNR', 'iq-p10-memory-game.png', 'A memory-match card game of sacred symbols and the deities they belong to.'),
  p('Temple Art Colouring Kit', 'Art & Stationery', 'Colouring', 549, 'TBF', 'iq-p11-colouring-kit.png', 'A colouring kit of temple art outlines.'),
  p('Kolam & Rangoli Stencil Pack', 'Art & Stationery', 'Craft Supplies', 249, 'FNR', 'iq-p12-kolam-stencils.png', 'Stencils for drawing traditional kolam and rangoli patterns.'),
  p('Classroom Iconography Pack', 'School & Academy Packs', 'Classroom Packs', 4999, 'TBR', 'iq-p13-classroom-pack.png', 'A pack for teaching Indian iconography to a whole class.'),
  p('Natyam Academy Mudra Pack', 'School & Academy Packs', 'Academy Packs', 3499, 'BFN', 'iq-p14-natyam-pack.png', 'A teaching pack of hasta mudras for dance academies.'),
];

/** Hero carousel (`banners`). The split hero sets its own line beside the photo, so the photos carry no text. */
export const HERO_BANNERS = [
  { link: '/products', photo: 'iq-hero-1.png' },
  { link: '/category/school-academy-packs', photo: 'iq-hero-2.png' },
];

/** Category showcase tiles (`showcases`). `subtitle` is the category slug the tile links to. */
export const SHOWCASES = [
  { title: 'Learning Kits', subtitle: 'learning-kits', cta: 'Shop kits', description: 'Kits that explain each sacred form and the meaning of its symbols.', photo: 'iq-p01-nataraja-kit.png' },
  { title: 'Templates & Stencils', subtitle: 'templates-stencils', cta: 'Shop templates', description: 'Draw deities and temple motifs in their traditional proportions.', photo: 'iq-p05-brass-stencils.png' },
  { title: 'Books & Charts', subtitle: 'books-charts', cta: 'Shop books', description: 'Picture books, wall charts and activity books for home and class.', photo: 'iq-p06-picture-book.png' },
  { title: 'Games & Puzzles', subtitle: 'games-puzzles', cta: 'Shop games', description: 'Learn the sacred forms and symbols through play.', photo: 'iq-p09-avatar-puzzle.png' },
  { title: 'Art & Stationery', subtitle: 'art-stationery', cta: 'Shop art', description: 'Colour and craft temple art and kolam patterns.', photo: 'iq-p11-colouring-kit.png' },
  { title: 'School & Academy Packs', subtitle: 'school-academy-packs', cta: 'Shop packs', description: 'Packs for classrooms and dance academies.', photo: 'iq-p13-classroom-pack.png' },
];

/** "Our Collections" cards (`homeCollections`), portrait 3:4: the six categories. */
export const COLLECTIONS = [
  { eyebrow: 'Category', title: 'Learning Kits', subtitle: 'Deities, temples and mudras, explained.', link: '/category/learning-kits', photo: 'iq-p15-ganesha-kit.png' },
  { eyebrow: 'Category', title: 'Templates & Stencils', subtitle: 'Draw in the traditional proportions.', link: '/category/templates-stencils', photo: 'iq-p04-drawing-templates.png' },
  { eyebrow: 'Category', title: 'Books & Charts', subtitle: 'Read, look and colour.', link: '/category/books-charts', photo: 'iq-p07-navagraha-charts.png' },
  { eyebrow: 'Category', title: 'Games & Puzzles', subtitle: 'Learn the forms through play.', link: '/category/games-puzzles', photo: 'iq-p09-avatar-puzzle.png' },
  { eyebrow: 'Category', title: 'Art & Stationery', subtitle: 'Colour and craft temple art.', link: '/category/art-stationery', photo: 'iq-p11-colouring-kit.png' },
  { eyebrow: 'Category', title: 'School & Academy Packs', subtitle: 'For classrooms and dance academies.', link: '/category/school-academy-packs', photo: 'iq-p13-classroom-pack.png' },
];

/** Wide banner near the bottom of the home page (`homeBanners`, slot collection-wide). */
export const COLLECTION_BANNER = {
  eyebrow: 'For schools and academies',
  title: 'Teach Indian iconography in class',
  subtitle: 'Classroom and academy packs for teachers.',
  ctaLabel: 'See the packs',
  ctaLink: '/category/school-academy-packs',
  photo: 'iq-classroom.png',
};
