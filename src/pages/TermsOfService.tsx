import LegalPageLayout from "@/components/legal/LegalPageLayout";

export default function TermsOfService() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      summary="These terms govern access to AJE and clarify the limits of the product, including that it is not a substitute for licensed professional advice."
    >
      <h2>1. Use of the Service</h2>
      <p>
        AJE provides tools, commentary, models, calculators, and AI
        generated outputs designed to help users explore ideas, scenarios, and
        workflows. The service is offered for informational and entertainment
        purposes only.
      </p>

      <h2>2. No Financial, Investment, Tax, or Legal Advice</h2>
      <p>
        AJE does not provide financial planning, investment advice,
        tax advice, accounting advice, legal advice, brokerage services, or
        fiduciary services. Nothing on the platform should be treated as a
        recommendation to buy, sell, hold, rebalance, or avoid any security,
        asset, portfolio, strategy, or transaction.
      </p>
      <p>
        If you need advice tailored to your circumstances, you should consult a
        properly licensed financial advisor, tax professional, attorney, or
        other qualified professional.
      </p>

      <h2>3. No Guarantees or Warranties</h2>
      <p>
        Market data, projections, simulations, and AI outputs may be delayed,
        incomplete, inaccurate, or unsuitable for your situation. Past
        performance, modeled outcomes, and hypothetical scenarios do not
        guarantee future results.
      </p>

      <h2>4. User Responsibility</h2>
      <p>
        You are solely responsible for evaluating the information provided
        through AJE and for any decision you make based on that
        information. You agree not to rely on the service as your only source
        of information before making financial, investment, tax, legal, or
        business decisions.
      </p>

      <h2>5. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, AJE and its operators
        are not liable for any losses, damages, claims, costs, taxes, penalties,
        or expenses arising from or related to your use of the service or your
        reliance on any content, model output, forecast, or suggestion provided
        through the service.
      </p>

      <h2>6. Acceptance</h2>
      <p>
        By using AJE, you acknowledge that you understand these terms
        and accept that the service is a general-purpose tool, not a licensed
        advisory service.
      </p>
    </LegalPageLayout>
  );
}
