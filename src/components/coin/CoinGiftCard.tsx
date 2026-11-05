import { useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScratchFoil } from '@/components/scratch/ScratchFoil';
import { coinName, ordersToGold, type OrderCoinGift } from '@/lib/coinGift';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BRAND } from '@/config/brand';

/** The card art (602x865): the coin's circle sits at left 27.5%, top 40.8%, 45% of the width across. */
const ART = { gold: '/art/coin-gift/gold.webp', silver: '/art/coin-gift/silver.webp' } as const;

export interface CoinGiftCardProps {
  coin: OrderCoinGift;
  /** Every Nth coin order is gold (siteSettings/coinGift). */
  goldEvery: number;
  /** The smallest order (goods, rupees) that earns a coin. */
  minOrder: number;
  /** Called once when the customer reveals the coin (scratched or pressed Reveal). */
  onReveal: () => void;
  /** Already revealed before: show the coin, no foil. */
  startRevealed?: boolean;
}

/** What the customer reads under the revealed coin. */
export function coinCopy(coin: OrderCoinGift, goldEvery: number, minOrder: number) {
  const name = coinName(coin.type);
  const packed = `Your ${name} card is packed with this order.`;
  if (coin.type === 'gold') return { lead: `A ${name}!`, rest: `${packed} Thank you for shopping with ${BRAND.name} again.` };
  const left = ordersToGold(coin.seq, goldEvery);
  const rest =
    goldEvery <= 1
      ? packed
      : `${packed} ${left === 1 ? 'Your next order' : `${left} more orders`} of ${formatINR(minOrder)} or more ${left === 1 ? 'brings' : 'bring'} a gold coin.`;
  return { lead: `A ${name}.`, rest };
}

/**
 * The Lakshmi coin card the shop prints and packs with the order, with a round
 * scratch foil over the coin. The coin is already decided (the server set it
 * when the order was paid); scratching only reveals it on screen.
 */
export function CoinGiftCard({ coin, goldEvery, minOrder, onReveal, startRevealed = false }: CoinGiftCardProps) {
  const [revealed, setRevealed] = useState(startRevealed);
  const told = useRef(startRevealed);
  const titleRef = useRef<HTMLParagraphElement>(null);

  const reveal = () => {
    setRevealed(true);
    if (told.current) return;
    told.current = true;
    onReveal();
  };

  // Keep focus somewhere sensible when the Reveal button disappears.
  useEffect(() => {
    if (revealed && !startRevealed) titleRef.current?.focus();
  }, [revealed, startRevealed]);

  const copy = coinCopy(coin, goldEvery, minOrder);
  const dots = goldEvery > 1 && goldEvery <= 12 ? goldEvery : 0;
  const filled = coin.type === 'gold' ? dots : Math.min(coin.seq, dots - 1);

  return (
    <div>
      <div
        role="img"
        aria-label={revealed ? `${coinName(coin.type)} card from ${BRAND.name}` : 'Lakshmi coin card, the coin is under the scratch foil'}
        className="relative mx-auto aspect-[602/865] w-full max-w-[300px] select-none overflow-hidden rounded-card shadow-panel"
      >
        <img
          src={ART[coin.type]}
          alt=""
          draggable={false}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute aspect-square" style={{ left: '27.5%', top: '40.8%', width: '45%' }}>
          {!startRevealed && (
            <ScratchFoil
              round
              resetKey={0}
              fading={revealed}
              onFirstStroke={() => {}}
              onCleared={reveal}
            />
          )}
        </div>
      </div>

      {/* Announced when the coin is revealed (polite, so it never interrupts). */}
      <div role="status" className={revealed ? 'mt-4' : undefined}>
        {revealed && (
          <div className={cn(!startRevealed && 'sw-pop', 'text-center')}>
            <p ref={titleRef} tabIndex={-1} className="text-sm leading-relaxed text-foreground outline-none">
              <span className="font-semibold">{copy.lead} </span>
              <span className="text-muted-foreground">{copy.rest}</span>
            </p>
            {dots > 0 && coin.status === 'active' && (
              <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true">
                {Array.from({ length: dots }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'size-2.5 rounded-full border',
                      i < filled ? 'border-primary bg-primary' : 'border-foreground/25 bg-transparent',
                      i === dots - 1 && 'size-3 border-highlight',
                      i === dots - 1 && i < filled && 'bg-highlight',
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!revealed && (
        <>
          <Button variant="outline" className="mt-4 w-full" onClick={reveal}>
            <Eye aria-hidden="true" /> Reveal coin
          </Button>
          <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
            Scratch the coin with your finger or mouse, or press Reveal coin.
          </p>
        </>
      )}
    </div>
  );
}
