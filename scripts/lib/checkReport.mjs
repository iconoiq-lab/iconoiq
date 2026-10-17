// Small helpers for what scripts/check.mjs and scripts/qa/ui-shots.mjs report.

/** The failing tests in `npm test` output: its TAP "not ok" lines, trimmed (a skipped test prints "ok ... # SKIP"). */
export function failedTestNames(output) {
  return String(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('not ok '));
}

// Chromium logs a console error for every failed response, and the page listener also sees the
// response itself, so one 404 would show up twice.
const LOGGED_AS_REQUEST = /^Failed to load resource: the server responded with a status of \d+/;

/**
 * Console and network issues on a page, counting a failed response once: its console error
 * ("Failed to load resource: ... status of 404") is the same failure as its entry in `failedRequests`.
 * Other console errors (including "Failed to load resource: net::ERR_...", which has no response) still count.
 */
export function countIssues(log) {
  return (
    log.consoleErrors.filter((text) => !LOGGED_AS_REQUEST.test(text)).length +
    log.pageErrors.length +
    log.failedRequests.length
  );
}

// Template promise values a client copy must replace in Phase 1 (docs/template/PHASE1.md).
const TEMPLATE_PROMISES = [
  ['src/config/brand.ts', /replyWithin:\s*'24 hours'/, "BRAND.replyWithin is still the template's '24 hours'"],
  ['src/config/brand.ts', /shipsTo:\s*'Shipped across India'/, "BRAND.shipsTo is still the template's 'Shipped across India'"],
  ['src/services/siteSettingsService.ts', /estimatedDays:\s*'3-5 business days'/, "DEFAULT_DELIVERY.estimatedDays is still the template's '3-5 business days'"],
];

/** Which template promise defaults are still in a client copy's source (brand.ts and siteSettingsService.ts text). */
export function templateDefaultsLeft(brandSrc, settingsSrc) {
  const src = { 'src/config/brand.ts': String(brandSrc), 'src/services/siteSettingsService.ts': String(settingsSrc) };
  return TEMPLATE_PROMISES.filter(([file, re]) => re.test(src[file])).map(([, , message]) => message);
}
