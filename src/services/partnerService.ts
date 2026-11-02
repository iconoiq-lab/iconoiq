import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { rewardsAction } from '@/services/rewardsService';
import {
  PARTNER_CODE_RE,
  claimId,
  cleanPartnerCode,
  normalisePartnerSettings,
  partnerView,
  DEFAULT_PERK_RULES,
  type ClaimLike,
  type EarningRow,
  type PartnerSettings,
  type PartnerTier,
  type PayoutLike,
  type PerkId,
} from '@/lib/partner';
import { getCouponByCode } from '@/services/couponService';

/*
 * Academy partner programme data (docs/specs/academy-dealership-programme.md).
 * partners/<uid> is the application and, once approved, the partner record.
 * The server (api/notify-order.ts) writes the earnings and the totals; this
 * file never writes money the partner earns. firestore.rules enforce it.
 * ICONOIQ's sales value lives on partnerPrivate/<uid> (admin and server only,
 * spec decision 6); the partner's doc carries only derived values.
 */

export type PartnerStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface PartnerApplicationInput {
  name: string;
  business: string;
  phone: string;
  city: string;
  state: string;
}

export interface PartnerRecord extends PartnerApplicationInput {
  uid: string;
  status: PartnerStatus;
  code: string;
  tier: PartnerTier;
  tierOverride: PartnerTier | null;
  appliedAtMs: number;
  approvedAtMs: number;
  reviewedAtMs: number;
  reviewNote: string;
  /** Server-maintained, derived from the private sales value (spec decision 6). */
  silverGrams: number;
  perksUnlocked: PerkId[];
  /** Admin screens only, from partnerPrivate/<uid>. Never on the partner's own doc. */
  lifetimeSales?: number;
  /** Admin only: sales past their return window, what unlocks perks, silver and Gold. */
  unlockedSales?: number;
  /** When the next order leaves its return window (0: none waiting). */
  viewsDueAtMs: number;
  unitsSold: number;
  earnedTotal: number;
  familySavings: number;
}

export interface PayoutRow extends PayoutLike {
  paidOnMs: number;
  note: string;
}

export interface ClaimRow extends ClaimLike {
  /** partners/<uid>/claims/<id>, for the admin queue. */
  path: string;
  partnerUid: string;
  fulfilledAtMs: number;
}

const ms = (v: unknown) =>
  typeof (v as { toMillis?: () => number })?.toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : 0;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const STATUSES: PartnerStatus[] = ['pending', 'approved', 'rejected', 'suspended'];
const tierOf = (v: unknown): PartnerTier | null => (v === 'gold' || v === 'silver' ? v : null);

function toRecord(id: string, d: DocumentData): PartnerRecord {
  return {
    uid: id,
    status: STATUSES.includes(d.status) ? d.status : 'pending',
    name: str(d.name),
    business: str(d.business),
    phone: str(d.phone),
    city: str(d.city),
    state: str(d.state),
    code: str(d.code),
    tier: tierOf(d.tier) ?? 'silver',
    tierOverride: tierOf(d.tierOverride),
    appliedAtMs: ms(d.appliedAt),
    approvedAtMs: ms(d.approvedAt),
    reviewedAtMs: ms(d.reviewedAt),
    reviewNote: str(d.reviewNote),
    silverGrams: num(d.silverGrams),
    perksUnlocked: Array.isArray(d.perksUnlocked) ? d.perksUnlocked.filter((p: unknown): p is PerkId => typeof p === 'string' && p in DEFAULT_PERK_RULES) : [],
    unitsSold: num(d.unitsSold),
    earnedTotal: num(d.earnedTotal),
    familySavings: num(d.familySavings),
    viewsDueAtMs: ms(d.viewsDueAt),
  };
}

const toEarning = (id: string, d: DocumentData): EarningRow => ({
  id,
  amount: num(d.amount),
  rate: num(d.rate),
  units: num(d.units),
  family: d.family === true,
  savings: num(d.savings),
  state: d.state === 'void' || d.state === 'held' ? d.state : 'active',
  month: str(d.month),
  unlockAtMs: ms(d.unlockAt),
});

const toPayout = (id: string, d: DocumentData): PayoutRow => ({
  id,
  amount: num(d.amount),
  receivedAtMs: ms(d.receivedAt) || undefined,
  paidOnMs: ms(d.paidOn) || ms(d.createdAt),
  note: str(d.note),
});

