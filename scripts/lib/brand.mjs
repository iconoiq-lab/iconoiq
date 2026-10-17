// Values the QA scripts read from the repo, so a client copy needs no edits here.
// BRAND is imported from src/config/brand.ts itself (Node strips the types), so there is no pattern to
// miss and no silent fallback: a store whose state is "Tamil Nadu" in double quotes is read correctly.
// Run the scripts from the repo root (.firebaserc is read relative to it).
import { readFileSync } from 'node:fs';
import { BRAND } from '../../src/config/brand.ts';

const need = (key, value) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`src/config/brand.ts: BRAND.${key} is empty. Fill it in (Phase 1) before running this script.`);
  }
  return value;
};
export const BRAND_SLUG = need('slug', BRAND.slug);
/**
 * The store's state (BRAND.state), the default delivery home state. A function so that only the scripts
 * that need it fail when it is empty; it never falls back to another state.
 */
export const brandState = () => need('state', BRAND.state);
/** localStorage key the theme is saved under (BRAND.storageKeys.theme). */
export const THEME_KEY = `${BRAND_SLUG}-theme`;
/** The Firebase project in .firebaserc: live QA scripts refuse to run against any other. */
export const FIREBASE_PROJECT = JSON.parse(readFileSync('.firebaserc', 'utf8')).projects.default;
