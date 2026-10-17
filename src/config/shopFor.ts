/**
 * The home page's "Shop for" cards: who the kits are for (BRAND.description names them: children,
 * schools, academies and temples) and the shelf each one opens. Photos are ChatGPT-made art in
 * public/art/ (2026-10-17), not product photos. Provisional: the client may re-point or reword them.
 * Pure module: tests import it.
 */
export interface ShopForItem {
  title: string;
  line: string;
  href: string;
  image: string;
}

export const SHOP_FOR: ShopForItem[] = [
  {
    title: "Young learners",
    line: "Puzzles, card games and colouring with the gods and their symbols.",
    href: "/category/games-puzzles",
    image: "/art/shop-for-children.webp",
  },
  {
    title: "Classrooms",
    line: "Packs for teaching iconography to a whole class.",
    href: "/category/school-academy-packs?sub=classroom-packs",
    image: "/art/shop-for-classrooms.webp",
  },
  {
    title: "Dance academies",
    line: "Mudra cards and packs for natyam classes.",
    href: "/category/school-academy-packs?sub=academy-packs",
    image: "/art/shop-for-academies.webp",
  },
  {
    title: "Temples",
    line: "Wall charts and picture books on deities and temple art.",
    href: "/category/books-charts",
    image: "/art/shop-for-temples.webp",
  },
];
