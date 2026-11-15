import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, ImagePlus, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { uploadImage } from '@/services/mediaStorage';
import { PaymentCancelledError, submitUpiProof, type UpiPaymentRequest, type UpiProof } from '@/services/razorpayService';
import { cleanUtr, upiPayLink, UTR_PATTERN } from '@/lib/paymentMode';
import { formatINR as formatPrice } from '@/lib/format';

interface Pending {
  req: UpiPaymentRequest;
  resolve: (proof: UpiProof) => void;
  reject: (err: Error) => void;
}

const isPhone = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

/**
 * Manual UPI payment: the QR for the exact amount, then the UTR and a
 * screenshot. `request` is passed to payWithRazorpay as onUpiPayment; mount
 * `element` once on the page.
 */
export function useUpiPayDialog() {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;

  const request = useCallback(
    (req: UpiPaymentRequest) =>
      new Promise<UpiProof>((resolve, reject) => {
        pendingRef.current?.reject(new PaymentCancelledError());
        setPending({ req, resolve, reject });
      }),
    [],
  );

  const element = pending ? (
    <UpiPayDialog
      key={pending.req.paymentId}
      req={pending.req}
      onDone={(proof) => {
        pending.resolve(proof);
        setPending(null);
      }}
      onCancel={() => {
        pending.reject(new PaymentCancelledError());
        setPending(null);
      }}
    />
  ) : null;

  return { request, element };
}

function UpiPayDialog({
  req,
  onDone,
  onCancel,
}: {
  req: UpiPaymentRequest;
  onDone: (proof: UpiProof) => void;
  onCancel: () => void;
}) {
  const link = upiPayLink({ upiId: req.upiId, payeeName: req.payeeName, amount: req.amount, note: req.note });
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [utr, setUtr] = useState('');
  const [shot, setShot] = useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    import('qrcode')
      .then((QR) => QR.toDataURL(link, { width: 480, margin: 1, errorCorrectionLevel: 'M' }))
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(''));
    return () => {
      alive = false;
    };
  }, [link]);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(req.upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the ID is on screen to type */
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const up = await uploadImage(file, { category: 'payments', autoCompress: true });
      setShot({ url: up.url, name: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the screenshot. Try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const utrClean = cleanUtr(utr);
  const utrOk = UTR_PATTERN.test(utrClean);

  const send = async () => {
    if (!utrOk) return setError('Enter the 12-digit UTR / transaction ID from your UPI app.');
    if (!shot) return setError('Add the payment screenshot.');
    setError('');
    setSending(true);
    try {
      await submitUpiProof(req.paymentId, utrClean, shot.url);
      onDone({ utr: utrClean, screenshotUrl: shot.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the details. Try again.');
      setSending(false);
    }
  };

  const tryClose = () => {
    if (sending) return;
    if (!confirmClose) return setConfirmClose(true);
    onCancel();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && tryClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay {formatPrice(req.amount)} by UPI</DialogTitle>
          <DialogDescription>
            Scan with GPay, PhonePe, Paytm or any UPI app. Then send the UTR and a screenshot so we can confirm your order.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-5">
          <li className="space-y-3">
            <p className="text-sm font-medium">1. Pay exactly {formatPrice(req.amount)}</p>
            <div className="mx-auto w-56 rounded-xl border bg-white p-3">
              {qr ? (
                <img src={qr} alt={`UPI QR code to pay ${formatPrice(req.amount)} to ${req.payeeName}`} className="h-auto w-full" width={480} height={480} />
              ) : (
                <div className="flex aspect-square items-center justify-center">
                  <Spinner size={24} label="Making the QR code" />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">UPI ID · {req.payeeName}</p>
                <p className="truncate font-mono font-medium">{req.upiId}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={copyId} aria-label="Copy UPI ID">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            {isPhone() && (
              <Button asChild variant="secondary" className="w-full">
                <a href={link}>
                  <Smartphone className="h-4 w-4" /> Open UPI app
                </a>
              </Button>
            )}
          </li>

          <li className="space-y-3">
            <p className="text-sm font-medium">2. Send the payment details</p>
            <div className="space-y-1.5">
              <Label htmlFor="upi-utr">UTR / transaction ID</Label>
              <Input
                id="upi-utr"
                inputMode="text"
                autoComplete="off"
                placeholder="12-digit number from your UPI app"
                value={utr}
                maxLength={40}
                onChange={(e) => setUtr(e.target.value)}
                aria-invalid={utr !== '' && !utrOk}
              />
              <p className="text-xs text-muted-foreground">Find it in the payment details of your UPI app (UTR, UPI Ref No. or Transaction ID).</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="upi-shot">Payment screenshot</Label>
              <input
                ref={fileRef}
                id="upi-shot"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => void pickFile(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                disabled={uploading || sending}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Spinner size={16} /> : shot ? <Check className="h-4 w-4 text-status-success-fg" /> : <ImagePlus className="h-4 w-4" />}
                <span className="truncate">{uploading ? 'Uploading…' : shot ? `Added: ${shot.name}` : 'Add screenshot'}</span>
              </Button>
            </div>
          </li>
        </ol>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {confirmClose && !sending && (
          <div role="alert" className="space-y-2 rounded-lg border border-status-warning-line bg-status-warning-bg text-status-warning-fg p-3 text-sm">
            <p>Already paid? Don&apos;t close: send the UTR and screenshot above so we can place your order.</p>
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              I haven&apos;t paid, close
            </Button>
          </div>
        )}

        <Button type="button" className="w-full" size="lg" disabled={sending || uploading} onClick={send}>
          {sending ? <Spinner size={16} /> : null}
          {sending ? 'Sending…' : 'I have paid, place my order'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">We check every UPI payment by hand, usually within a few hours.</p>
      </DialogContent>
    </Dialog>
  );
}
