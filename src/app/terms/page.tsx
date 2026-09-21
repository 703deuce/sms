import { LegalShell } from "@/components/landing/legal-shell";
import { BRAND_NAME } from "@/lib/brand";
import { legalPublicSiteHost, legalPublicSiteUrl } from "@/lib/legal/public-site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for [REDACTED] appointment scheduling, messaging, AI-assisted booking, and related business software.",
};

export default function TermsPage() {
  const publicSiteUrl = legalPublicSiteUrl();
  const publicSiteHost = legalPublicSiteHost();

  return (
    <LegalShell title="Terms of Service" effectiveDate="September 4, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) are a legally binding agreement between you and
        [REDACTED] LLC (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) and govern your
        access to and use of{" "}
        <a href={publicSiteUrl || "/"}>{publicSiteHost}</a>, our software platform, and related
        products and services (the &ldquo;Services&rdquo;).
      </p>
      <p>
        By creating an account, accessing the Services, or clicking to accept these Terms, you agree
        to them. If you use the Services on behalf of a company or other organization, you represent
        that you have authority to bind that organization, and &ldquo;you&rdquo; includes that
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
        [REDACTED] LLC is located in Woodbridge, Virginia, United States. We provide software that
        helps businesses manage customer communications, appointment scheduling, reminders,
        workflows, and related operations. We are a software provider. We are not a wireless
        carrier, payment processor, or the provider of the underlying services that our customers
        sell to their own customers.
      </p>
      <p>
        Support and legal notices: <a href="mailto:support@transovo.ai">support@transovo.ai</a>.
      </p>

      <h2>2. The Services</h2>
      <p>
        Transovo provides a software platform that may include, depending on your plan and
        configuration:
      </p>
      <ul>
        <li>Online appointment scheduling and public booking pages</li>
        <li>Appointment availability, staff routing, and booking rules</li>
        <li>AI-assisted booking, rescheduling, and scheduling assistance</li>
        <li>SMS and email appointment reminders, confirmations, and related communications</li>
        <li>Appointment workflows and automation</li>
        <li>Team and staff scheduling, including round robin and shared availability</li>
        <li>Recurring appointments, group bookings, waitlists, and custom booking questions</li>
        <li>Connected calendar services and availability conflict checking</li>
        <li>Customer and contact management related to appointments</li>
        <li>Facilitation of deposits or payments through connected third-party payment processors</li>
        <li>Business messaging, campaigns, inbox, and related communication tools</li>
      </ul>
      <p>
        Features may vary by plan, workspace configuration, carrier or provider approval, connected
        integrations, and product availability. We may add, change, or discontinue features over time.
      </p>
      <p>
        Transovo does not guarantee that every message will be delivered, every appointment will be
        attended, every payment will succeed, or every integration will remain available. Delivery
        and performance can be affected by carriers, processors, networks, user devices, third-party
        outages, and other factors outside our reasonable control.
      </p>

      <h2>3. Business and merchant responsibility</h2>
      <p>
        If you are a business using Transovo, you are responsible for the products and services you
        offer to your own customers. Transovo does not provide the underlying appointment, professional,
        medical, beauty, home-service, or other service that your customers book. You are solely
        responsible for:
      </p>
      <ul>
        <li>Your service descriptions, pricing, taxes, and availability</li>
        <li>Your cancellation, refund, rescheduling, and no-show policies</li>
        <li>Compliance with laws and regulations applicable to your business and industry</li>
        <li>Customer disputes relating to the actual services you provide</li>
        <li>The accuracy of information you publish in booking pages, reminders, and communications</li>
      </ul>

      <h2>4. Appointments</h2>
      <p>
        Businesses configure their own appointment types, availability, staff, locations, prices,
        booking questions, policies, and payment requirements. Customers may book, cancel, or
        reschedule subject to the policies configured by the business and the functionality enabled
        in the Services.
      </p>
      <p>
        Transovo provides software tools to manage appointments and related communications. We do not
        guarantee attendance, revenue, staffing outcomes, calendar accuracy in every circumstance, or
        customer behavior.
      </p>

      <h2>5. AI features</h2>
      <p>
        Transovo may use artificial intelligence to interpret natural-language scheduling requests,
        assist with booking, rescheduling, cancellation, and related customer interactions. AI output
        is assistive and may be incomplete or inaccurate. Authoritative availability, booking rules,
        payment requirements, and confirmation status come from the scheduling system and configured
        business settings, not from generated AI text alone.
      </p>
      <p>
        You remain responsible for reviewing important business and customer information. Transovo may
        use third-party AI service providers to process requests as reasonably necessary to provide
        AI-enabled features. AI features do not replace your responsibility for lawful messaging,
        consent, pricing, and service delivery.
      </p>

      <h2 id="sms-messaging-terms">6. SMS Messaging Terms</h2>

      <h3>Transovo SMS Messaging Program</h3>
      <p>
        Transovo provides conversational and customer-care SMS messaging related to consumer
        inquiries. As part of Transovo&apos;s Missed Call Text Back service, a consumer may call a
        business and, if the call is unanswered and forwarded to Transovo, be offered the option to
        receive a text message from Transovo regarding that inquiry.
      </p>
      <p>
        Participation in the Transovo SMS messaging program is optional. Consent to receive SMS
        messages is not a condition of purchasing any goods or services.
      </p>

      <h3>Consent and Opt-In</h3>
      <p>
        When prompted by the Transovo IVR, you may consent to receive SMS messages by pressing 1 after
        hearing the SMS consent disclosure.
      </p>
      <p>
        By pressing 1, you consent to receive conversational and customer-care SMS messages from
        Transovo concerning your inquiry.
      </p>
      <p>
        If you do not press 1 or you hang up, you will not be enrolled in the SMS messaging program
        and no opt-in SMS message will be sent. Your Press-1 consent is recorded and stored.
      </p>
      <p>
        Acceptance of these Terms and Conditions or our Privacy Policy does not by itself constitute
        consent to receive SMS messages. SMS consent is obtained separately through the opt-in
        process described above. See <a href="/opt-in-documentation">opt-in documentation</a> for the
        flow diagram.
      </p>

      <h3>Message Frequency</h3>
      <p>
        Message frequency may vary depending on your inquiry and your interaction with the messaging
        service.
      </p>

      <h3>Message and Data Rates</h3>
      <p>Standard message and data rates may apply.</p>

      <h3>Opt-Out</h3>
      <p>You may opt out of receiving SMS messages at any time by replying STOP.</p>
      <p>
        After you opt out, you will receive confirmation that you have been unsubscribed and no further
        SMS messages will be sent unless you subsequently provide new consent where permitted.
      </p>

      <h3>Help and Customer Care</h3>
      <p>Reply HELP for help.</p>
      <p>
        You may also contact Transovo at <a href="mailto:support@transovo.ai">support@transovo.ai</a>{" "}
        or through the contact information provided on the Transovo website for assistance.
      </p>

      <h3>Supported Carriers and Message Delivery</h3>
      <p>
        Wireless carriers are not liable for delayed or undelivered messages. Message delivery is
        subject to your wireless carrier&apos;s network availability and other factors outside
        Transovo&apos;s control.
      </p>

      <h3>Privacy</h3>
      <p>
        Your participation in the Transovo SMS messaging program is subject to the Transovo{" "}
        <a href="/privacy#sms-messaging-privacy">Privacy Policy</a>.
      </p>
      <p>
        Mobile information will not be sold or shared with third parties for promotional or marketing
        purposes. SMS opt-in data and consent will not be shared with third parties for purposes
        unrelated to providing the messaging service.
      </p>
      <p>
        Promotional or marketing SMS sent by businesses through other Transovo features requires the
        appropriate consent and disclosures. Businesses using Transovo must comply with applicable
        messaging laws, carrier rules, CTIA and provider requirements, and Transovo policies. You may
        not use the Services for spam, purchased lists, unlawful unsolicited messaging, or messaging
        without valid consent.
      </p>

      <h3>Account phone verification and one-time SMS codes</h3>
      <p>
        {BRAND_NAME} may send one-time verification codes when users request them for sign-in,
        phone-number verification, or password recovery. Codes are sent only after a user actively
        requests them. Sample verification message: &ldquo;Your {BRAND_NAME} verification code is
        123456. This code expires in 10 minutes. Do not share this code with anyone.&rdquo; These
        messages are transactional and are not used for unrelated advertising.
      </p>

      <h2>7. Email communications</h2>
      <p>
        Email confirmations, reminders, and other service-related messages may be sent as part of
        appointment and account functionality. Marketing email requires applicable consent or another
        lawful basis. Businesses are responsible for lawful recipient lists, content, and unsubscribe
        compliance for messages they send through the Services.
      </p>

      <h2>8. Appointment payments</h2>
      <p>
        Transovo may allow businesses to connect third-party payment processors such as Stripe and
        Square to collect deposits or full payments in connection with appointments. In that model:
      </p>
      <ul>
        <li>The connected business is the merchant or provider of the underlying service.</li>
        <li>Payment processing is performed by the selected third-party processor, not by Transovo.</li>
        <li>Transovo does not store raw card numbers or card security codes.</li>
        <li>
          Businesses may configure deposit or full-payment requirements subject to processor and
          account status.
        </li>
        <li>
          Processor terms, fees, verification, settlement timing, chargebacks, and restrictions apply
          separately.
        </li>
        <li>
          Transovo is not responsible for processor holds, account restrictions, settlement delays,
          chargebacks, or processor outages except to the extent required by law.
        </li>
        <li>
          Refund and cancellation obligations are governed by the business&apos;s stated policies and
          applicable law.
        </li>
        <li>
          A business authorizes Transovo to perform only the payment-related actions reasonably
          necessary to provide the connected integration, such as creating appointment-related
          checkout sessions or payment records permitted by the connection.
        </li>
      </ul>
      <p>
        Merchant appointment payments are separate from fees you pay Transovo for subscription or
        platform access. Paying Transovo for software does not itself complete an appointment payment
        to a business&apos;s customer.
      </p>

      <h3>Stripe</h3>
      <p>
        Businesses may connect their own Stripe account through Stripe Connect. Stripe may require
        identity and business verification. Stripe&apos;s own terms and privacy practices apply. By
        connecting Stripe, a business authorizes Transovo to create and manage appointment-related
        payment transactions permitted by the connection.
      </p>

      <h3>Square</h3>
      <p>
        Businesses may connect their own Square seller account through OAuth. The merchant explicitly
        authorizes the permissions requested during connection. Transovo accesses only the Square
        resources required to provide the enabled payment functionality. Square&apos;s own terms and
        privacy practices apply.
      </p>

      <h2>9. Calendar integrations</h2>
      <p>
        You may authorize supported calendar providers. Where enabled, Transovo may read busy/free
        information and create or update events for scheduling and conflict checking. You control
        connected calendars and permissions. Third-party calendar provider terms also apply.
      </p>

      <h2>10. Accounts and eligibility</h2>
      <p>
        You must provide accurate registration information and keep it up to date. You are
        responsible for safeguarding login credentials and for activity under your account. Notify us
        promptly at <a href="mailto:support@transovo.ai">support@transovo.ai</a> if you believe your
        account has been compromised.
      </p>
      <p>
        You must be able to form a binding contract under applicable law. The Services are intended
        for business use unless a specific product feature clearly states otherwise.
      </p>

      <h2>11. Fees, billing, trials, and subscriptions</h2>
      <p>
        Paid plans, usage charges, number fees, or other pricing terms may apply to your Transovo
        subscription or platform usage. If you purchase a paid plan, you agree to pay the fees
        described at checkout or in your order. Fees are generally non-refundable except where
        required by law or expressly stated by Transovo in writing. We may change pricing with
        notice for future billing periods. Failure to pay may result in suspension or termination.
      </p>
      <p>
        Free trials, promotional access, or feature availability may vary by plan and
        configuration. Any trial or free-access terms presented at signup or in-product apply to your
        account. Merchant appointment payments collected through connected processors are not
        Transovo subscription payments.
      </p>

      <h2>12. Messaging compliance and your responsibilities</h2>
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
        U.S. application-to-person messaging may require carrier or registry verification. Messaging
        access may remain limited until verification is complete.
      </p>

      <h2>13. Acceptable use and prohibited conduct</h2>
      <p>
        You must follow our <a href="/acceptable-use">Acceptable Use Policy</a>. Without limiting
        that policy, you may not use the Services to:
      </p>
      <ul>
        <li>Violate law or third-party rights</li>
        <li>Send spam, phishing, harassment, or deceptive content</li>
        <li>Use purchased, scraped, or unlawfully obtained contact lists</li>
        <li>Commit fraud or impersonate others</li>
        <li>Access accounts or data without authorization</li>
        <li>Abuse payment services or attempt to circumvent processor rules</li>
        <li>Interfere with the Services or bypass consent, opt-out, or security controls</li>
        <li>Use malicious automation or attempt unauthorized access to integrations</li>
      </ul>
      <p>
        We may investigate suspected violations and suspend or terminate access when we reasonably
        believe these Terms or the Acceptable Use Policy have been violated.
      </p>

      <h2>14. Customer data</h2>
      <p>
        As between you and Transovo, you retain rights to the contact lists, appointment records,
        message content, and other business data you submit to the Services (&ldquo;Customer
        Data&rdquo;). You grant Transovo a limited license to host, process, transmit, and display
        Customer Data as needed to provide, secure, and support the Services and comply with law.
      </p>
      <p>
        You represent that you have all rights and consents needed to upload Customer Data and to
        communicate with the people you message or book. End-customer preferences and personal
        information remain your responsibility as the business communicating with them.
      </p>

      <h2>15. Third-party services</h2>
      <p>
        The Services may depend on third-party providers, including payment processors such as Stripe
        and Square; telecommunications carriers and messaging platforms; email providers; calendar
        providers; AI providers; hosting and infrastructure vendors; and verification or registry
        partners. Those parties have their own terms, privacy practices, and availability
        constraints. Transovo is not responsible for outages, filtering, account decisions, or
        actions by third parties outside our reasonable control.
      </p>

      <h2>16. Intellectual property</h2>
      <p>
        The Services, including software, interfaces, branding, documentation, and related
        materials, are owned by Transovo or its licensors and are protected by intellectual property
        laws. We grant you a limited, non-exclusive, non-transferable right to use the Services for
        your internal business purposes during your subscription or account term, subject to these
        Terms.
      </p>

      <h2>17. Confidentiality</h2>
      <p>
        Each party may receive non-public information from the other. The receiving party will use
        that information only to perform under these Terms and will protect it with reasonable care.
      </p>

      <h2>18. Disclaimers</h2>
      <p>
        THE SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE.&rdquo; TO THE MAXIMUM
        EXTENT PERMITTED BY LAW, TRANSOVO DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR
        STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
        TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT UNINTERRUPTED OR ERROR-FREE OPERATION, PERFECT
        AI OUTPUT, OR THAT EVERY MESSAGE OR PAYMENT WILL SUCCEED.
      </p>

      <h2>19. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, TRANSOVO AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND
        AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR
        PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR
        RELATED TO THESE TERMS OR THE SERVICES.
      </p>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, TRANSOVO&apos;S TOTAL LIABILITY FOR ALL CLAIMS
        ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICES WILL NOT EXCEED THE AMOUNTS YOU PAID
        TO TRANSOVO FOR THE SERVICES IN THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING RISE TO THE
        CLAIM, OR ONE HUNDRED U.S. DOLLARS (US $100) IF YOU HAVE NOT PAID ANY AMOUNTS.
      </p>

      <h2>20. Indemnification</h2>
      <p>
        You will defend, indemnify, and hold harmless Transovo and its officers, directors,
        employees, and agents from claims, damages, losses, liabilities, costs, and expenses
        (including reasonable attorneys&apos; fees) arising out of or related to your Customer Data,
        your messages, your appointment or payment practices, your consent practices, your violation
        of law or carrier rules, or your breach of these Terms or the Acceptable Use Policy.
      </p>

      <h2>21. Suspension and termination</h2>
      <p>
        You may stop using the Services at any time. We may suspend or terminate access if you breach
        these Terms, if required by a carrier, processor, or provider, if needed to protect the
        Services or other users, or if your account remains inactive or unpaid. Upon termination,
        your right to use the Services ends. Provisions that by their nature should survive
        termination will survive.
      </p>

      <h2>22. Changes to the Services or Terms</h2>
      <p>
        We may update the Services and these Terms from time to time. When we update these Terms, we
        will revise the effective date above and may provide additional notice. Continued use after
        the updated Terms take effect constitutes acceptance. If you do not agree, you must stop
        using the Services.
      </p>

      <h2>23. Governing law</h2>
      <p>
        These Terms are governed by the laws of the Commonwealth of Virginia, without regard to
        conflict-of-law rules. Subject to applicable law, exclusive venue for disputes arising out of
        these Terms will lie in the state or federal courts located in Virginia, and you consent to
        personal jurisdiction there.
      </p>

      <h2>24. Miscellaneous</h2>
      <p>
        These Terms are the entire agreement between you and Transovo regarding the Services and
        supersede prior agreements on that subject. If any provision is found unenforceable, the
        remaining provisions remain in effect. You may not assign these Terms without our prior
        written consent. We may assign these Terms in connection with a merger, acquisition,
        reorganization, or sale of assets.
      </p>

      <h2>25. Contact</h2>
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
