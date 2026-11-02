// ============================================
// PARTNER AREA (/account/partner): an approved partner's earnings, payouts,
// business support and claims. Container only; views in PartnerAreaViews.tsx.
// ============================================

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { IconButton } from '@/components/ui/icon-button';
import { PanelSkeleton } from '@/components/skeletons';
import { Notice } from '@/components/ui/notice';
import { NotAPartner, PartnerAreaView, type PartnerTab } from '@/components/partner/PartnerAreaViews';
import { useAuth } from '@/contexts/AuthContext';
import { usePageMeta } from '@/hooks/usePageMeta';
import { usePartner } from '@/hooks/usePartner';
import { describeError } from '@/lib/errorMessage';
import { silverPot, type EarningRow, type PerkId } from '@/lib/partner';
import {
  claimSilver,
  confirmPayoutReceived,
  requestPerk,
  subscribeClaims,
  subscribeEarnings,
  subscribePayouts,
  type ClaimRow,
  type PayoutRow,
} from '@/services/partnerService';

const TABS: PartnerTab[] = ['account', 'support', 'claims'];

const PartnerShell = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh tx-paper">
      <div className="hidden lg:block"><Header /></div>
      <div className="tx-sheet sticky top-0 z-sticky flex items-center gap-2 border-b border-foreground/[0.08] px-2 py-1.5 lg:hidden">
        <IconButton label="Back" onClick={() => navigate(-1)}>
          <ArrowLeft />
        </IconButton>
        <p className="font-heading text-xl font-semibold tracking-tight text-foreground" aria-hidden="true">Partner area</p>
      </div>
      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-6 pb-24 outline-none lg:py-10 lg:pb-10">
        <h1 className="mb-6 hidden font-heading text-3xl font-semibold tracking-tight text-foreground lg:block">Partner area</h1>
        <h1 className="sr-only lg:hidden">Partner area</h1>
        {children}
      </main>
      <div className="hidden lg:block"><Footer /></div>
    </div>
  );
};

const PartnerArea: React.FC = () => {
  const { user } = useAuth();
  const partner = usePartner();
  const [params, setParams] = useSearchParams();
  const [earnings, setEarnings] = useState<EarningRow[] | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[] | null>(null);
  const [claims, setClaims] = useState<ClaimRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());

  usePageMeta({ title: 'Partner area', noindex: true });

  const uid = user?.uid ?? null;
  const status = partner.record?.status;
  const member = status === 'approved' || status === 'suspended';

  useEffect(() => {
    if (!uid || !member) return;
    const fail = (e: Error) => setError(describeError(e));
    const offs = [
      subscribeEarnings(uid, setEarnings, fail),
      subscribePayouts(uid, setPayouts, fail),
      subscribeClaims(uid, setClaims, fail),
    ];
    return () => offs.forEach((o) => o());
  }, [uid, member]);

  const asked = params.get('tab') as PartnerTab | null;
  const tab: PartnerTab = asked && TABS.includes(asked) ? asked : 'account';
  const onTab = (t: PartnerTab) => setParams(t === 'account' ? {} : { tab: t }, { replace: true });

  const run = async (key: string, work: () => Promise<void>, done: string) => {
    setBusy(key);
    try {
      await work();
      toast.success(done);
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  const body = () => {
    if (!partner.ready) return <PanelSkeleton lines={5} label="Loading your partner area" />;
    if (!partner.record || !member) return <NotAPartner pending={status === 'pending'} />;
    if (error) return <Notice tone="danger" title="We couldn't load your partner area">{error}</Notice>;
    if (!earnings || !payouts || !claims) return <PanelSkeleton lines={5} label="Loading your partner area" />;
    const record = partner.record;
    return (
      <PartnerAreaView
        record={record}
        settings={partner.settings}
        earnings={earnings}
        payouts={payouts}
        claims={claims}
        nowMs={nowMs}
        tab={tab}
        onTab={onTab}
        busy={busy}
        onReceived={(id) => uid && run(id, () => confirmPayoutReceived(uid, id), 'Thanks, payout confirmed')}
        onRedeem={(perk: PerkId, opts) =>
          uid && run(`${perk}:${opts.index ?? opts.month ?? ''}`, () => requestPerk(uid, perk, opts), 'Request sent to our team')
        }
        onClaimSilver={() =>
          uid && run('silver', () => claimSilver(uid, silverPot(record.lifetimeSales, partner.settings.silverStep, claims)), 'Silver coins claimed')
        }
      />
    );
  };

  return <PartnerShell>{body()}</PartnerShell>;
};

export default PartnerArea;
