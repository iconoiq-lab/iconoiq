import { useRewardsLive } from "@/hooks/useRewardSettings";

const phrases = [
  "Delivery across India",
  "Secure Razorpay checkout",
  "Shop new arrivals and best sellers",
];

/**
 * Service promises on a paper strip (tablet and desktop only, as before).
 * Static and centred: the marquee band higher up is the page's one moving strip.
 * It always stays on one line: tablets show two promises, laptops three,
 * screens from 1400px all four, so a wrap can never leave a diamond at a line start.
 * The points promise is only in the strip while the shop's rewards are running
 * (build switch and the live setting); without it the other promises fill the row.
 */
const visibility = ["flex", "flex", "hidden lg:flex", "hidden min-[1400px]:flex"];
const FreeShippingBand = () => {
  const rewards = useRewardsLive();
  const shown = rewards ? ["Earn loyalty points on every order", ...phrases] : phrases;
  return (
    <section className="tx-sheet hidden border-y border-foreground/[0.08] py-3.5 md:block">
      <ul className="container-custom flex flex-nowrap items-center justify-center gap-x-10">
        {shown.map((phrase, index) => (
          <li key={phrase} className={`${visibility[index]} items-center gap-10`}>
            {index > 0 && <span aria-hidden="true" className="sep-diamond !bg-primary/70" />}
            <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/75">
              {phrase}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default FreeShippingBand;
