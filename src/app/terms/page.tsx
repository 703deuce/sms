import { LegalShell } from "@/components/landing/legal-shell";
import { BRAND_NAME } from "@/lib/brand";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for Transovo AI LLC business messaging software and related services.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" effectiveDate="July 16, 2026">
      <p>
        These Terms of Service (“Terms”) are a legally binding agreement between you and Transovo
        AI LLC (“Transovo,” “we,” “us,” or “our”) and govern your access to and use of{" "}
        <a href="https://transovo.ai">transovo.ai</a>, our business messaging software, and related
        products and services (the “Services”).
      </p>
      <p>
        By creating an account, accessing the Services, or clicking to accept these Terms, you agree
        to them. If you are using the Services on behalf of a company or other organization, you
        represent that you have authority to bind that organization, and “you” includes that
        organization.
      </p>
      <p>
        If you do not agree to these Terms, do not use the Services. Our{" "}
        <a href="/privacy">Privacy Policy</a> and{" "}
        <a href="/acceptable-use">Acceptable Use Policy</a> are incorporated into these Terms by
        reference.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Transovo AI LLC is located in Woodbridge, Virginia, United States. We provide business
        messaging software that helps small businesses send permission-based SMS campaigns, manage
        customer replies, and organize related customer communications. We are a software provider.
        We are not a carrier and we do not control every aspect of message delivery on wireless
        networks.
      </p>
      <p>
        Support and legal notices: <a href="mailto:support@transovo.ai">support@transovo.ai</a>.
      </p>

      <h2>2. The Services</h2>
      <p>
        The Services may include account and workspace management, contact and list tools, message
        templates, campaign sending, two-way inbox features, messaging registration support,
        reporting, and related administrative features. Features may change over time as we improve
        the product. Some capabilities may require plan eligibility, business verification, carrier
        approval, or third-party provider availability.
      </p>
      <p>
        Transovo does not guarantee that every message will be delivered, read, or answered.
        Delivery can be affected by carrier filtering, invalid numbers, blocked contacts, content
        rules, network conditions, user device settings, and other factors outside our control.
      </p>

      <h2>3. Accounts and eligibility</h2>
      <p>
        You must provide accurate registration information and keep it up to date. You are
        responsible for safeguarding login credentials and for all activity under your account. Notify
        us promptly at <a href="mailto:support@transovo.ai">support@transovo.ai</a> if you believe
        your account has been compromised.
      </p>
      <p>
        You must be able to form a binding contract under applicable law. The Services are intended
        for business use, not for personal consumer texting as a substitute for a personal phone
        number.
      </p>

      <h2>4. Fees and billing</h2>
      <p>
        Paid plans, usage charges, number fees, or other pricing terms may apply. If you purchase a
        paid plan, you agree to pay the fees described at the time of purchase or in your order.
        Fees are generally non-refundable except where required by law or expressly stated by
        Transovo in writing. We may change pricing with notice for future billing periods. Failure
        to pay may result in suspension or termination of access.
      </p>

      <h2>5. Messaging compliance and your responsibilities</h2>
      <p>You are solely responsible for:</p>
      <ul>
        <li>The content of messages you send through the Services</li>
        <li>Maintaining lawful consent for each recipient you message</li>
        <li>Honoring STOP, HELP, and other required opt-out or help keywords</li>
        <li>Keeping records of how and when consent was obtained</li>
        <li>Complying with applicable laws, carrier rules, and industry guidelines</li>
        <li>Ensuring your use matches the campaign and brand information you submit for verification</li>
      </ul>
      <p>
        You may only message people who agreed to receive texts from your business. Purchased lists,
        scraped phone numbers, and unsolicited mass texting are prohibited. Messages must identify
        your business and provide a simple way to opt out. Consent must not be a condition of
        purchase where prohibited by law.
      </p>
      <p>
        U.S. application-to-person messaging often requires carrier or registry verification.
        Messaging access may remain limited until verification is complete. Transovo may collect
        business information to support that process, but approval decisions rest with carriers,
        registries, and related partners.
      </p>

      <h3>SMS phone verification and consent</h3>
      <p>
        When you enter your mobile number to verify your account (for example on our sign-in page or
        at <a href="/sms-opt-in">/sms-opt-in</a>), you expressly consent to receive a one-time
        verification code from {BRAND_NAME} by SMS. Message and data rates may apply. Message
        frequency varies. Reply STOP to opt out and HELP for help. These are transactional messages
        sent only when you request a code, and consent to receive them is not a condition of any
        purchase.
      </p>

      <h2>6. Acceptable use</h2>
      <p>
        You must follow our <a href="/acceptable-use">Acceptable Use Policy</a>. Without limiting
        that policy, you may not use the Services to send spam, phishing, deceptive offers,
        harassment, unlawful content, or content prohibited by carriers. You may not attempt to
        bypass rate limits, security controls, or opt-out systems. We may investigate suspected
        violations and suspend or terminate access when we reasonably believe these Terms or the
        Acceptable Use Policy have been violated.
      </p>

      <h2>7. Customer data</h2>
      <p>
        As between you and Transovo, you retain rights to the contact lists, message content, and
        other business data you submit to the Services (“Customer Data”). You grant Transovo a
        limited license to host, process, transmit, and display Customer Data as needed to provide
        and secure the Services, support messaging delivery, and comply with law.
      </p>
      <p>
        You represent that you have all rights and consents needed to upload Customer Data and to
        send messages to the recipients you select. End customers’ messaging preferences and
        personal information remain your responsibility as the business communicating with them.
      </p>

      <h2>8. Intellectual property</h2>
      <p>
        The Services, including software, interfaces, branding, documentation, and related materials,
        are owned by Transovo or its licensors and are protected by intellectual property laws. We
        grant you a limited, non-exclusive, non-transferable right to use the Services for your
        internal business purposes during your subscription or account term, subject to these Terms.
        You may not copy, reverse engineer, resell, or create derivative works from the Services
        except as allowed by law or written agreement with us.
      </p>

      <h2>9. Third-party services</h2>
      <p>
        The Services may depend on third-party providers, including hosting platforms, email
        services, messaging gateways, and wireless carriers. Those parties have their own terms and
        availability constraints. Transovo is not responsible for outages, filtering, or decisions
        made by third parties outside our reasonable control.
      </p>

      <h2>10. Confidentiality</h2>
      <p>
        Each party may receive non-public information from the other. The receiving party will use
        that information only to perform under these Terms and will protect it with reasonable care.
        Confidentiality obligations do not apply to information that is public through no fault of
        the receiving party, independently developed, or rightfully received from another source
        without confidentiality duty.
      </p>

      <h2>11. Disclaimers</h2>
      <p>
        THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY
        LAW, TRANSOVO DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING
        IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND
        NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR
        THAT EVERY MESSAGE WILL BE DELIVERED OR FREE FROM FILTERING.
      </p>

      <h2>12. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, TRANSOVO AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND
        AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY,
        OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR
        RELATED TO THESE TERMS OR THE SERVICES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
      </p>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, TRANSOVO’S TOTAL LIABILITY FOR ALL CLAIMS ARISING OUT
        OF OR RELATED TO THESE TERMS OR THE SERVICES WILL NOT EXCEED THE AMOUNTS YOU PAID TO
        TRANSOVO FOR THE SERVICES IN THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING RISE TO THE
        CLAIM. IF YOU HAVE NOT PAID ANY AMOUNTS, TRANSOVO’S TOTAL LIABILITY WILL NOT EXCEED ONE
        HUNDRED U.S. DOLLARS (US $100).
      </p>

      <h2>13. Indemnification</h2>
      <p>
        You will defend, indemnify, and hold harmless Transovo and its officers, directors,
        employees, and agents from and against claims, damages, losses, liabilities, costs, and
        expenses (including reasonable attorneys’ fees) arising out of or related to your Customer
        Data, your messages, your consent practices, your violation of law or carrier rules, or your
        breach of these Terms or the Acceptable Use Policy.
      </p>

      <h2>14. Suspension and termination</h2>
      <p>
        You may stop using the Services at any time. We may suspend or terminate access if you
        breach these Terms, if required by a carrier or provider, if needed to protect the Services
        or other users, or if your account remains inactive or unpaid. Upon termination, your right
        to use the Services ends. Provisions that by their nature should survive termination will
        survive, including ownership, confidentiality, disclaimers, limitations of liability, and
        indemnification.
      </p>

      <h2>15. Changes to the Services or Terms</h2>
      <p>
        We may update the Services and these Terms from time to time. When we update these Terms, we
        will revise the effective date above and may provide additional notice. If you continue
        using the Services after the updated Terms take effect, you agree to the updated Terms. If
        you do not agree, you must stop using the Services.
      </p>

      <h2>16. Governing law</h2>
      <p>
        These Terms are governed by the laws of the Commonwealth of Virginia, without regard to
        conflict-of-law rules. Subject to applicable law, exclusive venue for disputes arising out
        of these Terms will lie in the state or federal courts located in Virginia, and you consent
        to personal jurisdiction there.
      </p>

      <h2>17. Miscellaneous</h2>
      <p>
        These Terms are the entire agreement between you and Transovo regarding the Services and
        supersede prior or contemporaneous agreements on that subject. If any provision is found
        unenforceable, the remaining provisions remain in effect. Our failure to enforce a provision
        is not a waiver. You may not assign these Terms without our prior written consent. We may
        assign these Terms in connection with a merger, acquisition, corporate reorganization, or
        sale of assets. Notices to Transovo should be sent to{" "}
        <a href="mailto:support@transovo.ai">support@transovo.ai</a>.
      </p>

      <h2>18. Contact</h2>
      <p>
        Transovo AI LLC
        <br />
        Woodbridge, Virginia, United States
        <br />
        Email: <a href="mailto:support@transovo.ai">support@transovo.ai</a>
        <br />
        Website: <a href="https://transovo.ai">https://transovo.ai</a>
      </p>
    </LegalShell>
  );
}
