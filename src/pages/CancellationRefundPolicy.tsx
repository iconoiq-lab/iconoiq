import {
  policyBodyClassName,
  policyHeadingClassName,
  policyLinkClassName,
  policyListClassName,
  policySectionClassName,
} from "@/components/PolicyPageLayout";
import PolicyPageLayout from "@/components/PolicyPageLayout";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useCustomerSupport } from "@/hooks/useCustomerSupport";
import { BRAND } from "@/config/brand";
import { RETURN_WINDOW_DAYS } from "@/lib/returnWindow";

const CancellationRefundPolicy = () => {
  const { email, phone } = useCustomerSupport();
  usePageMeta({ title: "Cancellation and refund policy", description: `How to cancel an order, return a product and get a refund from ${BRAND.name}.` });

  return (
    <PolicyPageLayout title="Cancellation and refund policy" effectiveDate="[NEED: client review and effective date]">
      <>
            {/* Introduction */}
            <section className={policySectionClassName}>
              <p className={policyBodyClassName}>
                At {BRAND.name}, customer satisfaction is our priority.
              </p>
            </section>

            {/* Return Window */}
            <section className={policySectionClassName}>
              <h2 className={policyHeadingClassName}>1. Return window</h2>
              <p className={policyBodyClassName}>
                Customers may request a return within {RETURN_WINDOW_DAYS} days from the date of delivery.
              </p>
            </section>

            {/* Eligibility for Return */}
            <section className={policySectionClassName}>
              <h2 className={policyHeadingClassName}>2. Eligibility for return</h2>
              <p className={`${policyBodyClassName} mb-3`}>
                Products must:
              </p>
              <ul className={policyListClassName}>
                <li>Be unused and in the same condition as delivered</li>
                <li>Be in the original packaging</li>
                <li>Include the invoice</li>
              </ul>
              <p className={`${policyBodyClassName} mt-4`}>
                Damaged products are not eligible for return.
              </p>
            </section>

            {/* Cancellation */}
            <section className={policySectionClassName}>
              <h2 className={policyHeadingClassName}>3. Cancellation</h2>
              <p className={policyBodyClassName}>
                Orders can be cancelled before dispatch. Once shipped, cancellation is not allowed.
              </p>
            </section>

            {/* Refund Process */}
            <section className={policySectionClassName}>
              <h2 className={policyHeadingClassName}>4. Refund process</h2>
              <p className={`${policyBodyClassName} mb-3`}>
                After we receive and inspect the returned product:
              </p>
              <ul className={policyListClassName}>
                <li>Refund will be processed within 7 business days.</li>
                <li>For prepaid orders, refund will be made to the original payment method.</li>
                <li>For Cash on Delivery (COD) orders, refund will be processed to the customer's bank account after verification.</li>
              </ul>
            </section>

            {/* Non-Refundable Cases */}
            <section className={policySectionClassName}>
              <h2 className={policyHeadingClassName}>5. Non-refundable cases</h2>
              <ul className={policyListClassName}>
                <li>Used products</li>
                <li>Damaged items not due to shipping</li>
                <li>Requests after {RETURN_WINDOW_DAYS} days</li>
              </ul>
            </section>

            {/* Contact for Refund Assistance */}
            <section className={policySectionClassName}>
              {email || phone ? (
                <>
                  <p className={`${policyBodyClassName} mb-2`}>
                    <strong className="text-foreground">For refund assistance:</strong>
                  </p>
                  {email && (
                    <p className={policyBodyClassName}>Email: <a href={`mailto:${email}`} className={policyLinkClassName}>{email}</a></p>
                  )}
                  {phone && <p className={policyBodyClassName}>Phone: {phone}</p>}
                </>
              ) : (
                <p className={policyBodyClassName}>
                  <strong className="text-foreground">For refund assistance,</strong> please use our <Link to="/contact" className={policyLinkClassName}>contact page</Link>.
                </p>
              )}
            </section>
      </>
    </PolicyPageLayout>
  );
};

export default CancellationRefundPolicy;
