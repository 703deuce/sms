import { LegalShell } from "@/components/landing/legal-shell";
import { BRAND_NAME } from "@/lib/brand";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Transovo AI LLC. How we collect, use, and protect information in our business messaging software.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" effectiveDate="July 16, 2026">
      <p>
        This Privacy Policy explains how Transovo AI LLC (“Transovo,” “we,” “us,” or “our”)
        collects, uses, stores, and shares information when you visit{" "}
        <a href="https://transovo.ai">transovo.ai</a>, create an account, or use our business
        messaging software and related services (together, the “Services”).
      </p>
      <p>
        Transovo provides software that helps small businesses send and manage permission-based SMS
        marketing and customer communications. We are a software provider. Businesses that use
        Transovo decide what messages to send, which contacts to include, and how customer consent
        is collected.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Transovo AI LLC is a limited liability company located in Woodbridge, Virginia, United
        States. For privacy questions or requests, contact us at{" "}
        <a href="mailto:support@transovo.ai">support@transovo.ai</a>.
      </p>

      <h2>2. Information we collect</h2>
      <h3>Account and business information</h3>
      <p>
        When you sign up or configure your workspace, we collect information such as your name,
        work email address, password, business name, business address and contact details, industry
        or use-case information, billing-related details when applicable, and information needed to
        support carrier or messaging registration.
      </p>
      <h3>Messaging and contact data you provide</h3>
      <p>
        If you use the Services to communicate with customers or leads, you may upload or enter
        phone numbers, names, tags, lists, consent records, message templates, campaign content,
        inbox conversations, and related notes. That information belongs to your business
        relationship with those people. We process it to operate the Services on your behalf.
      </p>
      <h3>Usage, device, and log data</h3>
      <p>
        We automatically collect technical information when you use the Services, including IP
        address, browser type, device type, pages or screens viewed, referring URLs, timestamps,
        approximate location derived from IP, and diagnostic or error logs. We use this information
        for security, reliability, and product improvement.
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

      <h2>3. How we use information</h2>
      <p>We use information to:</p>
      <ul>
        <li>Provide, operate, maintain, and improve the Services</li>
        <li>Create and manage accounts, workspaces, and permissions</li>
        <li>Send and receive SMS and related messages through messaging providers and carriers</li>
        <li>Support business verification, campaign registration, and compliance workflows</li>
        <li>Process opt-out requests such as STOP and help requests such as HELP</li>
        <li>Detect, prevent, and investigate fraud, abuse, spam, or security incidents</li>
        <li>Provide customer support and send service-related notices</li>
        <li>Comply with law, carrier rules, and enforceable legal process</li>
        <li>Analyze aggregated or de-identified usage to improve product performance</li>
      </ul>
      <p>
        We do not sell personal information. We do not use customer contact lists uploaded by
        businesses to market Transovo products to those end customers.
      </p>

      <h2>4. Customer contacts, consent, and SMS communications</h2>
      <p>
        Businesses using Transovo are responsible for collecting, documenting, and maintaining valid
        consent before sending marketing or other commercial text messages. Having a phone number
        alone is not always enough to send marketing messages.
      </p>
      <p>
        End customers who receive messages from a business using Transovo should follow the
        instructions in those messages. In general, they can reply STOP to opt out of messages from
        that business and HELP for assistance. Opt-out requests should be honored by the business
        and are processed through the messaging workflows supported by Transovo.
      </p>
      <p>
        When an end customer contacts Transovo directly about a message, we may need limited
        information (such as the phone number and approximate time of the message) to help identify
        the sending business and route the request.
      </p>

      <h3>Account phone verification and one-time SMS codes (2FA)</h3>
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
        reply: &ldquo;{BRAND_NAME} Support: For assistance, visit https://transovo.ai or email
        support@transovo.ai. Reply STOP to opt out.&rdquo;
      </p>
      <p>
        These messages are transactional. Your number will not be used for advertising, promotional
        campaigns, or unsolicited messages. We use it to confirm ownership of the device and to
        secure your account; we do not sell it. See our <a href="/terms">Terms of Service</a> for
        more detail.
      </p>

      <h2>5. How we share information</h2>
      <p>We may share information in these situations:</p>
      <ul>
        <li>
          <strong>Service providers.</strong> Hosting, infrastructure, email, analytics, payment,
          and messaging providers that process data for us under contractual obligations.
        </li>
        <li>
          <strong>Messaging carriers and registries.</strong> Information required to deliver
          messages, complete verification, or meet carrier and industry messaging requirements.
        </li>
        <li>
          <strong>Business customers.</strong> Workspace owners and authorized users can access the
          contacts, messages, and account data in their own workspace.
        </li>
        <li>
          <strong>Legal and safety.</strong> When we believe disclosure is required by law,
          regulation, legal process, or to protect the rights, safety, or property of Transovo,
          our users, or others.
        </li>
        <li>
          <strong>Business transfers.</strong> In connection with a merger, acquisition, financing,
          reorganization, or sale of assets, subject to appropriate confidentiality protections.
        </li>
      </ul>

      <h2>6. Retention</h2>
      <p>
        We retain account information for as long as your account remains active and as needed to
        provide the Services. Messaging logs, consent records, and related workspace data may be
        retained for operational, security, dispute, and compliance purposes. We may keep limited
        records after account closure when required by law or needed to resolve issues, prevent
        abuse, or enforce our agreements. When retention is no longer necessary, we delete or
        de-identify information in the ordinary course of business.
      </p>

      <h2>7. Security</h2>
      <p>
        We use administrative, technical, and organizational measures designed to protect
        information against unauthorized access, loss, misuse, or alteration. No method of
        transmission or storage is completely secure. You are responsible for protecting your
        account credentials and for limiting access within your organization to people who need it.
      </p>

      <h2>8. Children’s privacy</h2>
      <p>
        The Services are built for business users and are not directed to children under 13. We do
        not knowingly collect personal information from children under 13. If you believe a child
        has provided us personal information, contact{" "}
        <a href="mailto:support@transovo.ai">support@transovo.ai</a> and we will take appropriate
        steps.
      </p>

      <h2>9. Your choices and requests</h2>
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

      <h2>10. International users</h2>
      <p>
        Transovo is based in the United States. If you access the Services from outside the United
        States, you understand that your information may be processed in the United States and other
        locations where we or our service providers operate.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. When we do, we will change the
        effective date at the top of this page and, when appropriate, provide additional notice
        through the Services or by email. Continued use of the Services after an update means you
        acknowledge the revised policy.
      </p>

      <h2>12. Contact us</h2>
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
