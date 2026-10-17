import { useSyncExternalStore } from "react";
import { subscribeDeliverySettings } from "@/services/siteSettingsService";

/**
 * The order value above which delivery is free (Admin > Commerce > Delivery), for product cards.
 * Every card on a page shares ONE Firestore listener: it opens with the first card and closes
 * when the last one unmounts. `null` until the settings arrive, and when delivery is switched
 * off or has no free-delivery amount, so a card never promises free delivery on a guess.
 */
let threshold: number | null = null;
let stop: (() => void) | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!stop) {
    stop = subscribeDeliverySettings(
      (s) => {
        threshold = s.enabled && s.freeDeliveryAbove > 0 ? s.freeDeliveryAbove : null;
        listeners.forEach((l) => l());
      },
      () => {
        threshold = null;
        listeners.forEach((l) => l());
      },
    );
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && stop) {
      stop();
      stop = null;
    }
  };
}

export function useFreeDeliveryAbove(): number | null {
  return useSyncExternalStore(subscribe, () => threshold, () => null);
}
