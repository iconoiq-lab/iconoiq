import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';

/**
 * ICONOIQ only: Razorpay rejected iconoiq.com (2026-11-15), so checkout can take
 * money only in UPI QR mode. Until the owner saves UPI in Admin > Commerce
 * settings > Payments, the dashboard says so plainly and links there.
 */
export function PaymentSetupNotice() {
  const { mode, loading } = usePaymentSettings();
  if (loading || mode === 'upi') return null;
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-card border-2 border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center"
    >
      <AlertTriangle aria-hidden="true" className="size-5 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Customers cannot pay yet</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Checkout still uses Razorpay, which has not approved this website. Enter your UPI ID and name, pick
          &ldquo;UPI QR&rdquo; and press Save.
        </p>
      </div>
      <Button asChild size="sm" className="shrink-0">
        <Link to="/admin/commerce-settings?tab=payments">Set up UPI payments</Link>
      </Button>
    </div>
  );
}
