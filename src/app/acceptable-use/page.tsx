import { LegalShell } from "@/components/landing/legal-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
  description: "Acceptable Use Policy for Transovo AI LLC permission-based business messaging.",
};

export default function AcceptableUsePage() {
  return (
    <LegalShell title="Acceptable Use Policy">
      <p>
        This Acceptable Use Policy applies to all use of Transovo AI LLC (“Transovo”) business
        messaging software. Violations may result in suspension or termination of messaging access.
      </p>
      <h2>Permission-based messaging only</h2>
      <p>
        You may only message people who agreed to receive texts from your business. Purchased
        contact lists, scraped phone numbers, and unsolicited bulk messaging are not allowed.
      </p>
      <h2>Clear consent</h2>
      <p>
        Consent language must explain who will send messages, what messages may include, how often
        they may arrive, that message and data rates may apply, and how to opt out. Consent must not
        be a condition of purchase where prohibited.
      </p>
      <h2>STOP and HELP</h2>
      <p>
        Messages must support STOP to opt out and HELP for assistance. You must honor opt-outs and
        must not continue sending marketing messages after consent is withdrawn.
      </p>
      <h2>Prohibited content</h2>
      <p>
        Do not use Transovo for unlawful content, phishing, spam, harassment, deceptive offers, or
        content prohibited by carriers or applicable law.
      </p>
      <h2>Business responsibility</h2>
      <p>
        Each business remains responsible for its messaging practices, consent records, and
        compliance with carrier rules. Transovo provides software and guidance to support
        responsible messaging.
      </p>
      <h2>Contact</h2>
      <p>
        Report abuse or ask questions at{" "}
        <a href="mailto:support@transovo.ai">support@transovo.ai</a>. Legal entity: Transovo AI
        LLC.
      </p>
    </LegalShell>
  );
}
