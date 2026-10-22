import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  sortCategories,
  moveItem,
  nameProblem,
  uniqueSlug,
  productsIn,
  renamePlan,
  removeFooterLinks,
  couponsLimitedTo,
} from '../src/lib/categoryTree.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const sub1 = { name: 'Sub One', slug: 'sub-one' };
const sub2 = { name: 'Sub Two', slug: 'sub-two' };
const catA = { name: 'Category A', slug: 'category-a', subcategories: [sub1, sub2] };
const catB = { name: 'Category B', slug: 'category-b', subcategories: [{ name: 'Sub One', slug: 'sub-one' }] };
const all = [catA, catB];

test('sortCategories: saved order first, then the default order, then arrival order', () => {
  const cats = [
    { slug: 'extra-1' },
    { slug: 'second' },
    { slug: 'first' },
    { slug: 'moved', order: 0 },
    { slug: 'extra-2' },
  ];
  const out = sortCategories(cats, ['first', 'second']).map((c) => c.slug);
  assert.deepEqual(out, ['moved', 'first', 'second', 'extra-1', 'extra-2']);
});

test('sortCategories: a store with no saved order keeps the default order', () => {
  const out = sortCategories([{ slug: 'b' }, { slug: 'a' }], ['a', 'b']).map((c) => c.slug);
  assert.deepEqual(out, ['a', 'b']);
});

test('moveItem swaps with the neighbour and leaves the edges alone', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 1, -1), ['b', 'a', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 1, 1), ['a', 'c', 'b']);
  const list = ['a', 'b'];
  assert.equal(moveItem(list, 0, -1), list);
  assert.equal(moveItem(list, 1, 1), list);
});

test('nameProblem: empty, too long, no letters, duplicate (any case), and renaming to itself', () => {
  const sibs = [{ name: 'Category A' }, { name: 'Category B' }];
  assert.equal(nameProblem('   ', sibs), 'Type a name.');
  assert.equal(nameProblem('x'.repeat(41), sibs), 'Keep it under 40 characters.');
  assert.equal(nameProblem('&&&', sibs), 'Use at least one letter or number.');
  assert.equal(nameProblem('  category   a ', sibs), '"category a" is already in the list.');
  assert.equal(nameProblem('Category A', sibs, sibs[0]), null);
  assert.equal(nameProblem('Category C', sibs), null);
});

test('uniqueSlug adds -2, -3 when the slug is taken', () => {
  assert.equal(uniqueSlug('new', ['old']), 'new');
  assert.equal(uniqueSlug('new', ['new', 'new-2']), 'new-3');
});

test('productsIn matches products stored by name or slug, and narrows to a subcategory', () => {
  const products = [
    { id: '1', category: 'Category A', subcategory: 'Sub One' },
    { id: '2', category: 'category-a', subcategory: 'sub-two' },
    { id: '3', category: 'Category B', subcategory: 'Sub One' },
    { id: '4', category: null },
  ];
  assert.deepEqual(productsIn(products, catA, all).map((p) => p.id), ['1', '2']);
  assert.deepEqual(productsIn(products, catA, all, sub1).map((p) => p.id), ['1']);
  assert.deepEqual(productsIn(products, catB, all, catB.subcategories[0]).map((p) => p.id), ['3']);
});

test('renamePlan (category) rewrites products, coupons and footer links that use the old name', () => {
  const plan = renamePlan({
    cat: catA,
    all,
    newName: 'Category Z',
    products: [
      { id: '1', category: 'Category A' },
      { id: '2', category: 'category-a' },
      { id: '3', category: 'Category B' },
    ],
    coupons: [
      { id: 'c1', applicableCategories: ['category a', 'Category B'] },
      { id: 'c2', applicableCategories: ['Category B'] },
    ],
    footerLinks: ['Category A', 'Shop all'],
  });
  assert.deepEqual(plan.products, [
    { id: '1', data: { category: 'Category Z' } },
    { id: '2', data: { category: 'Category Z' } },
  ]);
  assert.deepEqual(plan.coupons, [{ id: 'c1', data: { applicableCategories: ['Category Z', 'Category B'] } }]);
  assert.deepEqual(plan.footerLinks, ['Category Z', 'Shop all']);
});

test('renamePlan (subcategory) stays inside its own category', () => {
  const plan = renamePlan({
    cat: catA,
    all,
    sub: sub1,
    newName: 'Sub Renamed',
    products: [
      { id: '1', category: 'Category A', subcategory: 'Sub One' },
      { id: '3', category: 'Category B', subcategory: 'Sub One' },
    ],
    coupons: [
      { id: 'c1', applicableCategories: ['Category A'], applicableSubcategories: ['Sub One'] },
      { id: 'c2', applicableCategories: ['Category B'], applicableSubcategories: ['Sub One'] },
    ],
    footerLinks: ['Category A'],
  });
  assert.deepEqual(plan.products, [{ id: '1', data: { subcategory: 'Sub Renamed' } }]);
  assert.deepEqual(plan.coupons, [{ id: 'c1', data: { applicableSubcategories: ['Sub Renamed'] } }]);
  assert.equal(plan.footerLinks, null);
});

test('removeFooterLinks drops the name (any case) and reports no change as null', () => {
  assert.deepEqual(removeFooterLinks(['Category A', 'Shop all'], 'category a'), ['Shop all']);
  assert.equal(removeFooterLinks(['Shop all'], 'Category A'), null);
});

test('couponsLimitedTo names the coupons a removal would leave matching nothing', () => {
  const coupons = [
    { id: 'c1', applicableCategories: ['Category A'] },
    { id: 'c2', applicableCategories: [] },
  ];
  assert.deepEqual(couponsLimitedTo(coupons, catA).map((c) => c.id), ['c1']);
});

test('Admin > Categories is routed, in the menu, and admin pickers still list hidden categories', () => {
  assert.match(read('src/App.tsx'), /path="categories" element={<AdminCategories \/>}/);
  assert.match(read('src/pages/admin/AdminLayout.tsx'), /path: '\/admin\/categories'/);
  for (const page of ['ProductForm', 'Products', 'AdminCoupons', 'AdminShowcases', 'AdminCategories']) {
    assert.match(read(`src/pages/admin/${page}.tsx`), /includeHidden: true/, `${page} must list hidden categories`);
  }
});
