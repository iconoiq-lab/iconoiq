import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  toSlug,
  sortCategories,
  uniqueSlug,
  cleanName,
  productsIn,
  renamePlan,
  removeFooterLinks,
  type CascadePlan,
  type CouponRef,
  type ProductRef,
} from '@/lib/categoryTree';
import { requestCatalogRefresh } from '@/services/catalogPublisher';

export { toSlug };

// ── Types ──────────────────────────────────────────────

export interface SubSubCategory {
  id?: string;
  name: string;
  slug: string;
}

export interface SubCategory {
  id?: string;
  name: string;
  slug: string;
  children?: SubSubCategory[];
}

export interface Category {
  id?: string;
  name: string;
  slug: string;
  subcategories: SubCategory[];
  /** Position in the store (Admin > Categories). Unset = DEFAULT_CATEGORIES order, then creation time. */
  order?: number;
  /** Off the storefront's menus and pages; its products still show in search and "All products". */
  hidden?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

// ── Default categories (seeded on first load if collection empty) ──

export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Learning Kits',
    slug: 'learning-kits',
    subcategories: [
      { name: 'Deity Iconography', slug: 'deity-iconography', children: [] },
      { name: 'Temple Architecture', slug: 'temple-architecture', children: [] },
      { name: 'Mudras & Natyam', slug: 'mudras-natyam', children: [] },
    ],
  },
  {
    name: 'Templates & Stencils',
    slug: 'templates-stencils',
    subcategories: [
      { name: 'Drawing Templates', slug: 'drawing-templates', children: [] },
      { name: 'Metal Stencils', slug: 'metal-stencils', children: [] },
    ],
  },
  {
    name: 'Books & Charts',
    slug: 'books-charts',
    subcategories: [
      { name: 'Picture Books', slug: 'picture-books', children: [] },
      { name: 'Wall Charts', slug: 'wall-charts', children: [] },
      { name: 'Activity Books', slug: 'activity-books', children: [] },
    ],
  },
  {
    name: 'Games & Puzzles',
    slug: 'games-puzzles',
    subcategories: [
      { name: 'Puzzles', slug: 'puzzles', children: [] },
      { name: 'Card Games', slug: 'card-games', children: [] },
    ],
  },
  {
    name: 'Art & Stationery',
    slug: 'art-stationery',
    subcategories: [
      { name: 'Colouring', slug: 'colouring', children: [] },
      { name: 'Craft Supplies', slug: 'craft-supplies', children: [] },
    ],
  },
  {
    name: 'School & Academy Packs',
    slug: 'school-academy-packs',
    subcategories: [
      { name: 'Classroom Packs', slug: 'classroom-packs', children: [] },
      { name: 'Academy Packs', slug: 'academy-packs', children: [] },
    ],
  },
];

const CATEGORIES_COLLECTION = 'categories';

/** Firestore hands timestamps back in several shapes depending on the read. */
type TimestampLike = { seconds?: number; toMillis?: () => number } | string | number | null | undefined;

const timeOf = (v: TimestampLike): number => {
  if (!v) return Number.MAX_SAFE_INTEGER; // no timestamp -> sorts last
  if (typeof v === 'object') {
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    if (typeof v.toMillis === 'function') return v.toMillis();
    return Number.MAX_SAFE_INTEGER;
  }
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
};

/**
 * Fold duplicate category documents that share a slug into a single entry.
 *
 * The collection is seeded from DEFAULT_CATEGORIES whenever it reads back as
 * empty, so one transient empty read seeded a second full set. That is why the
 * admin product form listed "Category One" twice and why Radix's <Select> printed
 * "Category OneCategory One" in the trigger - two items shared one value, so both
 * item labels rendered. Prevention lives in `seedDefaultCategories`
 * (deterministic document ids); this heals the data that already exists.
 *
 * The surviving entry keeps the oldest document's id - subcategories added from
 * the admin form write to that id - and takes the union of every duplicate's
 * subcategories and their children, so no taxonomy is lost.
 */
