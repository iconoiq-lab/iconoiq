import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { subscribeEmail } from "@/services/newsletterService";
import { isOn } from "@/config/features";
import { activeSection } from "@/config/activeSections";
import { LazyMount } from "@/components/ui/lazy-mount";
import { cn } from "@/lib/utils";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";
import {
  subscribeFooterSettings,
  DEFAULT_FOOTER,
  type FooterSettings,
} from "@/services/siteSettingsService";
import {
  subscribeToCategories,
  DEFAULT_CATEGORIES,
  type Category,
} from "@/services/categoryService";
import { BRAND } from "@/config/brand";
import { useCustomerSupport } from "@/hooks/useCustomerSupport";
import { withSupportContact } from "@/lib/footerContact";
import { LOGO } from "@/config/logoSize";
import CompactFooter from "@/components/footer/CompactFooter";
import { INFORMATION_LINKS } from "@/components/footer/footerLinks";
import { CopyrightLine, CreditLine } from "@/components/footer/FooterLegal";
import { SOCIAL_LABELS, resolveFooterHref, socialIconFor } from "@/components/footer/footerShared";

/** Hours are typed by the admin; show ranges with words, not dashes. */
const tidyHours = (value: string) => value.replace(/\s*[–—]\s*/g, " to ");

/** The address and a way out to Google Maps, shown while the map embed loads. */
const MapCard = ({ addressLines, hidden = false }: { addressLines?: string[]; hidden?: boolean }) => {
  const address = (addressLines ?? []).filter(Boolean).join(", ");
  return (
    <div
      aria-hidden={hidden || undefined}
      {...(hidden ? ({ inert: "" } as Record<string, string>) : {})}
      className={cn(
        "tx-slate absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center transition-[opacity,visibility] duration-500 ease-out motion-reduce:transition-none",
        // Fades out only once the map above it has faded in, so nothing ghosts through.
        hidden && "invisible opacity-0 delay-500",
      )}
    >
      <MapPin aria-hidden="true" className="size-5 text-highlight-soft" />
      {address && <p className="max-w-xs text-sm leading-snug text-charcoal-foreground/80 text-pretty">{address}</p>}
      {address && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-highlight-soft transition-colors duration-hover ease-out hover:text-charcoal-foreground"
        >
          Open in Google Maps <ArrowUpRight aria-hidden="true" className="size-3.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </div>
  );
};

/** The sign-up band at the top of every footer version. Owns its own form state. */
const NewsletterStrip = () => {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterLoading, setNewsletterLoading] = useState(false);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newsletterEmail.trim();
    if (!email) return;
    setNewsletterLoading(true);
    try {
      const result = await subscribeEmail(email);
      if (result === 'exists') {
        toast.info('This email is already subscribed.');
      } else {
        toast.success("You're on the list. New launches and member offers will reach your inbox.");
        setNewsletterEmail("");
      }
    } catch {
      toast.error("We couldn't subscribe you. Check the address and try again.");
    } finally {
      setNewsletterLoading(false);
    }
  };

  return (
    <div className="relative border-b border-charcoal-foreground/10">
      <div className="container-custom py-10 md:py-12">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="eyebrow-no on-dark mb-3">
              The {BRAND.shortName} Circle
            </p>
            <h2 className="text-2xl md:text-3xl font-serif font-semibold leading-tight text-balance">
              Be the first to discover new launches and private offers.
            </h2>
          </div>
          <form
            onSubmit={handleNewsletterSubmit}
            aria-busy={newsletterLoading || undefined}
            className="flex w-full max-w-lg md:ml-auto rounded-card bg-charcoal-foreground/[0.05] border border-charcoal-foreground/15 p-1.5 transition-[border-color,box-shadow] duration-hover ease-out focus-within:border-highlight-soft/70 focus-within:ring-2 focus-within:ring-highlight-soft/20"
          >
            <input
              type="email"
              name="email"
              required
              aria-label="Email address"
              autoComplete="email"
              inputMode="email"
              enterKeyHint="send"
              spellCheck={false}
              placeholder="Enter your email"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-charcoal-foreground placeholder:text-charcoal-foreground/55 focus-visible:outline-none sm:px-4 md:text-sm"
            />
            <button
              type="submit"
              disabled={newsletterLoading}
              aria-label={newsletterLoading ? undefined : "Subscribe"}
              className="btn-copper flex-shrink-0 !px-4 md:!px-6 !py-2.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className={newsletterLoading ? "" : "hidden sm:inline"}>
                {newsletterLoading ? "Subscribing…" : "Subscribe"}
              </span>
              {!newsletterLoading && <ArrowRight aria-hidden="true" className="size-3.5" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const Footer = () => {
  const darkModeLogo = "/white_logo.png";
  const [footerSettings, setFooterSettings] = useState<FooterSettings>(DEFAULT_FOOTER);
  // Phone, email and hours come from Admin > Commerce > Support unless the footer editor saves its own.
  const support = useCustomerSupport();
  const settings = useMemo(() => withSupportContact(footerSettings, support), [footerSettings, support]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES as Category[]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(mapTimer.current), []);

  useEffect(() => {
    const unsub = subscribeFooterSettings(setFooterSettings);
    return unsub;
  }, []);

  // Same query the category strip listens to, so Firestore serves both from one listener.
  useEffect(() => {
    const unsub = subscribeToCategories((cats) => {
      if (cats.length) setCategories(cats);
    });
    return unsub;
  }, []);

  // Version "compact": one centred block. The shell (colour, glow, newsletter band) is the same.
  if (activeSection("footer") === "compact") {
    return (
      <footer className="tx-slate relative overflow-hidden text-charcoal-foreground">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-highlight-soft/40 to-transparent" />
        {isOn("newsletter") && <NewsletterStrip />}
        <CompactFooter settings={settings} categories={categories} />
      </footer>
    );
  }

  const activeSocials = (settings.socialLinks || []).filter((s) => s.active && s.url);
  const shopLinks = (settings.shopLinks || []).filter(Boolean);
  const categoryLinks = (settings.categoryLinks || []).filter(Boolean);
  const hasContact =
    (settings.addressLines?.length ?? 0) > 0 ||
    Boolean(settings.phones?.[0] || settings.emails?.[0] || settings.businessHours);

  return (
    <footer className="tx-slate relative overflow-hidden text-charcoal-foreground">
      {/* Decorative gold glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-highlight-soft/40 to-transparent" />

      {/* ── Newsletter strip ── */}
      {isOn("newsletter") && <NewsletterStrip />}

      {/* ── Main grid ── */}
      <div className="relative container-custom py-14 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-8 gap-y-10">
          {/* Brand & socials: its own row on tablets so the four link columns get room */}
          <div className="col-span-2 md:col-span-4 lg:col-span-2">
            <img
              src={darkModeLogo}
              alt={BRAND.name}
              width={LOGO.width}
              height={LOGO.height}
              loading="lazy"
              decoding="async"
              className="h-12 w-auto mb-5"
            />
            <p className="text-charcoal-foreground/65 text-sm leading-relaxed mb-6 max-w-sm text-pretty">
              {settings.brandTagline}
            </p>

            {activeSocials.length > 0 && (
              <div className="flex flex-wrap gap-2.5">
                {activeSocials.map((s) => {
                  const Icon = socialIconFor(s.platform);
                  return (
                    <a
                      key={`${s.platform}-${s.url}`}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={SOCIAL_LABELS[s.platform]}
                      className="relative grid size-11 place-items-center rounded-full border border-charcoal-foreground/15 text-charcoal-foreground/80 transition-[transform,color,border-color] duration-press ease-out hover:border-highlight-soft hover:text-highlight-soft active:scale-[0.97]"
                    >
                      <Icon aria-hidden="true" className="size-[18px]" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Shop */}
          <div>
            <h2 className="mb-5 text-[11px] font-bold uppercase tracking-[0.22em] text-highlight-soft">Shop</h2>
            <ul className="-my-1 space-y-0.5">
              {shopLinks.map((name) => (
                <li key={name}>
                  <Link
                    to={resolveFooterHref(name, categories)}
                    className="inline-block py-1 text-sm text-charcoal-foreground/65 transition-colors duration-hover ease-out hover:text-charcoal-foreground"
                  >
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h2 className="mb-5 text-[11px] font-bold uppercase tracking-[0.22em] text-highlight-soft">Categories</h2>
            <ul className="-my-1 space-y-0.5">
              {categoryLinks.map((name) => (
                <li key={name}>
                  <Link
                    to={resolveFooterHref(name, categories)}
                    className="inline-block py-1 text-sm text-charcoal-foreground/65 transition-colors duration-hover ease-out hover:text-charcoal-foreground"
                  >
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Information */}
          <div>
            <h2 className="mb-5 text-[11px] font-bold uppercase tracking-[0.22em] text-highlight-soft">Information</h2>
            <ul className="-my-1 space-y-0.5">
              {INFORMATION_LINKS.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.to}
                    className="inline-block py-1 text-sm text-charcoal-foreground/65 transition-colors duration-hover ease-out hover:text-charcoal-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact: not shown until the store has at least one contact detail */}
          {hasContact && (
            <div className="col-span-2 md:col-span-1">
              <h2 className="mb-5 text-[11px] font-bold uppercase tracking-[0.22em] text-highlight-soft">Reach us</h2>
              <ul className="space-y-3 text-sm text-charcoal-foreground/65">
                {settings.addressLines?.length > 0 && (
                  <li className="flex gap-2.5">
                    <MapPin aria-hidden="true" className="size-4 text-highlight-soft flex-shrink-0 mt-0.5" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {settings.addressLines.map((line, i) => (
                        <span key={i} className="block leading-snug">{line}</span>
                      ))}
                    </span>
                  </li>
                )}
                {settings.phones?.[0] && (
                  <li className="flex gap-2.5">
                    <Phone aria-hidden="true" className="size-4 text-highlight-soft flex-shrink-0 mt-0.5" />
                    <a
                      href={`tel:${settings.phones[0].replace(/\s+/g, "")}`}
                      className="min-w-0 whitespace-nowrap transition-colors duration-hover ease-out hover:text-charcoal-foreground"
                    >
                      {settings.phones[0]}
                    </a>
                  </li>
                )}
                {settings.emails?.[0] && (
                  <li className="flex gap-2.5">
                    <Mail aria-hidden="true" className="size-4 text-highlight-soft flex-shrink-0 mt-0.5" />
                    <a
                      href={`mailto:${settings.emails[0]}`}
                      className="min-w-0 [overflow-wrap:anywhere] transition-colors duration-hover ease-out hover:text-charcoal-foreground"
                    >
                      {/* Wrap after the @ if the column is narrow, never mid-word. */}
                      {settings.emails[0].split("@").map((part, i) => (
                        <span key={i}>
                          {i > 0 && <>@<wbr /></>}
                          {part}
                        </span>
                      ))}
                    </a>
                  </li>
                )}
                {settings.businessHours && (
                  <li className="flex gap-2.5">
                    <Clock aria-hidden="true" className="size-4 text-highlight-soft flex-shrink-0 mt-0.5" />
                    <span>{tidyHours(settings.businessHours)}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Map: the address card sits under the iframe, so the box is never an empty
            grey slab while the embed and its tiles load. */}
        {settings.mapEmbedUrl && (
          <LazyMount
            className="group relative mt-12 h-[220px] overflow-hidden rounded-card border border-charcoal-foreground/10"
            placeholder={<MapCard addressLines={settings.addressLines} />}
          >
            <MapCard addressLines={settings.addressLines} hidden={mapLoaded} />
            <iframe
              src={settings.mapEmbedUrl}
              width="100%"
              height="220"
              style={{ border: 0 }}
              // The embed paints a flat grey box for a moment after "load" while its
              // tiles arrive, so the map is revealed a beat later.
              onLoad={() => {
                mapTimer.current = window.setTimeout(() => setMapLoaded(true), 900);
              }}
              // Quiet monochrome inside the charcoal footer; full colour when the visitor reaches for it.
              className={cn(
                "absolute inset-0 block [filter:grayscale(1)_contrast(1.05)_brightness(0.82)] transition-[filter,opacity] duration-500 ease-out group-hover:[filter:none] group-focus-within:[filter:none] motion-reduce:transition-none",
                mapLoaded ? "opacity-90 group-hover:opacity-100 group-focus-within:opacity-100" : "opacity-0",
              )}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Store Location"
            />
          </LazyMount>
        )}
      </div>

      {/* ── Bottom bar ── */}
      {/* Hollow wordmark, cropped by the bottom bar */}
      <div aria-hidden className="pointer-events-none relative container-custom select-none overflow-hidden">
        <p className="text-outline whitespace-nowrap text-center text-[15vw] font-bold uppercase leading-[0.8] opacity-25 md:text-[9.5vw] translate-y-[18%]" style={{ fontFamily: "var(--font-heading)", fontStretch: "var(--font-heading-stretch)" }}>
          {BRAND.shortName}
        </p>
      </div>

      <div className="relative border-t border-charcoal-foreground/10 py-5">
        <div className="container-custom flex flex-col md:flex-row items-center justify-between gap-3 text-center text-xs text-charcoal-foreground/60">
          <CopyrightLine suffix={settings.copyrightSuffix} />
          <CreditLine />
        </div>
      </div>
    </footer>
  );
};

export default Footer;
