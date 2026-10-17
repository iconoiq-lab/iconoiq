/**
 * The template's default look as plain values. src/lib/lookTokens.ts uses them only when it cannot read the page CSS
 * (no document: a test run, a server render). A browser always reads src/index.css instead, so Phase 3 edits
 * src/index.css and never this file. tests/look-audit.test.ts allows these literals here and nowhere else in src/.
 */
export const LOOK_FALLBACK = {
  /** Browser-bar colour of each theme: --background. */
  themeColor: { light: '#FAFAF9', dark: '#0C0A09' },
  /** Razorpay checkout accent: the light theme's --primary. */
  checkoutColor: '#1C1917',
  /** The shared receipt image: always the light theme, so it prints and shares the same in dark mode. */
  receipt: {
    text: '#1C1917', // --foreground
    muted: '#57534E', // --muted-foreground
    rule: '#E7E5E4', // --border
    panel: '#FAFAF9', // --background
    accent: '#1C1917', // --primary
    discount: '#4E6B3C', // money-saved green: no token matches it, so it is used as shipped, not read
    paper: '#FFFFFF', // --card
  },
  /** Font stacks for canvas drawing: --font-heading and --font-body. */
  fonts: { heading: 'Fraunces, serif', body: 'Inter, sans-serif' },
} as const;
