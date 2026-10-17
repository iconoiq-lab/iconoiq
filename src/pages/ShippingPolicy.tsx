import { useEffect, useState } from "react";
import {
  policyBodyClassName,
  policyHeadingClassName,
  policySectionClassName,
} from "@/components/PolicyPageLayout";
import PolicyPageLayout from "@/components/PolicyPageLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BRAND } from "@/config/brand";
import { DEFAULT_DELIVERY, getDeliverySettings } from "@/services/siteSettingsService";
import { deliveryTimeLine } from "@/lib/deliveryTimeLine";

const ShippingPolicy = () => {
  // The delivery time is the store's delivery setting (DEFAULT_DELIVERY until the admin saves one).
  const [estimatedDays, setEstimatedDays] = useState(DEFAULT_DELIVERY.estimatedDays);
  useEffect(() => {
    let live = true;
    getDeliverySettings().then((settings) => {
      if (live) setEstimatedDays(settings.estimatedDays);
    });
    return () => {
      live = false;
    };
  }, []);

  usePageMeta({ title: "Shipping policy", description: `Where ${BRAND.name} delivers, how long orders take and how tracking works.` });

  return (
    <PolicyPageLayout title="Shipping policy" effectiveDate="[NEED: client review and effective date]">
      <>
            {/* Introduction */}
            <section className={policySectionClassName}>
              <p className={policyBodyClassName}>
                At {BRAND.name}, we aim to deliver your order safely and promptly.
              </p>
            </section>

            {/* Delivery Area */}
            <section className={policySectionClassName}>
              <h2 className={policyHeadingClassName}>1. Delivery area</h2>
              <p className={policyBodyClassName}>
                We deliver across India only.
              </p>
            </section>

            {/* Processing Time */}
            <section className={policySectionClassName}>
              <h2 className={policyHeadingClassName}>2. Processing time</h2>
              <p className={policyBodyClassName}>
                Orders are processed within 1 to 3 working days after confirmation.
              </p>
            </section>

            {/* Delivery Time */}
            <section className={policySectionClassName}>
              <h2 className={policyHeadingClassName}>3. Delivery time</h2>
              <p className={policyBodyClassName}>
                {deliveryTimeLine(estimatedDays)}
              </p>
            </section>

            {/* Shipping Charges */}
            <section className={policySectionClassName}>
              <h2 className={policyHeadingClassName}>4. Shipping charges</h2>
              <p className={policyBodyClassName}>
                Shipping charges (if any) will be displayed at checkout before payment.
              </p>
            </section>

            {/* Tracking */}
            <section className={policySectionClassName}>
              <h2 className={policyHeadingClassName}>5. Tracking</h2>
              <p className={policyBodyClassName}>
                Tracking details will be shared via email or SMS once the order is dispatched.
              </p>
            </section>

            {/* Delays */}
            <section className={policySectionClassName}>
              <h2 className={policyHeadingClassName}>6. Delays</h2>
              <p className={policyBodyClassName}>
                Delivery may be delayed due to unforeseen circumstances such as natural disasters, courier delays, or government restrictions.
              </p>
            </section>
      </>
    </PolicyPageLayout>
  );
};

export default ShippingPolicy;
