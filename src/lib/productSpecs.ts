/** Product specification helpers shared by the product page and the Detailed card. Pure: tests import it. */

/** Readable labels for common spec keys; any other key shows as typed. */
export const SPEC_LABELS: Record<string, string> = { dimensions: "Size", material: "Material", purity: "Purity" };

/** Quantity and ingredients first, directions last, everything else in between. */
export const specRank = (key: string) => {
  const k = key.toLowerCase();
  if (k.startsWith("net")) return 0;
  if (k.startsWith("key ingredient") || k === "ingredients") return 1;
  if (k.startsWith("how to use") || k === "directions") return 9;
  return 5;
};

export const specEntries = (specs?: Record<string, unknown>) =>
  Object.entries(specs || {})
    .filter((e): e is [string, string] => typeof e[1] === "string" && e[1].trim() !== "")
    .sort((a, b) => specRank(a[0]) - specRank(b[0]) || a[0].localeCompare(b[0]));

/** A "[NEED: ...]" value is a placeholder still waiting for the client's real text. */
const isPlaceholder = (v: string) => /^\[need:/i.test(v.trim());

/**
 * One short line for the Detailed card: the best spec (value 40 characters or less),
 * else the weight, else nothing. A quantity ("net ...") and the weight read fine bare
 * ("50 ml"); any other value gets its label ("Material: Clay"), so it is never a lone
 * word. Placeholder values never reach a shopper's card.
 */
export function keyAttribute(specs?: Record<string, unknown>, weight?: string, weightUnit?: "grams" | "kgs"): string | undefined {
  const hit = specEntries(specs).find(([k, v]) => specRank(k) < 9 && v.trim().length <= 40 && !isPlaceholder(v));
  if (hit) {
    const [key, value] = hit;
    if (specRank(key) === 0) return value.trim();
    const name = key.trim();
    return `${SPEC_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1)}: ${value.trim()}`;
  }
  if (weight && weight.trim()) return `${weight.trim()} ${weightUnit === "kgs" ? "kg" : "g"}`;
  return undefined;
}
