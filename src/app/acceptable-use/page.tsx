import { LegalShell } from "@/components/landing/legal-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
  description:
    "Acceptable Use Policy for Transovo AI LLC permission-based business messaging software.",
};

export default function AcceptableUsePage() {
  return (
    <LegalShell title="Acceptable Use Policy" effectiveDate="July 16, 2026">
      <p>
        This Acceptable Use Policy (“Policy”) applies to every use of Transovo AI LLC (“Transovo”)
        websites, accounts, and business messaging software (the “Services”). By using the Services,
        you agree to this Policy in addition to our <a href="/terms">Terms of Service</a> and{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>
      <p>
        Violations may result in delayed messaging, suspension, termination, or reporting to carriers
        and other partners. Questions or abuse reports can be sent to{" "}
        <a href="mailto:support@transovo.ai">support@transovo.ai</a>.
      </p>

      <h2>1. Permission-based messaging only</h2>
      <p>
        You may only send messages to people who agreed to receive texts from your business for the
        type of messages you are sending. Purchased contact lists, rented lists, scraped phone
        numbers, and unsolicited bulk messaging are not allowed. Having a customer’s phone number
        from an invoice, form, or call does not automatically mean you have permission to send
        marketing texts.
      </p>

      <h2>2. Clear consent</h2>
      <p>
        Consent language must clearly explain who will send the messages, what the messages may
        include, how often they may arrive, that message and data rates may apply, and how to opt
        out. Consent must not be a condition of purchase where prohibited. You should keep records
        showing how and when consent was obtained and be prepared to provide those records if asked
        by Transovo, a carrier, or a regulator.
      </p>

      <h2>3. STOP and HELP</h2>
      <p>
        Your messaging program must support STOP to opt out and HELP for assistance. You must honor
        opt-out requests promptly and must not continue sending marketing messages after consent has
        been withdrawn. Required help information should point recipients to a working support
        channel for your business.
      </p>

      <h2>4. Sender identification and content standards</h2>
      <p>
        Messages must identify your business. Do not impersonate another person or company. Do not
        send unlawful content, phishing, malware links, harassment, deceptive offers, adult content
        prohibited by carriers, or any content that violates applicable law or industry messaging
        guidelines. Do not attempt to evade content filters with misleading abbreviations or
        obfuscation.
      </p>

      <h2>5. Prohibited technical activity</h2>
      <p>You may not:</p>
      <ul>
        <li>Attempt to bypass rate limits, security controls, or verification requirements</li>
        <li>Probe, scan, or attack the Services or related systems</li>
        <li>Share account credentials in a way that creates unauthorized access</li>
        <li>Use the Services to interfere with other customers or end recipients</li>
        <li>Misrepresent your business, brand, or campaign purpose during registration</li>
      </ul>

      <h2>6. Business responsibility</h2>
      <p>
        Each business remains responsible for its messaging practices, customer lists, consent
        records, and compliance with carrier rules. Transovo provides business messaging software
        and related guidance, but we do not assume your compliance obligations. If your use creates
        risk to the platform, carriers, or other customers, we may require changes or suspend
        sending.
      </p>

      <h2>7. Reporting and contact</h2>
      <p>
        Report suspected abuse or ask compliance questions at{" "}
        <a href="mailto:support@transovo.ai">support@transovo.ai</a>.
      </p>
      <p>
        Transovo AI LLC
        <br />
        Woodbridge, Virginia, United States
        <br />
        Email: <a href="mailto:support@transovo.ai">support@transovo.ai</a>
      </p>
    </LegalShell>
  );
}
