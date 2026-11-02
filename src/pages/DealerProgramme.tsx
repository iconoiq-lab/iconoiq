// ============================================
// ACADEMY & DEALERSHIP PROGRAMME (/dealer): the hero, two track cards
// (stockist, partner) and the chosen track. A thin container: dealer state
// from useDealer(), partner state from usePartner(), screens drawn by
// src/components/dealer/DealerViews.tsx and src/components/partner/PartnerViews.tsx.
// ============================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDealer } from '@/hooks/useDealer';
import { usePageMeta } from '@/hooks/usePageMeta';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { IconButton } from '@/components/ui/icon-button';
import { DealerPageView } from '@/components/dealer/DealerViews';
import { StockistArea } from '@/components/dealer/StockistArea';
import { PartnerTrack, ProgrammeHero, TrackCards, type Track, type TrackCardInfo } from '@/components/partner/PartnerViews';
import { usePartner } from '@/hooks/usePartner';
import { describeError } from '@/lib/errorMessage';
import type { DealerApplicationInput } from '@/lib/dealerForm';
import { DEFAULT_DEALER_SETTINGS, type DealerSettings } from '@/lib/dealer';
import { applyAsDealer, subscribeDealerSettings, withdrawDealerApplication } from '@/services/dealerService';
import { GuestApplyPanel } from '@/components/partner/GuestApplyPanel';
import { applyAsPartner, withdrawPartnerApplication, type PartnerApplicationInput } from '@/services/partnerService';

/** Wallet-style chrome (PurchaseSummary's shell): desktop Header and Footer, phone sticky title bar and bottom nav. */
const DealerShell = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh tx-paper">
      <div className="hidden lg:block"><Header /></div>

      <div className="tx-sheet sticky top-0 z-sticky flex items-center gap-2 border-b border-foreground/[0.08] px-2 py-1.5 lg:hidden">
        <IconButton label="Back" onClick={() => navigate(-1)}>
          <ArrowLeft />
        </IconButton>
        <p className="font-heading text-xl font-semibold tracking-tight text-foreground" aria-hidden="true">Partner with us</p>
      </div>

      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-6 pb-24 outline-none lg:py-10 lg:pb-10">
        {children}
      </main>

      <div className="hidden lg:block"><Footer /></div>
    </div>
  );
};

const focusMain = () => document.getElementById('main')?.focus();