const toClaim = (path: string, d: DocumentData): ClaimRow => {
  const parts = path.split('/');
  return {
    id: parts[parts.length - 1],
    path,
    partnerUid: parts[1] || '',
    perk: d.perk,
    index: typeof d.index === 'number' ? d.index : undefined,
    month: typeof d.month === 'string' ? d.month : undefined,
    from: typeof d.from === 'number' ? d.from : undefined,
    to: typeof d.to === 'number' ? d.to : undefined,
    status: d.status === 'fulfilled' ? 'fulfilled' : 'requested',
    createdAtMs: ms(d.createdAt),
    fulfilledAtMs: ms(d.fulfilledAt),
  };
};

const partnerRef = (uid: string) => doc(db, 'partners', uid);
const settingsRef = doc(db, 'partnerSettings', 'main');
const answered = (s: DocumentSnapshot) => !s.metadata.fromCache || s.exists();
const LIVE = { includeMetadataChanges: true } as const;
const est = { serverTimestamps: 'estimate' } as const;

// ─── The partner's own data ────────────────────────────────────────────────

export function subscribeOwnPartner(uid: string, onNext: (r: PartnerRecord | null, answered: boolean) => void, onError: (e: Error) => void) {
  return onSnapshot(partnerRef(uid), LIVE, (s) => onNext(s.exists() ? toRecord(s.id, s.data(est)) : null, answered(s)), onError);
}

export function subscribePartnerSettings(onNext: (s: PartnerSettings, answered: boolean) => void, onError: (e: Error) => void) {
  return onSnapshot(settingsRef, LIVE, (s) => onNext(normalisePartnerSettings(s.exists() ? s.data() : null), answered(s)), onError);
}

export function cleanPartnerApplication(input: PartnerApplicationInput): PartnerApplicationInput {
  const t = (v: string, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  return {
    name: t(input.name, 60),
    business: t(input.business, 80),
    phone: String(input.phone ?? '').replace(/[^\d+ ]/g, '').trim().slice(0, 16),
    city: t(input.city, 60),
    state: t(input.state, 40),
  };
}

/** A new application, or a fresh one after a rejection (the rules allow exactly these writes). */
export async function applyAsPartner(uid: string, input: PartnerApplicationInput, reapply: boolean) {
  const fields = { ...cleanPartnerApplication(input), status: 'pending', appliedAt: serverTimestamp(), updatedAt: serverTimestamp() };
  if (reapply) await updateDoc(partnerRef(uid), fields);
  else await setDoc(partnerRef(uid), { uid, ...fields });
}

export const withdrawPartnerApplication = (uid: string) => deleteDoc(partnerRef(uid));

export function subscribeEarnings(uid: string, onNext: (rows: EarningRow[]) => void, onError: (e: Error) => void) {
  return onSnapshot(collection(db, 'partners', uid, 'earnings'), (s) => onNext(s.docs.map((d) => toEarning(d.id, d.data(est)))), onError);
}

export function subscribePayouts(uid: string, onNext: (rows: PayoutRow[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    collection(db, 'partners', uid, 'payouts'),
    (s) => onNext(s.docs.map((d) => toPayout(d.id, d.data(est))).sort((a, b) => b.paidOnMs - a.paidOnMs)),
    onError,
  );
}

export function subscribeClaims(uid: string, onNext: (rows: ClaimRow[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    collection(db, 'partners', uid, 'claims'),
    (s) => onNext(s.docs.map((d) => toClaim(d.ref.path, d.data(est))).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))),
    onError,
  );
}

/** The partner confirms a payout arrived. Once only (firestore.rules). */
export const confirmPayoutReceived = (uid: string, payoutId: string) =>
  updateDoc(doc(db, 'partners', uid, 'payouts', payoutId), { receivedAt: serverTimestamp() });

/** A perk request. The id is fixed per claim, so the same claim cannot be made twice. */
export async function requestPerk(uid: string, perk: PerkId, opts: { index?: number; month?: string } = {}) {
  const id = claimId(perk, opts);
  const extra = opts.index !== undefined ? { index: opts.index } : opts.month ? { month: opts.month } : {};
  await setDoc(doc(db, 'partners', uid, 'claims', id), { perk, ...extra, status: 'requested', createdAt: serverTimestamp() });
}

/** Claim the silver coins earned and not yet claimed: grams [from, to). */
export async function claimSilver(uid: string, pot: { earned: number; claimed: number; lastFrom: number | null }) {
  if (pot.earned <= pot.claimed) throw new Error('No silver coins to claim yet.');
  await setDoc(doc(db, 'partners', uid, 'claims', `silver_${pot.claimed}`), {
    perk: 'silver',
    from: pot.claimed,
    to: pot.earned,
    ...(pot.claimed > 0 && pot.lastFrom !== null ? { prev: pot.lastFrom } : {}),
    status: 'requested',
    createdAt: serverTimestamp(),
  });
}

// ─── Admin ─────────────────────────────────────────────────────────────────

/** Every partner, with the private sales value merged in (admin only). */
export function subscribePartners(onNext: (rows: PartnerRecord[]) => void, onError: (e: Error) => void) {
  let docs: DocumentSnapshot[] | null = null;
  let sales: Map<string, { lifetimeSales: number; unlockedSales: number }> | null = null;
  const emit = () => {
    if (!docs || !sales) return;
    const s = sales;
    onNext(
      docs
        .map((d) => ({ ...toRecord(d.id, d.data(est) ?? {}), lifetimeSales: 0, unlockedSales: 0, ...s.get(d.id) }))
        .sort((a, b) => b.appliedAtMs - a.appliedAtMs),
    );
  };
  const off1 = onSnapshot(collection(db, 'partners'), (s) => { docs = s.docs; emit(); }, onError);
  const off2 = onSnapshot(
    collection(db, 'partnerPrivate'),
    (s) => {
      sales = new Map(s.docs.map((d) => [d.id, { lifetimeSales: num(d.data().lifetimeSales), unlockedSales: num(d.data().unlockedSales) }]));
      emit();
    },
    onError,
  );
  return () => { off1(); off2(); };
}

export function subscribePendingPartnerCount(onNext: (n: number) => void, onError: (e: Error) => void) {
  return onSnapshot(query(collection(db, 'partners'), where('status', '==', 'pending')), (s) => onNext(s.size), onError);
}

/** Every claim of every partner, newest first (the admin's queue). */
export function subscribeAllClaims(onNext: (rows: ClaimRow[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    collectionGroup(db, 'claims'),
    (s) =>
      onNext(
        s.docs
          .filter((d) => d.ref.path.startsWith('partners/'))
          .map((d) => toClaim(d.ref.path, d.data(est)))
          .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)),
      ),
    onError,
  );
}

