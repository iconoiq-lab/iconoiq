/**
 * The store's monogram (e.g. "Demo Store" -> "DS"), drawn on the scratch-card
 * foil. Initials of the first two words of the store name; a one-word name
 * gives its first letter. Falls back to "S" so the foil never draws a blank.
 */
export function brandMonogram(name: string): string {
  const letters = (name || '')
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+/u, '').charAt(0))
    .filter(Boolean)
    .slice(0, 2);
  return (letters.join('') || 'S').toUpperCase();
}
