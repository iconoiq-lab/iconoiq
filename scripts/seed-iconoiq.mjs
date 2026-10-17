/**
 * Fill ICONOIQ's own Firebase project with the dummy catalogue from scripts/iconoiq/content.mjs (owner,
 * 2026-10-17: dummy products with ChatGPT photos until the real ones arrive in Phase 6).
 *
 *   node scripts/seed-iconoiq.mjs           # upload missing photos, replace every dummy doc
 *   node scripts/seed-iconoiq.mjs --remove  # delete every dummy doc (do this before launch)
 *   node scripts/seed-iconoiq.mjs --add-missing-products  # add only products whose slug is not there yet
 *     (product ids are random, so a full re-run breaks carts, wishlists and order links that point at them)
 *
 * Photos are the originals in client-brief/generated/ (git-ignored), cropped and compressed with sharp and
 * uploaded to Cloudinary with the unsigned preset. URLs are cached in scripts/iconoiq/images.json, so a
 * re-run reuses them; delete an entry to upload that photo again.
 *
 * Every document carries `demo: true`. Categories are the exception: they are the store's real starting
 * categories (DEFAULT_CATEGORIES, doc id = slug, as seedDefaultCategories writes them), created only when
 * missing and never removed. No testimonials: the store shows only real reviews.
 *
 * Needs: the project's admin key (FIREBASE_ADMIN_SDK_BASE64 in .env, or the *firebase-adminsdk*.json file in
 * the repo root, git-ignored), VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env.
 */
import 'dotenv/config';
import admin from 'firebase-admin';
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { PRODUCTS, HERO_BANNERS, SHOWCASES, COLLECTIONS, COLLECTION_BANNER } from './iconoiq/content.mjs';

// DEFAULT_CATEGORIES is a plain literal inside a browser module (it imports the Firebase web SDK), so read
// the literal from the source instead of importing the module.
const categorySource = readFileSync('src/services/categoryService.ts', 'utf8');
const categoryLiteral = categorySource.match(/export const DEFAULT_CATEGORIES[^=]*=\s*(\[[\s\S]*?\n\]);/)?.[1];
if (!categoryLiteral) throw new Error('DEFAULT_CATEGORIES not found in src/services/categoryService.ts');
const DEFAULT_CATEGORIES = new Function(`return ${categoryLiteral}`)();

const REMOVE = process.argv.includes('--remove');
const ADD_MISSING = process.argv.includes('--add-missing-products');
const CACHE_FILE = new URL('./iconoiq/images.json', import.meta.url);
const SOURCE_DIR = 'client-brief/generated';
const DEMO_COLLECTIONS = ['products', 'banners', 'showcases', 'homeCollections', 'homeBanners'];

const { FIREBASE_ADMIN_SDK_BASE64, VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET } = process.env;
const keyFile = readdirSync('.').find((f) => /firebase-adminsdk.*\.json$/.test(f));
const serviceAccount = FIREBASE_ADMIN_SDK_BASE64
  ? JSON.parse(Buffer.from(FIREBASE_ADMIN_SDK_BASE64, 'base64').toString('utf8'))
  : keyFile
    ? JSON.parse(readFileSync(keyFile, 'utf8'))
    : null;
