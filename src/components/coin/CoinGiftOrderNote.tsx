import { useState } from 'react';
import { Gift } from 'lucide-react';
import { CoinGiftDialog, useOrderCoin } from '@/components/coin/CoinGiftDialog';
import { coinName } from '@/lib/coinGift';

/**
 * One line on the customer's order page about the order's Lakshmi coin card:
 * a Scratch button until it is revealed, the coin after, a muted line when the
 * order's cancellation took it back. Nothing when the order has no coin.
 */
export function CoinGiftOrderNote({ orderId }: { orderId: string | null }) {
  const { coin, settings } = useOrderCoin(orderId);
  const [open, setOpen] = useState(false);
  if (!orderId || !coin) return null;

  return (
    <>
      <p className="flex items-start gap-2 px-4 pb-3 text-xs text-muted-foreground">
        <Gift className="mt-px size-3.5 shrink-0 text-primary" aria-hidden="true" />
        {coin.status === 'void' ? (
          <span>The Lakshmi coin card was cancelled with this order.</span>
        ) : coin.revealed ? (
          <span>
            {coinName(coin.type)} card: packed with this order.{' '}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              View card
            </button>
          </span>
        ) : (
          <span>
            A Lakshmi coin card comes with this order.{' '}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Scratch to see your coin
            </button>
          </span>
        )}
      </p>
      {coin.status === 'active' && (
        <CoinGiftDialog open={open} onOpenChange={setOpen} orderId={orderId} coin={coin} settings={settings} />
      )}
    </>
  );
}
