import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { BRAND } from "@/config/brand";
import { LOGO } from "@/config/logoSize";
import { desktopHeaderClass } from "./desktopHeaderClass";

interface CenteredHeaderBarProps {
  isScrolled: boolean;
  /** The search combobox, left. Header owns its state and passes the element in. */
  search: ReactNode;
  /** The icon cluster, right. */
  icons: ReactNode;
}

/**
 * Header version "centered" (desktop, lg and up): search on the left, the logo in the
 * middle, icons on the right. Same 68px bar, background, hairline and stacking as
 * Classic. DOM order is search, logo, icons, so Tab follows what the eye sees.
 */
const CenteredHeaderBar = ({ isScrolled, search, icons }: CenteredHeaderBarProps) => {
  const { resolvedTheme } = useTheme();

  return (
    <header className={desktopHeaderClass(isScrolled)}>
      <div className="max-w-[1440px] mx-auto px-8 lg:px-12">
        <div className="grid h-[68px] grid-cols-[1fr_auto_1fr] items-center gap-8">
          {search}

          <Link to="/" aria-label={`${BRAND.name} home`} className="flex items-center flex-shrink-0 rounded-control">
            <img
              src={resolvedTheme === "dark" ? "/white_logo.png" : "/black_logo.png"}
              alt=""
              width={LOGO.width}
              height={LOGO.height}
              decoding="async"
              className="h-9 w-auto"
            />
          </Link>

          {icons}
        </div>
      </div>
    </header>
  );
};

export default CenteredHeaderBar;