if (!serviceAccount) {
  console.error('No admin key: set FIREBASE_ADMIN_SDK_BASE64 in .env or put the firebase-adminsdk json in the repo root');
  process.exit(1);
}
if (serviceAccount.project_id !== process.env.VITE_FIREBASE_PROJECT_ID) {
  console.error(`The admin key is for ${serviceAccount.project_id}, .env names ${process.env.VITE_FIREBASE_PROJECT_ID}: stopping`);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp;
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ── Photos ──────────────────────────────────────────────────────────────────

const KB = 1024;
const SIZES = {
  product: { out: [1000, 1000], max: 420 * KB },
  heroDesktop: { out: [1600, 900], max: 700 * KB },
  heroMobile: { out: [960, 1200], max: 600 * KB },
  showcase: { out: [1200, 800], max: 420 * KB },
  collection: { out: [900, 1200], max: 420 * KB },
  wide: { out: [1600, 640], max: 600 * KB },
};

async function compress(file, [width, height], maxBytes) {
  for (let quality = 84; quality >= 50; quality -= 6) {
    const out = await sharp(file)
      .resize(width, height, { fit: 'cover', position: 'attention' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (out.length <= maxBytes) return out;
  }
  throw new Error(`could not compress ${file} under ${maxBytes} bytes`);
}

async function upload(buffer, name) {
  if (!VITE_CLOUDINARY_CLOUD_NAME || !VITE_CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET missing from .env');
  }
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), `${name}.jpg`);
  form.append('upload_preset', VITE_CLOUDINARY_UPLOAD_PRESET);
  form.append('folder', `${serviceAccount.project_id}/dummy`);
  const resp = await fetch(`https://api.cloudinary.com/v1_1/${VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: form });
  const json = await resp.json();
  if (!resp.ok || !json.secure_url) throw new Error(`Cloudinary: ${json.error?.message || resp.status}`);
  return json.secure_url;
}

const cache = existsSync(CACHE_FILE) ? JSON.parse(await readFile(CACHE_FILE, 'utf8')) : {};

/** URL of one photo cropped to a slot; uploads only when the key + source + size isn't cached. */
async function photo(key, file, size) {
  const { out, max } = SIZES[size];
  const id = `${file}|${out.join('x')}`;
  if (cache[key]?.id === id) return cache[key].url;
  const path = `${SOURCE_DIR}/${file}`;
  if (!existsSync(path)) throw new Error(`missing photo ${path}`);
  console.log(`  uploading ${key}`);
  const url = await upload(await compress(path, out, max), key);
  cache[key] = { id, url };
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2) + '\n');
  return url;
}

// ── Firestore ───────────────────────────────────────────────────────────────

async function removeDummies() {
  let total = 0;
  for (const name of DEMO_COLLECTIONS) {
    const snap = await db.collection(name).where('demo', '==', true).get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    if (snap.size) console.log(`  removed ${snap.size} from ${name}`);
    total += snap.size;
  }
  return total;
}

async function ensureCategories() {
  for (const c of DEFAULT_CATEGORIES) {
    const ref = db.collection('categories').doc(c.slug);
    if ((await ref.get()).exists) continue;
    await ref.set({ ...c, createdAt: now(), updatedAt: now() });
    console.log(`  created category ${c.name}`);
  }
}

const FLAG_LETTERS = { T: 'isTopDeal', B: 'isBestSeller', F: 'isFeatured', N: 'isNewArrival', R: 'isTrendProduct' };

async function productDoc(p, i, base) {
  const flags = { isActive: true, isFeatured: false, isNewArrival: false, isBestSeller: false, isTopDeal: false, isTrendProduct: false };
  for (const letter of p.flags) flags[FLAG_LETTERS[letter]] = true;
  const url = await photo(`product-${slugify(p.name)}`, p.photo, 'product');
  // Staggered so "newest first" keeps the order written here.
  const createdAt = admin.firestore.Timestamp.fromMillis(base - i * 60_000);
  return {
    name: p.name,
    slug: slugify(p.name),
    barcode: null,
    category: p.category,
    subcategory: p.subcategory,
    subSubcategory: null,
    description: p.description,
    price: p.price,
    originalPrice: p.originalPrice,
    discount: 0,
    currency: 'INR',
    media: { images: [url], videos: [], thumbnail: url },
    inventory: { stock: p.stock, sku: '', weight: p.weight, weightUnit: 'grams' },
    specifications: p.specs,
    flags,
    inactiveReason: null,
    delivery: null,
    silverPricing: { enabled: false },
    createdBy: 'seed-iconoiq',
    createdAt,
    updatedAt: createdAt,
  };
}

async function writeDummies() {
  const batch = db.batch();
  const add = (collection, data) => batch.set(db.collection(collection).doc(), { ...data, demo: true });
  const base = Date.now();

  for (const [i, p] of PRODUCTS.entries()) add('products', await productDoc(p, i, base));

  for (const [i, b] of HERO_BANNERS.entries()) {
    add('banners', {
      imageUrl: await photo(`hero-${i + 1}-desktop`, b.photo, 'heroDesktop'),
      mobileImageUrl: await photo(`hero-${i + 1}-mobile`, b.photo, 'heroMobile'),
      redirectLink: b.link,
      order: i,
      status: 'active',
      createdAt: now(),
      updatedAt: now(),
    });
  }

  for (const [i, s] of SHOWCASES.entries()) {
    const { photo: file, ...rest } = s;
    add('showcases', { ...rest, imageUrl: await photo(`showcase-${i + 1}`, file, 'showcase'), order: i, status: 'active', createdAt: now(), updatedAt: now() });
  }

  for (const [i, c] of COLLECTIONS.entries()) {
    add('homeCollections', {
      eyebrow: c.eyebrow,
      title: c.title,
      subtitle: c.subtitle,
      ctaLabel: 'Explore',
      ctaLink: c.link,
      imageUrl: await photo(`collection-${i + 1}`, c.photo, 'collection'),
      active: true,
      order: i,
      createdAt: now(),
      updatedAt: now(),
    });
  }

  const { photo: wideFile, ...wide } = COLLECTION_BANNER;
  add('homeBanners', { ...wide, slot: 'collection-wide', imageUrl: await photo('collection-wide', wideFile, 'wide'), active: true, order: 0, createdAt: now(), updatedAt: now() });

  await batch.commit();
}

// ── Main ────────────────────────────────────────────────────────────────────

if (REMOVE) {
  const n = await removeDummies();
  console.log(`Removed ${n} dummy documents. (Cloudinary files stay: an unsigned preset can't delete.)`);
  process.exit(0);
}

console.log(`Project ${serviceAccount.project_id}:`);
await ensureCategories();
if (ADD_MISSING) {
  const have = new Set((await db.collection('products').where('demo', '==', true).get()).docs.map((d) => d.get('slug')));
  const base = Date.now();
  let added = 0;
  for (const [i, p] of PRODUCTS.entries()) {
    if (have.has(slugify(p.name))) continue;
    await db.collection('products').doc().set({ ...(await productDoc(p, i, base)), demo: true });
    console.log(`  added ${p.name}`);
    added += 1;
  }
  console.log(`Added ${added} products (demo: true); everything else left as it was.`);
  process.exit(0);
}
await removeDummies();
await writeDummies();
console.log(`Wrote ${PRODUCTS.length} products, ${HERO_BANNERS.length} hero banners, ${SHOWCASES.length} showcases, ${COLLECTIONS.length} collections and 1 wide banner (all demo: true).`);
process.exit(0);
