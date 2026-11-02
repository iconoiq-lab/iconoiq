// ============================================
// Partner area (/account/partner): My account, Business support, My claims.
// Pure views; src/pages/PartnerArea.tsx wires them to Firestore.
// The partner's sales value is never shown (spec decision 6): perks show the
// threshold as the rule, never the partner's current sales.
// ============================================

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, CheckCircle2, Coins, Gift, Lock, Plane, Sparkles, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatINR, formatNumber } from '@/lib/format';
import {
  PERKS,
  earningsByMonth,
  monthLabel,
  partnerMonthKey,
  partnerRate,
  perkStates,
  settledAmount,
  silverPot,
  type ClaimLike,
  type EarningRow,
  type PartnerSettings,
  type PerkId,
  type PerkState,
} from '@/lib/partner';
import { cn } from '@/lib/utils';
import type { ClaimRow, PartnerRecord, PayoutRow } from '@/services/partnerService';
import { unlockLabel } from './PartnerViews';

const panelHeading = 'text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground';
const labelCls = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground';

const IST = 5.5 * 3600 * 1000;
/** dd/mm/yyyy in India time (the PDF's format). */
export function formatDMY(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms + IST);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

/** A claim in words: "Masterclasses: class 3", "Promotion team: November 2026", "Silver coins: 3 g". */
export function claimTitle(c: ClaimLike): string {
  if (c.perk === 'silver') {
    const g = Math.max(0, (Number(c.to) || 0) - (Number(c.from) || 0));
    return `Silver coins: ${g} g`;
  }
  const def = PERKS.find((p) => p.id === c.perk);
  const t = def?.title ?? c.perk;
  if (c.index !== undefined) return `${t}: ${c.perk === 'masterclass' ? 'class' : 'pass'} ${c.index}`;
  if (c.month) return `${t}: ${monthLabel(c.month)}`;
  return t;
}

export type PartnerTab = 'account' | 'support' | 'claims';

export interface PartnerAreaViewProps {
  record: PartnerRecord;
  settings: PartnerSettings;
  earnings: EarningRow[];
  payouts: PayoutRow[];
  claims: ClaimRow[];
  nowMs: number;
  tab: PartnerTab;
  onTab: (t: PartnerTab) => void;
  /** The id of the payout or claim being written, for the button spinner. */
  busy: string | null;
  onReceived: (payoutId: string) => void;
  onRedeem: (perk: PerkId, opts: { index?: number; month?: string }) => void;
  onClaimSilver: () => void;
}

export const PartnerAreaView = (p: PartnerAreaViewProps) => {
  const active = p.record.status === 'approved';
  return (
    <>
      {!active && (
        <Notice tone="warning" title="Your partner account is on hold" className="mb-6" role="region" aria-label="Partner account status">
          Your code doesn't work at checkout for now, and new claims are paused. Earnings you already have are safe.
        </Notice>
      )}
      <Tabs value={p.tab} onValueChange={(v) => p.onTab(v as PartnerTab)}>
        <TabsList className="mb-6 grid h-auto w-full grid-cols-3 sm:inline-grid sm:w-auto">
          <TabsTrigger value="account" className="px-2 py-2 text-xs sm:px-4 sm:text-sm">My account</TabsTrigger>
          <TabsTrigger value="support" className="px-2 py-2 text-xs sm:px-4 sm:text-sm">Business support</TabsTrigger>
          <TabsTrigger value="claims" className="px-2 py-2 text-xs sm:px-4 sm:text-sm">My claims</TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="mt-0 focus-visible:outline-none">
          <AccountTab {...p} />
        </TabsContent>
        <TabsContent value="support" className="mt-0 focus-visible:outline-none">
          <SupportTab {...p} active={active} />
        </TabsContent>
        <TabsContent value="claims" className="mt-0 focus-visible:outline-none">
          <ClaimsTab {...p} active={active} />
        </TabsContent>
      </Tabs>
    </>
  );
};

// ─── My account ────────────────────────────────────────────────────────────

const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="min-w-0">
    <dt className={labelCls}>{label}</dt>
    <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</dd>
    {hint && <dd className="mt-0.5 text-xs text-muted-foreground">{hint}</dd>}
  </div>
);