const DealerProgramme: React.FC = () => {
  const { user, userProfile } = useAuth();
  const dealer = useDealer();
  const [submitting, setSubmitting] = useState(false);
  const [reapplying, setReapplying] = useState(false);
  /**
   * What the customer sent, kept until the write is confirmed. The Firestore listener fires
   * a local snapshot on the write, so the page moves to Pending and the form unmounts at once;
   * if the server then rejects the write, the form comes back with this, not an empty one.
   */
  const [draft, setDraft] = useState<DealerApplicationInput | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const withdrawRef = useRef<HTMLButtonElement>(null);
  /** Where focus goes when the withdraw dialog closes: the button on Cancel, the page once it is gone. */
  const dialogReturnRef = useRef<HTMLElement | null>(null);
  const focusReapplyAfterCancel = useRef(false);
  const lastStatus = useRef<string | null | undefined>(undefined);

  usePageMeta({
    title: 'Academy & Dealership Programme',
    description: 'Learn. Teach. Earn. Explore! Stock ICONOIQ in your shop at dealer prices, or partner with us as an academy or teacher and earn on every sale made with your code.',
    canonicalPath: '/dealer',
  });
  const navigate = useNavigate();
  const location = useLocation();

  // Guests read the public stockist settings here (useDealer reads nothing for them).
  const [guestSettings, setGuestSettings] = useState<DealerSettings | null>(null);
  useEffect(() => {
    if (user) return;
    setGuestSettings(null);
    return subscribeDealerSettings((s) => setGuestSettings(s), () => setGuestSettings({ ...DEFAULT_DEALER_SETTINGS }));
  }, [user]);

  const partner = usePartner();
  const [params] = useSearchParams();
  const [pSubmitting, setPSubmitting] = useState(false);
  const [pReapplying, setPReapplying] = useState(false);
  const [pDraft, setPDraft] = useState<PartnerApplicationInput | null>(null);
  const [pConfirmOpen, setPConfirmOpen] = useState(false);
  const pStatus = partner.record?.status ?? null;
  useEffect(() => {
    if (pStatus !== 'rejected') setPReapplying(false);
  }, [pStatus]);

  const { record, pricing } = dealer;
  const settings = user ? dealer.settings : guestSettings ?? DEFAULT_DEALER_SETTINGS;
  const ready = user ? dealer.ready : guestSettings !== null;
  const status = record?.status ?? null;

  // Applying again only makes sense while the application is rejected.
  useEffect(() => {
    if (status !== 'rejected') setReapplying(false);
  }, [status]);

  // A button that was pressed disappears when the status changes (Send, Withdraw), so
  // focus would drop to the page body. Keep it on the page instead.
  useEffect(() => {
    if (!ready) return;
    if (lastStatus.current !== undefined && lastStatus.current !== status) {
      const active = document.activeElement;
      if (!active || active === document.body) focusMain();
    }
    lastStatus.current = status;
  }, [ready, status]);

  useEffect(() => {
    if (!reapplying && focusReapplyAfterCancel.current) {
      focusReapplyAfterCancel.current = false;
      document.getElementById('dealer-reapply')?.focus();
    }
  }, [reapplying]);

  const prefill = useMemo<DealerApplicationInput>(
    () => ({
      businessName: '',
      businessType: '',
      contactName: userProfile?.name || userProfile?.username || '',
      phone: userProfile?.phone || '',
      city: '',
      state: '',
      gstin: '',
      message: '',
    }),
    [userProfile?.name, userProfile?.username, userProfile?.phone],
  );

  const handleSubmit = useCallback(
    async (application: DealerApplicationInput) => {
      if (!user) return;
      const reapply = status === 'rejected';
      setDraft(application);
      setSubmitting(true);
      try {
        await applyAsDealer(user.uid, application, reapply);
        setDraft(null);
        toast.success('Application sent');
      } catch (e) {
        toast.error(describeError(e));
        // The local snapshot already reset `reapplying` (the status went to pending); once it
        // reverts to rejected, show the form again, not the rejected notice.
        if (reapply) setReapplying(true);
      } finally {
        setSubmitting(false);
      }
    },
    [user, status],
  );

  const handleWithdraw = useCallback(async () => {
    if (!user) return;
    try {
      await withdrawDealerApplication(user.uid);
    } catch (e) {
      toast.error(describeError(e));
      throw e; // keeps the dialog open
    }
    dialogReturnRef.current = document.getElementById('main');
    toast('Application withdrawn');
  }, [user]);

  const asked = params.get('track');
  const track: Track =
    asked === 'partner' || asked === 'stockist' ? asked : partner.record && !dealer.record ? 'partner' : 'stockist';

  const STATUS_CHIP = {
    pending: { label: 'Under review', tone: 'warning' },
    approved: { label: 'Approved', tone: 'success' },
    active: { label: 'Approved', tone: 'success' },
    rejected: { label: 'Not approved', tone: 'neutral' },
    suspended: { label: 'On hold', tone: 'warning' },
  } as const satisfies Record<string, TrackCardInfo['status']>;
  const chip = (s: string | null | undefined) => (s && s in STATUS_CHIP ? STATUS_CHIP[s as keyof typeof STATUS_CHIP] : undefined);
  const firstTier = settings.tiers[0];
  const cardInfo: Record<Track, TrackCardInfo> = {
    stockist: {
      offer: firstTier
        ? `Buy stock in bulk at up to ${Math.max(...settings.tiers.map((t) => t.percent))}% off, then resell.`
        : 'Buy stock in bulk at dealer prices, then resell.',
      status: chip(status),
      open: settings.enabled,
    },
    partner: {
      offer: `Earn ${partner.settings.silverPercent}% on every sale made with your code.`,
      status: chip(pStatus),
      open: partner.settings.enabled,
    },
  };

  const pPrefill: PartnerApplicationInput = {
    name: userProfile?.name || userProfile?.username || '',
    business: '',
    phone: userProfile?.phone || '',
    city: '',
    state: '',
  };

  const handlePartnerSubmit = async (application: PartnerApplicationInput) => {
    if (!user) return;
    const reapply = pStatus === 'rejected';
    setPDraft(application);
    setPSubmitting(true);
    try {
      await applyAsPartner(user.uid, application, reapply);
      setPDraft(null);
      toast.success('Application sent');
    } catch (e) {
      toast.error(describeError(e));
      if (reapply) setPReapplying(true);
    } finally {
      setPSubmitting(false);
    }
  };

  const handlePartnerWithdraw = async () => {
    if (!user) return;
    try {
      await withdrawPartnerApplication(user.uid);
    } catch (e) {
      toast.error(describeError(e));
      throw e;
    }
    dialogReturnRef.current = document.getElementById('main');
    toast('Application withdrawn');
  };

  const signInToApply = () => navigate('/login', { state: { from: location, reason: 'dealer' } });
  const guestApply = user ? undefined : <GuestApplyPanel track={track} onSignIn={signInToApply} />;

  return (
    <DealerShell>
      <ProgrammeHero />
      <TrackCards active={track} info={cardInfo} hrefFor={(t) => `/dealer?track=${t}`} />
      {track === 'partner' ? (
        <PartnerTrack
          loading={!partner.ready}
          guestApply={guestApply}
          settings={partner.settings}
          record={partner.record}
          reapplying={pReapplying}
          prefill={pPrefill}
          draft={pDraft}
          submitting={pSubmitting}
          onSubmit={handlePartnerSubmit}
          onReapply={() => setPReapplying(true)}
          onCancelReapply={() => {
            setPDraft(null);
            setPReapplying(false);
          }}
          onWithdraw={() => {
            dialogReturnRef.current = document.activeElement as HTMLElement | null;
            setPConfirmOpen(true);
          }}
        />
      ) : (
      <DealerPageView
        loading={!ready}
        guestApply={guestApply}
        record={record}
        programmeOn={settings.enabled}
        tiers={settings.tiers}
        pricingKnown={pricing !== null}
        reapplying={reapplying}
        prefill={prefill}
        draft={draft}
        submitting={submitting}
        onSubmit={handleSubmit}
        onReapply={() => setReapplying(true)}
        onCancelReapply={() => {
          focusReapplyAfterCancel.current = true;
          setDraft(null);
          setReapplying(false);
        }}
        onWithdraw={() => {
          dialogReturnRef.current = withdrawRef.current;
          setConfirmOpen(true);
        }}
        withdrawRef={withdrawRef}
        stockistArea={user && status === 'approved' ? <StockistArea uid={user.uid} /> : undefined}
      />
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Withdraw your application?"
        description="We'll delete it. You can send a new application if the programme is open."
        confirmLabel="Withdraw"
        cancelLabel="Keep application"
        tone="danger"
        returnFocusRef={dialogReturnRef}
        onConfirm={handleWithdraw}
      />
      <ConfirmDialog
        open={pConfirmOpen}
        onOpenChange={setPConfirmOpen}
        title="Withdraw your partner application?"
        description="We'll delete it. You can send a new application if the programme is open."
        confirmLabel="Withdraw"
        cancelLabel="Keep application"
        tone="danger"
        returnFocusRef={dialogReturnRef}
        onConfirm={handlePartnerWithdraw}
      />
    </DealerShell>
  );
};

export default DealerProgramme;
