import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SmartImage } from "@/components/ui/smart-image";
import { cldUrl } from "@/lib/cloudinaryUrl";
import type { Banner } from "@/services/bannerService";

/** The phone and tablet crop of the banner, as in the Classic hero. */
const MOBILE_QUERY = "(max-width: 1023px)";

/** The banner's link: an external address opens in a new tab, anything else is an in-app route. */
function BannerLink({ to, className, children, ...rest }: { to: string; className: string; children?: ReactNode; "aria-hidden"?: true; tabIndex?: number }) {
  return /^https?:\/\//i.test(to) ? (
    <a href={to} target="_blank" rel="noopener noreferrer" className={className} {...rest}>
      {children}
    </a>
  ) : (
    <Link to={to} className={className} {...rest}>
      {children}
    </Link>
  );
}

/**
 * One slide of the `split` hero (docs/template/SECTIONS.md).
 *
 * Desktop: a 12-column grid, the text panel (5/12) beside the photo (7/12).
 * Phones and tablets: the photo, then the text below it on a plain panel, so
 * nothing is laid over the picture and no scrim is needed. The carousel
 * (track, autoplay, swipe, dots) stays in HeroBanner; this is the slide's inside.
 *
 * With a banner link the whole slide is clickable, as in Classic. Classic stretches
 * the CTA's ::after over the slide; btn-copper already uses its own ::after for the
 * foil sweep, so here a second, hidden link covers the slide instead (aria-hidden,
 * out of the Tab order: the CTA stays the one link a keyboard or screen reader meets).
 */
export function SplitSlide({
  banner,
  line,
  priority,
  onLoad,
}: {
  banner: Banner;
  /** The slide's HERO_LINES entry. */
  line: string;
  /** True for the first slide: its photo is the page's LCP, so it loads eagerly. */
  priority: boolean;
  /** Called when the photo has loaded (HeroBanner starts autoplay on the first one). */
  onLoad?: () => void;
}) {
  const link = banner.redirectLink?.trim();
  // z-[2]: above the slide-wide link below.
  const ctaClass = "btn-copper z-[2] mt-6 w-fit md:mt-7 lg:mt-8";
  const cta = (
    <>
      Explore the range <ArrowRight aria-hidden="true" className="size-3.5" />
    </>
  );

  return (
    <div className="flex flex-1 flex-col lg:grid lg:h-[min(72vh,48vw)] lg:flex-none lg:grid-cols-12">
      {/* Text panel. It comes first in the DOM, so a screen reader meets the line before the (decorative) photo. */}
      <div className="flex flex-1 flex-col justify-center bg-muted px-5 py-6 md:px-10 md:py-8 lg:col-span-5 lg:flex-none lg:p-12">
        <h2
          className="whitespace-pre-line text-[32px] font-semibold leading-[1.04] text-foreground [text-wrap:balance] md:text-[44px] lg:text-[60px] xl:text-[68px]"
          style={{ fontFamily: "var(--font-heading)", fontStretch: "var(--font-heading-stretch)", letterSpacing: "-0.03em" }}
        >
          {line}
        </h2>
        {link ? (
          <BannerLink to={link} className={ctaClass}>
            {cta}
          </BannerLink>
        ) : null}
      </div>

      <div className="relative order-first aspect-[4/5] overflow-hidden bg-muted md:aspect-[4/3] lg:order-none lg:col-span-7 lg:aspect-auto">
        <picture>
          {/* A <source> wins over the <img> when its media query matches, so it needs the same transform as the <img>. */}
          <source media={MOBILE_QUERY} srcSet={cldUrl(banner.mobileImageUrl || banner.imageUrl, "detail")} />
          <SmartImage
            src={banner.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover/hero:scale-[1.03]"
            draggable={false}
            preset="hero"
            priority={priority}
            onLoad={onLoad}
          />
        </picture>
      </div>

      {/* Covers the whole slide (its nearest positioned ancestor); the photo above is positioned too, hence z-[1]. */}
      {link ? <BannerLink to={link} aria-hidden tabIndex={-1} className="absolute inset-0 z-[1]" /> : null}
    </div>
  );
}

export default SplitSlide;
