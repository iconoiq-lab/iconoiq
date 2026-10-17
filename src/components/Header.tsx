import { useState, useRef, useEffect, useId, type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Heart, ShoppingBag, User } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveProductsCached, useCatalogRevision } from "@/services/productCache";
import { UIProduct, adaptFirebaseToUI } from "@/lib/productAdapter";
import MobileHeader, { SkipLink } from "./MobileHeader";
import OfferRibbon from "./offers/OfferRibbon";
import ThemeToggle from "./ThemeToggle";
import SilverRateWidget from "./SilverRateWidget";
import LoyaltyPointsButton from "./LoyaltyPointsButton";
import { isAnyOn, isOn } from "@/config/features";
import { SmartImage } from "@/components/ui/smart-image";
import { IconButton } from "@/components/ui/icon-button";
import { DealerPriceInline } from "@/components/dealer/DealerPrice";
import { useDealerUnit } from "@/hooks/useDealer";
import { formatINR, plural } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { BRAND } from "@/config/brand";
import { LOGO } from "@/config/logoSize";
import { activeSection } from "@/config/activeSections";
import CenteredHeaderBar from "./header/CenteredHeaderBar";
import { desktopHeaderClass } from "./header/desktopHeaderClass";

const MAX_RESULTS = 8;

/**
 * The price at the end of a search result. A component of its own so every
 * result reads its own dealer price (a hook cannot run inside the .map);
 * without a dealer price it is exactly the plain price.
 */
const ResultPrice = ({ product, active }: { product: UIProduct; active: boolean }) => {
  const dealer = useDealerUnit(product.id, product.price);
  if (dealer) {
    return (
      <DealerPriceInline
        unit={dealer.unit}
        regular={product.price}
        percentOff={dealer.percentOff}
        size="sm"
        stacked
        // The chip's accent colour on the highlighted row's tint is 4.4:1; foreground text clears 4.5:1.
        className={cn("shrink-0 items-end pl-2", active && "[&_.chip-off]:border-foreground/40 [&_.chip-off]:text-foreground")}
      />
    );
  }
  return (
    <p className="shrink-0 pl-2 text-sm font-semibold tabular-nums text-foreground">
      {formatINR(product.price)}
    </p>
  );
};

/** Dropdown: grows out of the field, exits faster than it enters. */
const panelMotion = {
  initial: { opacity: 0, transform: "translateY(-4px) scale(0.98)" },
  animate: { opacity: 1, transform: "translateY(0px) scale(1)", transition: { duration: 0.18, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } },
};

