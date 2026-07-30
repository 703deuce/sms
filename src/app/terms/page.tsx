import { LegalShell } from "@/components/landing/legal-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Transovo AI LLC business messaging software.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        These Terms of Service (“Terms”) govern access to and use of the Transovo AI LLC
        (“Transovo”) business messaging software and related services.
      </p>
      <h2>The service</h2>
      <p>
        Transovo provides software that helps businesses send and manage permission-based SMS
        marketing and customer communications. Transovo is a software provider. Each business is
        responsible for its messaging content, customer lists, and consent practices.
      </p>
      <h2>Accounts</h2>
      <p>
        You must provide accurate business information and keep your credentials secure. You are
        responsible for activity under your account.
      </p>
      <h2>Acceptable use</h2>
      <p>
        You must follow our{" "}
        <a href="/acceptable-use">Acceptable Use Policy</a>, applicable carrier rules, and all
        messaging laws. Purchased lists, scraped numbers, and unsolicited mass texting are
        prohibited.
      </p>
      <h2>Messaging verification</h2>
      <p>
        U.S. application-to-person messaging may require carrier or registry verification.
        Messaging access may remain limited until verification is complete.
      </p>
      <h2>Opt-out and help</h2>
      <p>
        Customers must be able to reply STOP to opt out and HELP for assistance. You must honor
        opt-out requests promptly.
      </p>
      <h2>Contact</h2>
      <p>
        Questions: <a href="mailto:support@transovo.ai">support@transovo.ai</a>. Legal entity:
        Transovo AI LLC.
      </p>
    </LegalShell>
  );
}
