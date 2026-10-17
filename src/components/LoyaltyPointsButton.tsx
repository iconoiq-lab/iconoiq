import { Award, Wallet } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { IconButton } from "@/components/ui/icon-button";
import { useRewardsLive } from "@/hooks/useRewardSettings";
import { useWaitingScratchCards } from "@/hooks/useWaitingScratchCards";
import { cn } from "@/lib/utils";

interface LoyaltyPointsButtonProps {
  /** Icon size in px - the desktop header uses 20, the mobile header 22. */
  size?: number;
}

/**
 * Header shortcut to the wallet page (/wallet): loyalty points / rewards while the
 * shop's rewards are running, otherwise just the wallet (gift cards).
 *
 * Sits where the live silver-rate widget was in the original theme. It shows no
 * points count on purpose: reading the balance here would cost a Firestore read
 * on every page view for every signed-in visitor. An accent dot says a scratch
 * card is waiting; that comes from one listener shared by the whole session.
 */
const LoyaltyPointsButton = ({ size = 20 }: LoyaltyPointsButtonProps) => {
  const waiting = useWaitingScratchCards() > 0;
  const rewards = useRewardsLive();
  return <LoyaltyPointsButtonView size={size} waiting={waiting} rewards={rewards} />;
};

export const LoyaltyPointsButtonView = ({
  size = 20,
  waiting = false,
  rewards = true,
}: LoyaltyPointsButtonProps & { waiting?: boolean; rewards?: boolean }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = pathname.startsWith("/wallet");
  // The mobile header (22px icons) sits on touch screens: no tooltip, 44px target.
  const mobile = size > 20;
  const Icon = rewards ? Award : Wallet;
  const name = rewards ? "Rewards" : "Wallet";

  return (
    <IconButton
      label={waiting ? `${name}, scratch card waiting` : name}
      tooltip={!mobile}
      onClick={() => navigate("/wallet")}
      aria-current={active ? "page" : undefined}
      className={cn("hover:text-primary", mobile && "size-11 [@media(pointer:fine)]:size-11 [&_svg]:size-[22px]", active && "text-primary")}
    >
      <Icon aria-hidden="true" />
      {waiting && (
        <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
      )}
    </IconButton>
  );
};

export default LoyaltyPointsButton;