interface SearchBoxProps {
  /** The wrapper the click-outside check watches. */
  searchRef: RefObject<HTMLDivElement>;
  listId: string;
  optionId: (i: number) => string;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  setShowSearchResults: (open: boolean) => void;
  handleSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  panelOpen: boolean;
  listOpen: boolean;
  searchResults: UIProduct[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  openProduct: (product: UIProduct) => void;
  goToSearchResults: () => void;
  /** Size and margin of the wrapper in the row it sits in. */
  className?: string;
  /** Where the results panel hangs under the field. */
  panelClassName?: string;
}

/**
 * The search combobox and its results panel, moved out of the header row so the
 * Classic and Centred layouts render the same elements. The state stays in Header.
 */
const SearchBox = ({
  searchRef, listId, optionId, searchQuery, setSearchQuery, setShowSearchResults, handleSearchKeyDown,
  panelOpen, listOpen, searchResults, activeIndex, setActiveIndex, openProduct, goToSearchResults,
  className, panelClassName = "left-0 right-0",
}: SearchBoxProps) => (
  <div className={className} ref={searchRef}>
    <div className="relative">
      <div className="relative flex items-center">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 size-[18px] text-muted-foreground"
        />
        <input
          type="search"
          role="combobox"
          aria-label="Search products"
          aria-expanded={listOpen}
          aria-controls={listOpen ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={listOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search products"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery && setShowSearchResults(true)}
          onKeyDown={handleSearchKeyDown}
          className="h-10 w-full rounded-control border border-transparent bg-muted pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-[background-color,border-color,box-shadow] duration-hover ease-out hover:border-input/60 focus-visible:border-ring focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
        />
      </div>

      <AnimatePresence>
        {panelOpen && (
          <motion.div
            key="search-panel"
            {...panelMotion}
            style={{ transformOrigin: "top center" }}
            className={cn("tx-sheet absolute top-full z-popover mt-2 overflow-hidden rounded-card border border-foreground/10 shadow-panel", panelClassName)}
          >
            {searchResults.length > 0 ? (
              <>
                <ul
                  id={listId}
                  role="listbox"
                  aria-label="Matching products"
                  className="max-h-[400px] overflow-y-auto overscroll-contain p-1.5"
                >
                  {searchResults.map((product, i) => {
                    const active = i === activeIndex;
                    return (
                      <li
                        key={product.id}
                        id={optionId(i)}
                        role="option"
                        aria-selected={active}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseMove={() => active || setActiveIndex(i)}
                        onClick={() => openProduct(product)}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-control p-2 transition-colors duration-hover",
                          active ? "bg-accent text-accent-foreground" : "text-foreground",
                        )}
                      >
                        <div className="size-12 flex-shrink-0 overflow-hidden rounded-chip bg-muted">
                          {product.image ? (
                            <SmartImage src={product.image} alt="" className="h-full w-full object-cover" preset="card" />
                          ) : (
                            <div className="grid h-full w-full place-items-center">
                              <ShoppingBag aria-hidden="true" className="size-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{product.title}</p>
                          {product.category && (
                            <p className="truncate text-xs text-muted-foreground">{product.category}</p>
                          )}
                        </div>
                        <ResultPrice product={product} active={active} />
                      </li>
                    );
                  })}
                </ul>
                {searchResults.length === MAX_RESULTS && (
                  <div className="border-t border-foreground/[0.08] p-1.5">
                    <button
                      type="button"
                      onClick={goToSearchResults}
                      className="focus-inset flex h-10 w-full items-center justify-center rounded-control text-sm font-medium text-primary transition-colors duration-hover hover:bg-accent"
                    >
                      View all results for “{searchQuery.trim()}”
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div role="status" className="px-6 py-7 text-center">
                <p className="text-sm font-medium text-foreground">No products match “{searchQuery.trim()}”</p>
                <p className="mt-1 text-sm text-muted-foreground">Try a shorter word or a different spelling.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
);

interface HeaderIconsProps {
  user: ReturnType<typeof useAuth>["user"];
  userProfile: ReturnType<typeof useAuth>["userProfile"];
  totalItems: number;
  showBadge: boolean;
  onWishlist: boolean;
  onAccount: boolean;
  navigate: (to: string) => void;
  toggleCart: () => void;
  className?: string;
}

/** Rate or wallet button, theme toggle, wishlist, account and cart: the same elements in both layouts. */
const HeaderIcons = ({
  user, userProfile, totalItems, showBadge, onWishlist, onAccount, navigate, toggleCart, className,
}: HeaderIconsProps) => (
  <div className={cn("flex items-center gap-2 flex-shrink-0", className)}>
    {/* Live silver rate (metal stores) or the wallet (rewards, gift cards) */}
    {isOn('silverPricing') ? <SilverRateWidget variant="icon" /> : isAnyOn(['rewards', 'giftCards']) && <LoyaltyPointsButton />}

    <ThemeToggle />

    <IconButton
      label="Wishlist"
      tooltip
      onClick={() => navigate("/wishlist")}
      aria-current={onWishlist ? "page" : undefined}
      className={cn("hover:text-primary", onWishlist && "text-primary")}
    >
      <Heart aria-hidden="true" />
    </IconButton>

    <IconButton
      label="Account"
      tooltip
      onClick={() => navigate("/account")}
      aria-current={onAccount ? "page" : undefined}
      className={cn("hover:text-primary", onAccount && "text-primary")}
    >
      {user ? (
        userProfile?.avatar || user.photoURL ? (
          <SmartImage
            key={userProfile?.avatar || user.photoURL}
            src={userProfile?.avatar || user.photoURL}
            alt=""
            className={cn(
              "size-[22px] rounded-full object-cover ring-1",
              onAccount ? "ring-primary" : "ring-border",
            )}
            referrerPolicy="no-referrer" preset="thumb" />
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              "grid size-[22px] place-items-center rounded-full bg-primary text-[10px] font-semibold leading-none text-primary-foreground ring-2",
              onAccount ? "ring-primary/30" : "ring-background",
            )}
          >
            {(userProfile?.name || userProfile?.username || 'U').charAt(0).toUpperCase()}
          </span>
        )
      ) : (
        <User aria-hidden="true" />
      )}
    </IconButton>

    <IconButton
      label={showBadge ? `Cart, ${plural(totalItems, "item")}` : "Cart"}
      tooltip="Cart"
      onClick={toggleCart}
      className="hover:text-primary"
    >
      <ShoppingBag aria-hidden="true" />
      {showBadge && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none tabular-nums text-primary-foreground ring-2 ring-background"
        >
          {totalItems}
        </span>
      )}
    </IconButton>
  </div>
);

const Header = () => {
  /** Changes when an admin publishes; re-reads the catalog below. */
  const catalogRevision = useCatalogRevision();

  const lightModeLogo = "/black_logo.png";
  const darkModeLogo = "/white_logo.png";
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const { resolvedTheme } = useTheme();
  const { totalItems, toggleCart } = useCart();
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UIProduct[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [allProducts, setAllProducts] = useState<UIProduct[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  // Check if current page is an auth page
  // Every storefront page, the auth pages included, shows the site chrome; only admin hides it.
  const isAuthPage = location.pathname.startsWith('/admin');

  const onWishlist = location.pathname.startsWith("/wishlist");
  const onAccount = location.pathname.startsWith("/account");
  const showBadge = !!user && totalItems > 0;

  // Load all products for search
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const products = await getActiveProductsCached();
        const uiProducts = products.map((p) => adaptFirebaseToUI(p));
        setAllProducts(uiProducts);
      } catch (error) {
        console.error('Error loading products:', error);
      }
    };
    loadProducts();
      // Re-runs when an admin publishes a new catalog, so a price change
      // reaches this screen without the visitor reloading it.
  }, [catalogRevision]);

  // Handle click outside search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search functionality
  useEffect(() => {
    setActiveIndex(-1);
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allProducts.filter(product =>
      product.title.toLowerCase().includes(query) ||
      product.category?.toLowerCase().includes(query) ||
      product.alt?.toLowerCase().includes(query)
    ).slice(0, MAX_RESULTS);

    setSearchResults(filtered);
    setShowSearchResults(true);
  }, [searchQuery, allProducts]);

  // Background and hairline once the page scrolls; passive, and only re-renders when it flips.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const next = window.scrollY > 50;
      setIsScrolled((prev) => (prev === next ? prev : next));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const goToSearchResults = () => {
    const query = searchQuery.trim();
    if (!query) return;
    navigate(`/search-results?q=${encodeURIComponent(query)}`);
    setShowSearchResults(false);
  };

  const openProduct = (product: UIProduct) => {
    navigate(`/product/${product.id}`);
    setSearchQuery("");
    setShowSearchResults(false);
  };

  const panelOpen = showSearchResults && searchQuery.trim().length > 0;
  const listOpen = panelOpen && searchResults.length > 0;

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown": {
        if (!searchResults.length) return;
        e.preventDefault();
        if (!showSearchResults) setShowSearchResults(true);
        setActiveIndex((i) => (i + 1) % searchResults.length);
        break;
      }
      case "ArrowUp": {
        if (!searchResults.length) return;
        e.preventDefault();
        if (!showSearchResults) setShowSearchResults(true);
        setActiveIndex((i) => (i <= 0 ? searchResults.length - 1 : i - 1));
        break;
      }
      case "Enter": {
        if (listOpen && activeIndex >= 0 && searchResults[activeIndex]) {
          e.preventDefault();
          openProduct(searchResults[activeIndex]);
        } else {
          goToSearchResults();
        }
        break;
      }
      case "Escape": {
        // First Escape closes the list; a second one clears the field (native search behaviour).
        if (panelOpen) {
          e.preventDefault();
          setShowSearchResults(false);
          setActiveIndex(-1);
        }
        break;
      }
    }
  };

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const centered = activeSection("header") === "centered";

  // One set of props for both layouts, so they render the same search and icons.
  const searchBoxProps = {
    searchRef, listId, optionId, searchQuery, setSearchQuery, setShowSearchResults, handleSearchKeyDown,
    panelOpen, listOpen, searchResults, activeIndex, setActiveIndex, openProduct, goToSearchResults,
  };
  const headerIconsProps = { user, userProfile, totalItems, showBadge, onWishlist, onAccount, navigate, toggleCart };

  return (
    <>
      <SkipLink />

      {/* Offers the admin marked "Show in offer banner". Sits above both headers
          and scrolls away with the page, so it never eats space once browsing. */}
      {!isAuthPage && <OfferRibbon />}

      {/* Mobile Header - Only on Mobile, hidden on auth pages */}
      {!isAuthPage && <MobileHeader skipLink={false} />}

      {/* Main Header: "centered" puts the logo in the middle (docs/template/SECTIONS.md). */}
      {centered ? (
        <CenteredHeaderBar
          isScrolled={isScrolled}
          search={<SearchBox {...searchBoxProps} className="w-full max-w-[320px]" panelClassName="left-0 w-[400px]" />}
          icons={<HeaderIcons {...headerIconsProps} className="justify-self-end" />}
        />
      ) : (
        <header className={desktopHeaderClass(isScrolled)}>
          <div className="max-w-[1440px] mx-auto px-8 lg:px-12">
            <div className="flex items-center justify-between gap-8 h-[68px]">
              {/* Logo */}
              <Link to="/" aria-label={`${BRAND.name} home`} className="flex items-center flex-shrink-0 rounded-control">
                <img
                  src={resolvedTheme === 'dark' ? darkModeLogo : lightModeLogo}
                  alt=""
                  width={LOGO.width}
                  height={LOGO.height}
                  decoding="async"
                  className="h-12 w-auto"
                />
              </Link>

              {/* Search */}
              <SearchBox {...searchBoxProps} className="flex-1 max-w-[560px] mx-8" />

              {/* Right actions */}
              <HeaderIcons {...headerIconsProps} />
            </div>
          </div>
        </header>
      )}
    </>
  );
};

export default Header;
