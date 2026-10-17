import { motion, useReducedMotion } from "framer-motion";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { subscribeToShowcases, Showcase } from "@/services/showcaseService";
import { subscribeToCategories, DEFAULT_CATEGORIES, type Category } from "@/services/categoryService";
import { SmartImage } from "@/components/ui/smart-image";
import { Skeleton } from "@/components/ui/skeleton";
import { reveal, staggerDelay } from "@/lib/motion";

/**
 * Home category display, version `tiles`: equal tiles with the category name
 * below the photo, nothing laid over it. Same data and links as the Classic
 * `CategoryShowcase` (keep its helpers and heading in step with this file).
 */

/** Showcase subtitles are category slugs ("category-one"), so they link straight to the category. */
const getCategoryLink = (subtitle: string): string => `/category/${subtitle.toLowerCase().trim()}`;

/** The category's own name ("Category One"); falls back to "category-one" -> "category one". */
const displayName = (subtitle: string, categories: Pick<Category, "name" | "slug">[]) => {
  const slug = subtitle.toLowerCase().trim();
  return categories.find((c) => c.slug === slug)?.name ?? subtitle.replace(/-/g, " ").trim();
};

// A wrapping row rather than a grid, so a short last row sits in the centre (2, 3 or 4 tiles across).
const GRID = "flex flex-wrap justify-center gap-3 md:gap-5";
const TILE = "w-[calc((100%-0.75rem)/2)] md:w-[calc((100%-2.5rem)/3)] lg:w-[calc((100%-3.75rem)/4)]";

/** Tiles up to this position load their photo straight away; later ones wait until they near the screen. */
const EAGER_TILES = 4;

const SectionHeader = () => (
  <div className="mb-6 text-center md:mb-10">
    <p className="eyebrow-no eyebrow-center mb-3">Shop by category</p>
    <h2
      className="text-2xl font-semibold text-foreground [text-wrap:balance] md:text-3xl lg:text-4xl"
      style={{ fontFamily: "var(--font-heading)", fontStretch: "var(--font-heading-stretch)" }}
    >
      Browse every category
    </h2>
    <p className="mt-2 text-sm text-muted-foreground">Everything in one place</p>
  </div>
);

const CategoryTiles = () => {
  const [showcases, setShowcases] = useState<Showcase[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Pick<Category, "name" | "slug">[]>(DEFAULT_CATEGORIES);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const unsubscribe = subscribeToCategories((cats) => {
      if (cats.length > 0) setCategories(cats);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Subscribe to active showcases only
    const unsubscribe = subscribeToShowcases((data) => {
      setShowcases(data);
      setLoading(false);
    }, true); // true = active only

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <section aria-busy="true" className="tx-contour w-full py-12 md:py-20">
        <span className="sr-only" role="status">Loading</span>
        <div className="container-custom">
          <SectionHeader />
          <div className={GRID}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={i === 3 ? `hidden lg:block ${TILE}` : TILE}>
                <Skeleton className="aspect-[4/5] w-full rounded-card" />
                <Skeleton className="mt-3 h-5 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (showcases.length === 0) return null;

  return (
    <section className="tx-contour w-full py-12 md:py-20">
      <div className="container-custom">
        <SectionHeader />

        <div className={GRID}>
          {showcases.map((showcase, index) => {
            const name = displayName(showcase.subtitle, categories);
            const cta = showcase.cta?.trim();
            return (
              <motion.div
                key={showcase.id ?? `${showcase.subtitle}-${index}`}
                initial={reduceMotion ? false : reveal.initial}
                whileInView={reveal.whileInView}
                viewport={reveal.viewport}
                transition={{ ...reveal.transition, delay: staggerDelay(index) }}
                className={TILE}
              >
                <Link to={getCategoryLink(showcase.subtitle)} className="group block rounded-card">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-muted">
                    <SmartImage
                      src={showcase.imageUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition-[transform,opacity] [transition-duration:180ms] ease-out motion-safe:group-hover:scale-[1.03]"
                      preset="card"
                      priority={index < EAGER_TILES}
                    />
                  </div>

                  <div className="mt-3 text-center md:mt-4">
                    <h3
                      className="text-base font-semibold text-foreground [text-wrap:balance]"
                      style={{ fontFamily: "var(--font-heading)", fontStretch: "var(--font-heading-stretch)" }}
                    >
                      {name}
                    </h3>
                    {cta && (
                      <span className="mt-1 inline-block text-sm text-muted-foreground underline underline-offset-4 transition-colors duration-hover ease-out group-hover:text-foreground">
                        {cta}
                      </span>
                    )}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategoryTiles;
