# Categories admin page: spec and plan (2026-10-22)

QA gap A7 (`docs/qa/real-user-test-2026-10-22.md`): top-level categories cannot be added, renamed, reordered, hidden or removed in Admin, and subcategories can only be added (in the product form). Same in every store made from the template.

## How categories are stored today (what the design must respect)

- `categories/<id>` documents: `name`, `slug`, `subcategories[{ name, slug, children[] }]`. Seeded from `DEFAULT_CATEGORIES` with id = slug.
- **Products store the category and subcategory NAME** (`product.category`, `product.subcategory`). So do coupons (`applicableCategories`, `applicableSubcategories`) and the footer's `siteSettings` `categoryLinks`.
- **URLs, showcases (subtitle), home collections (`ctaLink`) and nav icons use the SLUG.**
- `seedDefaultCategories` re-creates every default whose slug is missing, on every admin product-form visit and every category page visit. A removed default would come back.

## Decisions

1. **Rename keeps the slug.** Links, showcases, home collections and icons keep working. The new name is copied into every place that stores the old one, in the same action: products (category or subcategory), coupons (category or subcategory lists) and footer category links. Changed products are sent to the catalogue snapshot (`requestCatalogRefresh`).
2. **Remove is blocked while products use it.** The page shows the product count on every category and subcategory (read from Firestore products). Remove re-counts from Firestore before deleting. On remove, its footer link goes too. Coupons are left alone: dropping the last name from a coupon's list would turn "this category only" into "the whole store", so a coupon limited to a removed category simply stops matching (the dialog says so). The last category can't be removed.
3. **Hide** = `hidden: true` on the category. Hidden categories leave the storefront (category strip, tiles, showcase names, footer, mobile categories, category page, offer links). Their products stay visible in search and "All products"; the page says so. Admin screens (product form, products filter, coupons, showcases) still list them, marked "(hidden)" where a picker shows them.
4. **Order** = `order` number. The page reorders with Up/Down buttons (keyboard and phone friendly, no drag library) and writes `order` 0..n-1 to every category. Categories without `order` (existing stores) keep today's order: the `DEFAULT_CATEGORIES` order first, then the rest by creation time. The storefront strip uses this order instead of its own hardcoded one.
5. **Add**: a new category gets id = slug (like seeding); a slug already taken gets `-2`, `-3`. Duplicate names (case-insensitive) are refused. Subcategories: add, rename, remove (same rules). Sub-subcategories are kept as they are (not edited here).
6. **Seeding** runs only when the collection is empty on a server read (first admin visit of a new store), so a removed default stays removed. `DEFAULT_CATEGORIES` stays the seed.
7. New category icon: the strip shows the "more" icon (existing gotcha in the handoff); the page says so.

## Plan

1. `src/lib/categoryTree.ts` (pure, no Firebase): `toSlug`, `sortCategories`, `moveItem`, `uniqueSlug`, `nameProblem`, `renamePlan` (which products/coupons/footer links change for a category or subcategory rename), `removeFooterLinks`, `productsIn` (counts). `categoryService` re-exports `toSlug`.
2. `categoryService`: `order`/`hidden` on the type; subscribe/get return sorted lists, hidden filtered out unless `{ includeHidden: true }`; `createCategory`, `renameCategory`, `renameSubcategory`, `setCategoryHidden`, `saveCategoryOrder`, `removeCategory`, `removeSubcategory` (cascades with `writeBatch`, chunks of 400); seeding only on an empty collection.
3. `src/pages/admin/AdminCategories.tsx` at `/admin/categories`, nav item "Categories" after Products.
4. Admin consumers pass `{ includeHidden: true }`; `CategoryIconNav` drops its hardcoded order; `OfferRibbon` resolves its link by name through the live categories.
5. Tests: `tests/categoryTree.test.ts` (sort, slugs, rename/remove plans, counts) and a source test that the route, nav item and admin `includeHidden` calls exist.
6. Check: `node scripts/check.mjs`; screenshots of the page at 390 and 1440, light and dark; a live rename/hide/reorder round trip on the dev server against `iconoiq-85b53` with a throwaway category (then removed).
7. Port: the template and the other client store (same files; their category names differ, so only code moves).
