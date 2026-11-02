import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { StockPurchaseLine, StockSale } from '@/lib/stockist';

/*
 * Stockist inventory (docs/specs/academy-dealership-programme.md, decision 10).
 * Bought = the items of the stockist's delivered dealer orders; sold = the
 * sales the stockist logs in dealers/<uid>/sales. Not money for the store:
 * nothing here changes a price or an order.
 */

const ms = (v: unknown) =>
  typeof (v as { toMillis?: () => number })?.toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : 0;

const toSale = (id: string, d: DocumentData): StockSale & { name: string } => ({
  id,
  productId: String(d.productId || ''),
  name: String(d.name || ''),
  qty: Math.max(0, Math.floor(Number(d.qty) || 0)),
  unitPrice: Number(d.unitPrice) || 0,
  atMs: ms(d.at),
});

export type LoggedSale = ReturnType<typeof toSale>;

/** The items of the stockist's delivered dealer orders, at today's regular prices. */
export async function loadStockPurchases(uid: string): Promise<StockPurchaseLine[]> {
  const snap = await getDocs(query(collection(db, 'orders'), where('userId', '==', uid)));
  const lines: { productId: string; name: string; quantity: number }[] = [];
  for (const d of snap.docs) {
    const o = d.data();
    if (o.status !== 'delivered' || o.pricing !== 'dealer' || !Array.isArray(o.items)) continue;
    for (const it of o.items) {
      if (it?.productId) lines.push({ productId: String(it.productId), name: String(it.name || ''), quantity: Number(it.quantity) || 0 });
    }
  }
  const ids = [...new Set(lines.map((l) => l.productId))];
  const prices = new Map<string, number>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const p = await getDoc(doc(db, 'products', id));
        prices.set(id, p.exists() ? Number(p.data().price) || 0 : 0);
      } catch {
        prices.set(id, 0);
      }
    }),
  );
  return lines.map((l) => ({ ...l, regularPrice: prices.get(l.productId) || 0 }));
}

export function subscribeStockSales(uid: string, onNext: (rows: LoggedSale[]) => void, onError: (e: Error) => void) {
  return onSnapshot(collection(db, 'dealers', uid, 'sales'), (s) => onNext(s.docs.map((d) => toSale(d.id, d.data({ serverTimestamps: 'estimate' })))), onError);
}

export async function loadStockSales(uid: string): Promise<LoggedSale[]> {
  const s = await getDocs(collection(db, 'dealers', uid, 'sales'));
  return s.docs.map((d) => toSale(d.id, d.data()));
}

/** Log a sale from stock (firestore.rules check the shape; the page checks stock left). */
export async function logStockSale(uid: string, sale: { productId: string; name: string; qty: number; unitPrice: number; atMs: number }) {
  const ref = doc(collection(db, 'dealers', uid, 'sales'));
  await setDoc(ref, {
    productId: sale.productId,
    name: sale.name.slice(0, 200),
    qty: Math.floor(sale.qty),
    unitPrice: Math.max(0, Number(sale.unitPrice) || 0),
    at: Timestamp.fromMillis(sale.atMs),
    createdAt: serverTimestamp(),
  });
}

export const deleteStockSale = (uid: string, saleId: string) => deleteDoc(doc(db, 'dealers', uid, 'sales', saleId));
