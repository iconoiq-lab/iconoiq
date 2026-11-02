// ============================================
// /dealer programme page: the hero, the two track cards and the partner track
// (offer, application, pending, approved, rejected, suspended). Pure views;
// src/pages/DealerProgramme.tsx wires them to Firestore.
// ============================================

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock,
  GraduationCap,
  Lock,
  PauseCircle,
  Sparkles,
  Store,
  type LucideIcon,
} from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { PanelSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate, formatINR } from '@/lib/format';
import { INDIAN_STATES } from '@/lib/indianStates';
import { DUR, EASE_OUT } from '@/lib/motion';
import { PERKS, type PartnerSettings } from '@/lib/partner';
import { cn } from '@/lib/utils';
import { cleanPartnerApplication, type PartnerApplicationInput, type PartnerRecord } from '@/services/partnerService';

export const PARTNER_AREA_PATH = '/account/partner';

const enter = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.modal, ease: EASE_OUT, delay },
});

const panelHeading = 'text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground';
const labelCls = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground';
const twoCol = 'grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]';
const linkArrow = "link-arrow relative after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']";

/** "₹10,000 in sales", or "From day one" for perks every partner gets. */
export const unlockLabel = (unlockAt: number) => (unlockAt > 0 ? `Unlocks at ${formatINR(unlockAt)} in sales` : 'From day one');

// ─── Hero and track cards ──────────────────────────────────────────────────

export const ProgrammeHero = () => (
  <section className="tx-slate tx-contour relative mb-6 overflow-hidden rounded-panel p-6 text-charcoal-foreground shadow-panel dark:ring-1 dark:ring-highlight-soft/20 lg:p-10">
    <GraduationCap aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 size-44 opacity-[0.07]" />
    <p className="eyebrow-no on-dark !text-[10px]"><span>Academy &amp; Dealership Programme</span></p>
    <h1 className="relative mt-3 max-w-2xl font-heading text-3xl font-semibold leading-[1.1] tracking-tight text-balance lg:text-5xl">
      Learn. Teach. Earn. Explore!
    </h1>
    <p className="relative mt-3 max-w-xl text-sm leading-relaxed text-charcoal-foreground/80 lg:text-base">
      Partner with ICONOIQ to bring Indian heritage, creative learning and educational products to your academy.
    </p>
  </section>
);

export type Track = 'stockist' | 'partner';

export interface TrackCardInfo {
  /** One line under the title: the offer. */
  offer: string;
  /** The status chip when the customer already applied. */
  status?: { label: string; tone: 'success' | 'warning' | 'info' | 'neutral' | 'danger' };
  open: boolean;
}

const TRACK_META: Record<Track, { title: string; icon: LucideIcon; who: string }> = {
  stockist: { title: 'Become a stockist', icon: Store, who: 'For shops and outlets' },
  partner: { title: 'Become a partner', icon: GraduationCap, who: 'For academies and teachers' },
};

/** Two cards that pick the track shown below. Links (?track=), so the choice survives a reload and Back. */
export const TrackCards = ({ active, info, hrefFor }: { active: Track; info: Record<Track, TrackCardInfo>; hrefFor: (t: Track) => string }) => (
  <nav aria-label="Programme" className="mb-8 grid gap-3 sm:grid-cols-2">
    {(['stockist', 'partner'] as Track[]).map((t) => {
      const m = TRACK_META[t];
      const i = info[t];
      const on = active === t;
      return (
        <Link
          key={t}
          to={hrefFor(t)}
          replace
          aria-current={on ? 'page' : undefined}
          className={cn(
            'group panel tx-sheet relative flex gap-4 p-5 outline-none transition-[box-shadow,transform] duration-200 ease-out',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'motion-safe:hover:-translate-y-0.5',
            on ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-foreground/20',
          )}
        >
          <div aria-hidden="true" className="tx-slate flex size-11 shrink-0 items-center justify-center rounded-[8px] text-highlight-soft">
            <m.icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{m.who}</p>
            <p className="mt-0.5 text-base font-semibold text-foreground">{m.title}</p>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">{i.open || i.status ? i.offer : 'Not open right now'}</p>
            {i.status && <StatusBadge className="mt-2" tone={i.status.tone} label={i.status.label} />}
          </div>
          <ArrowRight
            aria-hidden="true"
            className={cn('mt-1 size-4 shrink-0 transition-transform duration-200', on ? 'text-primary' : 'text-muted-foreground motion-safe:group-hover:translate-x-0.5')}
          />
        </Link>
      );
    })}
  </nav>
);