export const dedupeCategories = (cats: Category[]): Category[] => {
  const bySlug = new Map<string, Category>();
  const ordered = [...cats].sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt));

  for (const cat of ordered) {
    const slug = cat.slug || toSlug(cat.name || '');
    if (!slug) continue;

    const existing = bySlug.get(slug);
    if (!existing) {
      bySlug.set(slug, {
        ...cat,
        slug,
        subcategories: (cat.subcategories || []).map((s) => ({
          ...s,
          slug: s.slug || toSlug(s.name || ''),
          children: [...(s.children || [])],
        })),
      });
      continue;
    }

    for (const sub of cat.subcategories || []) {
      const subSlug = sub.slug || toSlug(sub.name || '');
      const match = existing.subcategories.find((s) => s.slug === subSlug);
      if (!match) {
        existing.subcategories.push({ ...sub, slug: subSlug, children: [...(sub.children || [])] });
        continue;
      }
      const children = [...(match.children || [])];
      for (const child of sub.children || []) {
        const childSlug = child.slug || toSlug(child.name || '');
        if (!children.some((c) => (c.slug || toSlug(c.name || '')) === childSlug)) {
          children.push({ ...child, slug: childSlug });
        }
      }
      match.children = children;
    }
  }

  return [...bySlug.values()];
};

// ── CRUD ───────────────────────────────────────────────

/** Dedupes concurrent callers - two components mounting at once seeded twice. */
let seedInFlight: Promise<void> | null = null;

/**
 * Create the default categories in a store that has none yet (its first admin
 * visit).
 *
 * Only an empty collection is seeded, read from the server so a cold cache can't
 * look empty: Admin > Categories can remove a default, and the old "create
 * whatever default is missing" brought it straight back. Ids are the slugs, so
 * two tabs seeding at once write the same documents instead of a duplicate set.
 *
 * Only admins may write to `categories`, so this is a silent no-op for shoppers.
 */
export const seedDefaultCategories = async (): Promise<void> => {
  if (seedInFlight) return seedInFlight;

  seedInFlight = (async () => {
    const snapshot = await getDocsFromServer(collection(db, CATEGORIES_COLLECTION));
    if (!snapshot.empty) return;

    for (const [order, cat] of DEFAULT_CATEGORIES.entries()) {
      await setDoc(doc(db, CATEGORIES_COLLECTION, cat.slug), {
        ...cat,
        order,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  })()
    .catch((error) => {
      // Signed-out visitors cannot write here; expected, not a failure.
      console.debug('[categoryService] seed skipped:', (error as Error)?.message);
    })
    .finally(() => {
      seedInFlight = null;
    });

  return seedInFlight;
};

/**
 * Read every category document.
 *
 * Deliberately not `orderBy('createdAt')`: an ordered Firestore query silently
 * drops documents that lack the field, so a single category saved without a
 * timestamp would disappear from the whole storefront. Sorting client-side
 * after deduping keeps every document visible.
 */
export interface CategoryReadOptions {
  /** Admin screens list hidden categories too; the storefront never does. */
  includeHidden?: boolean;
}

const DEFAULT_SLUGS = DEFAULT_CATEGORIES.map((c) => c.slug);

const inStoreOrder = (docs: Category[], { includeHidden = false }: CategoryReadOptions = {}) =>
  sortCategories(dedupeCategories(docs), DEFAULT_SLUGS).filter((c) => includeHidden || !c.hidden);

export const getCategories = async (options?: CategoryReadOptions): Promise<Category[]> => {
  const snapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
  return inStoreOrder(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Category)), options);
};

export const subscribeToCategories = (
  callback: (cats: Category[]) => void,
  options?: CategoryReadOptions,
) => {
  return onSnapshot(
    collection(db, CATEGORIES_COLLECTION),
    (snapshot) => {
      callback(inStoreOrder(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Category)), options));
    },
    (error) => {
      console.error('[categoryService] Subscription error:', error);
      callback([]); // resolve with empty so loading stops
    },
  );
};

/** Runs at most once per session - healing is idempotent but costs writes. */
let healInFlight: Promise<number> | null = null;

/**
 * Permanently merge duplicate category documents in Firestore.
 *
 * `dedupeCategories` hides duplicates at read time; this removes them at the
 * source so the admin form, storefront filters and every future consumer see
 * one document per slug. The oldest document per slug survives and receives the
 * merged subcategory tree; the rest are deleted.
 *
 * Admin-only (Firestore rules). Returns the number of documents removed.
 */
export const healDuplicateCategories = async (): Promise<number> => {
  if (healInFlight) return healInFlight;

  healInFlight = (async () => {
    const snapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
    const raw = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Category));

    const merged = dedupeCategories(raw);
    const survivors = new Set(merged.map((c) => c.id));
    const extras = raw.filter((c) => !survivors.has(c.id));
    if (extras.length === 0) return 0;

    for (const canonical of merged) {
      if (!canonical.id) continue;
      const before = raw.find((c) => c.id === canonical.id);
      const changed =
        JSON.stringify(before?.subcategories || []) !== JSON.stringify(canonical.subcategories);
      if (changed) {
        await updateDoc(doc(db, CATEGORIES_COLLECTION, canonical.id), {
          subcategories: canonical.subcategories,
          updatedAt: serverTimestamp(),
        });
      }
    }

    for (const extra of extras) {
      if (extra.id) await deleteDoc(doc(db, CATEGORIES_COLLECTION, extra.id));
    }

    console.info(`[categoryService] merged ${extras.length} duplicate category document(s)`);
    return extras.length;
  })()
    .catch((error) => {
      console.debug('[categoryService] duplicate merge skipped:', (error as Error)?.message);
      return 0;
    })
    .finally(() => {
      healInFlight = null;
    });

  return healInFlight;
};

