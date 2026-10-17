import { lazy, Suspense, useEffect, type ReactNode } from "react";
import Header from "@/components/Header";
import MobileSearchBar from "@/components/MobileSearchBar";
import CategoryIconNav from "@/components/CategoryIconNav";
import HeroBanner from "@/components/HeroBanner";
import TopDeals from "@/components/TopDeals";
import BestSellers from "@/components/BestSellers";
import FeaturedSection from "@/components/FeaturedSection";
import TrendProducts from "@/components/TrendProducts";
import TrendProductSection from "@/components/TrendProductSection";
import FactsStrip from "@/components/FactsStrip";
import Footer from "@/components/Footer";
import { LazyMount } from "@/components/ui/lazy-mount";
import { isOn } from "@/config/features";
import { HOME_BLOCKS, HOME_BLOCK_RESERVE } from "@/config/homeBlocks";
import { activeSection } from "@/config/activeSections";
import { subscribeHomeBanners, subscribeHomeCollections } from "@/services/homeContentService";

// Below the fold: each section is its own chunk, fetched only as it nears the screen.
const MarqueeBand = lazy(() => import("@/components/MarqueeBand"));
const ShopForSection = lazy(() => import("@/components/ShopForSection"));
const CategoryShowcase = lazy(() => import("@/components/CategoryShowcase"));
const CategoryTiles = lazy(() => import("@/components/CategoryTiles"));
const FeatureIcons = lazy(() => import("@/components/FeatureIcons"));
const PromoSection = lazy(() => import("@/components/PromoSection"));
const FreeShippingBand = lazy(() => import("@/components/FreeShippingBand"));
const TestimonialsCarousel = lazy(() => import("@/components/TestimonialsCarousel"));
const CollectionBanner = lazy(() => import("@/components/CollectionBanner"));
const YouTubeShowcase = lazy(() => import("@/components/YouTubeShowcase"));

/**
 * Mounts a lazy section shortly before it scrolls into view. The placeholder
 * holds the section's usual height (per breakpoint) so nothing jumps when it
 * arrives.
 */
const Deferred = ({ children, reserve }: { children: ReactNode; reserve: string }) => {
  const placeholder = <div aria-hidden="true" className={reserve} />;
  return (
    <LazyMount rootMargin="600px 0px" placeholder={placeholder}>
      <Suspense fallback={placeholder}>{children}</Suspense>
    </LazyMount>
  );
};

const Index = () => {
  // The category display version picks which chunk loads; Classic keeps its own.
  const tiles = activeSection("categoryDisplay") === "tiles";
  // Start listening for the lower blocks' content as the page opens, so by the time the banner and the
  // collections mount (just before they scroll into view) Firestore answers from its cache and they
  // already know whether they have anything to show.
  useEffect(() => {
    const stops = [
      HOME_BLOCKS.banner ? subscribeHomeBanners(() => {}, "collection-wide") : undefined,
      HOME_BLOCKS.collections ? subscribeHomeCollections(() => {}) : undefined,
    ];
    return () => stops.forEach((stop) => stop?.());
  }, []);
  return (
    <div className="min-h-screen w-full overflow-x-clip bg-background">
      <Header />

      {/* Mobile Search Bar - Sticky */}
      <MobileSearchBar />

      {/* Category Navigation */}
      <CategoryIconNav />

      {/* Paper texture across the whole page; sections sit on it like cards on a desk. */}
      <main id="main" tabIndex={-1} className="tx-paper relative overflow-hidden outline-none">
        <div className="relative z-raised">
          <HeroBanner />
          {HOME_BLOCKS.facts && <FactsStrip />}
          {/* Each block below is switched in src/config/homeBlocks.ts (with the height it reserves); the order is set here.
              ICONOIQ (Phase 2 mockup, 2026-10-17): the category tiles come straight after the hero and facts. */}
          {HOME_BLOCKS.categories &&
            (tiles ? (
              <Deferred reserve={HOME_BLOCK_RESERVE.categoriesTiles}>
                <CategoryTiles />
              </Deferred>
            ) : (
              <Deferred reserve={HOME_BLOCK_RESERVE.categoriesShowcase}>
                <CategoryShowcase />
              </Deferred>
            ))}
          {HOME_BLOCKS.topDeals && <TopDeals />}
          {HOME_BLOCKS.bestSellers && <BestSellers />}
          {HOME_BLOCKS.shopFor && (
            <Deferred reserve={HOME_BLOCK_RESERVE.shopFor}>
              <ShopForSection />
            </Deferred>
          )}
          {HOME_BLOCKS.featured && <FeaturedSection />}
          {HOME_BLOCKS.newArrivals && <TrendProducts />}
          {HOME_BLOCKS.trending && <TrendProductSection />}
          {HOME_BLOCKS.marquee && (
            <Deferred reserve={HOME_BLOCK_RESERVE.marquee}>
              <MarqueeBand />
            </Deferred>
          )}
          {HOME_BLOCKS.promiseCards && (
            <Deferred reserve={HOME_BLOCK_RESERVE.promiseCards}>
              <FeatureIcons />
            </Deferred>
          )}
          {HOME_BLOCKS.collections && (
            <Deferred reserve={HOME_BLOCK_RESERVE.collections}>
              <PromoSection />
            </Deferred>
          )}
          {HOME_BLOCKS.serviceBand && (
            <Deferred reserve={HOME_BLOCK_RESERVE.serviceBand}>
              <FreeShippingBand />
            </Deferred>
          )}
          {isOn("testimonials") && (
            <Deferred reserve={HOME_BLOCK_RESERVE.testimonials}>
              <TestimonialsCarousel />
            </Deferred>
          )}
          {HOME_BLOCKS.banner && (
            <Deferred reserve={HOME_BLOCK_RESERVE.banner}>
              <CollectionBanner />
            </Deferred>
          )}
          {isOn("videoStories") && (
            <Deferred reserve={HOME_BLOCK_RESERVE.videoStories}>
              <YouTubeShowcase />
            </Deferred>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
