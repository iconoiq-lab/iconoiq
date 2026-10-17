// Grid placement for scripts/qa/sheet.mjs (tested in tests/sheet-layout.test.ts).

/**
 * Cells of equal width laid out in rows of `cols`; each row is as tall as its tallest cell.
 * `heights` are the cells' heights in order. Returns each cell's top-left corner and the sheet size.
 */
export function gridLayout(heights, { cols, cellWidth, gap }) {
  const places = [];
  let top = gap;
  for (let start = 0; start < heights.length; start += cols) {
    const row = heights.slice(start, start + cols);
    row.forEach((_, c) => places.push({ left: gap + c * (cellWidth + gap), top }));
    top += Math.max(...row) + gap;
  }
  const used = Math.min(cols, heights.length);
  return { places, width: gap + used * (cellWidth + gap), height: top };
}
