// The apply column for a guest on /dealer: what happens next and one button
// that signs them in and brings them back to the same track.

import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const GuestApplyPanel = ({ track, onSignIn }: { track: 'stockist' | 'partner'; onSignIn: () => void }) => (
  <section aria-labelledby="guest-apply-heading" className="panel tx-sheet p-6">
    <h3 id="guest-apply-heading" className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
      Apply
    </h3>
    <p className="mt-3 text-lg font-semibold tracking-tight text-foreground">
      {track === 'partner' ? 'Ready to become a partner?' : 'Ready to become a stockist?'}
    </p>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
      Sign in or create a free account, then fill in a short form. Our team reviews every application and replies by phone or email.
    </p>
    <Button className="mt-5 w-full sm:w-auto" onClick={onSignIn}>
      <LogIn aria-hidden="true" />
      Sign in to apply
    </Button>
  </section>
);
