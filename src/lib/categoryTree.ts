/**
 * Pure category logic shared by the category service, the storefront and
 * Admin > Categories. No Firebase imports, so the tests can load it directly.
 *
 * Two keys, two jobs: a category's SLUG is its address (URLs, showcases, home
 * collections, nav icons) and never changes after creation; its NAME is what
 * products, coupons and the footer store. Renaming therefore rewrites the name
 * everywhere it is stored and leaves every link alone.
 */

export const toSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export interface Taxon {
  name: string;
  slug: string;
  children?: Taxon[];
}

/**
 * Does a product's stored subcategory value refer to the subcategory addressed
 * by `activeSlug`?
 *
 * The admin product form stores the subcategory *name* ("Men & Women"), while
 * the storefront filters address it by *slug* ("men-women"). Comparing the two
 * directly only matched when a name happened to be a single plain word, so any
 * subcategory containing a space or symbol silently showed zero products.
 *
 * Migrating 353 product documents to slugs would fix it too, but this keeps
 * both shapes valid so existing data and any half-migrated data both work.
 */
export const matchesTaxon = (
  stored: string | undefined | null,
  activeSlug: string,
  options: Taxon[] = [],
): boolean => {
  if (!stored || !activeSlug) return false;

  const value = stored.trim().toLowerCase();
  const target = activeSlug.trim().toLowerCase();

  // stored as a slug already, or a name that slugifies to the target
  if (value === target || toSlug(value) === target) return true;

  // stored as the display name - resolve the slug back to its name
  const match = options.find((o) => o.slug.toLowerCase() === target);
  if (!match) return false;

  return value === match.name.trim().toLowerCase() || toSlug(value) === toSlug(match.name);
};

// ── Order ──────────────────────────────────────────────

export interface OrderedCategory {
  slug: string;
  order?: number;
}

/**
 * Store order: the admin's `order` when set; otherwise the DEFAULT_CATEGORIES
 * order, then anything else in the order it arrived (creation time). Stable, so
 * a store that never reordered looks exactly as it did before `order` existed.
 */
export const sortCategories = <T extends OrderedCategory>(cats: T[], defaultSlugs: string[]): T[] => {
  const rank = (c: T) => {
    if (typeof c.order === 'number' && Number.isFinite(c.order)) return c.order;
    const i = defaultSlugs.indexOf(c.slug);
    return 100_000 + (i === -1 ? defaultSlugs.length : i);
  };
  return cats
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map(({ c }) => c);
};

/** Swap one category with its neighbour; returns a new list (unchanged when at the edge). */
export const moveItem = <T,>(list: T[], index: number, delta: -1 | 1): T[] => {
  const to = index + delta;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
};

// ── Names and slugs ────────────────────────────────────

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** Collapse inner whitespace, so "  Wall   Charts " is stored as "Wall Charts". */
export const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim();

/** Why a name can't be used, or null when it can. `except` is the entry being renamed. */
export const nameProblem = (
  name: string,
  siblings: Array<{ name: string }>,
  except?: { name: string },
): string | null => {
  const clean = cleanName(name);
  if (!clean) return 'Type a name.';
  if (clean.length > 40) return 'Keep it under 40 characters.';
  if (!toSlug(clean)) return 'Use at least one letter or number.';
  const taken = siblings.some((s) => s !== except && norm(s.name) === norm(clean));
  return taken ? `"${clean}" is already in the list.` : null;
};

/** `base`, else `base-2`, `base-3`... whichever no existing entry uses. */
export const uniqueSlug = (base: string, taken: string[]): string => {
  const used = new Set(taken.map(norm));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
};

// ── Products that use a category ───────────────────────

export interface ProductRef {
  id: string;
  category?: string | null;
  subcategory?: string | null;
}

export interface CategoryLike extends Taxon {
  subcategories?: Taxon[];
}

const inCategory = (p: ProductRef, cat: CategoryLike, all: CategoryLike[]) =>
  matchesTaxon(p.category, cat.slug, all);

const inSubcategory = (p: ProductRef, cat: CategoryLike, sub: Taxon) =>
  matchesTaxon(p.subcategory, sub.slug, cat.subcategories || []);

/** Products filed under a category, or under one of its subcategories when `sub` is given. */
export const productsIn = (
  products: ProductRef[],
  cat: CategoryLike,
  all: CategoryLike[],
  sub?: Taxon,
): ProductRef[] =>
  products.filter((p) => inCategory(p, cat, all) && (!sub || inSubcategory(p, cat, sub)));

// ── What a rename or removal changes elsewhere ─────────

export interface CouponRef {
  id: string;
  applicableCategories?: string[];
  applicableSubcategories?: string[];
}

export interface CascadePlan {
  /** Product id -> fields to write. */
  products: Array<{ id: string; data: Partial<Pick<ProductRef, 'category' | 'subcategory'>> }>;
  coupons: Array<{ id: string; data: Partial<Pick<CouponRef, 'applicableCategories' | 'applicableSubcategories'>> }>;
  /** The footer's new category links, or null when they don't change. */
  footerLinks: string[] | null;
}

const replaceIn = (list: string[] | undefined, from: string, to: string) => {
  if (!list?.some((v) => norm(v) === norm(from))) return null;
  return list.map((v) => (norm(v) === norm(from) ? to : v));
};

/**
 * Everything a rename touches outside the category document. A subcategory
 * rename (`sub` given) rewrites only products in that category, and only
 * coupons limited to that category, since another category may use the same
 * subcategory name.
 */
export const renamePlan = (input: {
  cat: CategoryLike;
  all: CategoryLike[];
  sub?: Taxon;
  newName: string;
  products: ProductRef[];
  coupons: CouponRef[];
  footerLinks: string[];
}): CascadePlan => {
  const { cat, all, sub, newName, products, coupons, footerLinks } = input;
  const oldName = sub ? sub.name : cat.name;

  const plan: CascadePlan = { products: [], coupons: [], footerLinks: null };

  for (const p of productsIn(products, cat, all, sub)) {
    const field = sub ? 'subcategory' : 'category';
    if (p[field] !== newName) plan.products.push({ id: p.id, data: { [field]: newName } });
  }

  for (const c of coupons) {
    if (sub) {
      if (!c.applicableCategories?.some((n) => norm(n) === norm(cat.name))) continue;
      const next = replaceIn(c.applicableSubcategories, oldName, newName);
      if (next) plan.coupons.push({ id: c.id, data: { applicableSubcategories: next } });
    } else {
      const next = replaceIn(c.applicableCategories, oldName, newName);
      if (next) plan.coupons.push({ id: c.id, data: { applicableCategories: next } });
    }
  }

  plan.footerLinks = replaceIn(footerLinks, oldName, newName);
  return plan;
};

/**
 * What a removal cleans up: only the footer link. Coupons are left alone on
 * purpose: dropping the last name from a coupon's list would turn "this
 * category only" into "the whole store". A coupon limited to a removed
 * category simply stops matching anything (`couponsLimitedTo` names them).
 */
export const removeFooterLinks = (footerLinks: string[], name: string): string[] | null =>
  footerLinks.some((v) => norm(v) === norm(name)) ? footerLinks.filter((v) => norm(v) !== norm(name)) : null;

export const couponsLimitedTo = (coupons: CouponRef[], cat: CategoryLike, sub?: Taxon): CouponRef[] =>
  coupons.filter((c) =>
    sub
      ? c.applicableCategories?.some((n) => norm(n) === norm(cat.name)) &&
        c.applicableSubcategories?.some((n) => norm(n) === norm(sub.name))
      : c.applicableCategories?.some((n) => norm(n) === norm(cat.name)),
  );
