import { BRAND } from "@/config/brand";

/** "© 2026 Store. All rights reserved." */
export const CopyrightLine = ({ suffix }: { suffix?: string }) => (
  <p>
    © {new Date().getFullYear()}{" "}
    <span className="text-charcoal-foreground/80">{suffix || BRAND.name}</span>. All rights reserved.
  </p>
);

/** The agency credit that closes every footer. */
export const CreditLine = () => (
  <p>
    Designed and developed by{" "}
    <a
      href="https://www.thedreamteamservices.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="whitespace-nowrap text-charcoal-foreground/80 underline underline-offset-2 transition-colors duration-hover ease-out hover:text-charcoal-foreground"
    >
      DREAM TEAM SERVICES
    </a>
  </p>
);
