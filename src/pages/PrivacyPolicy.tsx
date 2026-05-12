import LegalPageLayout from "@/components/legal/LegalPageLayout";

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      summary="This policy explains the basic categories of information WealthOS Hub may collect and how that information is used, while also clarifying that the product is not a licensed advisory service."
    >
      <h2>1. Information We Collect</h2>
      <p>
        We may collect account information, contact details, usage activity,
        settings, uploaded content, and technical data needed to operate,
        secure, and improve WealthOS Hub.
      </p>

      <h2>2. How We Use Information</h2>
      <p>
        Information may be used to provide the service, authenticate users,
        improve product performance, respond to support requests, monitor abuse,
        and communicate product updates or legal notices.
      </p>

      <h2>3. Financial Disclaimer</h2>
      <p>
        Data you enter into WealthOS Hub and outputs you receive from WealthOS
        Hub do not create a financial advisor-client, legal-client, tax-client,
        or fiduciary relationship. The platform is not a replacement for advice
        from licensed professionals.
      </p>

      <h2>4. Sharing and Disclosure</h2>
      <p>
        We may share information with service providers, infrastructure
        partners, and vendors that help us operate the product, or when
        required by law, regulation, or valid legal process.
      </p>

      <h2>5. Data Retention and Security</h2>
      <p>
        We retain information for as long as reasonably necessary to operate
        the service, meet legal obligations, resolve disputes, and enforce our
        terms. No method of storage or transmission is completely secure, so we
        cannot guarantee absolute security.
      </p>

      <h2>6. Your Responsibility</h2>
      <p>
        You should avoid treating WealthOS Hub as your only source of
        information when making financial or legal decisions. You remain
        responsible for the decisions you make and for consulting licensed
        professionals where appropriate.
      </p>
    </LegalPageLayout>
  );
}
