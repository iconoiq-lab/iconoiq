import Marquee from "@/components/home/Marquee";
import { LotusMark } from "@/components/icons/IconoIcons";

// ICONOIQ (2026-10-17): the subjects the kits teach, not shop slogans. Nothing here is a claim.
const phrases = [
  "Deities",
  "Mudras",
  "Temple architecture",
  "Shilpa Shastra",
  "Navagraha",
  "Dashavatara",
  "Kolam & rangoli",
  "Learn · Draw · Play",
];

/** The page's one moving band: charcoal stone, accent lettering, solid and hollow in turn. */
const MarqueeBand = () => (
  <section className="tx-slate border-y border-highlight-soft/20 py-3.5 md:py-5">
    <Marquee speed={45} copyClassName="gap-10 pr-10">
      {phrases.map((phrase, index) => (
        <div key={phrase} className="flex items-center gap-10">
          <span
            className={`whitespace-nowrap text-sm font-semibold uppercase tracking-[0.14em] md:text-lg ${
              index % 2 ? "text-outline" : "text-charcoal-foreground/90"
            }`}
            style={{ fontFamily: "var(--font-heading)", fontStretch: "var(--font-heading-stretch)" }}
          >
            {phrase}
          </span>
          <LotusMark aria-hidden="true" className="size-5 text-highlight-soft/80 md:size-6" />
        </div>
      ))}
    </Marquee>
  </section>
);

export default MarqueeBand;
