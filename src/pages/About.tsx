import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SmartImage } from "@/components/ui/smart-image";
import { BRAND } from "@/config/brand";
import { usePageMeta } from "@/hooks/usePageMeta";
import { DEFAULT_CATEGORIES } from "@/services/categoryService";

/**
 * Photography for this page: local placeholders (public/demo, made by
 * scripts/make-placeholders.mjs) until the client has its own photos.
 */
const PHOTOS = {
  hero: "/demo/about-1.svg",
  storyA: "/demo/about-2.svg",
  storyB: "/demo/about-3.svg",
  collection: "/demo/about-4.svg",
  craft: "/demo/about-5.svg",
  ritual: "/demo/about-6.svg",
  energy: "/demo/about-7.svg",
  hair: "/demo/about-8.svg",
  skin: "/demo/about-9.svg",
  grooming: "/demo/about-10.svg",
  classical: "/demo/about-11.svg",
  clean: "/demo/about-12.svg",
  daily: "/demo/about-13.svg",
  men: "/demo/about-14.svg",
};

/**
 * The store's categories (DEFAULT_CATEGORIES), each linked to its category page (owner decision
 * AUTH-07). Four placeholder photos ship; a store with more categories reuses them until Phase 3.
 */
const RANGE_PHOTOS = [PHOTOS.energy, PHOTOS.hair, PHOTOS.skin, PHOTOS.grooming];
const RANGE = DEFAULT_CATEGORIES.map((category, index) => ({
  title: category.name,
  label: "Shop",
  description: "[NEED: one line about this category]",
  image: RANGE_PHOTOS[index % RANGE_PHOTOS.length],
  to: `/category/${category.slug}`,
}));

const VALUES = [
  { name: "Value one", role: "[NEED: one line on this value]", image: PHOTOS.classical },
  { name: "Value two", role: "[NEED: one line on this value]", image: PHOTOS.clean },
  { name: "Value three", role: "[NEED: one line on this value]", image: PHOTOS.daily },
  { name: "Value four", role: "[NEED: one line on this value]", image: PHOTOS.men },
];

