import { Link } from "react-router-dom";
import { Mail, Phone } from "lucide-react";
import type { FooterSettings } from "@/services/siteSettingsService";
import type { Category } from "@/services/categoryService";
import { BRAND } from "@/config/brand";
import { LOGO } from "@/config/logoSize";
import { INFORMATION_LINKS, dedupeFooterLinks } from "./footerLinks";
import { CopyrightLine, CreditLine } from "./FooterLegal";
import { SOCIAL_LABELS, resolveFooterHref, socialIconFor } from "./footerShared";

interface CompactFooterProps {
  settings: FooterSettings;
  categories: Category[];
}

/** Each link is a 44px-tall target; the colours and hover are Classic's. */
const LINK_CLASS =
  "inline-flex min-h-11 items-center text-sm text-charcoal-foreground/65 transition-colors duration-hover ease-out hover:text-charcoal-foreground";

/**
 * Footer version "compact" (below the newsletter band, which Footer renders): one centred
 * block for small stores with few pages. Logo, tagline, a single row of links (the Shop
 * links, then the policy pages), social icons, a contact line and the copyright. No map
 * and no category column. Colours, link hover and focus ring are Classic's, and each
 * value hides its line when the store has not set it.
 */
const CompactFooter = ({ settings, categories }: CompactFooterProps) => {
  const links = dedupeFooterLinks([
    ...(settings.shopLinks || []).filter(Boolean).map((name) => ({ name, to: resolveFooterHref(name, categories) })),
    ...INFORMATION_LINKS,
  ]);
  const socials = (settings.socialLinks || []).filter((s) => s.active && s.url);
  const phone = settings.phones?.[0];
  const email = settings.emails?.[0];

  return (
    <>
      <div className="relative container-custom">
        <div className="mx-auto max-w-3xl py-12 text-center">
          <img
            src="/white_logo.png"
            alt={BRAND.name}
            width={LOGO.width}
            height={LOGO.height}
            loading="lazy"
            decoding="async"
            className="mx-auto block h-12 w-auto"
          />
          {settings.brandTagline && (
            <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-charcoal-foreground/65 text-pretty">
              {settings.brandTagline}
            </p>
          )}

          {/* A shorter measure than the column, so a wrapped row breaks 4 + 3, never 6 + 1. */}
          <nav aria-label="Footer" className="mx-auto mt-6 max-w-lg">
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              {links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className={LINK_CLASS}>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {socials.length > 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {socials.map((s) => {
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

          {(phone || email) && (
            <div className="mt-4 flex flex-wrap justify-center gap-x-6">
              {phone && (
                <a href={`tel:${phone.replace(/\s+/g, "")}`} className={`${LINK_CLASS} gap-2.5 whitespace-nowrap`}>
                  <Phone aria-hidden="true" className="size-4 flex-shrink-0 text-highlight-soft" />
                  {phone}
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className={`${LINK_CLASS} min-w-0 gap-2.5 [overflow-wrap:anywhere]`}>
                  <Mail aria-hidden="true" className="size-4 flex-shrink-0 text-highlight-soft" />
                  <span>
                    {/* Wrap after the @ if the line is narrow, never mid-word. */}
                    {email.split("@").map((part, i) => (
                      <span key={i}>
                        {i > 0 && <>@<wbr /></>}
                        {part}
                      </span>
                    ))}
                  </span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="relative border-t border-charcoal-foreground/10 py-5">
        <div className="container-custom flex flex-col items-center gap-2 text-center text-xs text-charcoal-foreground/60">
          <CopyrightLine suffix={settings.copyrightSuffix} />
          <CreditLine />
        </div>
      </div>
    </>
  );
};

export default CompactFooter;
