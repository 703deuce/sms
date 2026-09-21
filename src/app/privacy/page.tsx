import { LegalShell } from "@/components/landing/legal-shell";
import { BRAND_NAME } from "@/lib/brand";
import { legalPublicSiteHost, legalPublicSiteUrl } from "@/lib/legal/public-site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for [REDACTED]. How we collect, use, and protect information in our appointment scheduling, messaging, and business software.",
};

export default function PrivacyPage() {
  const publicSiteUrl = legalPublicSiteUrl();
  const publicSiteHost = legalPublicSiteHost();

  return (
    <LegalShell title="Privacy Policy" effectiveDate="September 4, 2026">
      <p>
        This Privacy Policy explains how [REDACTED] LLC (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;) collects, uses, stores, and shares information when you visit{" "}
        <a href={publicSiteUrl || "/"}>{publicSiteHost}</a>, create an account, book an appointment, or
        use our appointment scheduling, messaging, AI-assisted booking, payment facilitation, and
        related software services (together, the &ldquo;Services&rdquo;).
      </p>
      <p>
        Transovo provides software that helps businesses manage appointments, customer communications,
        reminders, workflows, and related operations. We are a software provider. Businesses that use
        Transovo decide how they configure booking, messaging, pricing, and customer interactions.
      </p>

      <h2>1. Who we are</h2>
      <p>
        [REDACTED] LLC is a limited liability company located in Woodbridge, Virginia, United
        States. For privacy questions or requests, contact us at{" "}
        <a href="mailto:support@transovo.ai">support@transovo.ai</a>.
      </p>

      <h2>2. Information we collect</h2>
      <p>Depending on how you use the Services, we may collect the following categories of information:</p>

      <h3>Account and business information</h3>
      <p>
        When you sign up or configure a workspace, we collect information such as your name, work
        email address, password or authentication credentials, business name, business contact details,
        industry or use-case information, workspace settings, billing-related details when applicable,
        and information needed to support carrier, messaging, or payment registration.
      </p>

      <h3>Appointment and scheduling information</h3>
      <p>
        We collect appointment types, availability, staff assignments, booking rules, calendar
        preferences, appointment records, waitlist entries, booking-form responses, notes, and related
        scheduling metadata needed to operate appointment features.
      </p>

      <h3>Customer and contact records</h3>
      <p>
        Businesses using Transovo may input or collect information about their own customers, such as
        names, phone numbers, email addresses, appointment history, tags, preferences, and
        communications. We process this information to provide the Services on behalf of the business.
      </p>

      <h3>Communications and messaging data</h3>
      <p>
        If you use messaging features, we process phone numbers, message content, delivery status,
        inbox conversations, templates, campaign metadata, consent records, opt-out records, and
        related workflow or reminder metadata.
      </p>

      <h3>Payment and connected-account information</h3>
      <p>
        We do not store raw payment card numbers or card security codes. We may receive and store
        limited payment transaction metadata needed to associate a payment with an appointment, such as
        processor name, merchant or connected account identifier, payment transaction ID, amount,
        currency, status, refund status, and timestamps. If you connect Stripe or Square, we may store
        connected account identifiers, authorization status, and securely stored credentials or tokens
        necessary to operate the integration.
      </p>

      <h3>Calendar integration metadata</h3>
      <p>
        If you connect a supported calendar provider, we may access calendar identifiers, event
        metadata, busy/free information, and synchronization data needed for availability checking and
        event creation or updates as enabled by you.
      </p>

      <h3>AI requests and interactions</h3>
      <p>
        When AI-assisted scheduling or related features are used, we may process natural-language
        requests, booking context, and related interaction data reasonably necessary to interpret
        scheduling intent and provide the requested functionality.
      </p>

      <h3>Usage, device, and security information</h3>
      <p>
        We automatically collect technical information such as IP address, browser type, device
        type, pages or screens viewed, referring URLs, timestamps, approximate location derived from
        IP, diagnostic logs, and security-related events. We use this information for security,
        reliability, fraud prevention, and product improvement.
      </p>

      <h3>Support communications</h3>
      <p>
        If you email <a href="mailto:support@transovo.ai">support@transovo.ai</a> or otherwise
        contact us, we keep the content of that correspondence and any information you choose to
        include so we can respond and improve support.
      </p>

      <h3>Cookies and similar technologies</h3>
      <p>
        We use cookies and similar technologies that are needed to keep you signed in, remember
        preferences, and understand how the site is used. You can control cookies through your
        browser settings. Disabling certain cookies may limit account or site functionality.
      </p>

      <h2>3. Appointment customer data</h2>
      <p>
        Businesses using Transovo may collect or maintain information about their own customers through
        booking pages, appointment records, messaging, and related tools. In those cases, the business
        is responsible for its relationship with those customers and for providing appropriate notices
        and obtaining any required consents. Transovo processes that information as a service provider
        on behalf of the business to provide scheduling, reminders, workflows, payments, and related
        functionality.
      </p>
      <p>
        If you are an end customer of a business that uses Transovo, please contact that business
        first about your contact information, appointment details, or messaging preferences.
      </p>

      <h2 id="sms-messaging-privacy">4. SMS Messaging Privacy</h2>
      <p>
        Transovo may collect your mobile telephone number, SMS messaging consent, opt-in and opt-out
        records, message content, and related messaging information when you participate in a
        Transovo text messaging program.
      </p>
      <p>
        We use this information to provide the text messaging services you request, respond to your
        inquiries, provide customer-care and conversational communications, maintain records of your
        consent, process opt-out and help requests, prevent abuse, and comply with applicable legal
        and telecommunications requirements.
      </p>
      <p>
        <strong>
          No mobile information will be sold or shared with third parties for promotional or marketing
          purposes.
        </strong>
      </p>
      <p>
        All the above categories exclude text messaging originator opt-in data and consent; this
        information won&apos;t be shared with any third parties.
      </p>
      <p>
        We will not share your opt-in to an SMS messaging program with any third party for purposes
        unrelated to providing you with the services of that program. We may share information,
        including your SMS opt-in or consent status, with service providers that help us provide our
        messaging services, such as telecommunications carriers, messaging platform providers, and
        other vendors involved in delivering or supporting the requested messaging service. These
        service providers may use the information only as necessary to provide those services and not
        for their own marketing or promotional purposes.
      </p>
      <p>
        You may opt out of SMS messages at any time by replying STOP. You may reply HELP for assistance
        or contact us at <a href="mailto:support@transovo.ai">support@transovo.ai</a>.
      </p>
      <p>
        Businesses using Transovo for their own messaging programs remain responsible for collecting,
        documenting, and maintaining valid consent before sending marketing or other commercial text
        messages where applicable. Having a phone number alone is not consent to receive marketing or
        other non-disclosed messaging.
      </p>
      <p>
        See also our <a href="/opt-in-documentation">SMS opt-in documentation</a> for the Missed Call
        Text Back consent flow.
      </p>

      <h2>5. Account phone verification and one-time SMS codes (2FA)</h2>
      <p>
        {BRAND_NAME} sends one-time verification codes to users who request them when signing in,
        verifying their phone number, or resetting their password. You may enter your mobile number
        during account registration, sign-in verification, at{" "}
        <a href="/sms-opt-in">/sms-opt-in</a>, or during password recovery at{" "}
        <a href="/forgot-password">/forgot-password</a>. Before requesting a code, you are informed
        that {BRAND_NAME} will send a one-time verification code by SMS; the message is sent only
        after you actively request it.
      </p>
      <p>
        Sample verification message: &ldquo;Your {BRAND_NAME} verification code is 123456. This code
        expires in 10 minutes. Do not share this code with anyone.&rdquo; Opt-in disclosure: &ldquo;
        {BRAND_NAME}: You requested SMS verification codes for your account. Message frequency
        varies. Msg &amp; data rates may apply. Reply STOP to opt out or HELP for help.&rdquo; Help
        reply: &ldquo;{BRAND_NAME} Support: For assistance, visit {publicSiteHost} or email
        support@transovo.ai. Reply STOP to opt out.&rdquo;
      </p>
      <p>
        These messages are transactional. Your number will not be used for advertising, promotional
        campaigns, or unsolicited messages. We use it to confirm ownership of the device and to
        secure your account. See our <a href="/terms">Terms of Service</a> for more detail.
      </p>

      <h2>6. Payment data</h2>
      <p>
        Raw payment card information is processed by Stripe, Square, or another supported payment
        processor and is not stored by Transovo. Transovo may receive and store limited transaction
        metadata required to associate a payment with an appointment, such as processor name,
        merchant or connected account identifier, payment transaction ID, amount, currency, status,
        refund status, and timestamps.
      </p>
      <p>
        Merchant appointment payments are separate from fees a business pays Transovo for subscription
        or platform access.
      </p>

      <h3>Stripe and Square connection data</h3>
      <p>
        Businesses may authorize Stripe or Square connections to accept appointment deposits or
        payments. Transovo may store connected account identifiers, authorization status, and securely
        stored credentials or tokens necessary to operate the integration. For Square, access is
        limited to the scopes authorized by the seller during OAuth connection. Tokens and secrets are
        protected using the application&apos;s existing security controls.
      </p>

      <h2>7. AI processing</h2>
      <p>
        When AI-assisted scheduling or related features are enabled, user or customer scheduling
        requests may be processed by AI service providers to interpret scheduling intent and provide
        requested functionality. We aim to transmit only information reasonably necessary for the
        feature. AI use is subject to applicable vendor processing and privacy terms. We do not claim
        that third-party AI providers never retain any information unless contractually verified for a
        specific deployment.
      </p>

      <h2>8. Calendar data</h2>
      <p>
        If you authorize a supported calendar integration, Transovo may access calendar information
        necessary for availability or conflict checking and for creating or updating events as enabled
        by you. Access is limited to the integration purposes you enable. You can disconnect calendar
        integrations through the product or provider settings where available.
      </p>

      <h2>9. How we use information</h2>
      <p>We use information to:</p>
      <ul>
        <li>Provide, operate, maintain, and improve the Services</li>
        <li>Process bookings, appointments, waitlists, and scheduling workflows</li>
        <li>Send and receive SMS, email, and related communications through enabled features</li>
        <li>Facilitate appointment deposits or payments through connected processors</li>
        <li>Support calendar synchronization and availability checking</li>
        <li>Provide AI-assisted scheduling and related functionality</li>
        <li>Create and manage accounts, workspaces, permissions, and authentication</li>
        <li>Detect, prevent, and investigate fraud, abuse, spam, or security incidents</li>
        <li>Provide customer support and send service-related notices</li>
        <li>Enforce consent, opt-out, and messaging compliance workflows</li>
        <li>Analyze aggregated or de-identified usage to improve product performance</li>
        <li>Comply with law, carrier rules, processor requirements, and enforceable legal process</li>
      </ul>
      <p>
        We do not sell personal information. We do not use customer contact lists uploaded by
        businesses to market Transovo products to those end customers.
      </p>

      <h2>10. How we share information</h2>
      <p>We may share information in these situations:</p>
      <ul>
        <li>
          <strong>Service providers and processors.</strong> Hosting, infrastructure, email, analytics,
          payment processors, telecommunications and messaging providers, AI providers, calendar
          providers, security vendors, and other partners that process data for us under contractual
          obligations and only as needed to provide or support the Services.
        </li>
        <li>
          <strong>Messaging carriers and registries.</strong> Information required to deliver
          messages, complete verification, or meet carrier and industry messaging requirements.
        </li>
        <li>
          <strong>Business customers.</strong> Appointment and customer information may be shared with
          the business a consumer booked with or otherwise interacted with through that
          business&apos;s workspace.
        </li>
        <li>
          <strong>Workspace users.</strong> Workspace owners and authorized users can access the
          contacts, appointments, messages, and account data in their own workspace.
        </li>
        <li>
          <strong>Legal and safety.</strong> When we believe disclosure is required by law,
          regulation, legal process, or to protect the rights, safety, or property of Transovo, our
          users, or others.
        </li>
        <li>
          <strong>Business transfers.</strong> In connection with a merger, acquisition, financing,
          reorganization, or sale of assets, subject to appropriate confidentiality protections.
        </li>
      </ul>
      <p>
        <strong>SMS and mobile-data reminder:</strong> No mobile information will be sold or shared
        with third parties for promotional or marketing purposes. All the above categories exclude text
        messaging originator opt-in data and consent; this information won&apos;t be shared with any
        third parties, except with service providers as necessary to deliver the messaging services
        (see <a href="#sms-messaging-privacy">SMS Messaging Privacy</a>).
      </p>

      <h2>11. Selling or sharing personal information</h2>
      <p>
        Transovo does not sell personal information. We also do not share SMS opt-in data or mobile
        messaging consent information with third parties for their own marketing or promotional
        purposes. Necessary sharing with service providers to deliver the Services is not a sale and is
        described above.
      </p>

      <h2>12. Retention</h2>
      <p>
        We retain account information for as long as your account remains active and as needed to
        provide the Services. Appointment records, messaging logs, consent records, payment metadata,
        and related workspace data may be retained for operational, security, dispute, and compliance
        purposes. We may keep limited records after account closure when required by law or needed to
        resolve issues, prevent abuse, or enforce our agreements. When retention is no longer
        necessary, we delete or de-identify information in the ordinary course of business.
      </p>

      <h2>13. Security</h2>
      <p>
        We use administrative, technical, and organizational measures designed to protect
        information against unauthorized access, loss, misuse, or alteration. No method of
        transmission or storage is completely secure. You are responsible for protecting your
        account credentials and for limiting access within your organization to people who need it.
      </p>

      <h2>14. Your choices and requests</h2>
      <p>
        Depending on where you live, you may have rights to request access to, correction of, or
        deletion of personal information we hold about you, or to object to or restrict certain
        processing. Account users can often update profile and business details directly in the
        product. For other requests, email{" "}
        <a href="mailto:support@transovo.ai">support@transovo.ai</a>. We may need to verify your
        identity before fulfilling a request. Some information may be retained when we have a lawful
        reason to keep it.
      </p>
      <p>
        If you are an end customer of a business that uses Transovo, please contact that business
        first about your contact information or messaging preferences. We process that data for the
        business that uploaded or collected it.
      </p>

      <h2>15. Children&apos;s privacy</h2>
      <p>
        The Services are built for business users and are not directed to children under 13. We do
        not knowingly collect personal information from children under 13. If you believe a child
        has provided us personal information, contact{" "}
        <a href="mailto:support@transovo.ai">support@transovo.ai</a> and we will take appropriate
        steps.
      </p>

      <h2>16. International users</h2>
      <p>
        Transovo is based in the United States. If you access the Services from outside the United
        States, you understand that your information may be processed in the United States and other
        locations where we or our service providers operate.
      </p>

      <h2>17. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. When we do, we will change the
        effective date at the top of this page and, when appropriate, provide additional notice
        through the Services or by email. Continued use of the Services after an update means you
        acknowledge the revised policy.
      </p>

      <h2>18. Contact us</h2>
      <p>
        [REDACTED] LLC
        <br />
        Woodbridge, Virginia, United States
        <br />
        Email: <a href="mailto:support@transovo.ai">support@transovo.ai</a>
        <br />
        Website: <a href={publicSiteUrl || "/"}>{publicSiteHost}</a>
      </p>
    </LegalShell>
  );
}