// ── Admin > Categories ─────────────────────────────────

/** Every product's category fields, read fresh so a rename or count never works from a stale list. */
export const getProductRefs = async (): Promise<ProductRef[]> => {
  const snapshot = await getDocs(collection(db, 'products'));
  return snapshot.docs.map((d) => {
    const data = d.data();
    return { id: d.id, category: data.category ?? null, subcategory: data.subcategory ?? null };
  });
};

const getCouponRefs = async (): Promise<CouponRef[]> => {
  const snapshot = await getDocs(collection(db, 'coupons'));
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      applicableCategories: data.applicableCategories || [],
      applicableSubcategories: data.applicableSubcategories || [],
    };
  });
};

const FOOTER_DOC = ['siteSettings', 'footer'] as const;

/** The footer's category links as shoppers see them: the saved list, else the default (category names). */
const getFooterLinks = async (): Promise<string[]> => {
  const snap = await getDoc(doc(db, ...FOOTER_DOC));
  const saved = snap.exists() ? snap.data().categoryLinks : undefined;
  return Array.isArray(saved) ? saved : DEFAULT_CATEGORIES.map((c) => c.name);
};

type Batch = ReturnType<typeof writeBatch>;

/** Writes in chunks: a Firestore batch holds at most 500 writes. */
const applyPlan = async (plan: CascadePlan) => {
  const writes: Array<(b: Batch) => void> = [
    ...plan.products.map(({ id, data }) => (b: Batch) =>
      b.update(doc(db, 'products', id), { ...data, updatedAt: serverTimestamp() })),
    ...plan.coupons.map(({ id, data }) => (b: Batch) =>
      b.update(doc(db, 'coupons', id), { ...data, updatedAt: serverTimestamp() })),
  ];
  const links = plan.footerLinks;
  if (links) writes.push((b) => b.set(doc(db, ...FOOTER_DOC), { categoryLinks: links }, { merge: true }));

  for (let i = 0; i < writes.length; i += 400) {
    const batch = writeBatch(db);
    writes.slice(i, i + 400).forEach((w) => w(batch));
    await batch.commit();
  }
  if (plan.products.length) requestCatalogRefresh(plan.products.map((p) => p.id));
};

/**
 * A new category at the end of the list. Its slug (address) never changes after this.
 * The others get their current position saved in the same batch: a category with no
 * `order` sorts after every numbered one, so the new one would otherwise jump to the top.
 */
