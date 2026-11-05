import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Eye, Gift, Info, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Spinner } from '@/components/ui/spinner';
import { StatusBadge } from '@/components/ui/status-badge';
import { Switch } from '@/components/ui/switch';
import { FormSkeleton } from '@/components/skeletons';
import { CoinGiftDialog } from '@/components/coin/CoinGiftDialog';
import { describeError } from '@/lib/errorMessage';
import { formatINR } from '@/lib/format';
import { coinTypeFor, normaliseCoinSettings, type CoinGiftSettings, type OrderCoinGift } from '@/lib/coinGift';
import { getCoinSettings, saveCoinSettings } from '@/services/coinGiftService';

/** Admin > Commerce settings > Lakshmi coin. */
export function CoinGiftSettingsTab() {
  // Set only by a successful read: saving defaults over a failed read would overwrite the real settings.
  const [saved, setSaved] = useState<CoinGiftSettings | null>(null);
  const [form, setForm] = useState<CoinGiftSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<OrderCoinGift | null>(null);

  useEffect(() => {
    let live = true;
    setLoadError(null);
    getCoinSettings()
      .then((s) => {
        if (!live) return;
        setSaved(s);
        setForm(s);
      })
      .catch((err) => {
        console.error(err);
        if (live) setLoadError(describeError(err));
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  if (!form && !loadError) {
    return (
      <div className="rounded-card border border-border bg-card p-4 sm:p-6">
        <FormSkeleton fields={3} label="Loading Lakshmi coin settings" />
      </div>
    );
  }

  const header = (
    <div className="mb-5 flex items-start gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-muted text-foreground/70">
        <Gift className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-foreground">Lakshmi coin card</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">A printed coin card packed with bigger orders: silver, and gold every few orders.</p>
      </div>
      {saved?.enabled ? <StatusBadge tone="success" label="Live" dot pulse /> : <StatusBadge tone="neutral" label="Off" dot />}
    </div>
  );

  if (!form) {
    return (
      <section className="rounded-card border border-border bg-card p-4 shadow-sm sm:p-6">
        {header}
        <Notice
          tone="danger"
          title="Could not load the Lakshmi coin settings"
          className="mb-5"
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              <RefreshCw aria-hidden="true" /> Retry
            </Button>
          }
        >
          <p>{loadError}</p>
          <p className="mt-1">Saving stays off until they load, so the current settings cannot be overwritten.</p>
        </Notice>
        <Button disabled>
          <Save aria-hidden="true" /> Save Lakshmi coin
        </Button>
      </section>
    );
  }

  const clean = normaliseCoinSettings(form);
  const set = (patch: Partial<CoinGiftSettings>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const save = async () => {
    const before = form;
    setSaving(true);
    try {
      const next = normaliseCoinSettings(before);
      await saveCoinSettings(next);
      setSaved(next);
      setForm((current) => (current === before ? next : current));
      const adjusted = next.minOrder !== before.minOrder || next.goldEvery !== before.goldEvery;
      toast.success(
        'Lakshmi coin saved',
        adjusted ? { description: 'Values outside the allowed range were adjusted to fit.' } : undefined,
      );
    } catch (err) {
      console.error(err);
      toast.error('Could not save Lakshmi coin', { description: describeError(err) });
    } finally {
      setSaving(false);
    }
  };

  const openPreview = (seq: number) =>
    setPreview({ type: coinTypeFor(seq, clean), seq, status: 'active', revealed: false });

  const pattern = Array.from({ length: Math.min(clean.goldEvery, 8) }, (_, i) => coinTypeFor(i + 1, clean));

  return (
    <section className="rounded-card border border-border bg-card p-4 shadow-sm sm:p-6">
      {header}

      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="coin-on" className="text-sm font-medium text-foreground">Lakshmi coin on</Label>
          <p id="coin-on-hint" className="text-xs text-muted-foreground">
            Off stops new coins. Orders that already have one keep it.
          </p>
        </div>
        <Switch id="coin-on" aria-describedby="coin-on-hint" checked={form.enabled} onCheckedChange={(v) => set({ enabled: v })} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="coin-min" className="text-sm">Minimum order (₹)</Label>
          <Input
            id="coin-min"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.minOrder}
            onChange={(e) => set({ minOrder: Number(e.target.value) })}
            className="mt-1.5 tabular-nums"
            aria-describedby="coin-min-hint"
          />
          <p id="coin-min-hint" className="mt-1.5 text-xs text-muted-foreground">
            Products total before coupons and delivery. Orders at or above this get a coin.
          </p>
        </div>
        <div>
          <Label htmlFor="coin-gold" className="text-sm">Gold coin every (orders)</Label>
          <Input
            id="coin-gold"
            type="number"
            inputMode="numeric"
            min={1}
            value={form.goldEvery}
            onChange={(e) => set({ goldEvery: Number(e.target.value) })}
            className="mt-1.5 tabular-nums"
            aria-describedby="coin-gold-hint"
          />
          <p id="coin-gold-hint" className="mt-1.5 text-xs text-muted-foreground">
            Counted per customer, only orders that earned a coin. {clean.goldEvery}: {pattern.map((t) => (t === 'gold' ? 'gold' : 'silver')).join(', ')}
            {clean.goldEvery > 8 ? ', ...' : ''}.
          </p>
        </div>
      </div>

      <Notice tone="info" icon={Info} title="How coins work">
        <p>
          When a customer pays for an order with products worth {formatINR(clean.minOrder)} or more, the order gets a coin
          card: silver, and gold on every {clean.goldEvery === 1 ? 'order' : `${clean.goldEvery}th coin order`}. Coupons do not
          change it. The customer scratches the card on screen after paying. The order page in Admin says which card to pack.
          If an order is cancelled or returned, its coin is cancelled and stops counting toward gold. Dealer orders get none.
        </p>
      </Notice>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" onClick={() => openPreview(1)}>
            <Eye aria-hidden="true" /> Preview silver
          </Button>
          <Button variant="outline" onClick={() => openPreview(clean.goldEvery)}>
            <Eye aria-hidden="true" /> Preview gold
          </Button>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Spinner /> : <Save aria-hidden="true" />}
          Save Lakshmi coin
        </Button>
      </div>

      {preview && (
        <CoinGiftDialog
          open
          onOpenChange={(open) => !open && setPreview(null)}
          orderId="preview"
          coin={preview}
          settings={clean}
          preview
        />
      )}
    </section>
  );
}
