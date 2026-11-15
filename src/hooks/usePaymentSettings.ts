import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { DEFAULT_PAYMENT_SETTINGS, normalisePaymentSettings, type PaymentSettings } from '@/lib/paymentMode';

/** The live payment switch (siteSettings/payment, public read). Razorpay until it loads or if it cannot be read. */
export function usePaymentSettings(): PaymentSettings & { loading: boolean } {
  const [state, setState] = useState<PaymentSettings & { loading: boolean }>({ ...DEFAULT_PAYMENT_SETTINGS, loading: true });
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'siteSettings', 'payment'),
        (snap) => setState({ ...normalisePaymentSettings(snap.data()), loading: false }),
        () => setState({ ...DEFAULT_PAYMENT_SETTINGS, loading: false }),
      ),
    [],
  );
  return state;
}
