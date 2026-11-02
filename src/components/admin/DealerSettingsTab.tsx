import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { BadgeCheck, Clock, Handshake, IndianRupee, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Spinner } from '@/components/ui/spinner';
import { StatusBadge } from '@/components/ui/status-badge';
import { Switch } from '@/components/ui/switch';
import { FormSkeleton } from '@/components/skeletons';
import { StatCard } from '@/components/admin/StatCard';
import { describeError } from '@/lib/errorMessage';
import { dealerUnitPrice, normaliseDealerSettings, type DealerTier } from '@/lib/dealer';
import { formatINR, formatNumber } from '@/lib/format';
import { fadeUp } from '@/lib/motion';
import {
  loadDealerAdminSettings,
  saveDealerAdminSettings,
  subscribeDealerApplications,
} from '@/services/dealerService';

/** What the form edits: the public switch and the stockist margin tiers. */
export interface DealerFormValues {
  enabled: boolean;
  tiers: DealerTier[];
}

/** The "₹800 item" in the live example under the fields. */
const EXAMPLE_PRICE = 800;
const MAX_TIERS = 5;

/** Phone tap target: the 24px switch gets a 44px hit area. */
const SWITCH_HIT = "relative after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-['']";

const PANEL = 'rounded-card border border-border bg-card p-4 shadow-sm sm:p-6';

function Panel({ status, children }: { status?: ReactNode; children: ReactNode }) {
  return (
    <motion.section {...fadeUp} aria-labelledby="dealer-settings-title" className={PANEL}>
      <div className="mb-5 flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-muted text-foreground/70">
          <Handshake className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="dealer-settings-title" className="text-base font-semibold text-foreground">Dealer membership</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Placeholder values until the client confirms its dealer terms.</p>
        </div>
        {status}
      </div>
      {children}
    </motion.section>
  );
}

export interface DealerSettingsTabViewProps {
  /** The form values. null until the settings have been read: never the defaults, so a failed read cannot be saved over. */
  form: DealerFormValues | null;
  /** Why the read failed (shown with Retry); null when it has not failed. */
  loadError: string | null;
  onRetry: () => void;
  onChange: (patch: Partial<DealerFormValues>) => void;
  /** The switch as last saved. The status chip follows it, not the unsaved switch. */
  liveEnabled: boolean;
  saving: boolean;
  onSave: () => void;
  /** Dealer counts; null while loading or when the list could not be read. */
  counts: { approved: number; pending: number } | null;
  countsError: boolean;
}

