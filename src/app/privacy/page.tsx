import { LegalShell } from "@/components/landing/legal-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Transovo AI LLC business messaging software.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This Privacy Policy describes how Transovo AI LLC (“Transovo,” “we,” “us,” or “our”)
        collects, uses, and shares information when you use our business messaging software and
        related websites.
      </p>
      <h2>Who we are</h2>
      <p>
        Transovo AI LLC provides SMS marketing and customer communication software for small
        businesses. Contact us at{" "}
        <a href="mailto:support@transovo.ai">support@transovo.ai</a>.
      </p>
      <h2>Information we collect</h2>
      <p>
        We may collect account information (such as name, email, business details), messaging
        program configuration, contact lists you upload, message content you send through the
        platform, usage logs, and support communications.
      </p>
      <h2>How we use information</h2>
      <p>
        We use information to provide and improve the Transovo platform, support carrier and
        messaging compliance requirements, process support requests, send service notices, and
        protect against abuse.
      </p>
      <h2>Customer contacts and consent</h2>
      <p>
        Businesses using Transovo are responsible for collecting and documenting customer consent
        before sending marketing or customer-care messages. Customers may reply STOP to opt out or
        HELP for assistance. Transovo processes messaging on behalf of the business customer.
      </p>
      <h2>Sharing</h2>
      <p>
        We may share information with service providers that help operate messaging delivery,
        hosting, analytics, and support; with carriers or registries when required for messaging
        verification; and when required by law.
      </p>
      <h2>Contact</h2>
      <p>
        For privacy questions, email{" "}
        <a href="mailto:support@transovo.ai">support@transovo.ai</a>. Legal entity: Transovo AI
        LLC.
      </p>
    </LegalShell>
  );
}
