import { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { CreditCard, QrCode, Save } from 'lucide-react';
import { db } from '@/config/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Spinner } from '@/components/ui/spinner';
import { FormSkeleton } from '@/components/skeletons';
import { describeError } from '@/lib/errorMessage';
import {
  DEFAULT_PAYMENT_SETTINGS,
  normalisePaymentSettings,
  upiSettingsProblem,
  type PaymentMode,
  type PaymentSettings,
} from '@/lib/paymentMode';
import { cn } from '@/lib/utils';

const MODES: { value: PaymentMode; title: string; text: string; icon: typeof CreditCard }[] = [
  {
    value: 'razorpay',
    title: 'Razorpay (automatic)',
    text: 'Cards, UPI, wallets and net banking. Payments are confirmed automatically. Needs the Razorpay keys.',
    icon: CreditCard,
  },
  {
    value: 'upi',
    title: 'UPI QR (checked by hand)',
    text: 'Customers scan a QR for the exact amount and send the UTR and a screenshot. You approve each payment in the order. Points and cashback cannot be spent.',
    icon: QrCode,
  },
];

/** Admin > Commerce settings > Payments: which way customers pay (siteSettings/payment). */
export function PaymentSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'siteSettings', 'payment'))
      .then((snap) => setS(normalisePaymentSettings(snap.data())))
      .catch((e) => toast.error('Could not load payment settings', { description: describeError(e) }))
      .finally(() => setLoading(false));
  }, []);

  const problem = upiSettingsProblem(s);

  const save = async () => {
    setTried(true);
    if (problem) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'siteSettings', 'payment'), {
        mode: s.mode,
        upiId: s.upiId.trim(),
        payeeName: s.payeeName.trim(),
        updatedAt: serverTimestamp(),
      });
      toast.success(s.mode === 'upi' ? 'Checkout now takes UPI QR payments' : 'Checkout now takes Razorpay payments');
    } catch (e) {
      toast.error('Could not save payment settings', { description: describeError(e) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-card border border-border bg-card p-4 sm:p-6">
        <FormSkeleton fields={3} label="Loading payment settings" />
      </div>
    );
  }

  return (
    <section className="space-y-6 rounded-card border border-border bg-card p-4 shadow-sm sm:p-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">How customers pay</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Checkout uses one way at a time. Switching takes effect at once.</p>
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Payment method</legend>
        {MODES.map((m) => (
          <label
            key={m.value}
            className={cn(
              'flex cursor-pointer gap-3 rounded-card border-2 p-4 transition-colors',
              s.mode === m.value ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/30',
            )}
          >
            <input
              type="radio"
              name="payment-mode"
              value={m.value}
              checked={s.mode === m.value}
              onChange={() => setS((p) => ({ ...p, mode: m.value }))}
              className="mt-1 size-4 flex-shrink-0 accent-primary"
            />
            <span>
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <m.icon aria-hidden="true" className="h-4 w-4" /> {m.title}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{m.text}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pay-upi-id">UPI ID</Label>
          <Input
            id="pay-upi-id"
            placeholder="shopname@okaxis"
            autoComplete="off"
            value={s.upiId}
            onChange={(e) => setS((p) => ({ ...p, upiId: e.target.value.trim() }))}
          />
          <p className="text-xs text-muted-foreground">The ID money goes to. Customers see it under the QR.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pay-upi-name">Name on the UPI account</Label>
          <Input
            id="pay-upi-name"
            placeholder="As your bank shows it"
            maxLength={60}
            value={s.payeeName}
            onChange={(e) => setS((p) => ({ ...p, payeeName: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">Shown in the customer&apos;s UPI app before they pay.</p>
        </div>
      </div>

      {tried && problem && <Notice tone="danger">{problem}</Notice>}
      {s.mode === 'upi' && (
        <Notice tone="info">
          UPI orders arrive as &quot;payment pending&quot;. Open each one in Orders, match the UTR and amount in your bank app, then press Approve. Pack an order only after you approve it.
        </Notice>
      )}

      <Button onClick={save} disabled={saving} className="gap-2">
        {saving ? <Spinner size={16} /> : <Save className="h-4 w-4" aria-hidden="true" />}
        Save payment settings
      </Button>
    </section>
  );
}
