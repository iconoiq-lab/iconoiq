// ============================================
// ADMIN > PARTNERS: academy partner applications, the partner list (tier,
// sales, earnings, what is owed), payouts, the claims queue and the
// programme settings. docs/specs/academy-dealership-programme.md.
// Money is credited by the server (api/notify-order.ts); this page only
// records payouts and decisions.
// ============================================

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, CheckCircle2, Gift, GraduationCap, IndianRupee, Save, Settings, Users, X } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { StatCard } from '@/components/admin/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { FormSkeleton, TableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { StatusBadge } from '@/components/ui/status-badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { claimTitle, formatDMY } from '@/components/partner/PartnerAreaViews';
import { useAuth } from '@/contexts/AuthContext';
import { describeError } from '@/lib/errorMessage';
import { formatINR, formatNumber } from '@/lib/format';
import {
  PERKS,
  normalisePartnerSettings,
  partnerCodeFor,
  partnerTierFor,
  receivedTotal,
  settledAmount,
  unlockedEarnings,
  type EarningRow,
  type PartnerSettings,
  type PartnerTier,
} from '@/lib/partner';
import { cn } from '@/lib/utils';
import {
  approvePartner,
  fulfilClaim,
  loadPartnerMoney,
  loadPartnerSettings,
  recordPayout,
  reviewPartner,
  savePartnerSettings,
  setPartnerTierOverride,
  subscribeAllClaims,
  subscribePartners,
  type ClaimRow,
  type PartnerRecord,
  type PayoutRow,
} from '@/services/partnerService';

const PANEL = 'rounded-card border border-border bg-card p-4 shadow-sm sm:p-6';
type Tab = 'applications' | 'partners' | 'claims' | 'settings';
const TABS: Tab[] = ['applications', 'partners', 'claims', 'settings'];

const STATUS_TONE = {
  pending: { tone: 'warning', label: 'Pending' },
  approved: { tone: 'success', label: 'Approved' },
  rejected: { tone: 'neutral', label: 'Rejected' },
  suspended: { tone: 'danger', label: 'Suspended' },
} as const;

const istDay = (ms: number) => new Date(ms + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const istNoon = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1, 12) - 5.5 * 3600 * 1000;
};

