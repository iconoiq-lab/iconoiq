import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  DEFAULT_COIN_SETTINGS,
  normaliseCoinSettings,
  readOrderCoinGift,
  type CoinGiftSettings,
  type OrderCoinGift,
} from '@/lib/coinGift';
import { rewardsAction } from '@/services/rewardsService';

/**
 * Lakshmi coin card, browser side. api/notify-order.ts decides the coin when a
 * paid order is reconciled and mirrors it onto orders/<id>.coinGift; customers
 * can only read it (firestore.rules). Spec: docs/specs/lakshmi-coin-gift.md.
 */

const settingsRef = () => doc(db, 'siteSettings', 'coinGift');

/** The shop's settings, live. A failed read gives the defaults, which are off. */
export const subscribeCoinSettings = (cb: (s: CoinGiftSettings) => void) =>
  onSnapshot(
    settingsRef(),
    (snap) => cb(normaliseCoinSettings(snap.exists() ? (snap.data() as Partial<CoinGiftSettings>) : null)),
    () => cb(DEFAULT_COIN_SETTINGS),
  );

/** Throws when the settings cannot be read, so the admin form never mistakes defaults for saved values. */
export const getCoinSettings = async (): Promise<CoinGiftSettings> => {
  const snap = await getDoc(settingsRef());
  return normaliseCoinSettings(snap.exists() ? (snap.data() as Partial<CoinGiftSettings>) : null);
};

/**
 * Save the settings. Turning the switch on stamps enabledAt: orders paid while
 * it was off get no coin. Whether it was on is read from the saved document.
 */
export const saveCoinSettings = (s: CoinGiftSettings) => {
  const next = normaliseCoinSettings(s);
  return runTransaction(db, async (tx) => {
    const wasOn = (await tx.get(settingsRef())).data()?.enabled === true;
    tx.set(
      settingsRef(),
      { ...next, ...(next.enabled && !wasOn ? { enabledAt: serverTimestamp() } : {}), updatedAt: serverTimestamp() },
      { merge: true },
    );
  });
};

/** One order's coin, live (null while there is none). Errors count as none. */
export const subscribeOrderCoin = (orderId: string, cb: (coin: OrderCoinGift | null) => void) =>
  onSnapshot(
    doc(db, 'orders', orderId),
    (snap) => cb(snap.exists() ? readOrderCoinGift(snap.data()?.coinGift) : null),
    () => cb(null),
  );

/** Tell the server the customer scratched the card. Never throws; false when it could not be saved. */
export async function revealCoin(orderId: string): Promise<boolean> {
  const r = await rewardsAction({ action: 'coin-reveal', orderId });
  return r.ok;
}
