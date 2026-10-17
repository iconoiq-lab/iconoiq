import { useSyncExternalStore } from 'react';
import {
  DEFAULT_SUPPORT,
  subscribeCustomerSupportSettings,
  type CustomerSupportSettings,
} from '@/services/siteSettingsService';

/**
 * The store's live support details (phone, email, WhatsApp, hours, reply time), the ones the admin
 * edits in Admin > Commerce > Support. Every customer-facing phone, email and WhatsApp number reads
 * this hook instead of BRAND, so one admin edit reaches the footer, contact page, policies, order
 * receipt and WhatsApp buttons (tests/contact-follows-support.test.ts keeps pages off BRAND).
 *
 * Until the first read arrives (and when a read fails or no document is saved) the value is
 * DEFAULT_SUPPORT, which starts from BRAND, so the first paint already has the contact details.
 *
 * One Firestore listener is shared by every component using the hook; it opens with the first user
 * and closes with the last.
 */
let current: CustomerSupportSettings = DEFAULT_SUPPORT;
const listeners = new Set<() => void>();
let unsubscribe: (() => void) | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!unsubscribe) {
    unsubscribe = subscribeCustomerSupportSettings((next) => {
      current = next;
      listeners.forEach((notify) => notify());
    });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

const getSnapshot = () => current;

export function useCustomerSupport(): CustomerSupportSettings {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
