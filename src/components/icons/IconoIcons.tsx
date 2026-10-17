import type { SVGProps } from "react";

/**
 * ICONOIQ's own line icons for the category strip (2026-10-17), drawn on a 24px grid with a
 * 1.6 stroke so they sit beside lucide icons without looking borrowed. Each takes the same
 * props as a lucide icon (className, aria-hidden, ...), and colour follows `currentColor`.
 */
type IconProps = SVGProps<SVGSVGElement>;

const Base = ({ children, ...props }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {children}
  </svg>
);

/** Learning Kits: a kit box with its lid up and a temple doorway on the front. */
export const KitBoxIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3.5 11h17v8.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" />
    <path d="M4.5 11 6.5 5h11l2 6" />
    <path d="M10 21v-3.5a2 2 0 0 1 4 0V21" />
    <path d="M12 8.2v.1" />
  </Base>
);

/** Templates & Stencils: a stencil plate with a lotus cut out of it. */
export const StencilIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <path d="M12 16.5c-1.9-1.6-1.9-4.6 0-7 1.9 2.4 1.9 5.4 0 7z" />
    <path d="M12 16.5c-3 .3-5.1-1.4-5.6-4 2.6-.3 4.6.9 5.6 4z" />
    <path d="M12 16.5c3 .3 5.1-1.4 5.6-4-2.6-.3-4.6.9-5.6 4z" />
  </Base>
);

/** Books & Charts: an open book with a graha (planet) on its right page. */
export const BookChartIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 6.5C10.4 5 8 4.5 3 4.5v14c5 0 7.4.5 9 2 1.6-1.5 4-2 9-2v-14c-5 0-7.4.5-9 2z" />
    <path d="M12 6.5v14" />
    <circle cx="16.5" cy="10.5" r="1.8" />
    <path d="M6 9.5h3M6 12.5h3" />
  </Base>
);

/** Games & Puzzles: a jigsaw piece with a kolam dot. */
export const PuzzlePieceIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 8h4a2 2 0 1 1 4 0h4v3.5a2 2 0 1 1 0 4V20H4v-4a2 2 0 1 0 0-4z" />
    <circle cx="10" cy="14" r="0.9" fill="currentColor" stroke="none" />
  </Base>
);

/** Art & Stationery: a brush beside three kolam dots. */
export const BrushDotsIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M20.5 3.5 12 12" />
    <path d="M12 12c-2-.6-4.2.4-4.8 2.6-.4 1.6-1.3 2.9-3.2 3.6 2.7 1.3 6.3.8 7.9-1.5 1-1.4.9-3.5.1-4.7z" />
    <circle cx="5" cy="5.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="3.8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
  </Base>
);

/** School & Academy Packs: a graduation cap. */
export const ClassCapIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M2.5 9.5 12 5l9.5 4.5L12 14z" />
    <path d="M6.5 11.6v4.2c0 1.3 2.5 2.7 5.5 2.7s5.5-1.4 5.5-2.7v-4.2" />
    <path d="M21.5 9.5v5" />
  </Base>
);

/** A small lotus, for separators and section ornaments. */
export const LotusMark = (props: IconProps) => (
  <Base strokeWidth={1.4} {...props}>
    <path d="M12 18c-2.4-2-2.4-5.8 0-9 2.4 3.2 2.4 7 0 9z" />
    <path d="M12 18c-3.8.4-6.6-1.8-7.2-5.2 3.4-.4 6 1.1 7.2 5.2z" />
    <path d="M12 18c3.8.4 6.6-1.8 7.2-5.2-3.4-.4-6 1.1-7.2 5.2z" />
    <path d="M7 20h10" />
  </Base>
);