/** Admin > Commerce settings > Dealers: props only, no Firestore (the container below loads and saves). */
export function DealerSettingsTabView({
  form,
  loadError,
  onRetry,
  onChange,
  liveEnabled,
  saving,
  onSave,
  counts,
  countsError,
}: DealerSettingsTabViewProps) {
  // Cleaned like the save, so the example and the notice show what will be charged.
  const clean = useMemo(() => normaliseDealerSettings({ tiers: form?.tiers }), [form?.tiers]);

  if (!form && !loadError) {
    return (
      <div className={PANEL}>
        <FormSkeleton fields={4} label="Loading dealer settings" />
      </div>
    );
  }

  if (!form) {
    return (
      <Panel>
        <Notice
          tone="danger"
          title="Could not load the dealer settings"
          className="mb-5"
          action={
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw aria-hidden="true" /> Retry
            </Button>
          }
        >
          <p>{loadError}</p>
          <p className="mt-1">Saving stays off until they load, so the current settings cannot be overwritten.</p>
        </Notice>
        <Button disabled>
          <Save aria-hidden="true" />
          Save dealer settings
        </Button>
      </Panel>
    );
  }

  const tiers = clean.tiers;
  const firstTier = tiers[0];
  const topTier = tiers[tiers.length - 1];
  const examplePrice = dealerUnitPrice('x', EXAMPLE_PRICE, { productPrices: {} }, topTier.percent);
  const setTier = (i: number, patch: Partial<DealerTier>) =>
    onChange({ tiers: form.tiers.map((t, n) => (n === i ? { ...t, ...patch } : t)) });
  const statSubtitle = (text: string) => (counts ? text : countsError ? 'Could not load the list' : 'Loading');

  return (
    <Panel status={liveEnabled ? <StatusBadge tone="success" label="Live" dot pulse /> : <StatusBadge tone="neutral" label="Off" dot />}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="dl-on" className="text-sm font-medium text-foreground">Dealer programme</Label>
          <p id="dl-on-hint" className="text-xs text-muted-foreground">
            Off hides the dealer page and stops dealer prices. Approved dealers keep their status.
          </p>
        </div>
        <Switch
          id="dl-on"
          aria-describedby="dl-on-hint"
          checked={form.enabled}
          onCheckedChange={(enabled) => onChange({ enabled })}
          className={SWITCH_HIT}
        />
      </div>

      <fieldset className="mb-6" aria-describedby="dl-tiers-hint">
        <legend className="text-sm font-medium text-foreground">Stockist margin tiers</legend>
        <p id="dl-tiers-hint" className="mt-0.5 text-xs text-muted-foreground">
          One order worth the amount or more at regular prices gets the percent off. The highest tier met wins; below the first, regular prices apply.
        </p>
        <ol className="mt-3 space-y-3">
          {form.tiers.map((t, i) => (
            <li key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_auto] items-end gap-3 rounded-card border border-border bg-muted/30 p-3">
              <div>
                <Label htmlFor={`dl-tier-min-${i}`} className="text-xs">Order from (₹)</Label>
                <Input
                  id={`dl-tier-min-${i}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={t.minOrder}
                  onChange={(e) => setTier(i, { minOrder: Number(e.target.value) })}
                  className="mt-1 tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor={`dl-tier-pct-${i}`} className="text-xs">Margin (% off)</Label>
                <Input
                  id={`dl-tier-pct-${i}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={90}
                  value={t.percent}
                  onChange={(e) => setTier(i, { percent: Number(e.target.value) })}
                  className="mt-1 tabular-nums"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove tier ${i + 1}`}
                disabled={form.tiers.length <= 1}
                onClick={() => onChange({ tiers: form.tiers.filter((_, n) => n !== i) })}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={form.tiers.length >= MAX_TIERS}
          onClick={() => {
            const last = form.tiers[form.tiers.length - 1];
            onChange({ tiers: [...form.tiers, { minOrder: (Number(last?.minOrder) || 0) + 100000, percent: Math.min(90, (Number(last?.percent) || 0) + 5) }] });
          }}
        >
          <Plus aria-hidden="true" /> Add a tier
        </Button>
      </fieldset>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <li className="col-span-2 sm:col-span-1">
          <StatCard
            label={`A ${formatINR(EXAMPLE_PRICE)} item at the top tier`}
            icon={IndianRupee}
            value={formatINR(examplePrice)}
            subtitle={`${topTier.percent}% off, unless the product has its own dealer price`}
          />
        </li>
        <li>
          <StatCard
            label="Approved dealers"
            icon={BadgeCheck}
            tone="success"
            value={counts ? formatNumber(counts.approved) : '–'}
            subtitle={statSubtitle('Open the dealer list')}
            to="/admin/dealers?tab=approved"
          />
        </li>
        <li>
          <StatCard
            label="Applications waiting"
            icon={Clock}
            tone="warning"
            value={counts ? formatNumber(counts.pending) : '–'}
            subtitle={statSubtitle('Review them')}
            to="/admin/dealers?tab=pending"
          />
        </li>
      </ul>

      <Notice tone="info" title="How dealer prices work" className="mt-6" role="note">
        <ul className="list-disc space-y-1 pl-4">
          {tiers.map((t) => (
            <li key={t.minOrder}>
              One order of {formatINR(t.minOrder)} or more at regular prices: {t.percent}% off.
            </li>
          ))}
          <li>
            Below {formatINR(firstTier.minOrder)} an approved stockist pays regular prices. Only approved stockists and admins
            ever see dealer prices.
          </li>
          <li>A dealer price set on a product replaces the tier percent for that product.</li>
          <li>A dealer-priced order takes no coupon and cannot use points or wallet cashback.</li>
          <li>It earns no points and gets no Scratch &amp; Win card. Delivery and GST are charged as usual.</li>
          <li>The invoice prints the dealer&apos;s business name and GSTIN in the buyer block.</li>
        </ul>
      </Notice>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="outline" asChild>
          <Link to="/admin/dealers">
            <Handshake aria-hidden="true" /> Review applications
          </Link>
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Spinner /> : <Save aria-hidden="true" />}
          Save dealer settings
        </Button>
      </div>
    </Panel>
  );
}

/** Admin > Commerce settings > Dealers: loads and saves the programme switch and the margin tiers. */
export function DealerSettingsTab() {
  // Set only by a successful read. A failed one never falls back to the
  // defaults: saving those would overwrite the shop's real settings.
  const [form, setForm] = useState<DealerFormValues | null>(null);
  /** The switch as last read or saved: saveDealerAdminSettings stamps enabledAt only when it turns on. */
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState<{ approved: number; pending: number } | null>(null);
  const [countsError, setCountsError] = useState(false);

  useEffect(() => {
    let live = true;
    setLoadError(null);
    loadDealerAdminSettings()
      .then(({ settings }) => {
        if (!live) return;
        setLiveEnabled(settings.enabled);
        setForm({ enabled: settings.enabled, tiers: settings.tiers });
      })
      .catch((err) => {
        console.error(err);
        if (live) setLoadError(describeError(err));
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  useEffect(
    () =>
      subscribeDealerApplications(
        (rows) => {
          setCounts({
            approved: rows.filter((r) => r.status === 'approved').length,
            pending: rows.filter((r) => r.status === 'pending').length,
          });
          setCountsError(false);
        },
        (err) => {
          console.error(err);
          setCounts(null);
          setCountsError(true);
        },
      ),
    [],
  );

  const save = async () => {
    if (!form) return;
    const before = form;
    setSaving(true);
    try {
      // What is written: out-of-range values are clamped, so show those afterwards.
      const clean = normaliseDealerSettings({ enabled: before.enabled, tiers: before.tiers });
      await saveDealerAdminSettings(clean, liveEnabled);
      const adjusted = JSON.stringify(clean.tiers) !== JSON.stringify(before.tiers.map((t) => ({ minOrder: t.minOrder, percent: t.percent })));
      setLiveEnabled(clean.enabled);
      // Keep anything typed while the save was running.
      setForm((current) =>
        current === before ? { enabled: clean.enabled, tiers: clean.tiers } : current,
      );
      toast.success(
        'Dealer settings saved',
        adjusted ? { description: 'Tiers were sorted, and values outside the allowed range adjusted to fit.' } : undefined,
      );
    } catch (err) {
      console.error(err);
      toast.error('Could not save dealer settings', { description: describeError(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DealerSettingsTabView
      form={form}
      loadError={loadError}
      onRetry={() => setAttempt((n) => n + 1)}
      onChange={(patch) => setForm((f) => (f ? { ...f, ...patch } : f))}
      liveEnabled={liveEnabled}
      saving={saving}
      onSave={save}
      counts={counts}
      countsError={countsError}
    />
  );
}

export default DealerSettingsTab;
