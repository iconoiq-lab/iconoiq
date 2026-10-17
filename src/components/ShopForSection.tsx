import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import { SmartImage } from "@/components/ui/smart-image";
import { SHOP_FOR } from "@/config/shopFor";

/**
 * "Shop for": one card per kind of buyer (src/config/shopFor.ts), each a tall photo with
 * the audience and a short line on it, linking to the shelf that buyer wants. Four across
 * on a laptop, two by two on a phone. ICONOIQ, 2026-10-17.
 */
const ShopForSection = () => {
  if (SHOP_FOR.length === 0) return null;
  return (
    <section aria-labelledby="shop-for-title" className="py-12 md:py-20">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8 lg:px-12">
        <Reveal className="mb-6 flex flex-col items-center text-center md:mb-10">
          <p className="eyebrow-no eyebrow-center mb-3">Shop for</p>
          <h2
            id="shop-for-title"
            className="text-2xl font-semibold text-foreground [text-wrap:balance] md:text-3xl lg:text-4xl"
            style={{ fontFamily: "var(--font-heading)", fontStretch: "var(--font-heading-stretch)" }}
          >
            Who is learning?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">Pick a learner and go straight to their shelf</p>
        </Reveal>

        <ul className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4">
          {SHOP_FOR.map((item, i) => (
            <li key={item.title}>
              <Reveal delay={i * 0.06}>
              <Link
                to={item.href}
                className="group relative block aspect-[3/4] overflow-hidden rounded-card bg-charcoal outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring lg:aspect-[4/5]"
              >
                <SmartImage
                  src={item.image}
                  alt=""
                  preset="card"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-reveal ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-charcoal/95 via-charcoal/45 to-transparent"
                />
                <div className="absolute inset-x-0 bottom-0 p-3.5 md:p-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-highlight-soft md:text-[11px]">For</p>
                  <h3
                    className="mt-1 text-lg leading-tight text-charcoal-foreground [text-wrap:balance] md:text-2xl"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {item.title}
                  </h3>
                  <p className="mt-1.5 hidden text-sm leading-snug text-charcoal-foreground/80 [text-wrap:pretty] md:block">
                    {item.line}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-charcoal-foreground md:text-[11px]">
                    Shop now
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3.5 transition-transform duration-hover ease-out group-hover:translate-x-1 motion-reduce:transition-none"
                    />
                  </span>
                </div>
              </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default ShopForSection;