const About = () => {
  usePageMeta({
    title: "About us",
    description: BRAND.description,
  });

  return (
    <div className="min-h-screen tx-paper">
      <Header />
      <main id="main" tabIndex={-1} className="outline-none">
        {/* Hero */}
        <section className="relative h-[520px] overflow-hidden bg-charcoal md:h-[600px]">
          <img
            src={PHOTOS.hero}
            alt={`${BRAND.shortName} store photography`}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-charcoal/85 via-charcoal/60 to-charcoal/25 md:via-charcoal/45 md:to-transparent"
          />
          <div className="container-custom relative flex h-full items-center">
            <div className="max-w-2xl text-charcoal-foreground">
              <h1 className="on-photo mb-6 font-heading text-4xl font-semibold leading-[1.02] tracking-tight [text-wrap:balance] md:text-6xl">
                Introducing
                <br />
                {BRAND.name}
              </h1>
              <p className="on-photo mb-8 max-w-xl text-base leading-relaxed text-charcoal-foreground/90 [text-wrap:pretty] md:text-lg">
                {BRAND.description}
              </p>
              {BRAND.tagline && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-highlight-soft [text-wrap:balance]">
                  {BRAND.tagline}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Our story */}
        <section className="py-16 md:py-24">
          <div className="container-custom">
            <div className="grid items-center gap-10 md:grid-cols-2 md:gap-12">
              <div className="grid grid-cols-2 gap-4">
                <img
                  src={PHOTOS.storyA}
                  alt="A close-up of a product"
                  loading="lazy"
                  className="w-full rounded-card shadow-panel"
                />
                <div className="pt-12">
                  <img
                    src={PHOTOS.storyB}
                    alt="A product on display"
                    loading="lazy"
                    className="w-full rounded-card shadow-panel"
                  />
                </div>
              </div>
              <div>
                <h2 className="mb-6 font-heading text-3xl font-semibold tracking-tight text-foreground [text-wrap:balance] md:text-4xl">
                  Our story
                </h2>
                <div className="max-w-[62ch] space-y-4 leading-relaxed text-foreground/80 [text-wrap:pretty]">
                  <p>[NEED: the client&rsquo;s story in 2 to 3 sentences]</p>
                  <p>[NEED: what {BRAND.shortName} sells and who it is for, in 1 to 2 sentences]</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Collection banner */}
        <section className="relative h-[420px] overflow-hidden bg-charcoal md:h-[500px]">
          <img
            src={PHOTOS.collection}
            alt={`The ${BRAND.shortName} range`}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-charcoal/85 via-charcoal/55 to-charcoal/20 md:via-charcoal/40 md:to-transparent"
          />
          <div className="container-custom relative flex h-full items-center">
            <h2 className="on-photo max-w-xl font-heading text-3xl font-semibold leading-[1.05] tracking-tight text-charcoal-foreground [text-wrap:balance] md:text-5xl">
              The {BRAND.shortName} range, all in one place
            </h2>
          </div>
        </section>

        {/* Crafted */}
        <section className="relative my-16 h-[400px] overflow-hidden bg-charcoal md:my-24">
          <img
            src={PHOTOS.craft}
            alt={`Products from ${BRAND.shortName}`}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-charcoal/85 via-charcoal/55 to-charcoal/20 md:via-charcoal/40 md:to-transparent"
          />
          <div className="container-custom relative flex h-full items-center">
            <div className="max-w-xl text-charcoal-foreground">
              <h2 className="on-photo mb-6 font-heading text-2xl font-semibold tracking-tight [text-wrap:balance] md:text-3xl">
                [NEED: a short headline for this banner]
              </h2>
              <Link to="/products" className="btn-line text-charcoal-foreground">
                Shop now
              </Link>
            </div>
          </div>
        </section>

        {/* The range */}
        <section className="bg-muted py-16 md:py-24">
          <div className="container-custom">
            <div className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
              <h2 className="mb-4 font-heading text-3xl font-semibold tracking-tight text-foreground [text-wrap:balance] md:text-4xl">
                The {BRAND.shortName} range
              </h2>
              <p className="text-muted-foreground [text-wrap:pretty]">
                Browse our categories.
              </p>
            </div>
            {/* Rows of up to four cards; a short last row (five or six categories) is centred. */}
            <div className="flex flex-wrap justify-center gap-6">
              {RANGE.map((item) => (
                <article
                  key={item.title}
                  className="group relative flex w-full flex-col overflow-hidden rounded-card border border-foreground/[0.07] bg-card text-card-foreground shadow-panel transition-[transform,box-shadow,border-color] duration-hover ease-out hover:-translate-y-[var(--hover-lift)] hover:border-primary/35 sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)]"
                >
                  <div className="relative overflow-hidden">
                    <SmartImage
                      src={item.image}
                      alt=""
                      className="h-72 w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04] md:h-80"
                      preset="card"
                    />
                    <span className="tag-dark absolute left-3 top-3">{item.label}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-5 md:p-6">
                    <h3 className="mb-2 font-heading text-lg font-semibold tracking-tight text-foreground">{item.title}</h3>
                    <p className="mb-5 text-sm leading-relaxed text-muted-foreground [text-wrap:pretty]">{item.description}</p>
                    <Link
                      to={item.to}
                      className="link-arrow mt-auto self-start after:absolute after:inset-0 after:content-['']"
                    >
                      See more products
                      <span className="sr-only">: {item.title}</span>
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Our approach */}
        <section className="py-16 md:py-24">
          <div className="container-custom">
            <div className="grid items-center gap-10 md:grid-cols-2 md:gap-12">
              <img
                src={PHOTOS.ritual}
                alt={`${BRAND.shortName} store photography`}
                loading="lazy"
                className="w-full rounded-card shadow-panel"
              />
              <div>
                <p className="eyebrow-no mb-4">Our approach</p>
                <h2 className="mb-6 font-heading text-3xl font-semibold tracking-tight text-foreground [text-wrap:balance] md:text-4xl">
                  [NEED: a short headline for the approach section]
                </h2>
                <p className="mb-8 max-w-[62ch] leading-relaxed text-foreground/80 [text-wrap:pretty]">
                  [NEED: two sentences on how {BRAND.shortName} works or what it stands for]
                </p>
                <Link to="/products" className="btn-copper">
                  Explore more
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* What we stand for */}
        <section className="bg-muted py-16 md:py-24">
          <div className="container-custom">
            <h2 className="mb-12 text-center font-heading text-3xl font-semibold tracking-tight text-foreground [text-wrap:balance] md:mb-16 md:text-4xl">
              What we stand for
            </h2>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {VALUES.map((value) => (
                <div key={value.name} className="text-center">
                  <div className="mb-5 overflow-hidden rounded-card">
                    <SmartImage src={value.image} alt="" className="h-72 w-full object-cover md:h-80" preset="card" />
                  </div>
                  <h3 className="mb-1.5 font-heading text-lg font-semibold tracking-tight text-foreground">{value.name}</h3>
                  <p className="text-sm text-muted-foreground">{value.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Our promise */}
        <section className="py-16 md:py-24">
          <div className="container-custom max-w-4xl text-center">
            <h2 className="mb-3 font-heading text-3xl font-semibold tracking-tight text-foreground [text-wrap:balance] md:text-4xl">
              Our promise
            </h2>
            <p className="mb-10 text-muted-foreground md:mb-12">One line we hold ourselves to</p>
            <figure className="panel tx-sheet p-8 md:p-12">
              <blockquote className="mx-auto mb-8 max-w-[44ch] font-heading text-xl leading-snug tracking-tight text-foreground [text-wrap:balance] md:text-2xl">
                &ldquo;{BRAND.tagline || "[NEED: the client’s one-line promise to customers]"}&rdquo;
              </blockquote>
              <figcaption className="flex items-center justify-center gap-4">
                <Avatar className="h-14 w-14 bg-charcoal">
                  <AvatarImage src="/icon-192.png" alt="" />
                  <AvatarFallback className="bg-charcoal text-charcoal-foreground">{BRAND.memberPrefix}</AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <div className="font-semibold text-foreground">{BRAND.name}</div>
                  <div className="text-sm text-muted-foreground">{BRAND.description}</div>
                </div>
              </figcaption>
            </figure>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default About;
