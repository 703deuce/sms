import { LegalShell } from "@/components/landing/legal-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
  description:
    "Acceptable Use Policy for Transovo AI LLC. Rules for permission-based business messaging and prohibited activities.",
};

export default function AcceptableUsePage() {
  return (
    <LegalShell title="Acceptable Use Policy" effectiveDate="July 30, 2026">
      <p>
        This Acceptable Use Policy (“Policy”) explains the rules for using Transovo AI and its
        messaging services. By accessing or using Transovo AI, you agree to follow this Policy.
      </p>
      <p>
        Our goal is to provide a reliable platform for permission-based business messaging while
        protecting customers, carriers, and the messaging ecosystem from abuse.
      </p>

      <h2>Permitted Use</h2>
      <p>
        Transovo AI may be used by businesses and organizations to communicate with customers who
        have provided appropriate consent to receive text messages.
      </p>
      <p>Permitted uses include, but are not limited to:</p>
      <ul>
        <li>Customer service communications</li>
        <li>Appointment reminders</li>
        <li>Order and service updates</li>
        <li>Lead follow-up</li>
        <li>Review requests</li>
        <li>Promotional messages sent with proper consent</li>
        <li>Two-way customer conversations</li>
        <li>Business notifications</li>
        <li>Customer support</li>
      </ul>
      <p>
        All messaging must comply with applicable laws, carrier requirements, and industry
        guidelines.
      </p>

      <h2>Customer Consent</h2>
      <p>
        Businesses are responsible for obtaining and maintaining valid consent before sending
        marketing or promotional text messages.
      </p>
      <p>Businesses using Transovo AI must:</p>
      <ul>
        <li>Clearly explain what customers are signing up to receive.</li>
        <li>Maintain records of customer consent.</li>
        <li>Honor opt-out requests immediately.</li>
        <li>Only message recipients who have granted the appropriate permission.</li>
      </ul>
      <p>Consent may not be purchased, transferred, or assumed.</p>

      <h2>Prohibited Activities</h2>
      <p>The following activities are strictly prohibited:</p>
      <ul>
        <li>Sending unsolicited or spam text messages.</li>
        <li>Purchasing, renting, scraping, or harvesting phone numbers.</li>
        <li>Sending messages without customer consent.</li>
        <li>Sending deceptive or misleading content.</li>
        <li>Impersonating another individual or business.</li>
        <li>Sending phishing messages or attempting to obtain passwords or financial information.</li>
        <li>Promoting illegal products or services.</li>
        <li>Distributing malware or malicious software.</li>
        <li>Sending fraudulent or deceptive advertisements.</li>
        <li>Violating carrier messaging requirements.</li>
        <li>Circumventing carrier filtering systems.</li>
        <li>Attempting to hide the identity of the sender.</li>
        <li>Using automated systems to abuse the messaging network.</li>
        <li>Engaging in activities that interfere with the operation of the Transovo AI platform.</li>
      </ul>

      <h2>Restricted Content</h2>
      <p>Businesses may not use Transovo AI to promote or distribute content involving:</p>
      <ul>
        <li>Illegal goods or services</li>
        <li>Fraudulent financial schemes</li>
        <li>Counterfeit products</li>
        <li>Adult or sexually explicit services</li>
        <li>Child exploitation material</li>
        <li>Hate speech or violent extremism</li>
        <li>Malware or hacking tools</li>
        <li>Illegal gambling activities</li>
        <li>Controlled substances where prohibited by law</li>
        <li>Weapons sold in violation of applicable laws</li>
        <li>Any activity prohibited by applicable law</li>
      </ul>
      <p>
        Certain regulated industries may require additional review or may be subject to carrier
        restrictions.
      </p>

      <h2>Message Frequency</h2>
      <p>
        Businesses should send only the number of messages reasonably expected by customers.
      </p>
      <p>
        Excessive messaging, even when consent exists, may result in complaints or carrier
        filtering.
      </p>
      <p>
        Businesses should communicate the expected message frequency during the consent process
        whenever possible.
      </p>

      <h2>Opt-Out Requirements</h2>
      <p>
        Every messaging program must provide recipients with a simple method to stop receiving
        messages.
      </p>
      <p>Businesses must:</p>
      <ul>
        <li>Honor STOP requests immediately.</li>
        <li>Stop sending marketing messages after an opt-out request.</li>
        <li>Maintain suppression records to prevent future unwanted messages.</li>
        <li>Respond appropriately to standard carrier opt-out keywords when required.</li>
      </ul>

      <h2>Sender Identification</h2>
      <p>
        Businesses must accurately identify themselves when communicating with customers.
      </p>
      <p>Businesses may not:</p>
      <ul>
        <li>Misrepresent their identity.</li>
        <li>Use misleading sender information.</li>
        <li>Pretend to represent another business or organization.</li>
      </ul>
      <p>Recipients should be able to clearly understand who is contacting them.</p>

      <h2>Compliance with Laws</h2>
      <p>
        Businesses are responsible for complying with all applicable laws, regulations, and carrier
        requirements governing business messaging.
      </p>
      <p>This includes, where applicable:</p>
      <ul>
        <li>Telephone Consumer Protection Act (TCPA)</li>
        <li>CAN-SPAM Act (where applicable)</li>
        <li>CTIA Messaging Principles and Best Practices</li>
        <li>Carrier messaging requirements</li>
        <li>State privacy laws</li>
        <li>Other applicable local, state, and federal regulations</li>
      </ul>
      <p>Nothing in this Policy constitutes legal advice.</p>

      <h2>Monitoring and Enforcement</h2>
      <p>Transovo AI may investigate activity that appears to violate this Policy.</p>
      <p>We reserve the right to:</p>
      <ul>
        <li>Review abuse reports.</li>
        <li>Request additional information regarding messaging practices.</li>
        <li>Suspend messaging capabilities.</li>
        <li>Restrict access to specific features.</li>
        <li>Terminate accounts involved in prohibited activity.</li>
        <li>Cooperate with carriers or law enforcement when required by law.</li>
      </ul>
      <p>
        We may take action without prior notice when necessary to protect our platform, customers,
        or messaging providers.
      </p>

      <h2>Carrier Compliance</h2>
      <p>
        Delivery of text messages is subject to carrier policies and network requirements.
      </p>
      <p>Carriers may block or filter messages that violate their policies.</p>
      <p>
        Transovo AI cannot guarantee message delivery and is not responsible for carrier filtering
        decisions.
      </p>

      <h2>Reporting Abuse</h2>
      <p>
        If you believe Transovo AI is being used in violation of this Policy, please contact:
      </p>
      <p>
        <a href="mailto:support@transovo.ai">support@transovo.ai</a>
      </p>
      <p>
        Please include as much information as possible so we can investigate the report.
      </p>

      <h2>Changes to This Policy</h2>
      <p>We may update this Acceptable Use Policy from time to time.</p>
      <p>
        When changes are made, the updated version will be posted on this page with a revised
        Effective Date.
      </p>
      <p>
        Continued use of Transovo AI after changes become effective constitutes acceptance of the
        updated Policy.
      </p>

      <h2>Contact Information</h2>
      <p>
        Transovo AI LLC
        <br />
        Woodbridge, Virginia, USA
        <br />
        Email: <a href="mailto:support@transovo.ai">support@transovo.ai</a>
      </p>
    </LegalShell>
  );
}
