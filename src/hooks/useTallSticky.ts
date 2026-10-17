import { useEffect, useState, type CSSProperties } from "react";
import { tallStickyTop } from "@/lib/stickyTop";

/**
 * For a sticky sidebar that can be taller than the screen (the stacked product page's details).
 * Spread `style` on the element and pass `ref` as its ref: the element's height is watched, and
 * its inline `top` is set so a tall column scrolls with the page until its bottom is in view,
 * then sticks, instead of scrolling inside itself. `enabled: false` changes nothing.
 */
export function useTallSticky(enabled: boolean) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!enabled || !el || typeof ResizeObserver === "undefined") return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, el]);

  const top = enabled ? tallStickyTop(height) : undefined;
  const style: CSSProperties | undefined = top ? { top } : undefined;
  return { ref: setEl, style };
}
