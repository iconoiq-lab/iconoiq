import { SECTIONS, parseSectionOverride, resolveSections, type SectionChoice, type SectionKey, type SectionVersion } from "./sections";

// The preview override works in dev, or on a build with VITE_SECTION_PREVIEW=1 (a demo link for a client).
const PREVIEW = import.meta.env.DEV || import.meta.env.VITE_SECTION_PREVIEW === "1";
const STORE_KEY = "section-preview";

function readOverride(): Partial<SectionChoice> {
  if (!PREVIEW || typeof window === "undefined") return {};
  try {
    const fromUrl = parseSectionOverride(window.location.search);
    if (fromUrl === "reset") { sessionStorage.removeItem(STORE_KEY); return {}; }
    const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || "{}");
    const merged = { ...(typeof saved === "object" && saved ? saved : {}), ...fromUrl };
    // Saved values pass the same check as the URL, so a stale or edited entry can't select a missing version.
    const checked = parseSectionOverride("?sections=" + Object.entries(merged).map(([k, v]) => `${k}:${v}`).join(","));
    const clean = checked === "reset" ? {} : checked;
    sessionStorage.setItem(STORE_KEY, JSON.stringify(clean));
    return clean;
  } catch {
    return {};
  }
}

const ACTIVE = resolveSections(SECTIONS, readOverride());

export function activeSection<K extends SectionKey>(key: K): SectionVersion<K> {
  return ACTIVE[key];
}