export default function AdminPartners() {
  const { user } = useAuth();
  const adminUid = user?.uid ?? '';
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab') as Tab | null;
  const tab: Tab = asked && TABS.includes(asked) ? asked : 'applications';
  const [records, setRecords] = useState<PartnerRecord[] | null>(null);
  const [claims, setClaims] = useState<ClaimRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setError(null);
    const fail = (e: Error) => setError(describeError(e));
    const a = subscribePartners(setRecords, fail);
    const b = subscribeAllClaims(setClaims, fail);
    return () => {
      a();
      b();
    };
  }, [retry]);

  const pending = useMemo(() => (records ?? []).filter((r) => r.status === 'pending'), [records]);
  const members = useMemo(() => (records ?? []).filter((r) => r.status !== 'pending'), [records]);
  const openClaims = useMemo(() => (claims ?? []).filter((c) => c.status === 'requested'), [claims]);

  return (
    <div>
      <AdminPageHeader title="Partners" description="Academy and teacher partners: applications, earnings, payouts and claims." />
      {error && (
        <Notice tone="danger" title="Couldn't load partners" className="mb-6" action={<Button size="sm" variant="outline" onClick={() => setRetry((n) => n + 1)}>Try again</Button>}>
          {error}
        </Notice>
      )}
      <Tabs value={tab} onValueChange={(v) => setParams(v === 'applications' ? {} : { tab: v }, { replace: true })}>
        <TabsList className="mb-6 w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="applications" className="gap-1.5">
            <GraduationCap className="size-4" aria-hidden="true" /> Applications
            {pending.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{pending.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="partners" className="gap-1.5"><Users className="size-4" aria-hidden="true" /> Partners</TabsTrigger>
          <TabsTrigger value="claims" className="gap-1.5">
            <Gift className="size-4" aria-hidden="true" /> Claims
            {openClaims.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{openClaims.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><Settings className="size-4" aria-hidden="true" /> Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="applications" className="mt-0">
          {records === null ? <TableSkeleton /> : <Applications rows={pending} adminUid={adminUid} />}
        </TabsContent>
        <TabsContent value="partners" className="mt-0">
          {records === null ? <TableSkeleton /> : <PartnerList rows={members} adminUid={adminUid} />}
        </TabsContent>
        <TabsContent value="claims" className="mt-0">
          {claims === null || records === null ? <TableSkeleton /> : <ClaimsQueue claims={claims} records={records} adminUid={adminUid} />}
        </TabsContent>
        <TabsContent value="settings" className="mt-0">
          <SettingsForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Applications ──────────────────────────────────────────────────────────

function Applications({ rows, adminUid }: { rows: PartnerRecord[]; adminUid: string }) {
  if (rows.length === 0) {
    return <EmptyState icon={GraduationCap} as="h2" title="No applications waiting" description="New partner applications show up here." />;
  }
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {rows.map((r) => <ApplicationCard key={r.uid} r={r} adminUid={adminUid} />)}
    </ul>
  );
}

function ApplicationCard({ r, adminUid }: { r: PartnerRecord; adminUid: string }) {
  const [code, setCode] = useState(() => r.code || partnerCodeFor(r.name, r.phone));
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState('');
  const id = `code-${r.uid}`;

  const approve = async () => {
    setBusy('approve');
    setProblem(null);
    try {
      await approvePartner(r, code, adminUid);
      toast.success(`${r.name} approved with code ${code.toUpperCase()}`);
    } catch (e) {
      setProblem(describeError(e));
    } finally {
      setBusy(null);
    }
  };
  const reject = async () => {
    setBusy('reject');
    try {
      await reviewPartner(r, 'reject', adminUid, note);
      toast('Application rejected');
      setRejectOpen(false);
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className={PANEL}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">{r.name}</h3>
          <p className="text-sm text-muted-foreground">{r.business}</p>
        </div>
        <StatusBadge tone="warning" label="Pending" />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">Phone</dt><dd className="tabular-nums text-foreground">{r.phone}</dd></div>
        <div><dt className="text-xs text-muted-foreground">City</dt><dd className="text-foreground">{r.city}, {r.state}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Applied</dt><dd className="tabular-nums text-foreground">{formatDMY(r.appliedAtMs)}</dd></div>
      </dl>
      <div className="mt-4 border-t border-border pt-4">
        <Label htmlFor={id}>Partner code</Label>
        <Input
          id={id}
          className="mt-1.5 font-mono uppercase tracking-wider"
          value={code}
          maxLength={16}
          aria-invalid={problem ? true : undefined}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
            setProblem(null);
          }}
        />
        <p id={`${id}-hint`} className={cn('mt-1 text-xs', problem ? 'text-destructive' : 'text-muted-foreground')} role={problem ? 'alert' : undefined}>
          {problem ?? 'First 4 letters of the name + last 4 digits of the phone. Edit if needed.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={approve} disabled={busy !== null || code.length < 4}>
            {busy === 'approve' ? <Spinner /> : <Check aria-hidden="true" />} Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)} disabled={busy !== null}>
            <X aria-hidden="true" /> Reject
          </Button>
        </div>
      </div>
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {r.name}'s application?</DialogTitle>
            <DialogDescription>They see the note on their programme page and can apply again.</DialogDescription>
          </DialogHeader>
          <Label htmlFor={`note-${r.uid}`}>Note (optional)</Label>
          <Textarea id={`note-${r.uid}`} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={reject} disabled={busy !== null}>
              {busy === 'reject' && <Spinner />} Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

// ─── Partner list ──────────────────────────────────────────────────────────

function PartnerList({ rows, adminUid }: { rows: PartnerRecord[]; adminUid: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const totals = useMemo(
    () => ({
      active: rows.filter((r) => r.status === 'approved').length,
      sales: rows.reduce((t, r) => t + (r.lifetimeSales ?? 0), 0),
      earned: rows.reduce((t, r) => t + r.earnedTotal, 0),
    }),
    [rows],
  );
  const current = rows.find((r) => r.uid === open) ?? null;
  if (rows.length === 0) {
    return <EmptyState icon={Users} as="h2" title="No partners yet" description="Approved partners show up here." />;
  }
  return (
    <>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Active partners" value={formatNumber(totals.active)} />
        <StatCard label="Sales through codes" value={formatINR(totals.sales)} />
        <StatCard label="Earned by partners" value={formatINR(totals.earned)} />
      </div>
      <ul className={cn(PANEL, 'divide-y divide-border p-0 sm:p-0')}>
        {rows.map((r) => {
          const st = STATUS_TONE[r.status];
          return (
            <li key={r.uid} className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">{r.business ? `${r.business} · ` : ''}<span className="font-mono">{r.code || 'no code'}</span></p>
              </div>
              <StatusBadge tone={st.tone} label={st.label} />
              <span className="text-xs text-muted-foreground">
                {(r.tierOverride ?? r.tier) === 'gold' ? 'Gold' : 'Silver'}
                {r.tierOverride && ' (set by admin)'}
              </span>
              <dl className="flex gap-6 text-right text-sm tabular-nums">
                <div><dt className="text-[11px] text-muted-foreground">Sales</dt><dd className="text-foreground">{formatINR(r.lifetimeSales ?? 0)}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Earned</dt><dd className="text-foreground">{formatINR(r.earnedTotal)}</dd></div>
              </dl>
              <Button size="sm" variant="outline" onClick={() => setOpen(r.uid)} aria-label={`Manage ${r.name}`}>Manage</Button>
            </li>
          );
        })}
      </ul>
      {current && <PartnerDialog key={current.uid} r={current} adminUid={adminUid} onClose={() => setOpen(null)} />}
    </>
  );
}

function PartnerDialog({ r, adminUid, onClose }: { r: PartnerRecord; adminUid: string; onClose: () => void }) {
  const [money, setMoney] = useState<{ earnings: EarningRow[]; payouts: PayoutRow[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(() => istDay(Date.now()));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [settings, setSettings] = useState<PartnerSettings | null>(null);

  const reload = () =>
    loadPartnerMoney(r.uid)
      .then(setMoney)
      .catch((e) => setLoadError(describeError(e)));
  useEffect(() => {
    void reload();
    loadPartnerSettings().then(setSettings).catch(() => setSettings(normalisePartnerSettings(null)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.uid]);

  const act = async (key: string, work: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await work();
      toast.success(done);
      return true;
    } catch (e) {
      toast.error(describeError(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const autoTier: PartnerTier | null = settings ? partnerTierFor(r.lifetimeSales ?? 0, settings, null) : null;
  const unlocked = money ? unlockedEarnings(money.earnings, nowMs) : 0;
  const sent = money ? money.payouts.reduce((t, p) => t + p.amount, 0) : 0;
  const received = money ? receivedTotal(money.payouts) : 0;
  const owed = money ? settledAmount(money.earnings, money.payouts, nowMs) : 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{r.name}</DialogTitle>
          <DialogDescription>
            {[r.business, `${r.city}, ${r.state}`, r.phone].filter(Boolean).join(' · ')} · code <span className="font-mono">{r.code}</span>
          </DialogDescription>
        </DialogHeader>

        <section aria-label="Money" className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ['Unlocked', unlocked],
            ['Sent', sent],
            ['Confirmed', received],
            ['To settle', owed],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-card bg-muted/60 p-3">
              <p className="text-[11px] text-muted-foreground">{k}</p>
              <p className="font-semibold tabular-nums text-foreground">{money ? formatINR(v as number) : '…'}</p>
            </div>
          ))}
        </section>
        {money && sent > received && (
          <p className="text-xs text-muted-foreground">
            {formatINR(sent - received)} is sent and waiting for the partner's Received. Still to send: {formatINR(Math.max(0, owed - (sent - received)))}.
          </p>
        )}
        {loadError && <Notice tone="danger" compact title="Couldn't load money">{loadError}</Notice>}

        <section aria-labelledby={`tier-${r.uid}`} className="space-y-2">
          <Label id={`tier-${r.uid}`}>Tier</Label>
          <Select
            value={r.tierOverride ?? 'auto'}
            onValueChange={(v) =>
              act('tier', () => setPartnerTierOverride(r.uid, v === 'auto' ? null : (v as PartnerTier)), 'Tier saved')
            }
          >
            <SelectTrigger aria-labelledby={`tier-${r.uid}`} className="w-full sm:w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Automatic{autoTier ? ` (now ${autoTier === 'gold' ? 'Gold' : 'Silver'})` : ''}</SelectItem>
              <SelectItem value="silver">Silver (fixed)</SelectItem>
              <SelectItem value="gold">Gold (fixed)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">A new tier applies to orders delivered after the change.</p>
        </section>

        <form
          className="space-y-3 rounded-card border border-border p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await act('payout', () => recordPayout(r.uid, { amount: Number(amount), paidOnMs: istNoon(day), note }, adminUid), 'Payout recorded');
            if (ok) {
              setAmount('');
              setNote('');
              void reload();
            }
          }}
        >
          <h3 className="text-sm font-semibold text-foreground">Record a payout</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`amt-${r.uid}`}>Amount (₹)</Label>
              <Input id={`amt-${r.uid}`} inputMode="decimal" type="number" min="1" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`day-${r.uid}`}>Paid on</Label>
              <Input id={`day-${r.uid}`} type="date" required max={istDay(Date.now())} value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`pnote-${r.uid}`}>Note (optional)</Label>
            <Input id={`pnote-${r.uid}`} maxLength={200} placeholder="UPI ref, bank transfer…" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button type="submit" size="sm" disabled={busy !== null || !(Number(amount) > 0)}>
            {busy === 'payout' ? <Spinner /> : <IndianRupee aria-hidden="true" />} Record payout
          </Button>
        </form>

        {money && money.payouts.length > 0 && (
          <section aria-label="Payouts">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Payouts</h3>
            <ul className="divide-y divide-border text-sm">
              {money.payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="tabular-nums">{formatINR(p.amount)} · {formatDMY(p.paidOnMs)}{p.note && ` · ${p.note}`}</span>
                  {p.receivedAtMs ? (
                    <StatusBadge tone="success" icon={CheckCircle2} label="Received" />
                  ) : (
                    <StatusBadge tone="warning" label="Awaiting partner" />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {r.status === 'approved' ? (
            <Button variant="outline" disabled={busy !== null} onClick={() => act('status', () => reviewPartner(r, 'suspend', adminUid), 'Partner suspended')}>
              {busy === 'status' && <Spinner />} Suspend partner
            </Button>
          ) : r.status === 'suspended' || r.status === 'rejected' ? (
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() =>
                act('status', () => (r.code ? reviewPartner(r, 'reinstate', adminUid) : approvePartner(r, partnerCodeFor(r.name, r.phone), adminUid)), 'Partner approved')
              }
            >
              {busy === 'status' && <Spinner />} {r.status === 'suspended' ? 'Reinstate' : 'Approve'}
            </Button>
          ) : <span />}
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Claims queue ──────────────────────────────────────────────────────────

function ClaimsQueue({ claims, records, adminUid }: { claims: ClaimRow[]; records: PartnerRecord[]; adminUid: string }) {
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const byUid = useMemo(() => new Map(records.map((r) => [r.uid, r])), [records]);
  const rows = claims.filter((c) => (showDone ? c.status === 'fulfilled' : c.status === 'requested'));

  const fulfil = async (c: ClaimRow) => {
    setBusy(c.path);
    try {
      await fulfilClaim(c.path, adminUid);
      toast.success('Marked fulfilled');
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Switch id="show-done" checked={showDone} onCheckedChange={setShowDone} />
        <Label htmlFor="show-done">Show fulfilled claims</Label>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Gift} as="h2" title={showDone ? 'No fulfilled claims yet' : 'No claims waiting'} description="Partners' perk and silver claims show up here." />
      ) : (
        <ul className={cn(PANEL, 'divide-y divide-border p-0 sm:p-0')}>
          {rows.map((c) => {
            const r = byUid.get(c.partnerUid);
            return (
              <li key={c.path} className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
                <div className="min-w-0 flex-1 basis-52">
                  <p className="text-sm font-semibold text-foreground">{claimTitle(c)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r ? [r.name, r.business, r.phone].filter(Boolean).join(' · ') : c.partnerUid}
                  </p>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {c.status === 'fulfilled' ? `Fulfilled ${formatDMY(c.fulfilledAtMs || 0)}` : `Requested ${formatDMY(c.createdAtMs || 0)}`}
                </span>
                {c.status === 'requested' && (
                  <Button size="sm" onClick={() => fulfil(c)} disabled={busy !== null} aria-label={`Mark ${claimTitle(c)} for ${r?.name ?? 'partner'} fulfilled`}>
                    {busy === c.path ? <Spinner /> : <Check aria-hidden="true" />} Mark fulfilled
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Settings ──────────────────────────────────────────────────────────────

function NumField({ id, label, value, onChange, suffix, hint }: { id: string; label: string; value: number; onChange: (n: number) => void; suffix?: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input id={id} type="number" inputMode="decimal" min="0" value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(Number(e.target.value))} aria-describedby={hint ? `${id}-hint` : undefined} />
        {suffix && <span className="shrink-0 text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SettingsForm() {
  const [form, setForm] = useState<PartnerSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPartnerSettings().then(setForm).catch((e) => setError(describeError(e)));
  }, []);

  if (error) return <Notice tone="danger" title="Couldn't load the settings">{error}</Notice>;
  if (!form) return <FormSkeleton />;

  const set = <K extends keyof PartnerSettings>(k: K, v: PartnerSettings[K]) => setForm({ ...form, [k]: v });
  const setPerk = (id: keyof PartnerSettings['perks'], k: 'unlockAt' | 'count', v: number) =>
    setForm({ ...form, perks: { ...form.perks, [id]: { ...form.perks[id], [k]: v } } });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await savePartnerSettings(form);
      setForm(normalisePartnerSettings(form));
      toast.success('Partner settings saved');
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <section className={PANEL} aria-labelledby="ps-programme">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="ps-programme" className="text-base font-semibold text-foreground">Partner programme</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Off: the partner card shows "not open" and no new applications come in. Approved codes keep working.</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ps-enabled" checked={form.enabled} onCheckedChange={(v) => set('enabled', v)} />
            <Label htmlFor="ps-enabled">{form.enabled ? 'Open' : 'Off'}</Label>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumField id="ps-silver" label="Silver commission" suffix="%" value={form.silverPercent} onChange={(n) => set('silverPercent', n)} />
          <NumField id="ps-gold" label="Gold commission" suffix="%" value={form.goldPercent} onChange={(n) => set('goldPercent', n)} />
          <NumField id="ps-goldat" label="Gold from lifetime sales" suffix="₹" value={form.goldThreshold} onChange={(n) => set('goldThreshold', n)} hint="Partners never see Gold before they reach it." />
          <NumField id="ps-cust" label="Customer discount with a code" suffix="%" value={form.customerDiscountPercent} onChange={(n) => set('customerDiscountPercent', n)} hint="0 = no discount for customers." />
          <NumField id="ps-hold" label="Hold earnings for" suffix="days" value={form.holdDays} onChange={(n) => set('holdDays', n)} hint="Earnings unlock after the return window, or after this many days if that is longer." />
          <NumField id="ps-step" label="1 g silver coin per" suffix="₹" value={form.silverStep} onChange={(n) => set('silverStep', n)} />
        </div>
      </section>

      <section className={PANEL} aria-labelledby="ps-perks">
        <h2 id="ps-perks" className="text-base font-semibold text-foreground">Perks</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Unlocks at lifetime delivered sales. 0 = from approval.</p>
        <div className="mt-4 divide-y divide-border">
          {PERKS.map((p) => (
            <div key={p.id} className="grid items-end gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_7rem]">
              <p className="text-sm text-foreground">{p.title}</p>
              <NumField id={`pk-${p.id}`} label="Unlocks at (₹)" value={form.perks[p.id].unlockAt} onChange={(n) => setPerk(p.id, 'unlockAt', n)} />
              {p.kind === 'count' ? (
                <NumField id={`pc-${p.id}`} label="How many" value={form.perks[p.id].count} onChange={(n) => setPerk(p.id, 'count', n)} />
              ) : <span className="hidden sm:block" />}
            </div>
          ))}
        </div>
      </section>

      <Button type="submit" disabled={saving}>
        {saving ? <Spinner /> : <Save aria-hidden="true" />} Save settings
      </Button>
    </form>
  );
}
