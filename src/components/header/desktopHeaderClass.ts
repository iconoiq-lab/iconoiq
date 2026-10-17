import { cn } from "@/lib/utils";

/**
 * The shell of the desktop header bar (lg and up), shared by the header versions so
 * every layout sticks, blurs and gets its hairline the same way once the page scrolls.
 */
export const desktopHeaderClass = (isScrolled: boolean) =>
  cn(
    "hidden lg:block sticky top-0 z-header transition-[background-color,box-shadow] duration-hover ease-out",
    isScrolled
      ? "bg-background/95 backdrop-blur-xl shadow-[0_1px_0_hsl(var(--foreground)/0.07)]"
      : "bg-background",
  );
