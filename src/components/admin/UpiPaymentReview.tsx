import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';
import { ExternalLink, QrCode } from 'lucide-react';
import { db, auth } from '@/config/firebase';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatDateTime, formatINR } from '@/lib/format';
import type { Order } from '@/services/orderService';

interface ManualPayment {
  status?: 'awaiting' | 'submitted' | 'approved' | 'rejected';
  amountPaise?: number;
  upiId?: string;
  utr?: string;
  screenshotUrl?: string;
  duplicateUtrOf?: string[];
  reason?: string;
  submittedAt?: { toDate?: () => Date };
  reviewedAt?: { toDate?: () => Date };
}

async function sendReview(id: string, decision: 'approve' | 'reject', reason: string) {
  const token = await auth.currentUser?.getIdToken().catch(() => '');
  if (!token) throw new Error('Please sign in again.');
  const res = await fetch('/api/notify-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'review-upi-payment', orderId: id, decision, reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error && data.error !== 'upi_failed' ? data.error : 'The server could not save it. Try again.');
}

/**
 * Admin > Order: the proof a customer sent for a manual UPI payment, and the
 * Approve / Reject decision (api/notify-order.ts review-upi-payment). Only for
 * orders whose payment id starts with upi_.
 */
export function UpiPaymentReview({ order, className }: { order: Order; className?: string }) {
  const id = order.razorpayOrderId || '';
  const [p, setP] = useState<ManualPayment | null>(null);
  const [ask, setAsk] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!id.startsWith('upi_')) return;
    return onSnapshot(
      doc(db, 'manualPayments', id),
      (snap) => setP((snap.data() as ManualPayment) || {}),
      () => setP({}),
    );
  }, [id]);

  if (!id.startsWith('upi_') || !p) return null;

  const expected = (Number(p.amountPaise) || 0) / 100;
  const decided = p.status === 'approved' || p.status === 'rejected' || order.upiReview?.status;
  const state = p.status === 'approved' || order.upiReview?.status === 'approved' ? 'approved' : p.status === 'rejected' || order.upiReview?.status === 'rejected' ? 'rejected' : 'open';
  // Only manualPayments values: the server checked them. order.upiPayment is
  // written by the customer and is never shown or linked here.
  const utr = p.utr || '';
  const shot = typeof p.screenshotUrl === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(p.screenshotUrl) ? p.screenshotUrl : '';

  return (
    <section aria-label="UPI payment check" className={className}>
      <Notice
        tone={state === 'approved' ? 'success' : state === 'rejected' ? 'danger' : 'warning'}
        icon={QrCode}
        title={
          state === 'approved'
            ? 'UPI payment approved'
            : state === 'rejected'
              ? 'UPI payment rejected'
              : 'UPI payment to check'
        }
        className="shadow-sm"
      >
        <div className="space-y-3">
          {state === 'open' && (
            <p>Open your bank or UPI app, find this UTR and check the amount. Approve only when the money has arrived.</p>
          )}
          {state === 'rejected' && (
            <p>
              {p.reason || order.upiReview?.reason || 'Not paid.'} Cancel this order unless the customer pays again.
            </p>
          )}
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Amount to receive</dt>
              <dd className="font-semibold tabular-nums">{formatINR(expected || order.total)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">UTR / reference</dt>
              <dd className="break-all font-mono font-semibold">{utr || 'Not sent yet'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Paid to</dt>
              <dd className="break-all">{p.upiId || '-'}</dd>
            </div>
          </dl>
          {p.duplicateUtrOf?.length ? (
            <p role="alert" className="font-medium text-status-danger-fg">
              This UTR was also sent for {p.duplicateUtrOf.length === 1 ? 'another payment' : `${p.duplicateUtrOf.length} other payments`} ({p.duplicateUtrOf.join(', ')}). One payment can pay only one order.
            </p>
          ) : null}
          {shot && (
            <a href={shot} target="_blank" rel="noopener noreferrer" className="inline-flex flex-col gap-1">
              <img src={shot} alt="Payment screenshot the customer sent" className="max-h-72 w-auto rounded-card border object-contain" loading="lazy" />
              <span className="inline-flex items-center gap-1 text-xs underline">
                Open the screenshot <ExternalLink aria-hidden="true" className="h-3 w-3" />
              </span>
            </a>
          )}
          {p.submittedAt?.toDate && <p className="text-xs text-muted-foreground">Sent {formatDateTime(p.submittedAt.toDate())}</p>}
          {!decided && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setAsk('approve')}>
                Approve payment
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAsk('reject')}>
                Reject
              </Button>
            </div>
          )}
        </div>
      </Notice>

      <ConfirmDialog
        open={ask === 'approve'}
        onOpenChange={(o) => !o && setAsk(null)}
        title={`Approve ${formatINR(expected || order.total)}?`}
        description={`Only if ${formatINR(expected || order.total)} with UTR ${utr || '(none)'} is in your account. The order becomes paid and can be packed.`}
        confirmLabel="Approve"
        onConfirm={async () => {
          try {
            await sendReview(id, 'approve', '');
            toast.success('Payment approved. The order is now paid.');
            setAsk(null);
          } catch (e) {
            toast.error('Could not approve', { description: e instanceof Error ? e.message : String(e) });
          }
        }}
      />
      <ConfirmDialog
        open={ask === 'reject'}
        onOpenChange={(o) => !o && setAsk(null)}
        title="Reject this UPI payment?"
        description="The order is marked as not paid. Then cancel it, or ask the customer to pay again."
        confirmLabel="Reject payment"
        tone="danger"
        onConfirm={async () => {
          try {
            await sendReview(id, 'reject', reason || 'Payment not received.');
            toast.success('Payment rejected');
            setAsk(null);
          } catch (e) {
            toast.error('Could not reject', { description: e instanceof Error ? e.message : String(e) });
          }
        }}
      >
        <Textarea
          aria-label="Reason (the customer may see it)"
          placeholder="Reason, e.g. no payment with this UTR"
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
        />
      </ConfirmDialog>
    </section>
  );
}
