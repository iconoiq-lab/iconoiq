/** Gap kept under a tall sticky column once its bottom is in view. */
const BOTTOM_GAP_PX = 16;

/**
 * The CSS `top` for a sticky sidebar that is `heightPx` tall: the usual offset under the
 * header, or, when the column is taller than the screen, a smaller (negative) value, so the
 * column scrolls with the page until its bottom is in view and then sticks there.
 * Returns undefined until the column has been measured (the class's default `top` applies).
 * Pure: tests import it.
 */
export function tallStickyTop(heightPx: number): string | undefined {
  if (!(heightPx > 0)) return undefined;
  return `min(var(--sticky-top), calc(100vh - ${Math.ceil(heightPx)}px - ${BOTTOM_GAP_PX}px))`;
}
