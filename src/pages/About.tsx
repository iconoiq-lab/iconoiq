import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SmartImage } from "@/components/ui/smart-image";
import { BRAND } from "@/config/brand";
import { SHOP_FOR } from "@/config/shopFor";
import { usePageMeta } from "@/hooks/usePageMeta";
import { DEFAULT_CATEGORIES } from "@/services/categoryService";

/**
 * About page from real facts only: BRAND (name, tagline, description), who the kits are for
 * (SHOP_FOR, the same art as the home page) and the range (DEFAULT_CATEGORIES).
 * The client's own story is still [NEED: about story] in PROGRESS.md; add an "Our story"
 * section here when it arrives. Nothing on this page is invented.
 */
const RANGE = DEFAULT_CATEGORIES.map((category) => ({
  title: category.name,
  to: `/category/${category.slug}`,
  parts: (category.subcategories ?? []).map((sub) => sub.name),
}));

const About = () => {
  usePageMeta({
    title: `About ${BRAND.name}: Indian Iconography Learning Kits`,
    description: `Why ${BRAND.name} makes Indian iconography learning kits: Shilpa Shastra and temple heritage, made hands-on for children, schools, academies and temples.`,
  });

  return (
    <div className="min-h-screen tx-paper">
      <Header />
      <main id="main" tabIndex={-1} className="outline-none">
        {/* Hero */}
        <section className="relative h-[480px] overflow-hidden bg-charcoal md:h-[560px]">
          <img
            src={SHOP_FOR[3]?.image ?? "/art/shop-for-temples.webp"}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-charcoal/90 via-charcoal/70 to-charcoal/35 md:via-charcoal/55 md:to-transparent"
          />
          <div className="container-custom relative flex h-full items-center">
            <div className="max-w-2xl text-charcoal-foreground">
              {BRAND.tagline && (
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-highlight-soft [text-wrap:balance]">
                  {BRAND.tagline}
                </p>
              )}
              <h1 className="on-photo mb-6 font-heading text-4xl font-semibold leading-[1.02] tracking-tight [text-wrap:balance] md:text-6xl">
                About {BRAND.name}
              </h1>
              <p className="on-photo mb-8 max-w-xl text-base leading-relaxed text-charcoal-foreground/90 [text-wrap:pretty] md:text-lg">
                {BRAND.description}
              </p>
              <Link to="/products" className="btn-copper">
                Shop the kits
              </Link>
            </div>
          </div>
        </section>

        {/* Who it is for */}
        <section aria-labelledby="about-for" className="py-16 md:py-24">
          <div className="container-custom">
            <div className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
              <h2
                id="about-for"
                className="mb-4 font-heading text-3xl font-semibold tracking-tight text-foreground [text-wrap:balance] md:text-4xl"
              >
                Who we make it for
              </h2>
              <p className="text-muted-foreground [text-wrap:pretty]">
                Learning kits for families and young learners, schools and nursery schools, natyam academies, and
                temples and ashrams. We ship all over India.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {SHOP_FOR.map((item) => (
                <article
                  key={item.title}
                  className="group relative flex flex-col overflow-hidden rounded-card border border-foreground/[0.07] bg-card text-card-foreground shadow-panel transition-[transform,box-shadow,border-color] duration-hover ease-out hover:-translate-y-[var(--hover-lift)] hover:border-primary/35"
                >
                  <div className="overflow-hidden">
                    <SmartImage
                      src={item.image}
                      alt=""
                      className="aspect-[4/3] w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                      preset="card"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5 md:p-6">
                    <h3 className="mb-2 font-heading text-lg font-semibold tracking-tight text-foreground">{item.title}</h3>
                    <p className="mb-5 text-sm leading-relaxed text-muted-foreground [text-wrap:pretty]">{item.line}</p>
                    <Link
                      to={item.href}
                      className="link-arrow mt-auto self-start after:absolute after:inset-0 after:content-['']"
                    >
                      See the products
                      <span className="sr-only">: {item.title}</span>
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* The range */}
        <section aria-labelledby="about-range" className="bg-muted py-16 md:py-24">
          <div className="container-custom">
            <div className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
              <h2
                id="about-range"
                className="mb-4 font-heading text-3xl font-semibold tracking-tight text-foreground [text-wrap:balance] md:text-4xl"
              >
                The {BRAND.shortName} range
              </h2>
              <p className="text-muted-foreground [text-wrap:pretty]">Browse by category.</p>
            </div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {RANGE.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="group flex h-full flex-col rounded-card border border-foreground/[0.07] bg-card p-5 text-card-foreground shadow-panel transition-[transform,border-color] duration-hover ease-out hover:-translate-y-[var(--hover-lift)] hover:border-primary/35 md:p-6"
                  >
                    <span className="mb-1.5 flex items-center justify-between gap-3 font-heading text-lg font-semibold tracking-tight text-foreground">
                      {item.title}
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground transition-transform duration-hover group-hover:translate-x-0.5"
                      />
                    </span>
                    {item.parts.length > 0 && (
                      <span className="text-sm leading-relaxed text-muted-foreground">{item.parts.join(" · ")}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Contact */}
        <section className="py-16 md:py-24">
          <div className="container-custom max-w-3xl text-center">
            <h2 className="mb-4 font-heading text-3xl font-semibold tracking-tight text-foreground [text-wrap:balance] md:text-4xl">
              Buying for a school, academy or temple?
            </h2>
            <p className="mx-auto mb-8 max-w-[52ch] text-muted-foreground [text-wrap:pretty]">
              Tell us what you need and how many. We will help you pick the right kits.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/contact" className="btn-copper">
                Contact us
              </Link>
              <Link to="/products" className="btn-line">
                Shop all products
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default About;