const AccountTab = ({ record, settings, earnings, payouts, nowMs, busy, onReceived }: PartnerAreaViewProps) => {
  const rate = partnerRate(record.tierOverride ?? record.tier, settings);
  const month = partnerMonthKey(nowMs);
  const byMonth = useMemo(() => earningsByMonth(earnings), [earnings]);
  const thisMonth = byMonth.find((m) => m.month === month)?.amount ?? 0;
  const toSettle = settledAmount(earnings, payouts, nowMs);
  const waiting = earnings.reduce(
    (t, r) => (!r.family && r.state !== 'void' && (r.state === 'held' || r.unlockAtMs > nowMs) ? t + (Number(r.amount) || 0) : t),
    0,
  );
  const awaiting = payouts.filter((x) => !x.receivedAtMs);
  const [pick, setPick] = useState('all');
  const shown = pick === 'all' ? null : byMonth.find((m) => m.month === pick) ?? null;
  const allTotal = byMonth.reduce((t, m) => t + m.amount, 0);
  const allUnits = byMonth.reduce((t, m) => t + m.units, 0);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="space-y-6">
        <section aria-labelledby="pa-code" className="tx-slate tx-contour relative overflow-hidden rounded-panel p-6 text-charcoal-foreground shadow-panel dark:ring-1 dark:ring-highlight-soft/20">
          <Sparkles aria-hidden="true" className="pointer-events-none absolute -right-6 -top-6 size-32 opacity-[0.07]" />
          <h2 id="pa-code" className="text-[10px] font-bold uppercase tracking-[0.18em] text-charcoal-foreground/70">Your coupon code</h2>
          <p className="mt-1 font-mono text-3xl font-semibold tracking-[0.12em]">{record.code}</p>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-charcoal-foreground/15 pt-4">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-charcoal-foreground/70">Signed up on</dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums">{formatDMY(record.approvedAtMs || record.appliedAtMs) || '-'}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-charcoal-foreground/70">My percentage</dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums">{rate}%</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="pa-numbers" className="panel tx-sheet p-6">
          <h2 id="pa-numbers" className={cn(panelHeading, 'mb-4')}>Your numbers</h2>
          <dl className="grid grid-cols-2 gap-5">
            <Stat label="Products sold" value={formatNumber(record.unitsSold)} />
            <Stat label="My share this month" value={formatINR(thisMonth)} hint={monthLabel(month)} />
            <div className="col-span-2 border-t border-foreground/[0.08] pt-4">
              <Stat
                label="Total to be settled"
                value={formatINR(toSettle)}
                hint={waiting > 0 ? `${formatINR(waiting)} more unlocks once the return window ends.` : undefined}
              />
            </div>
          </dl>
        </section>
      </div>

      <div className="space-y-6">
        <section aria-labelledby="pa-payouts" className="panel tx-sheet p-6">
          <h2 id="pa-payouts" className={cn(panelHeading, 'mb-4')}>Payouts</h2>
          {payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payouts yet. When we send you money, it shows here for you to confirm.</p>
          ) : (
            <ul className="divide-y divide-foreground/[0.06]">
              {[...awaiting, ...payouts.filter((x) => x.receivedAtMs)].map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold tabular-nums text-foreground">{formatINR(x.amount)} sent</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDMY(x.paidOnMs)}
                      {x.note && <> · {x.note}</>}
                    </p>
                  </div>
                  {x.receivedAtMs ? (
                    <StatusBadge tone="success" icon={CheckCircle2} label={`Received ${formatDMY(x.receivedAtMs)}`} />
                  ) : (
                    <Button size="sm" disabled={busy === x.id} onClick={() => onReceived(x.id)} aria-label={`Received ${formatINR(x.amount)}`}>
                      {busy === x.id && <Spinner />}
                      Received
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="pa-history" className="panel tx-sheet p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="pa-history" className={panelHeading}>Earnings history</h2>
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger className="h-9 w-[11rem]" aria-label="Show earnings for">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                {byMonth.map((m) => (
                  <SelectItem key={m.month} value={m.month}>{monthLabel(m.month)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <dl className="grid grid-cols-2 gap-5" aria-live="polite">
            <Stat label={shown ? monthLabel(shown.month) : 'Total earned'} value={formatINR(shown ? shown.amount : allTotal)} />
            <Stat label="Products sold" value={formatNumber(shown ? shown.units : allUnits)} />
          </dl>
          {pick === 'all' && byMonth.length > 0 && (
            <ul className="mt-5 divide-y divide-foreground/[0.06] border-t border-foreground/[0.08]">
              {byMonth.map((m) => (
                <li key={m.month} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <span className="text-foreground">{monthLabel(m.month)}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatNumber(m.units)} sold · <span className="font-semibold text-foreground">{formatINR(m.amount)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {byMonth.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">Earnings show here once an order with your code is delivered.</p>
          )}
        </section>
      </div>
    </div>
  );
};

// ─── Business support ──────────────────────────────────────────────────────

const PerkCard = ({
  s,
  nowMs,
  busy,
  active,
  onRedeem,
  claims,
}: {
  s: PerkState;
  nowMs: number;
  busy: string | null;
  active: boolean;
  onRedeem: PartnerAreaViewProps['onRedeem'];
  claims: ClaimRow[];
}) => {
  const { def, rule, unlocked } = s;
  const month = partnerMonthKey(nowMs);
  const total = def.kind === 'count' ? rule.count : 1;
  const opts = def.kind === 'count' ? { index: s.nextIndex ?? undefined } : def.kind === 'monthly' ? { month } : {};
  const key = `${def.id}:${opts.index ?? opts.month ?? ''}`;
  const mine = claims.filter((c) => c.perk === def.id && (def.kind !== 'monthly' || c.month === month));
  const done = s.left === 0 && unlocked;
  const label =
    def.kind === 'count' && def.numbered && s.nextIndex
      ? `${def.action} ${s.nextIndex} of ${total}`
      : def.action;
  const fulfilledOnce = def.kind === 'once' && done && mine[0]?.status === 'fulfilled';

  return (
    <li className={cn('panel tx-sheet flex flex-col p-5', !unlocked && 'bg-muted/40')}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">{def.title}</h3>
        {!unlocked ? (
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        ) : (
          <BadgeCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        )}
      </div>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">{def.body}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-foreground/[0.08] pt-4">
        {!unlocked ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="sr-only">Locked. </span>
            {unlockLabel(rule.unlockAt)}
          </span>
        ) : fulfilledOnce ? (
          <span className="sr-only">Done.</span>
        ) : (
          <span className="text-xs text-muted-foreground tabular-nums">
            {def.kind === 'count'
              ? `${s.left} of ${total} left`
              : def.kind === 'monthly'
                ? done
                  ? `Requested for ${monthLabel(month)}`
                  : `One request each month`
                : done
                  ? 'Requested, we will be in touch'
                  : 'Ready to redeem'}
            {s.fulfilled > 0 && def.kind !== 'once' && ` · ${s.fulfilled} fulfilled`}
          </span>
        )}
        {unlocked && !done && (
          <Button size="sm" disabled={!active || busy === key} onClick={() => onRedeem(def.id, opts)}>
            {busy === key && <Spinner />}
            {label}
          </Button>
        )}
        {fulfilledOnce && (
          <StatusBadge tone="success" icon={CheckCircle2} label="Fulfilled" />
        )}
      </div>
    </li>
  );
};

const SupportTab = ({ record, settings, claims, nowMs, busy, onRedeem, active }: PartnerAreaViewProps & { active: boolean }) => {
  const states = useMemo(
    () => perkStates(record.perksUnlocked, settings, claims, nowMs).filter((s) => s.def.tab === 'support'),
    [record.perksUnlocked, settings, claims, nowMs],
  );
  // Unlocked first, then by threshold; a perk's own sales number is never shown.
  const sorted = [...states].sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || a.rule.unlockAt - b.rule.unlockAt);
  return (
    <section aria-labelledby="pa-support">
      <h2 id="pa-support" className="sr-only">Business support</h2>
      <p className="mb-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Support unlocks as your sales grow. Redeem sends a request to our team; we mark it fulfilled once it reaches you.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((s) => (
          <PerkCard key={s.def.id} s={s} nowMs={nowMs} busy={busy} active={active} onRedeem={onRedeem} claims={claims} />
        ))}
      </ul>
    </section>
  );
};

// ─── My claims ─────────────────────────────────────────────────────────────

const ClaimsTab = ({ record, settings, claims, nowMs, busy, onRedeem, onClaimSilver, active }: PartnerAreaViewProps & { active: boolean }) => {
  const rate = partnerRate(record.tierOverride ?? record.tier, settings);
  const trip = perkStates(record.perksUnlocked, settings, claims, nowMs).find((s) => s.def.id === 'trip')!;
  const tripClaim = claims.find((c) => c.perk === 'trip');
  const pot = silverPot(record.silverGrams, claims);
  const pending = claims.filter((c) => c.status === 'requested').sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  const fulfilled = claims.filter((c) => c.status === 'fulfilled').sort((a, b) => (b.fulfilledAtMs || 0) - (a.fulfilledAtMs || 0));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <section aria-labelledby="pc-family" className="tx-slate tx-contour relative overflow-hidden rounded-panel p-6 text-charcoal-foreground shadow-panel dark:ring-1 dark:ring-highlight-soft/20">
          <h2 id="pc-family" className="text-[10px] font-bold uppercase tracking-[0.18em] text-charcoal-foreground/70">Family discount</h2>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.12em]">{record.code}</p>
          <p className="mt-2 text-sm text-charcoal-foreground/85">
            Use your own code while signed in for <span className="font-semibold">{rate}% off</span> your own orders. These orders earn no commission.
          </p>
        </section>

        <section aria-labelledby="pc-trip" className="panel tx-sheet p-6">
          <div className="flex items-start gap-3">
            <div aria-hidden="true" className="tx-slate flex size-10 shrink-0 items-center justify-center rounded-[8px] text-highlight-soft">
              <Plane className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="pc-trip" className="text-base font-semibold text-foreground">{trip.def.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{trip.def.body}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-foreground/[0.08] pt-4">
            {!trip.unlocked ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Lock aria-hidden="true" className="size-3.5" />
                <span className="sr-only">Locked. </span>
                {unlockLabel(trip.rule.unlockAt)}
              </span>
            ) : tripClaim ? (
              <StatusBadge
                tone={tripClaim.status === 'fulfilled' ? 'success' : 'info'}
                label={tripClaim.status === 'fulfilled' ? 'Fulfilled' : 'Claim sent, we will be in touch'}
              />
            ) : (
              <>
                <span className="text-xs text-muted-foreground">You're eligible</span>
                <Button size="sm" disabled={!active || busy === 'trip:'} onClick={() => onRedeem('trip', {})}>
                  {busy === 'trip:' && <Spinner />}
                  {trip.def.action}
                </Button>
              </>
            )}
          </div>
        </section>

        <section aria-labelledby="pc-silver" className="panel tx-sheet p-6">
          <div className="flex items-start gap-3">
            <div aria-hidden="true" className="tx-slate flex size-10 shrink-0 items-center justify-center rounded-[8px] text-highlight-soft">
              <Coins className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="pc-silver" className="text-base font-semibold text-foreground">Silver pot</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                A 1 g silver coin for every {formatINR(settings.silverStep)} in sales.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-foreground/[0.08] pt-4">
            <span className="text-sm text-foreground tabular-nums">
              {pot.unclaimed > 0 ? `${pot.unclaimed} g ready to claim` : 'No coins waiting'}
            </span>
            {pot.unclaimed > 0 && (
              <Button size="sm" disabled={!active || busy === 'silver'} onClick={onClaimSilver}>
                {busy === 'silver' && <Spinner />}
                Claim {pot.unclaimed} g
              </Button>
            )}
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section aria-labelledby="pc-pending" className="panel tx-sheet p-6">
          <h2 id="pc-pending" className={cn(panelHeading, 'mb-4')}>Pending claims</h2>
          <dl className="grid grid-cols-2 gap-5">
            <Stat label="Silver not yet claimed" value={`${pot.unclaimed} g`} />
            <Stat label="Savings on product purchases" value={formatINR(record.familySavings)} />
          </dl>
          {pending.length > 0 && (
            <ul className="mt-5 divide-y divide-foreground/[0.06] border-t border-foreground/[0.08]">
              {pending.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 text-sm text-foreground">{claimTitle(c)}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">Requested {formatDMY(c.createdAtMs || 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="pc-history" className="panel tx-sheet p-6">
          <h2 id="pc-history" className={cn(panelHeading, 'mb-4')}>History of gifts</h2>
          <dl>
            <Stat label="Silver coins earned to date" value={`${pot.earned} g`} />
          </dl>
          {fulfilled.length > 0 ? (
            <ul className="mt-5 divide-y divide-foreground/[0.06] border-t border-foreground/[0.08]">
              {fulfilled.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="inline-flex min-w-0 items-center gap-2 text-sm text-foreground">
                    <Gift aria-hidden="true" className="size-4 shrink-0 text-primary" />
                    {claimTitle(c)}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDMY(c.fulfilledAtMs || 0)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Gifts we have delivered show here.</p>
          )}
        </section>
      </div>
    </div>
  );
};

export const NotAPartner = ({ pending }: { pending: boolean }) => (
  <section className="panel tx-sheet mx-auto max-w-lg p-8 text-center">
    <Wallet aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
    <h2 className="mt-3 text-lg font-semibold text-foreground">
      {pending ? 'Your partner application is under review' : 'This area is for ICONOIQ partners'}
    </h2>
    <p className="mt-1 text-sm text-muted-foreground">
      {pending ? 'Your partner area opens once our team approves it.' : 'Academies and teachers can apply to become a partner.'}
    </p>
    <Button asChild className="mt-5">
      <Link to="/dealer?track=partner">{pending ? 'See your application' : 'Become a partner'}</Link>
    </Button>
  </section>
);