// ─── Partner track ─────────────────────────────────────────────────────────

const PartnerBand = ({ lead }: { lead: string }) => (
  <section className="panel tx-sheet mb-6 p-6">
    <p className={panelHeading}>For academies and teachers</p>
    <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground lg:text-2xl">Become a partner</h2>
    <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{lead}</p>
  </section>
);

/** What a partner gets. Gold is never shown here (spec decision 2). */
export const PartnerOffer = ({ settings }: { settings: PartnerSettings }) => {
  const points = [
    `${settings.silverPercent}% of every delivered sale made with your personal code.`,
    'Your code works as a coupon in our checkout. Share it with your students and parents.',
    `Your family discount: use your own code for ${settings.silverPercent}% off your own orders.`,
    `A 1 g silver coin for every ${formatINR(settings.silverStep)} in sales.`,
    ...(settings.customerDiscountPercent > 0 ? [`Customers get ${settings.customerDiscountPercent}% off with your code.`] : []),
    'A higher tier unlocks as your sales grow.',
  ];
  const perks = PERKS.map((p) => ({ ...p, rule: settings.perks[p.id] })).sort((a, b) => a.rule.unlockAt - b.rule.unlockAt);
  return (
    <section aria-labelledby="partner-offer-heading" className="panel tx-sheet p-6">
      <h3 id="partner-offer-heading" className={cn(panelHeading, 'mb-4')}>What you get</h3>
      <ul className="space-y-3">
        {points.map((t) => (
          <li key={t} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary [stroke-width:2]" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <h3 className={cn(panelHeading, 'mb-3 mt-7')}>Business support that grows with you</h3>
      <ul className="divide-y divide-foreground/[0.06]">
        {perks.map((p) => (
          <li key={p.id} className="flex items-baseline justify-between gap-4 py-2.5">
            <span className="text-sm text-foreground">
              {p.title}
              {p.kind === 'count' && <span className="text-muted-foreground"> ×{p.rule.count}</span>}
              {p.kind === 'monthly' && <span className="text-muted-foreground"> (monthly)</span>}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {p.rule.unlockAt > 0 ? `from ${formatINR(p.rule.unlockAt)}` : 'day one'}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-5 border-t border-foreground/[0.08] pt-4 text-xs leading-relaxed text-muted-foreground">
        Sales count once an order is delivered, and come off again if it is returned or refunded.
      </p>
    </section>
  );
};

type PField = keyof PartnerApplicationInput;
const P_ORDER: PField[] = ['name', 'business', 'phone', 'city', 'state'];
const P_ID: Record<PField, string> = {
  name: 'partner-name',
  business: 'partner-business',
  phone: 'partner-phone',
  city: 'partner-city',
  state: 'partner-state',
};

export function validatePartnerApplication(v: PartnerApplicationInput): Partial<Record<PField, string>> {
  const e: Partial<Record<PField, string>> = {};
  if (v.name.length < 2) e.name = 'Enter your name.';
  if (v.business.length < 2) e.business = 'Enter your academy or business name.';
  if (!/^[+]?[0-9][0-9 ]{9,14}$/.test(v.phone)) e.phone = 'Enter a 10-digit phone number.';
  if (v.city.length < 2) e.city = 'Enter your city.';
  if (v.state.length < 2) e.state = 'Choose your state.';
  return e;
}

export const PartnerApplyForm = ({
  initial,
  submitting,
  onSubmit,
  heading = 'Apply to be a partner',
  onCancel,
  focusOnMount = false,
}: {
  initial: PartnerApplicationInput;
  submitting: boolean;
  onSubmit: (v: PartnerApplicationInput) => void | Promise<void>;
  heading?: string;
  onCancel?: () => void;
  focusOnMount?: boolean;
}) => {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<PField, string>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<PField | null>(null);

  useEffect(() => {
    if (focusOnMount) headingRef.current?.focus();
  }, [focusOnMount]);
  useEffect(() => {
    if (!pendingFocus.current) return;
    formRef.current?.querySelector<HTMLElement>(`#${P_ID[pendingFocus.current]}`)?.focus();
    pendingFocus.current = null;
  }, [errors]);

  const set = (k: PField, v: string) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const clean = cleanPartnerApplication(values);
    const found = validatePartnerApplication(clean);
    const first = P_ORDER.find((k) => found[k]);
    if (first) {
      pendingFocus.current = first;
      setErrors(found);
      return;
    }
    setErrors({});
    void onSubmit(clean);
  };
  const aria = (k: PField) => ({
    id: P_ID[k],
    'aria-invalid': errors[k] ? (true as const) : undefined,
    'aria-describedby': errors[k] ? `${P_ID[k]}-error` : undefined,
    'aria-required': 'true' as const,
  });
  const err = (k: PField) => errors[k] && <p id={`${P_ID[k]}-error`} className="text-xs text-destructive">{errors[k]}</p>;
  const label = (k: PField, text: string) => (
    <label htmlFor={P_ID[k]} className={labelCls}>
      {text}<span aria-hidden="true" className="ml-0.5 text-primary">*</span>
    </label>
  );

  return (
    <section aria-labelledby="partner-apply-heading" className="panel tx-sheet p-6">
      <h3 id="partner-apply-heading" ref={headingRef} tabIndex={-1} className="scroll-mt-24 text-lg font-semibold text-foreground outline-none">
        {heading}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        All fields are required. You sign in with this store account; your partner code comes with the approval.
      </p>
      <form ref={formRef} noValidate onSubmit={submit} className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          {label('name', 'Your name')}
          <Input {...aria('name')} autoComplete="name" maxLength={60} value={values.name} onChange={(e) => set('name', e.target.value)} />
          {err('name')}
        </div>
        <div className="flex flex-col gap-2">
          {label('business', 'Academy or business')}
          <Input {...aria('business')} autoComplete="organization" maxLength={80} value={values.business} onChange={(e) => set('business', e.target.value)} />
          {err('business')}
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          {label('phone', 'Phone')}
          <Input {...aria('phone')} type="tel" inputMode="tel" autoComplete="tel" maxLength={16} value={values.phone} onChange={(e) => set('phone', e.target.value)} />
          {err('phone')}
        </div>
        <div className="flex flex-col gap-2">
          {label('city', 'City')}
          <Input {...aria('city')} autoComplete="address-level2" maxLength={60} value={values.city} onChange={(e) => set('city', e.target.value)} />
          {err('city')}
        </div>
        <div className="flex flex-col gap-2">
          {label('state', 'State')}
          <Select value={values.state} onValueChange={(v) => set('state', v)}>
            <SelectTrigger {...aria('state')} className="aria-[invalid=true]:border-destructive">
              <SelectValue placeholder="Choose a state" />
            </SelectTrigger>
            <SelectContent>
              {INDIAN_STATES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err('state')}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:items-center">
          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting && <Spinner />}
            Send application
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel} className="w-full sm:w-auto">
              Cancel
            </Button>
          )}
        </div>
      </form>
    </section>
  );
};

const AppSummary = ({ title, r }: { title: string; r: PartnerApplicationInput }) => (
  <section aria-label={title} className="panel tx-sheet p-6">
    <h3 className={cn(panelHeading, 'mb-4')}>{title}</h3>
    <dl className="grid gap-4 sm:grid-cols-2">
      {([
        ['Name', r.name],
        ['Academy or business', r.business],
        ['Phone', r.phone],
        ['City', `${r.city}, ${r.state}`],
      ] as const).map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className={labelCls}>{k}</dt>
          <dd className="mt-1 break-words text-sm text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  </section>
);

export interface PartnerTrackProps {
  loading: boolean;
  /** A guest: shown in place of the form (sign in, then back here). */
  guestApply?: React.ReactNode;
  settings: PartnerSettings;
  record: PartnerRecord | null;
  reapplying: boolean;
  prefill: PartnerApplicationInput;
  draft: PartnerApplicationInput | null;
  submitting: boolean;
  onSubmit: (v: PartnerApplicationInput) => void | Promise<void>;
  onReapply: () => void;
  onCancelReapply: () => void;
  onWithdraw: () => void;
}

const toInput = (r: PartnerRecord): PartnerApplicationInput => ({ name: r.name, business: r.business, phone: r.phone, city: r.city, state: r.state });

export const PartnerTrack = ({
  loading,
  guestApply,
  settings,
  record,
  reapplying,
  prefill,
  draft,
  submitting,
  onSubmit,
  onReapply,
  onCancelReapply,
  onWithdraw,
}: PartnerTrackProps) => {
  if (loading) return <PanelSkeleton lines={4} label="Loading the partner programme" />;

  if (!record && !settings.enabled) {
    return (
      <EmptyState
        icon={GraduationCap}
        as="h2"
        title="The partner programme isn't open right now."
        description="Check back soon, or ask our team about it."
        action={{ label: 'Contact us', to: '/customer-support' }}
      />
    );
  }

  const status = record?.status;

  if (!record || (status === 'rejected' && reapplying)) {
    const again = Boolean(record);
    return (
      <>
        <motion.div {...enter()}>
          <PartnerBand lead="Earn on every sale made with your personal code, and unlock business support and gifts as your sales grow." />
        </motion.div>
        <div className={twoCol}>
          <motion.div {...enter(0.04)}><PartnerOffer settings={settings} /></motion.div>
          <motion.div {...enter(0.08)}>
            {guestApply && !record ? guestApply : <PartnerApplyForm
              key={again ? 'again' : 'new'}
              initial={draft ?? (record ? toInput(record) : prefill)}
              heading={again ? 'Apply again' : undefined}
              submitting={submitting}
              onSubmit={onSubmit}
              onCancel={again ? onCancelReapply : undefined}
              focusOnMount={again}
            />}
          </motion.div>
        </div>
      </>
    );
  }

  if (status === 'pending') {
    return (
      <>
        <motion.div {...enter()}><PartnerBand lead="Your application is with our team. You'll see the outcome here." /></motion.div>
        <div className={twoCol}>
          <motion.div {...enter(0.04)}>
            <section aria-labelledby="partner-pending-heading" className="panel tx-sheet p-6">
              <StatusBadge tone="warning" label="Under review" icon={Clock} />
              <h3 id="partner-pending-heading" className="mt-3 text-lg font-semibold text-foreground">We're reviewing your application</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {record.appliedAtMs ? `Sent on ${formatDate(record.appliedAtMs)}. ` : ''}Once approved, your partner code and earnings show in your partner area.
              </p>
              <Button type="button" variant="outline" className="mt-5 w-full sm:w-auto" onClick={onWithdraw}>
                Withdraw application
              </Button>
            </section>
          </motion.div>
          <motion.div {...enter(0.08)}><AppSummary title="Your application" r={record} /></motion.div>
        </div>
      </>
    );
  }

  if (status === 'approved') {
    return (
      <motion.section {...enter()} aria-labelledby="partner-approved-heading" className="tx-slate tx-contour relative overflow-hidden rounded-panel p-6 text-charcoal-foreground shadow-panel dark:ring-1 dark:ring-highlight-soft/20 lg:p-8">
        <Sparkles aria-hidden="true" className="pointer-events-none absolute -right-6 -top-6 size-36 opacity-[0.07]" />
        <StatusBadge tone="success" label="Approved partner" icon={BadgeCheck} />
        <h2 id="partner-approved-heading" className="mt-3 text-xl font-semibold tracking-tight lg:text-2xl">You're an ICONOIQ partner</h2>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-charcoal-foreground/70">Your partner code</p>
        <p className="mt-1 font-mono text-3xl font-semibold tracking-[0.12em]">{record.code}</p>
        <p className="mt-3 max-w-lg text-sm text-charcoal-foreground/80">
          Share it with your students and parents. Your earnings, business support and claims are in your partner area.
        </p>
        <Button asChild variant="secondary" className="mt-5 w-full sm:w-auto">
          <Link to={PARTNER_AREA_PATH}>Open partner area</Link>
        </Button>
      </motion.section>
    );
  }

  if (status === 'rejected') {
    return (
      <>
        <motion.div {...enter()}><PartnerBand lead="You can update your details and apply again." /></motion.div>
        <div className={twoCol}>
          <motion.div {...enter(0.04)}>
            <Notice
              tone="neutral"
              title="Your application wasn't approved"
              role="region"
              aria-label="Partner application status"
              action={
                settings.enabled ? (
                  <Button id="partner-reapply" type="button" onClick={onReapply}>Apply again</Button>
                ) : undefined
              }
            >
              {record.reviewNote ? <>Note from our team: {record.reviewNote}</> : 'Contact support to find out more.'}
            </Notice>
          </motion.div>
          <motion.div {...enter(0.08)}><AppSummary title="Your last application" r={record} /></motion.div>
        </div>
      </>
    );
  }

  return (
    <Notice
      tone="warning"
      icon={PauseCircle}
      title="Your partner account is on hold"
      role="region"
      aria-label="Partner account status"
      action={<Button asChild><Link to="/customer-support">Contact support</Link></Button>}
    >
      Your code doesn't work at checkout for now. Earnings you already have are safe.
      {record.reviewNote && <> Note from our team: {record.reviewNote}</>}
    </Notice>
  );
};

/** A small lock row for locked perks, shared with the partner area. */
export const LockedLine = ({ unlockAt }: { unlockAt: number }) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
    <Lock aria-hidden="true" className="size-3.5" /> {unlockLabel(unlockAt)}
  </span>
);

export { linkArrow };