export const createCategory = async (name: string, all: Category[]): Promise<void> => {
  const clean = cleanName(name);
  const slug = uniqueSlug(toSlug(clean), all.map((c) => c.slug));
  const batch = writeBatch(db);
  all.forEach((c, order) => {
    if (c.id && c.order !== order) batch.update(doc(db, CATEGORIES_COLLECTION, c.id), { order });
  });
  batch.set(doc(db, CATEGORIES_COLLECTION, slug), {
    name: clean,
    slug,
    subcategories: [],
    order: all.length,
    hidden: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
};

/**
 * Rename a category, or one of its subcategories when `subSlug` is given. The
 * slug stays; products, coupons and footer links that store the old name get
 * the new one. Returns how many products changed.
 */
export const renameCategory = async (
  cat: Category,
  all: Category[],
  newName: string,
  subSlug?: string,
): Promise<number> => {
  if (!cat.id) throw new Error('This category has no document id.');
  const clean = cleanName(newName);
  const sub = subSlug ? cat.subcategories.find((s) => s.slug === subSlug) : undefined;
  if (subSlug && !sub) throw new Error('That subcategory no longer exists.');

  const [products, coupons, footerLinks] = await Promise.all([getProductRefs(), getCouponRefs(), getFooterLinks()]);
  const plan = renamePlan({ cat, all, sub, newName: clean, products, coupons, footerLinks });

  // The category document first. If the cascade then fails, the same rename can
  // be retried: products still match by the slug, which did not change.
  await updateDoc(doc(db, CATEGORIES_COLLECTION, cat.id), {
    ...(sub
      ? { subcategories: cat.subcategories.map((s) => (s.slug === sub.slug ? { ...s, name: clean } : s)) }
      : { name: clean }),
    updatedAt: serverTimestamp(),
  });
  await applyPlan(plan);
  return plan.products.length;
};

export const addSubcategoryNamed = async (cat: Category, name: string): Promise<void> => {
  if (!cat.id) throw new Error('This category has no document id.');
  const clean = cleanName(name);
  const slug = uniqueSlug(toSlug(clean), cat.subcategories.map((s) => s.slug));
  await updateDoc(doc(db, CATEGORIES_COLLECTION, cat.id), {
    subcategories: [...cat.subcategories, { name: clean, slug, children: [] }],
    updatedAt: serverTimestamp(),
  });
};

export const setCategoryHidden = async (cat: Category, hidden: boolean): Promise<void> => {
  if (!cat.id) throw new Error('This category has no document id.');
  await updateDoc(doc(db, CATEGORIES_COLLECTION, cat.id), { hidden, updatedAt: serverTimestamp() });
};

/** Store the given order as 0..n-1 on every category, in one batch. */
export const saveCategoryOrder = async (ordered: Category[]): Promise<void> => {
  const batch = writeBatch(db);
  ordered.forEach((c, order) => {
    if (c.id) batch.update(doc(db, CATEGORIES_COLLECTION, c.id), { order, updatedAt: serverTimestamp() });
  });
  await batch.commit();
};

export class CategoryInUseError extends Error {
  count: number;
  constructor(count: number) {
    super(`${count} product${count === 1 ? ' is' : 's are'} still filed here. Move ${count === 1 ? 'it' : 'them'} to another category first.`);
    this.name = 'CategoryInUseError';
    this.count = count;
  }
}

/**
 * Remove a category, or one of its subcategories when `subSlug` is given.
 * Refused while any product (active or not) is filed under it, counted fresh
 * from Firestore. Its footer link goes too; coupons stay as they are (see
 * `removeFooterLinks` in categoryTree.ts).
 */
export const removeCategory = async (cat: Category, all: Category[], subSlug?: string): Promise<void> => {
  if (!cat.id) throw new Error('This category has no document id.');
  const sub = subSlug ? cat.subcategories.find((s) => s.slug === subSlug) : undefined;
  if (subSlug && !sub) return;
  if (!sub && all.length <= 1) throw new Error('A store needs at least one category.');

  const using = productsIn(await getProductRefs(), cat, all, sub).length;
  if (using > 0) throw new CategoryInUseError(using);

  if (sub) {
    await updateDoc(doc(db, CATEGORIES_COLLECTION, cat.id), {
      subcategories: cat.subcategories.filter((s) => s.slug !== sub.slug),
      updatedAt: serverTimestamp(),
    });
  } else {
    await deleteDoc(doc(db, CATEGORIES_COLLECTION, cat.id));
  }
  const footerLinks = removeFooterLinks(await getFooterLinks(), sub ? sub.name : cat.name);
  if (footerLinks) await applyPlan({ products: [], coupons: [], footerLinks });
};

// ── Subcategory helpers (product form) ─────────────────

export const addSubcategory = async (
  categoryId: string,
  currentSubs: SubCategory[],
  name: string
): Promise<void> => {
  const newSub: SubCategory = { name, slug: toSlug(name), children: [] };
  await updateDoc(doc(db, CATEGORIES_COLLECTION, categoryId), {
    subcategories: [...currentSubs, newSub],
    updatedAt: serverTimestamp(),
  });
};

// ── Sub-sub-category helpers ───────────────────────────

export const addSubSubcategory = async (
  categoryId: string,
  currentSubs: SubCategory[],
  subSlug: string,
  name: string
): Promise<void> => {
  const updated = currentSubs.map((s) => {
    if (s.slug === subSlug) {
      return { ...s, children: [...(s.children || []), { name, slug: toSlug(name) }] };
    }
    return s;
  });
  await updateDoc(doc(db, CATEGORIES_COLLECTION, categoryId), {
    subcategories: updated,
    updatedAt: serverTimestamp(),
  });
};

export const removeSubSubcategory = async (
  categoryId: string,
  currentSubs: SubCategory[],
  subSlug: string,
  childSlug: string
): Promise<void> => {
  const updated = currentSubs.map((s) => {
    if (s.slug === subSlug) {
      return { ...s, children: (s.children || []).filter((c) => c.slug !== childSlug) };
    }
    return s;
  });
  await updateDoc(doc(db, CATEGORIES_COLLECTION, categoryId), {
    subcategories: updated,
    updatedAt: serverTimestamp(),
  });
};
