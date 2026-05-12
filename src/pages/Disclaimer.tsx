import LegalPageLayout from "@/components/legal/LegalPageLayout";

export default function Disclaimer() {
  return (
    <LegalPageLayout
      title="Disclaimer"
      summary="This page states the core financial and liability limitations of WealthOS Hub in plain language."
    >
      <h2>1. Informational and Entertainment Use Only</h2>
      <p>
        WealthOS Hub is intended for general informational, educational, and
        entertainment use. It is designed to help users explore scenarios and
        ideas, not to replace professional judgment.
      </p>

      <h2>2. Not Financial Advice</h2>
      <p>
        Nothing on WealthOS Hub is financial advice, investment advice, tax
        advice, accounting advice, legal advice, or a personalized
        recommendation. Any analysis, AI output, market commentary, signal,
        score, plan, or projection may be incomplete or wrong.
      </p>

      <h2>3. Consult Licensed Professionals</h2>
      <p>
        Before making investment, tax, legal, retirement, estate, or other
        financial decisions, you should consult professionals who are properly
        licensed or otherwise qualified to advise you based on your specific
        circumstances.
      </p>

      <h2>4. Decisions Are Your Responsibility</h2>
      <p>
        You are solely responsible for any decision, action, or inaction you
        take based on your use of WealthOS Hub. This includes trading,
        investing, rebalancing, allocating capital, borrowing, tax reporting,
        or any other financial decision.
      </p>

      <h2>5. No Liability for User Decisions</h2>
      <p>
        To the fullest extent permitted by law, WealthOS Hub and its operators
        disclaim liability for losses or damages of any kind resulting from
        your reliance on the platform or from decisions you make after using
        it.
      </p>

      <h2>6. No Guarantees</h2>
      <p>
        We do not guarantee accuracy, completeness, suitability, availability,
        or fitness for a particular purpose. Hypothetical results and historical
        data are not promises of future performance.
      </p>
    </LegalPageLayout>
  );
}
