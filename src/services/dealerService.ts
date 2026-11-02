import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  DEFAULT_DEALER_PRICING,
  DEFAULT_DEALER_SETTINGS,
  normaliseDealerPricing,
  normaliseDealerSettings,
  type DealerPricing,
  type DealerSettings,
} from '@/lib/dealer';
import { cleanDealerApplication, type DealerApplicationInput } from '@/lib/dealerForm';

/*
 * Dealer Membership data. dealers/<uid> holds one application per customer;
 * only an admin changes its status (firestore.rules). siteSettings/dealer is
 * public (switch, minimum); dealerPricing/current is private (admins and
 * approved dealers). api/create-order.ts charges the prices; this file only
 * shows and edits them.
 */

export type DealerStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface DealerRecord extends DealerApplicationInput {
  uid: string;
  status: DealerStatus;
  appliedAtMs: number;
  reviewNote: string;
  reviewedAtMs: number;
  approvedAtMs: number;
}

const ms = (v: unknown) =>
  typeof (v as { toMillis?: () => number })?.toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : 0;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const STATUSES: DealerStatus[] = ['pending', 'approved', 'rejected', 'suspended'];

function toRecord(id: string, d: DocumentData): DealerRecord {
  return {
    uid: id,
    status: STATUSES.includes(d.status) ? d.status : 'pending',
    businessName: str(d.businessName),
    businessType: str(d.businessType),
    contactName: str(d.contactName),
    phone: str(d.phone),
    city: str(d.city),
    state: str(d.state),
    gstin: str(d.gstin),
    message: str(d.message),
    appliedAtMs: ms(d.appliedAt),
    reviewNote: str(d.reviewNote),
    reviewedAtMs: ms(d.reviewedAt),
    approvedAtMs: ms(d.approvedAt),
  };
}

const dealerRef = (uid: string) => doc(db, 'dealers', uid);
const settingsRef = doc(db, 'siteSettings', 'dealer');
const pricingRef = doc(db, 'dealerPricing', 'current');

/**
 * The three subscriptions below tell the caller whether the snapshot is an
 * answer. A document that is missing in a snapshot that came only from the
 * cache (Firestore is offline, or cannot reach the server) is not "this
 * document does not exist": `answered` is false. includeMetadataChanges makes
 * the server's answer arrive afterwards even when it says the same thing.
 */
const answered = (s: DocumentSnapshot) => !s.metadata.fromCache || s.exists();
const LIVE = { includeMetadataChanges: true } as const;

export function subscribeOwnDealer(uid: string, onNext: (r: DealerRecord | null, answered: boolean) => void, onError: (e: Error) => void) {
  return onSnapshot(
    dealerRef(uid),
    LIVE,
    (s) => onNext(s.exists() ? toRecord(s.id, s.data({ serverTimestamps: 'estimate' })) : null, answered(s)),
    onError,
  );
}

/** A new application, or a fresh one after a rejection (the rules allow exactly these writes). */
export async function applyAsDealer(uid: string, input: DealerApplicationInput, reapply: boolean) {
  const fields = { ...cleanDealerApplication(input), status: 'pending', appliedAt: serverTimestamp(), updatedAt: serverTimestamp() };
  if (reapply) await updateDoc(dealerRef(uid), fields);
  else await setDoc(dealerRef(uid), { uid, ...fields });
}

export const withdrawDealerApplication = (uid: string) => deleteDoc(dealerRef(uid));

export function subscribeDealerSettings(onNext: (s: DealerSettings, answered: boolean) => void, onError: (e: Error) => void) {
  return onSnapshot(settingsRef, LIVE, (s) => onNext(normaliseDealerSettings(s.exists() ? s.data() : null), answered(s)), onError);
}

/** A missing prices document means no fixed prices, only when `answered` (the server reads it the same way). */
export function subscribeDealerPricing(onNext: (p: DealerPricing, answered: boolean) => void, onError: (e: Error) => void) {
  return onSnapshot(pricingRef, LIVE, (s) => onNext(normaliseDealerPricing(s.exists() ? s.data() : null), answered(s)), onError);
}

export async function loadDealerAdminSettings(): Promise<{ settings: DealerSettings; pricing: DealerPricing }> {
  const [s, p] = await Promise.all([getDoc(settingsRef), getDoc(pricingRef)]);
  return {
    settings: s.exists() ? normaliseDealerSettings(s.data()) : { ...DEFAULT_DEALER_SETTINGS },
    pricing: p.exists() ? normaliseDealerPricing(p.data()) : { ...DEFAULT_DEALER_PRICING },
  };
}

/** The public switch and the margin tiers (minOrder is derived from the first tier). */
export async function saveDealerAdminSettings(settings: DealerSettings, wasEnabled: boolean) {
  const clean = normaliseDealerSettings(settings);
  await setDoc(
    settingsRef,
    { ...clean, ...(clean.enabled && !wasEnabled ? { enabledAt: serverTimestamp() } : {}), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** A product's fixed dealer price, and the first tier's percent (what a product without one gets at that tier). */
export async function getProductDealerPrice(productId: string): Promise<{ price: number | null; discountPercent: number }> {
  const [p, s] = await Promise.all([getDoc(pricingRef), getDoc(settingsRef)]);
  const pricing = normaliseDealerPricing(p.exists() ? p.data() : null);
  const settings = normaliseDealerSettings(s.exists() ? s.data() : null);
  return { price: pricing.productPrices[productId] ?? null, discountPercent: settings.tiers[0].percent };
}

/** Set or clear (null) one product's fixed dealer price. */
export async function setProductDealerPrice(productId: string, price: number | null) {
  if (price !== null && !(Number.isFinite(price) && price > 0)) throw new Error('Dealer price must be a number above 0');
  await setDoc(
    pricingRef,
    { productPrices: { [productId]: price === null ? deleteField() : Math.round(price * 100) / 100 }, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export function subscribeDealerApplications(onNext: (rows: DealerRecord[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    collection(db, 'dealers'),
    (snap) => onNext(snap.docs.map((d) => toRecord(d.id, d.data({ serverTimestamps: 'estimate' }))).sort((a, b) => b.appliedAtMs - a.appliedAtMs)),
    onError,
  );
}

export function subscribePendingDealerCount(onNext: (n: number) => void, onError: (e: Error) => void) {
  return onSnapshot(query(collection(db, 'dealers'), where('status', '==', 'pending')), (s) => onNext(s.size), onError);
}

export async function getDealerRecord(uid: string): Promise<DealerRecord | null> {
  const s = await getDoc(dealerRef(uid));
  return s.exists() ? toRecord(s.id, s.data({ serverTimestamps: 'estimate' })) : null;
}

const NEXT: Record<'approve' | 'reject' | 'suspend' | 'reinstate', DealerStatus> = {
  approve: 'approved',
  reject: 'rejected',
  suspend: 'suspended',
  reinstate: 'approved',
};

/** An admin decision. The note (up to 300 characters) is shown to the applicant when rejected or suspended. */
export async function reviewDealer(
  uid: string,
  action: keyof typeof NEXT,
  adminUid: string,
  note = '',
  firstApproval = false,
) {
  await updateDoc(dealerRef(uid), {
    status: NEXT[action],
    reviewNote: note.trim().slice(0, 300),
    reviewedAt: serverTimestamp(),
    reviewedBy: adminUid,
    updatedAt: serverTimestamp(),
    ...(action === 'approve' && firstApproval ? { approvedAt: serverTimestamp() } : {}),
  });
}