export const fulfilClaim = (path: string, adminUid: string) =>
  updateDoc(doc(db, path), { status: 'fulfilled', fulfilledAt: serverTimestamp(), fulfilledBy: adminUid });

export async function loadPartnerMoney(uid: string): Promise<{ earnings: EarningRow[]; payouts: PayoutRow[] }> {
  const [e, p] = await Promise.all([
    getDocs(collection(db, 'partners', uid, 'earnings')),
    getDocs(query(collection(db, 'partners', uid, 'payouts'), orderBy('createdAt', 'desc'))),
  ]);
  return { earnings: e.docs.map((d) => toEarning(d.id, d.data())), payouts: p.docs.map((d) => toPayout(d.id, d.data())) };
}

/**
 * Why a code cannot be used, or null when it is free for this partner: the
 * format, another partner's code, or a store coupon with the same code.
 */
export async function partnerCodeProblem(code: string, uid: string): Promise<string | null> {
  if (!PARTNER_CODE_RE.test(code)) return 'Use 4 to 16 letters and numbers.';
  const link = await getDoc(doc(db, 'partnerCodes', code));
  if (link.exists() && link.data().uid !== uid) return 'Another partner has this code.';
  if (await getCouponByCode(code)) return 'A store coupon has this code.';
  return null;
}

/** Approve (or change the code of) a partner: the code is reserved in partnerCodes in the same write. */
export async function approvePartner(record: PartnerRecord, rawCode: string, adminUid: string) {
  const code = cleanPartnerCode(rawCode);
  const problem = await partnerCodeProblem(code, record.uid);
  if (problem) throw new Error(problem);
  const batch = writeBatch(db);
  if (record.code && record.code !== code) batch.delete(doc(db, 'partnerCodes', record.code));
  batch.set(doc(db, 'partnerCodes', code), { uid: record.uid, active: true, updatedAt: serverTimestamp() });
  batch.update(partnerRef(record.uid), {
    status: 'approved',
    code,
    reviewNote: '',
    reviewedAt: serverTimestamp(),
    reviewedBy: adminUid,
    updatedAt: serverTimestamp(),
    ...(record.approvedAtMs ? {} : { approvedAt: serverTimestamp(), tier: 'silver' }),
  });
  await batch.commit();
}

