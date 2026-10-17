import { useSyncExternalStore } from 'react';
import { isOn } from '@/config/features';
import { DEFAULT_REWARD_SETTINGS, type RewardSettings } from '@/lib/rewards';
import { subscribeRewardSettings } from '@/services/rewardsService';

/*
 * The shop's live reward settings, for pages that only need to know whether the
 * programme is running: the header, home-page strips, sign-up and /wallet.
 * (useRewards also reads them, with the customer's whole ledger; use that one
 * where the ledger is needed.) One listener is shared by the whole session and
 * stays open, because every page renders its own header and a listener per
 * mount would reopen on each navigation. Anyone can read siteSettings
 * (firestore.rules), so this works for signed-out visitors too.
 *
 * Until the first read, and if the read fails, the value is the default,
 * which is off. A promise of points therefore never flashes up for a store
 * that has not turned rewards on.
 */

let current: RewardSettings = DEFAULT_REWARD_SETTINGS;
let started = false;
const listeners = new Set<() => void>();

const start = () => {
  if (started) return;
  started = true;
  subscribeRewardSettings((next) => {
    current = next;
    listeners.forEach((l) => l());
  });
};

const subscribe = (l: () => void) => {
  start();
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useRewardSettings(): RewardSettings {
  return useSyncExternalStore(subscribe, () => current, () => DEFAULT_REWARD_SETTINGS);
}

/**
 * True when customers may be told they earn points: the store has the rewards
 * feature AND the admin has turned the programme on. Use it for every promise
 * of points, loyalty tiers or rewards.
 */
export function useRewardsLive(): boolean {
  const { enabled } = useRewardSettings();
  return isOn('rewards') && enabled;
}

/**
 * What /wallet holds right now, for its links and title: rewards only while they
 * are running, gift cards while that feature is on.
 */
export function useWalletLabel(): string {
  const rewards = useRewardsLive();
  if (rewards) return 'Wallet & rewards';
  return isOn('giftCards') ? 'Wallet & gift cards' : 'Wallet';
}
