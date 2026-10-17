import {
  Facebook,
  Instagram,
  Youtube,
  Twitter,
  Linkedin,
  MessageCircle, // WhatsApp
  PinIcon,        // Pinterest substitute
  Send,           // Telegram substitute
  Camera,         // Snapchat substitute
  AtSign,         // Threads substitute
  type LucideIcon,
} from "lucide-react";
import type { SocialPlatform } from "@/services/siteSettingsService";
import { toSlug, type Category } from "@/services/categoryService";

/** Pieces both footer versions use, so a label, icon or link rule is changed in one place. */

const SOCIAL_ICONS: Record<SocialPlatform, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
  linkedin: Linkedin,
  whatsapp: MessageCircle,
  pinterest: PinIcon,
  telegram: Send,
  snapchat: Camera,
  threads: AtSign,
};

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  twitter: "X / Twitter",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  pinterest: "Pinterest",
  telegram: "Telegram",
  snapchat: "Snapchat",
  threads: "Threads",
};

export const socialIconFor = (platform: SocialPlatform): LucideIcon => SOCIAL_ICONS[platform] || AtSign;

/** Same slug rule the category service uses, so "Category One" -> category-one. */
const slugOf = (value: string) => toSlug(value.replace(/['’]/g, "").trim());

/** Store-wide listings every shop has, so the default "Shop" column links resolve without a category. */
const FIXED_FOOTER_LINKS = new Map<string, string>([
  ["shop all", "/products"],
  ["new arrivals", "/products?tag=new-arrivals"],
  ["best sellers", "/products?tag=best-sellers"],
]);

/**
 * Footer labels are free text from Admin > Footer. Each one resolves against the
 * live category tree: a category name opens its page, a subcategory name
 * ("Subcategory 1A") opens its parent filtered to it, and anything else falls back to
 * a product search, so no footer link can land on "Category not found".
 */
export const resolveFooterHref = (name: string, categories: Category[]) => {
  const slug = slugOf(name);
  const label = name.trim().toLowerCase();
  const fixed = FIXED_FOOTER_LINKS.get(label);
  if (fixed) return fixed;
  for (const cat of categories) {
    if (cat.slug === slug || cat.name.trim().toLowerCase() === label) return `/category/${cat.slug}`;
  }
  for (const cat of categories) {
    const sub = (cat.subcategories || []).find(
      (s) => s.slug === slug || s.name.trim().toLowerCase() === label,
    );
    if (sub) return `/category/${cat.slug}?sub=${sub.slug}`;
  }
  return `/search-results?q=${encodeURIComponent(name.trim())}`;
};