/** Reject, suspend or reinstate. A suspended or rejected partner's code stops working at checkout. */
export async function reviewPartner(record: PartnerRecord, action: 'reject' | 'suspend' | 'reinstate', adminUid: string, note = '') {
  const status: PartnerStatus = action === 'reject' ? 'rejected' : action === 'suspend' ? 'suspended' : 'approved';
  const batch = writeBatch(db);
  batch.update(partnerRef(record.uid), {
    status,
    reviewNote: note.trim().slice(0, 300),
    reviewedAt: serverTimestamp(),
    reviewedBy: adminUid,
    updatedAt: serverTimestamp(),
  });
  if (record.code) batch.set(doc(db, 'partnerCodes', record.code), { uid: record.uid, active: status === 'approved', updatedAt: serverTimestamp() });
  await batch.commit();
}

/** Force a tier (null = automatic from unlocked sales). The server applies it from the next delivered order. */
export async function setPartnerTierOverride(uid: string, tier: PartnerTier | null) {
  const [priv, raw] = await Promise.all([getDoc(doc(db, 'partnerPrivate', uid)), getDoc(settingsRef)]);
  const view = partnerView(num(priv.data()?.unlockedSales), raw.exists() ? raw.data() : null, tier);
  await updateDoc(partnerRef(uid), { tierOverride: tier, tier: view.tier, updatedAt: serverTimestamp() });
}

/**
 * After the admin changes the thresholds, re-derive what every partner sees
 * (tier, silver grams, unlocked perks) from the private sales value, so the
 * partner screens never wait for the next delivered order.
 */
export async function refreshPartnerViews() {
  const [partners, priv, raw] = await Promise.all([getDocs(collection(db, 'partners')), getDocs(collection(db, 'partnerPrivate')), getDoc(settingsRef)]);
  const settings = raw.exists() ? raw.data() : null;
  const sales = new Map(priv.docs.map((d) => [d.id, num(d.data().unlockedSales)]));
  const approved = partners.docs.filter((d) => d.data().status === 'approved');
  for (let i = 0; i < approved.length; i += 400) {
    const batch = writeBatch(db);
    for (const d of approved.slice(i, i + 400)) {
      batch.update(d.ref, { ...partnerView(sales.get(d.id) ?? 0, settings, d.data().tierOverride), updatedAt: serverTimestamp() });
    }
    await batch.commit();
  }
}

/**
 * Ask the server to recompute a partner's figures (unlocked sales, tier,
 * silver grams, perks) now: a return window may have ended since the last
 * delivered order. Without uid, the caller's own; an admin may pass any.
 * Never throws; false when the server could not do it.
 */
export async function refreshPartnerFigures(uid?: string): Promise<boolean> {
  const r = await rewardsAction({ action: 'refresh-partner', ...(uid ? { uid } : {}) });
  return r.ok;
}

/** Record money sent to a partner. The partner then confirms it with Received. */
export async function recordPayout(uid: string, input: { amount: number; paidOnMs: number; note: string }, adminUid: string) {
  const amount = Math.round((Number(input.amount) || 0) * 100) / 100;
  if (!(amount > 0)) throw new Error('Enter an amount above ₹0.');
  const ref = doc(collection(db, 'partners', uid, 'payouts'));
  await setDoc(ref, {
    amount,
    paidOn: Timestamp.fromMillis(input.paidOnMs || Date.now()),
    note: input.note.trim().slice(0, 200),
    createdAt: serverTimestamp(),
    createdBy: adminUid,
  });
}

export async function loadPartnerSettings(): Promise<PartnerSettings> {
  const s = await getDoc(settingsRef);
  return normalisePartnerSettings(s.exists() ? s.data() : null);
}

export async function savePartnerSettings(settings: PartnerSettings) {
  await setDoc(settingsRef, { ...normalisePartnerSettings(settings), updatedAt: serverTimestamp() }, { merge: true });
  await refreshPartnerViews();
}
