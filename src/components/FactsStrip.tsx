import { useEffect, useState } from "react";
import { Clock, Package, Truck } from "lucide-react";
import Reveal from "@/components/Reveal";
import { BRAND } from "@/config/brand";
import {
  subscribeCustomerSupportSettings,
  subscribeDeliverySettings,
  type CustomerSupportSettings,
  type DeliverySettings,
} from "@/services/siteSettingsService";
import { storeFacts, type StoreFact } from "@/lib/storeFacts";

const ICONS: Record<StoreFact["id"], typeof Truck> = { delivery: Truck, days: Package, reply: Clock };
const GRID: Record<number, string> = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3" };

// Held while the two settings load, so the page below does not jump when the strip arrives
// (measured at 390, 768, 1024 and 1280 px with the template's delivery and support defaults; a longer
// reply time or a store with state rates wraps taller, and between those widths the strip is a little off).
const RESERVE = "h-[257px] md:h-[246px] lg:h-[183px] xl:h-[161px]";

/**
 * Three plain facts under the hero: what delivery costs, how long it takes, how fast the shop replies.
 * Nothing is typed in here: delivery comes from Admin > Commerce > Delivery and GST, the reply time and
 * hours from Admin > Commerce > Support, the "ships to" line from BRAND.shipsTo. Switched in homeBlocks.ts.
 */
const FactsStrip = () => {
  const [delivery, setDelivery] = useState<DeliverySettings | null>(null);
  const [support, setSupport] = useState<CustomerSupportSettings | null>(null);
  // A failed read hides the strip: showing the template's default numbers could contradict the store's saved ones.
  const [failed, setFailed] = useState(false);
  useEffect(() => subscribeDeliverySettings(setDelivery, () => setFailed(true)), []);
  useEffect(() => subscribeCustomerSupportSettings(setSupport, () => setFailed(true)), []);

  if (failed) return null;
  if (!delivery || !support) return <div aria-hidden="true" className={RESERVE} />;
  const facts = storeFacts({
    delivery,
    responseTime: support.responseTime,
    shipsTo: BRAND.shipsTo,
    hours: support.hours,
  });
  if (facts.length === 0) return null;

  return (
    <section aria-label="Delivery and support" className="border-y border-border py-10 md:py-12">
      <Reveal className="container-custom">
        <ul className={`grid gap-[22px] md:gap-12 ${GRID[facts.length] ?? "md:grid-cols-3"}`}>
          {facts.map(({ id, title, detail }) => {
            const Icon = ICONS[id];
            return (
              <li key={id} className="flex items-start gap-4">
                <Icon aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-highlight" />
                <div>
                  <p className="text-[15px] font-bold text-foreground">{title}</p>
                  {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </section>
  );
};

export default FactsStrip;
