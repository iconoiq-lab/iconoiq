/**
 * Scale an image of `w` x `h` to fit inside a `boxW` x `boxH` box at its own proportions.
 * `offsetY` centres it up and down; the invoice keeps the logo at the left edge.
 */
export function fitInBox(w: number, h: number, boxW: number, boxH: number) {
  const scale = Math.min(boxW / w, boxH / h);
  const height = h * scale;
  return { width: w * scale, height, offsetY: (boxH - height) / 2 };
}
