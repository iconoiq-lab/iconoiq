import { useEffect, useRef, useState } from 'react';
import { Gift } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { CoinGiftCard } from '@/components/coin/CoinGiftCard';
import { coinName, DEFAULT_COIN_SETTINGS, type CoinGiftSettings, type OrderCoinGift } from '@/lib/coinGift';
import { revealCoin, subscribeCoinSettings, subscribeOrderCoin } from '@/services/coinGiftService';

const DESKTOP = '(min-width: 1024px)';

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP).matches);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return desktop;
}

/** An order's coin and the shop's coin settings, live. `coin` is undefined while loading. */
export function useOrderCoin(orderId: string | null) {
  const [coin, setCoin] = useState<OrderCoinGift | null | undefined>(undefined);
  const [settings, setSettings] = useState<CoinGiftSettings>(DEFAULT_COIN_SETTINGS);
  useEffect(() => {
    if (!orderId) {
      setCoin(null);
      return;
    }
    setCoin(undefined);
    return subscribeOrderCoin(orderId, setCoin);
  }, [orderId]);
  useEffect(() => subscribeCoinSettings(setSettings), []);
  return { coin, settings };
}

interface CoinGiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  coin: OrderCoinGift;
  settings: CoinGiftSettings;
  /** Admin preview: nothing is saved. */
  preview?: boolean;
}

/** The coin card to scratch: a bottom sheet on phones, a dialog on desktop. */
export function CoinGiftDialog({ open, onOpenChange, orderId, coin, settings, preview = false }: CoinGiftDialogProps) {
  const desktop = useIsDesktop();
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Fixed when it opens, so the card does not jump to "revealed" while the customer scratches it.
  const [snap, setSnap] = useState({ open, revealed: coin.revealed });
  if (snap.open !== open) setSnap({ open, revealed: coin.revealed });
  const startRevealed = snap.open === open ? snap.revealed : coin.revealed;

  const title = 'A gift with your order';
  const description = preview
    ? 'Preview only, nothing is saved.'
    : startRevealed
    ? `${coinName(coin.type)} card, packed with this order`
    : 'Scratch the coin to see which Lakshmi coin comes with this order.';

  const body = (
    <>
      <CoinGiftCard
        key={`${orderId}:${open}:${startRevealed}`}
        coin={coin}
        goldEvery={settings.goldEvery}
        minOrder={settings.minOrder}
        startRevealed={startRevealed}
        // Saved so the card is not offered again; if it fails, it is simply offered next time.
        onReveal={() => {
          if (!preview) void revealCoin(orderId);
        }}
      />
      <Button className="mt-4 w-full" onClick={() => onOpenChange(false)}>
        Done
      </Button>
    </>
  );

  // Focus the title, not the first button.
  const focusTitle = (e: Event) => {
    e.preventDefault();
    titleRef.current?.focus();
  };

  const heading = (
    <span className="inline-flex items-center gap-2">
      <Gift className="size-5 text-primary" aria-hidden="true" />
      {title}
    </span>
  );

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[400px] p-6" onOpenAutoFocus={focusTitle}>
          <DialogTitle ref={titleRef} tabIndex={-1} className="font-heading text-xl font-semibold tracking-tight outline-none">
            {heading}
          </DialogTitle>
          <DialogDescription className="-mt-1 mb-1">{description}</DialogDescription>
          {body}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="tx-paper max-h-[92dvh] overflow-y-auto px-5 pt-3" onOpenAutoFocus={focusTitle}>
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-foreground/15" />
        <SheetTitle ref={titleRef} tabIndex={-1} className="font-heading text-xl font-semibold tracking-tight outline-none">
          {heading}
        </SheetTitle>
        <SheetDescription className="mb-4 mt-0.5">{description}</SheetDescription>
        {body}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Opens the coin card by itself once, as soon as the server has given this
 * order a coin the customer has not scratched yet (the checkout success screen).
 */
export function CoinGiftPrompt({ orderId }: { orderId: string | null }) {
  const { coin, settings } = useOrderCoin(orderId);
  const [open, setOpen] = useState(false);
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!orderId || !coin || coin.status !== 'active' || coin.revealed || shown.current === orderId) return;
    shown.current = orderId;
    setOpen(true);
  }, [orderId, coin]);
  if (!orderId || !coin) return null;
  return <CoinGiftDialog open={open} onOpenChange={setOpen} orderId={orderId} coin={coin} settings={settings} />;
}
