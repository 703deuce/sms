# Transovo Privacy, Consent & Compliance UX Standards Guide

**Series:** Implementation standards · **Guide #8 of 12**  
**Status:** Active — mandatory hard standard for consent, privacy choices, messaging permissions, opt-outs, data collection, recording notices, compliance registration, and privacy-related user decisions  
**Audience:** Engineers, designers, product owners, compliance stakeholders, and Cursor agents building Transovo  
**Authorities:** FCC (TCPA) · FTC (CAN-SPAM, deceptive practices) · CTIA Messaging Principles & Best Practices · GDPR · CCPA/CPRA · NIST Privacy Framework

---

## Master Cursor rule

> **Transovo privacy, consent, and compliance behavior must be purpose-specific, channel-specific, evidence-based, and enforceable at runtime.** Do not model consent as one generic boolean. Preserve the exact provenance, scope, timestamp, and version of affirmative consent where consent evidence is relied upon, and preserve subsequent withdrawal or opt-out history. Never infer required consent from silence, inactivity, preselected controls, broad Terms acceptance, AI inference, or imported data. Follow applicable FCC/TCPA requirements for regulated calls/texts, FTC CAN-SPAM requirements for covered commercial email, CTIA messaging principles and carrier registration requirements for application messaging, and applicable privacy-law requirements such as GDPR and CCPA/CPRA. **Sender registration and recipient permission are separate concepts; A2P approval alone never constitutes recipient consent.** Every outbound communication path must use one centralized deterministic eligibility and suppression layer and re-check eligibility at delivery time. Privacy choices must be understandable, non-deceptive, free of dark patterns, and backed by actual system behavior. Do not claim blanket legal compliance where the platform can only establish specific factual states such as consent captured, registration approved, or opt-out recorded. Privacy rules must be centralized, versionable, auditable, testable, and updateable as regulations and carrier requirements change.

**This guide controls how Transovo presents consent, privacy choices, messaging permissions, opt-outs, data collection, recording notices, compliance registration, and privacy-related user decisions.**

---

## Important distinction from earlier guides

There is **no single universal privacy law** covering every Transovo user everywhere. Rules depend on:

- jurisdiction
- communication channel
- message purpose
- sender identity
- type of personal data
- whether the user is a consumer, business user, or employee
- whether consent is actually the legal basis being relied upon

**First rule:** Do not treat “consent” as one global boolean. Privacy and communication permissions must be represented according to the specific purpose, channel, sender, legal/compliance context, and evidence supporting that permission.

For Cursor, this guide establishes the **safe architecture and UX rules**. Specific legal applicability should still be determined from the actual jurisdiction/use case rather than guessed in UI code.

**Related Transovo guides**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #4: `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
- Guide #2: `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- Guide #3: `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- Guide #6: `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- Guide #7: `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`
- Guide #9: `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- Guide #10: `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- Guide #11: `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`

---

## A. Privacy and consent must be purpose-specific

One permission must not silently authorize another purpose.

**Examples:**

- Consent for **Appointment reminder texts** does not automatically mean **Promotional SMS**
- Consent for **Meeting recording** does not automatically mean **Marketing use of the transcript**

GDPR’s purpose-limitation principle requires personal information to be collected for specified, explicit, legitimate purposes and not reused incompatibly.

**Cursor rule:** Every consent or permission record must identify what the person agreed to, not merely that they “consented.”

---

## B. Do not use one generic consent = true

**Bad data model:** `consent = true`

**Better conceptual model:**

```
channel: sms
purpose: appointment_reminders
sender_context: platform
status: granted
source: booking_page
captured_at: ...
language_version: ...
```

Separately for email, meeting recording, and other purposes.

The system needs enough evidence to determine what the permission actually covers.

---

## C. Consent must be distinguishable from other legal bases or business permissions

Not every privacy operation depends on consent. GDPR recognizes multiple lawful bases for processing; consent is only one of them.

Therefore Cursor must never encode **No consent = no personal-data processing** as a universal product assumption.

Instead: the product must identify the applicable permission/legal basis for the specific processing operation.

For Transovo’s UI, avoid telling users **Consent required** unless it actually is required for that specific operation.

---

## D. When consent is used, it must be a genuine affirmative choice

GDPR defines valid consent as freely given, specific, informed, unambiguous, and demonstrated through a statement or clear affirmative action.

Therefore **no:**

- ☑ Receive promotional messages already checked
- By continuing to use this website you agree to everything
- closing this banner means consent

The CCPA likewise states that merely accepting broad terms, interacting with content in passive ways, or agreement obtained through dark patterns does not constitute valid consent under its definition.

**Cursor rule:** Whenever Transovo relies on affirmative consent, require an intentional affirmative action. Never infer it from silence, inactivity, page navigation, or preselected controls.

---

## E. Consent language must be understandable before agreement

Do not make users agree first and discover meaning later.

Consent controls should communicate: who is communicating/processing where relevant, what type of communication/data use, why, what the user is agreeing to, material consequences, and how to withdraw where applicable.

GDPR requires transparency and informed consent; California likewise requires meaningful notice about collection/use.

---

## F. Do not hide material consent terms in Terms of Service

A general Terms checkbox should not be used as a substitute for specific consent where specific consent is required.

California’s CCPA definition explicitly says acceptance of broad terms containing personal-information processing along with unrelated information does not itself constitute consent.

**Cursor rule:** Separate material privacy/communication consent from general Terms acceptance when they represent distinct decisions.

---

## G. Consent controls must use neutral choice architecture

Do not visually manipulate users toward consent.

Avoid: huge bright Accept vs tiny gray Decline, confusing double negatives, hiding rejection behind multiple screens, guilt language, fake urgency, repeated nagging, prechecked choices, disguising consent as a required system action.

The FTC identifies interface techniques that obscure, subvert, or impair consumer choice as dark patterns, and California regulations similarly prohibit dark-pattern consent.

**Cursor rule:** Privacy choice architecture must make acceptance and rejection understandable and must not materially impair autonomous choice.

---

## H. Refusal must not be visually deceptive

If **Allow optional analytics** is optional, the UI should not present **Accept** versus **maybe later** hidden in 10px gray text.

The choices need not always be graphically identical, but users must be able to understand and exercise the alternative without manipulation.

---

## I. Don’t use confusing negative toggles

Avoid: ☑ Do not disable appointment marketing messages

Use: **Promotional messages** On / Off — or clear affirmative choice.

Privacy settings should minimize linguistic traps.

---

## J. Consent should be granular when purposes materially differ

**Example:**

```
Appointment SMS reminders [ ]
Promotional SMS         [ ]
```

is clearer than **Messages and offers [ ]** when those uses have materially different purposes or requirements.

Granularity also allows withdrawal of one permission without destroying unrelated functionality.

---

## K. Required and optional processing must be distinguishable

If information is genuinely required to provide the requested service, say so.

**Example:** Email address — Required to send booking confirmation.

If something is optional: **Product updates — Optional**

Do not make optional processing appear operationally mandatory.

---

## L. Do not condition a service on unnecessary consent where the applicable law requires freely given consent

GDPR specifically instructs that whether a service is conditioned on consent to processing not necessary for the contract is relevant in assessing whether consent was freely given.

**Cursor rule:** Do not require agreement to unrelated optional processing merely to use the core appointment service when the applicable legal regime would prohibit that coupling.

---

## M. Privacy notices must be available at the point of collection

California requires covered businesses collecting personal information to provide a Notice at Collection in accordance with the CCPA and regulations.

For Transovo: when collecting customer information through a public Booking Page, required privacy information should be accessible at or before collection, not only through an obscure footer elsewhere.

---

## N. Collect only what is necessary for the task

GDPR’s data minimization principle requires personal data to be adequate, relevant, and limited to what is necessary for the purpose.

NIST’s Privacy Framework likewise approaches privacy as a data-processing risk-management problem rather than simply a security checkbox.

**Cursor rule:** Every customer-data field should have an identifiable product purpose. Do not collect information merely because it might be useful later.

---

## O. Do not expose unnecessary customer data everywhere

Just because Transovo stores phone, email, payment, meeting transcript, and appointment history does not mean every page needs to display all of it.

Use the minimum information necessary for the current task.

Privacy minimization applies to presentation and access, not merely collection.

---

## P. Sensitive information deserves stronger contextual protection

Where Transovo stores or displays higher-risk information — payment information, recordings, transcripts, personal contact data, potentially sensitive appointment notes — avoid unnecessary duplication, exposure, exports, logging, public URLs.

Cursor must treat sensitive-data surfaces as distinct from normal UI metadata.

---

## Q. Privacy and security are related but not identical

NIST specifically notes that good cybersecurity alone does not resolve every privacy risk.

**Example:** A transcript may be perfectly encrypted yet still create a privacy problem if collected unnecessarily, retained too long, shown to the wrong organizational role, or reused unexpectedly.

**Cursor rule:** Do not treat encryption/authentication as proof that a privacy design is correct.

---

## R. Privacy decisions must be attributable

When Transovo records consent or withdrawal, store enough information to establish what happened.

Depending on context: subject/contact, action, date/time, source, consent language/version, purpose, channel, sender context, collection mechanism, revocation, relevant policy/version.

GDPR Article 7 requires the controller to be able to demonstrate consent where processing is based on consent.

**Cursor rule:** Consent evidence must be auditable. Do not merely overwrite the current boolean and destroy the history.

---

## S. Never mutate historical consent evidence silently

If consent language changes, do not update every old record so that it appears the user agreed to the new wording.

Store `consent_version_3` with the original event. Future consent can use `consent_version_4`. Historical evidence remains historical.

---

## T. Consent withdrawal must also be recorded

A useful consent history is:

```
Sep 1 — SMS appointment reminders granted
Sep 8 — SMS appointment reminders withdrawn
```

not merely `sms_consent = false`.

The current state matters. The history matters too.

---

## U. Withdrawal must be honored operationally

A privacy/consent setting is not merely display state.

If consent is withdrawn or opt-out is received, the sending/runtime layer must enforce that state.

**Cursor rule:** No UI opt-out or consent withdrawal is complete until downstream messaging/processing eligibility changes accordingly.

---

## V. Revocation must not require one magic phrase where law requires reasonable methods

FCC rules protect consumers’ ability to revoke consent for robocalls/robotexts and recognize reasonable revocation methods.

Therefore: do not architect SMS opt-out handling around only exact uppercase STOP counts if applicable rules/provider requirements recognize additional reasonable expressions.

Keyword handling is useful and often required operationally, but free-form revocation intent must be handled according to the applicable FCC/provider rules.

---

## W. Standard opt-out keywords must work where required by the messaging ecosystem

For U.S. application messaging, platform/provider/carrier systems commonly recognize keywords such as STOP, UNSUBSCRIBE, CANCEL, END, QUIT.

Exact supported sets vary by messaging provider/ecosystem implementation.

Cursor should rely on the canonical messaging-compliance layer rather than duplicating keyword logic independently across features.

---

## X. Opt-out status must propagate across the applicable scope

If a contact opts out from a sender/use case, do not allow another workflow under the same prohibited scope to keep sending because it maintains a separate local boolean.

A single authoritative suppression/eligibility service should evaluate contact, sender, purpose, channel, and scope before send.

---

## Y. Opt-out should not erase historical communication records

Stop future sending. Do not rewrite history.

The appointment timeline can still show: **Customer opted out at 10:42 AM.**

That history is useful for support/audit.

---

## Z. Opt-out should be distinguished from missing consent

These are not equivalent.

| State | Meaning |
|-------|---------|
| **No consent evidence** | We don’t have sufficient permission evidence |
| **Opted out** | The person affirmatively withdrew/stopped messages |
| **No phone** | Technical contact information unavailable |
| **Business registration required** | Sender eligibility missing |

The UI must not collapse these into **SMS unavailable.**

---

## AA. Sender registration and recipient consent are different concepts

**This is extremely important for Transovo.**

A2P/10DLC registration does not itself create recipient consent.

A2P registration tells the messaging ecosystem about sender/Brand, Campaign/use case, and opt-in/opt-out mechanisms.

**Cursor rule:** Never use `a2pApproved = true` as equivalent to `recipientCanReceiveSms = true`.

Eligibility must evaluate both sender-side and recipient-side requirements.

---

## AB. A2P registration is sender/compliance infrastructure

For U.S. 10DLC A2P messaging, carriers require registration of application-generated traffic.

For Transovo, A2P status belongs under something like **Settings → Messaging → Business texting** — not inside a customer’s personal consent record.

---

## AC. Brand and Campaign must remain conceptually separate

A2P architecture generally distinguishes:

| Concept | Meaning |
|---------|---------|
| **Brand** | Who is sending |
| **Campaign** | What messaging use case is being sent and how users opt in/out |

Do not flatten both into **SMS approved = yes.** Store/status them separately.

---

## AD. Registration UX must show meaningful lifecycle states

Possible business-messaging states: Not started, Business information required, Brand submitted, Brand approved, Campaign submitted, Under review, Approved, Needs information, Rejected, Suspended.

Use exact provider/runtime states where available.

Do not show **Connected** for all of these. Registration is a process, not a binary connection.

---

## AE. Registration status should explain what it affects

**Example:**

```
Business texting registration required
SMS reminders for manually created and imported appointments are unavailable until registration is approved.
```

Better than: **A2P not configured.**

User-level consequence matters.

---

## AF. A2P registration details must reflect the actual business

Provider/TCR registration requires accurate business identity and campaign information.

**Cursor rule:** Do not pre-populate or fabricate compliance answers simply to maximize approval probability. Assist users. Do not invent facts for them.

---

## AG. User attestations must be explicit when relied upon

If Transovo asks the business to attest **I confirm that my organization has permission to send these messages** — make it explicit.

Do not silently infer that attestation merely because they enabled a channel.

Also store attestation evidence if it is part of the compliance architecture.

---

## AH. Platform-captured SMS consent and business-attested consent are different provenance

For Transovo’s architecture, these should never be conflated.

| Type | Meaning |
|------|---------|
| **Platform-captured** | Transovo directly captured the customer’s affirmative action through a Transovo-controlled Booking Page |
| **Business-attested/external** | The business asserts or maintains its own underlying relationship/permission outside Transovo |

Those can have different sender/compliance implications.

**Cursor rule:** Consent provenance is a first-class field.

---

## AI. Appointment origin and communication eligibility are separate

**Example:**

- **Origin:** Imported from Microsoft — does not itself mean SMS disallowed forever
- **SMS eligibility:** Business sender registration required — separate field

Likewise **Origin: Booked through Transovo** may coexist with **SMS: Eligible through captured appointment-reminder consent**.

Do not encode communication eligibility into appointment origin.

---

## AJ. Channel permissions must remain independent

A person may be SMS: opted out, Email: allowed, Voice: unknown/allowed under separate rules.

Do not implement `contact.canCommunicate` as the authoritative permission.

**Cursor rule:** Maintain channel-specific communication status and purpose where necessary.

---

## AK. Email and SMS rules must not be treated as identical

The FTC’s CAN-SPAM guidance applies specific requirements to commercial email. That is a different regime from TCPA/carrier SMS requirements.

Therefore: email permission must never automatically unlock SMS, and SMS opt-out must not necessarily imply every legally distinct email communication must cease unless scope requires it.

The eligibility engine needs channel semantics.

---

## AL. Commercial email must use accurate identity information

FTC CAN-SPAM guidance requires accurate From, To, Reply-To, routing/originating information and prohibits deceptive subject lines.

**Cursor rule:** Transovo must not permit customer-facing commercial email configuration that disguises the sender or materially misrepresents the subject/content.

---

## AM. Commercial-email opt-out must be available and honored

FTC guidance explains that recipients have the right to stop commercial email and businesses must provide an opt-out mechanism.

For Transovo’s commercial-email features: unsubscribe mechanism must remain functional, suppression must be enforced, workflows cannot override suppression casually.

Appointment transactional email may have different treatment depending on content/context; do not indiscriminately classify every appointment message as marketing.

---

## AN. Do not misclassify messages merely to avoid compliance controls

Do not label promotional content **appointment reminder** if the actual content is primarily marketing.

Likewise **service message** must not become a loophole for unrelated promotions.

Classification should follow actual purpose/content.

---

## AO. CTIA’s guiding principle is consumer consent/control

CTIA’s Messaging Principles & Best Practices are voluntary industry guidance, not legislation, but they are highly relevant to carrier messaging.

**Cursor rule:** Messaging features must be designed so consumers can understand the sender, control whether they receive messages, and stop unwanted messaging.

---

## AP. Messaging identity should be understandable

A recipient should not receive an automated appointment message and have no idea who is texting them.

**Example:** **Bright Dental: Your appointment is tomorrow at 2 PM…** — not **Reminder: tomorrow 2 PM** when recipient cannot reasonably identify the sender.

---

## AQ. Help behavior must be supported where the campaign model requires it

A2P campaign registration includes information about how users opt in, opt out, and get help according to carrier/provider campaign-registration requirements.

Cursor should centralize help/opt-out behavior in the messaging runtime.

Do not configure campaign registration promising HELP behavior that runtime doesn’t actually support.

---

## AR. Compliance registration and runtime must agree

**Critical hard rule.**

If the registered campaign says users opt in through Booking Page checkbox, runtime/product must actually use that method.

If campaign says STOP stops messages, runtime must enforce STOP.

If campaign says messages contain appointment reminders, don’t repurpose the same campaign for unrelated mass promotions.

**Cursor rule:** The product behavior must match the compliance representations submitted to carriers/providers.

---

## AS. Do not create fake opt-in evidence

Never synthesize timestamp, IP, checkbox event, consent wording, or source for imported/manual appointments when the platform did not actually capture it.

Unknown remains **Unknown / external permission** — not **consent captured.**

---

## AT. Imported appointments should carry truthful permission provenance

**Example:**

```
Imported from Microsoft
Transovo SMS consent: Not captured
```

If business-specific messaging setup permits the business to send under its own compliance/consent framework, that can be represented separately.

Do not convert import into platform consent.

---

## AU. Consent evidence should be viewable where operationally useful

Appointment/customer detail can expose:

```
SMS eligibility: Eligible
Source: Booking-page consent
Captured: Sep 7, 10:03 AM
```

or **SMS eligibility: Business texting registration required**

Do not require support staff to query the database to understand why an SMS can/cannot send.

---

## AV. Do not expose unnecessary raw compliance evidence to ordinary users

**Useful:** Consent captured Sep 7 through Booking Page.

Advanced/audit view can expose more.

Do not dump internal IDs, provider payloads, webhook identifiers into normal appointment UI.

---

## AW. Privacy settings should distinguish current state from evidence/history

**Current:** SMS appointment reminders: Allowed

**History:** Consent captured Sep 7 · Opt-out not recorded

Keep operational state simple while maintaining audit evidence underneath.

---

## AX. Consent history must not be editable like a normal note

A user should not be able to rewrite **customer consented yesterday** into **customer consented last month.**

If correction is required: append correction/audit event, preserve original record.

Evidence records need integrity.

---

## AY. Privacy controls should support data-subject requests where applicable

GDPR and CCPA provide various rights relating to personal information.

Cursor should architect data so Transovo can support appropriate access, correction, deletion, export, and opt-out workflows where legally required.

The exact legal scope belongs to compliance/legal configuration, not hard-coded assumptions.

---

## AZ. Deletion is not necessarily the same as erasing every record immediately

Some information may need retention for legal obligations, accounting, fraud prevention, audit, dispute handling.

Therefore UI should not promise **Permanently erases every trace immediately** unless that is actually legally and technically true.

Use accurate language.

---

## BA. Retention periods must be explainable and configurable where required

For Transovo’s recordings/transcripts in particular, provide clear retention policy/settings.

**Examples:** Retain recordings for 30 days. Delete recording after transcript processing.

Exact defaults should be a product/legal decision.

**Cursor rule:** Retention behavior must be explicit and must match backend deletion jobs.

---

## BB. Recording consent requires a separate model

Meeting recording involves different legal regimes than SMS.

Do not reuse `contact.smsConsent` for meeting recording.

Represent recording notice, acknowledgment/consent where applicable, source, time, meeting, participants where relevant.

The product must not falsely claim **Recording is legal because the host enabled it.**

---

## BC. Recording UI must not conceal recording state

When Transovo’s Notetaker records a meeting, recording state should be obvious to the authorized user.

Avoid hidden/unexplained recording behavior.

Configuration should expose auto-join, recording consent/notice, retention, recording status.

---

## BD. Meeting recording rules are jurisdiction-dependent

Some jurisdictions require consent from one party; others impose stricter all-party requirements or other notice rules.

Cursor should not hard-code a universal statement such as **One-party consent is always enough.**

Instead: recording-consent behavior must be configurable according to applicable requirements and deployment policy.

This is an area where legal review should control exact customer-facing language.

---

## BE. Data-processing disclosures must be truthful about AI

If meeting data is recorded, transcribed, summarized by AI, or sent to subprocessors — privacy copy must not imply **data only stays locally** if it does not.

User-facing privacy representations must match actual architecture.

---

## BF. Do not claim “we never store X” unless runtime proves it

Compliance UI cannot be aspirational.

**Cursor rule:** Privacy statements exposed in-product must be derived from verified product behavior/policy, not invented during UI implementation.

---

## BG. Integrations need permission transparency

When connecting Microsoft/Google, explain what access is being requested in user terms: read calendar, create/update events, maintain sync.

Do not request broad permissions solely because they are easier technically.

---

## BH. Permission request scope should be least-privilege where practical

If Transovo only needs calendar access, don’t request unrelated contacts, email, files without product need.

Cursor must not expand OAuth scopes merely to avoid implementing narrower APIs.

---

## BI. Explain additional permission requests at the moment they become necessary

If a future feature requires another permission, ask when enabling that feature.

Don’t front-load unrelated permissions during initial calendar connection.

---

## BJ. Disconnecting an integration must explain data consequences

**Example:**

```
Disconnect Microsoft Calendar?

• sync stops
• existing Transovo appointments remain
• future Microsoft changes stop syncing
• [what happens to already-created Microsoft events, depending on actual behavior]
```

Do not simply say **Are you sure?**

---

## BK. Privacy choices must not be buried under unrelated settings

A consumer/customer opt-out belongs near communication control.

Organization-level privacy/compliance configuration belongs in a clear Settings area.

Do not hide **Delete recordings automatically** under **Appearance.**

---

## BL. Do not overload users with legal language inside operational UI

Legal requirements must be met. But normal UI should translate them into understandable language.

**Good:** Business texting registration is required before SMS can be sent for imported appointments.

**Not:** Pursuant to carrier 10DLC campaign vetting requirements under applicable ecosystem policy…

Provide deeper details via **Learn more** when necessary.

---

## BM. Legal disclosures must remain conspicuous when conspicuousness matters

The FTC has repeatedly emphasized that material disclosures should not be hidden or deceptive.

Therefore don’t bury consequential information behind tiny text, low contrast, obscure tooltip, or multiple clicks when user needs it to make the decision.

---

## BN. Don’t use false urgency around privacy choices

No **ACT NOW or lose your account!** to force optional consent.

If there is a genuine deadline: **Business texting registration must be completed before SMS can be enabled.** — Specificity instead of manipulation.

---

## BO. Declining optional consent must not falsely appear as an error

If a user chooses **No promotional emails**, don’t show **⚠ Action required** unless action truly is required.

Privacy refusal is a legitimate state.

---

## BP. Consent withdrawal should be no harder than necessary

GDPR Article 7 requires it to be as easy to withdraw consent as to give it.

**Cursor rule:** Where Transovo relies on consent under GDPR, do not provide one-click consent and then require support tickets or hidden account settings to withdraw it.

---

## BQ. Withdrawal should explain its actual consequence

**Example:**

```
Turn off appointment reminder SMS?

Future SMS appointment reminders from this sender will stop. Email reminders remain enabled.
```

Clear scope.

---

## BR. Withdrawal must not falsely imply retroactive erasure

Stopping future messaging and deleting historical records are different actions.

Don’t say **Remove consent and delete everything** unless both genuinely happen.

---

## BS. Privacy requests must authenticate appropriately

If someone asks to export, correct, or delete personal data, Transovo may need to verify identity according to applicable requirements.

But don’t demand excessive data unrelated to verification.

---

## BT. Do not expose one tenant’s privacy data to another tenant

**Hard multi-tenant rule:** consent records, contact data, recordings, transcripts, appointment history must be tenant-scoped.

This is both security and privacy architecture. UI filtering alone is not security. Backend authorization must enforce it.

---

## BU. Role-based access should apply to privacy-sensitive information

Not every staff member necessarily needs access to compliance registration details, transcript retention settings, exports, privacy requests, consent evidence.

Use permissions according to organizational need.

---

## BV. Audit sensitive administrative actions

For high-impact privacy/compliance changes, record who, what, when, previous/new state.

**Examples:** changed retention, changed consent language, registered sender, exported customer data, changed opt-out state manually.

---

## BW. Manual override of opt-out should be heavily restricted

Do not provide a casual **Turn SMS back on** button after recipient opt-out.

Restoring eligibility should require a valid new permission event/appropriate process.

Never let staff simply erase a consumer’s opt-out because it is inconvenient.

---

## BX. Compliance status must fail closed where sending requires it

If authoritative eligibility is unknown, do not guess **probably okay to send.**

**Examples:** recipient opt-out state unavailable, sender registration state unknown, compliance provider unavailable.

For regulated messaging actions, fail safely according to the applicable sending policy.

---

## BY. Provider failure must not silently bypass compliance checks

If the compliance service is unavailable, do not fall back to **send anyway.**

**Cursor rule:** Eligibility controls are enforcement controls, not advisory UI.

---

## BZ. Every outbound message should pass through centralized eligibility

Before sending SMS, evaluate:

- Can sender send?
- Can recipient receive for this purpose?
- Is recipient opted out?
- Is channel available?
- Are timing/provider restrictions satisfied?

Then send.

Do not implement one permission check in reminder service and another different one in workflow service.

**One canonical eligibility layer.**

---

## CA. Scheduling a future message requires eligibility again at send time

If recipient consents today and opts out tomorrow, a reminder scheduled for next week must not send merely because it was eligible when originally scheduled.

**Cursor rule:** Re-evaluate communication eligibility immediately before delivery, not only when scheduling.

---

## CB. Cancel future sends after opt-out

When a relevant opt-out occurs, future pending communications within that suppression scope should be canceled, suppressed, or skipped — and timeline should explain why.

Do not let already-queued jobs ignore changed permissions.

---

## CC. Suppression is a valid terminal send state

Reminder status model should include something like **Suppressed — customer opted out.**

Do not categorize that as **Failed** because system behaved correctly.

---

## CD. Compliance blockers should be visible before scheduling

If SMS cannot legally/operationally be used, don’t let user build **SMS reminder tomorrow** and discover failure at delivery.

Show eligibility while configuring the appointment/sequence.

---

## CE. Compliance diagnostics should explain the exact blocker

**Examples:**

- SMS unavailable — customer opted out.
- SMS unavailable — no phone number.
- SMS unavailable — business texting registration required.
- SMS unavailable — platform consent was not captured for this imported appointment.

Avoid **Not eligible.**

---

## CF. Multiple blockers should be handled intelligently

If no phone, opted out, and sender registration missing — the system may prioritize the actionable/most fundamental reason but should retain all authoritative states internally.

Do not return contradictory explanations from different pages.

---

## CG. Privacy status should use canonical terminology

Use consistently: Consent captured, Consent not captured, Opted out, Registration required, Registration pending, Eligible, Suppressed.

Don’t randomly use Approved, Authorized, Allowed, Verified for different concepts unless their definitions are clear.

---

## CH. Don’t show “compliant” as a blanket guarantee

Avoid UI like **✅ TCPA Compliant** based merely on one checkbox or A2P approval.

Compliance depends on facts, jurisdiction, consent, message content/purpose, sender behavior, other requirements.

**Better:** Business texting registration approved. or SMS consent captured through booking page.

Specific factual statements are safer and more useful.

---

## CI. Do not make legal guarantees based on platform configuration alone

Similarly avoid **You are fully compliant.**

Use **Registration requirements for this sender are complete.**

Transovo can enforce platform rules. It cannot universally guarantee the customer’s entire legal conduct.

---

## CJ. Privacy notices should use versioning

If privacy policy / consent disclosure materially changes, store version/date.

Where renewed consent is legally required, product can determine who must be re-prompted according to policy/legal rules.

Do not overwrite historical notices.

---

## CK. Do not re-prompt unnecessarily

Privacy notices/consent prompts should appear when legally required, processing purpose changes materially, user enables related feature, or existing permission is absent/expired where applicable.

Not every login. Excessive prompts train users to ignore meaningful choices.

---

## CL. Privacy notices and preference controls should be accessible

Everything from Guide #1 applies: keyboard, screen reader, contrast, focus, plain labeling.

A consent control that cannot be used by assistive technology is not a valid product implementation.

---

## CM. Consent records should survive UI redesigns

Do not couple evidence to old checkbox component ID.

Store semantic evidence independently: purpose, language, timestamp, actor, source.

Then UI can evolve without destroying auditability.

---

## CN. Privacy state should survive provider migrations

If Transovo switches SMS providers, customer opt-outs, permission evidence, and consent history must not disappear.

Provider state is not the canonical consumer-permission database.

---

## CO. Carrier/provider suppression must be reconciled with application suppression

Messaging providers may enforce opt-outs independently.

Transovo must ingest relevant provider events/status and reconcile them with its canonical suppression state.

Do not display **SMS allowed** when provider has blocked the recipient.

---

## CP. Compliance webhooks are security-sensitive

Provider compliance events must be authenticated/validated appropriately.

Never accept `opt_out=true` from an unauthenticated public request.

---

## CQ. Don’t log sensitive consent/privacy payloads unnecessarily

Application logs should not indiscriminately dump entire contact record, sensitive recording data, raw tokens, full compliance registration data.

Log what engineering actually needs. Privacy minimization applies to operational telemetry too.

---

## CR. Analytics should use the minimum personal detail necessary

Aggregate analytics usually doesn’t need Anthony Johnson’s phone number to calculate appointment confirmation rate.

Avoid spreading identifying data into analytics pipelines without product need.

---

## CS. Export actions deserve privacy consideration

CSV/PDF export can create new copies of customer data.

At minimum: permission check, explicit user action, appropriate content scope.

For sensitive/high-volume exports, logging/admin restrictions may be appropriate.

---

## CT. Public share links need deliberate privacy behavior

For meeting recaps or similar shares, define: authentication required or not, expiration, revoke, password where supported, what data is shown.

Do not assume an unguessable URL alone solves every privacy requirement.

---

## CU. Revocation must actually revoke shared access

If user clicks **Revoke share link**, the server must reject future requests.

Changing a UI badge to **Revoked** without invalidating access is unacceptable.

---

## CV. Privacy-related defaults should be conservative

Where reasonable uncertainty exists: recording off until configured, data sharing limited, optional marketing unchecked, suppress unsupported messaging.

Do not maximize data collection/sending by default merely for engagement.

---

## CW. Privacy UX must accurately distinguish platform and customer responsibilities

**Platform might handle:** capture, storage, suppression enforcement, sender registration tooling, delivery controls.

**Customer may remain responsible for:** truthfulness of supplied business information, lawful basis/permission they claim to possess, message content/use, jurisdiction-specific obligations.

UI should explain these boundaries without pretending Transovo can transfer all legal responsibility in one checkbox.

---

## CX. Do not ask businesses to certify facts Transovo already knows are false

If Transovo knows consent was not captured, don’t display **Check here to confirm Transovo captured consent.**

Likewise, don’t let customers override machine-known evidence with contradictory attestation.

---

## CY. Distinguish evidence from attestation

| Type | Example |
|------|---------|
| **Evidence** | Booking Page checkbox captured Sep 7 at 10:03 AM |
| **Attestation** | Business states it has permission to contact this customer |

These are not equal. Data model and UI should preserve the distinction.

---

## CZ. Compliance UI should explain dependencies in plain language

**Example:**

```
SMS for imported appointments
To send SMS for appointments imported from Google or Microsoft,
your business needs its own registered texting identity.
[Set up business texting]
```

Not: **Campaign Registry Brand/CSP object missing.**

---

## DA. Never surface provider-specific terminology unless the user benefits

A2P/10DLC may need to be named because customers encounter it.

But don’t unnecessarily expose TrustProduct SID, CustomerProfile SID, Messaging Service SID, TCR object IDs.

Normal UX should remain provider-agnostic where possible.

---

## DB. Compliance states need timestamps

Useful: Submitted Sep 5 · Approved Sep 7 · Last updated 12 minutes ago

Especially for registrations, consent, privacy requests, retention/deletion jobs.

---

## DC. Compliance workflow should support “needs information” rather than generic failure

If registration is rejected because website missing privacy policy, show that if provider supplies the reason.

Avoid **Registration failed.** The goal is recovery.

---

## DD. Compliance errors must not fabricate explanations

If provider only says **rejected** and no reason is supplied:

Say **Registration was rejected. No detailed reason was provided.**

Do not let AI/UI invent a likely cause and present it as fact.

---

## DE. Policy changes should be centralized

SMS eligibility rules should not be hard-coded separately in Booking, Appointments, Workflow, Reminder sequences, Messages.

Use centralized policy logic/configuration. Regulatory/provider rules evolve. Architecture must allow one rule update to affect all sending paths.

---

## DF. Compliance logic should be testable independently of UI

Given appointment origin, sender status, contact consent, opt-out, channel, purpose — the policy engine should return deterministic result: eligible / ineligible, reason, scope.

This makes compliance behavior auditable and prevents inconsistent pages.

---

## DG. Store the reason behind eligibility decisions

Instead of only `can_send = false`, return/store where needed:

- `reason = recipient_opted_out`
- `reason = business_sender_registration_required`

That allows consistent diagnostics.

---

## DH. Do not make compliance decisions using AI

AI may explain a policy, help draft registration language, or classify with human review where appropriate.

But final sending eligibility should be determined by deterministic rules and authoritative state.

**Cursor rule:** LLMs must not decide whether regulated communication is legally/operationally eligible to send.

---

## DI. AI should never invent consent

**Hard rule.**

A model may infer **customer seems interested** — that is not consent evidence.

Never transform conversational sentiment into a permission record unless an explicit qualifying consent event occurs under the applicable rules.

---

## DJ. Privacy-related AI summaries must not become authoritative evidence

**Example:** AI says **Customer agreed to texts.**

The authoritative evidence is actual message, checkbox event, consent record — not the model summary.

---

## DK. Data retention must apply to AI-derived artifacts too

Deleting a recording may not automatically delete transcript, summary, embeddings, AI recap unless retention policy is designed that way.

Privacy model must identify each artifact and its retention behavior.

---

## DL. Transcripts and recordings are distinct data objects

Users may choose **Delete recording, retain transcript** if product policy permits.

Do not model `meeting_data_deleted` as one vague boolean if multiple artifacts exist.

---

## DM. Privacy deletion should handle copies and derived artifacts according to policy

When deletion is required, the backend needs known handling for primary record, search index, AI/vector data, cached copies, public shares, provider copies where applicable.

Do not make UI promises that backend architecture cannot fulfill.

---

## DN. NIST Privacy Framework should guide architecture, not be represented as law

NIST expressly states its Privacy Framework is a voluntary tool and not legally binding.

Use it to guide privacy risk identification, governance, data processing awareness, safeguards, communication, risk assessment.

Do not tell customers **NIST requires this** when it does not.

---

## DO. Privacy risk must consider harm to individuals, not only company risk

NIST defines privacy risk around the likelihood and impact of problems individuals experience as a result of data processing.

When adding a feature, ask: **What could happen to the person whose data we process?** — Not merely: What could happen to Transovo?

---

## DP. New personal-data uses should receive a privacy review

Before adding features involving new customer data, call recording, AI processing, new integrations, data sharing, or new analytics — identify:

1. What data?
2. Whose data?
3. Why?
4. Where collected?
5. Who can access it?
6. How long retained?
7. Which providers receive it?
8. What user control exists?
9. What consent/legal basis applies?
10. What happens on deletion/withdrawal?

---

## DQ. Privacy requirements must be captured before implementation

Do not build **Record every appointment call automatically** and decide consent/privacy afterward.

Privacy is an architecture requirement. It affects data model, runtime, storage, permissions, UI, deletion, audit.

---

## DR. Jurisdictional uncertainty should not be hidden by false certainty

If the platform cannot determine whether a particular local requirement applies, do not display **Legally approved.**

Use neutral factual state and configurable policy. Exact legal determinations may require counsel.

---

## DS. Product copy must distinguish law from carrier policy

A2P 10DLC is a U.S. carrier messaging ecosystem requirement. TCPA is federal law/regulation. CTIA principles are industry guidance.

These should not all be described as **Federal law requires A2P registration.**

**Cursor/content rule:** Identify the source and nature of a compliance requirement correctly.

---

## DT. Product copy must distinguish legal requirement from Transovo policy

**Required by Transovo** · **Required by messaging carrier registration** · **Required under applicable law** — are different statements. Don’t blur them.

---

## DU. Compliance guide must be kept updateable

This is critical because FCC rules change, carrier requirements change, state privacy laws change, provider A2P requirements change.

Do not scatter hard-coded explanatory legal text throughout components.

Use centralized policy/content configuration where practical.

---

## DV. Version regulatory rules where runtime behavior depends on them

For significant policy changes: record version, effective date, migration behavior.

This allows debugging: **Why was this appointment eligible on Sep 1 but not Sep 10?**

---

## DW. Compliance behavior must have regression tests

At minimum test scenarios like:

- Platform booking + direct SMS consent → eligible under platform sender policy
- Imported appointment + no platform consent + no business registration → blocked
- Imported appointment + business sender approved + recipient opted out → blocked
- Eligible appointment + recipient opts out after scheduling → future SMS suppressed
- Email allowed + SMS opted out → email state remains independently evaluated
- A2P approved + no recipient permission where permission required → A2P approval alone does not unlock send

These are much more important than testing whether the badge renders green.

---

## DX. Never bypass policy checks through secondary sending paths

All of these must call the same eligibility layer: manual Send SMS, Reminder Sequence, Workflow, AI booking, staff quick action, bulk action, API-triggered send.

No “internal” endpoint should bypass recipient suppression because it isn’t the main UI.

---

## DY. Test mode must never accidentally send regulated live messages

If workflow/AI test mode exists: use test recipient/sandbox mechanism, clearly identify live vs simulation.

Do not have a Test button accidentally send production SMS to a customer.

---

## DZ. Compliance UX should always answer four questions

Where a privacy/compliance state affects the user, they should be able to determine:

1. What is the current state?
2. Why is it in that state?
3. What does that state prevent or permit?
4. What can I do next?

**Example:**

```
SMS unavailable
This appointment was imported from Microsoft and Transovo did not capture SMS consent.
Your business must complete texting registration before Transovo can use your business sender for these appointments.
[Set up business texting]
```

That is much better than **SMS restricted.**

---

## Transovo Privacy / Consent / Compliance Acceptance Checklist

Every applicable feature should pass:

- [ ] Personal-data purpose is explicitly identified
- [ ] Different purposes are not collapsed into one generic consent
- [ ] SMS/email/voice/recording permissions are modeled separately where required
- [ ] Consent provenance is stored
- [ ] Consent language/version is stored where evidence is required
- [ ] Consent timestamp/source is preserved
- [ ] Historical consent evidence is not silently overwritten
- [ ] Withdrawal/revocation is recorded
- [ ] Withdrawal actually affects runtime
- [ ] Consent is not inferred from silence, inactivity, or navigation
- [ ] Required affirmative consent is not preselected
- [ ] Optional consent is not visually manipulated through dark patterns
- [ ] Material consent information appears before agreement
- [ ] General Terms acceptance is not substituted for specific consent where specific consent is required
- [ ] Required vs optional processing is distinguishable
- [ ] Data collection is limited to information needed for the purpose
- [ ] Sensitive information is not exposed outside task/permission need
- [ ] Privacy notices exist at/before collection where required
- [ ] Sender registration and recipient permission remain distinct
- [ ] A2P Brand and Campaign state remain distinct
- [ ] A2P approval does not automatically mark recipients SMS-eligible
- [ ] Appointment origin and SMS eligibility are separate fields
- [ ] Imported/manual appointments do not receive fabricated platform consent
- [ ] Platform-captured evidence and business attestation remain distinguishable
- [ ] SMS opt-out is centrally enforced
- [ ] Scheduled SMS re-checks eligibility at send time
- [ ] Opt-out suppresses applicable future sends
- [ ] Suppressed is not mislabeled as failed
- [ ] Compliance blockers are shown before configuration/send where possible
- [ ] Blocker reason is specific and actionable
- [ ] Email rules are evaluated separately from SMS rules
- [ ] Commercial email identity/subject behavior is truthful
- [ ] Commercial-email suppression is enforced where applicable
- [ ] Runtime matches the messaging use case represented in A2P registration
- [ ] HELP/opt-out behavior promised during registration actually works
- [ ] Registration state is shown as a lifecycle, not a generic Connected boolean
- [ ] Registration rejection/needs-info reason is surfaced when authoritative reason exists
- [ ] The UI never fabricates a reason providers did not supply
- [ ] Recording consent/notice uses its own model
- [ ] Recording state is visible
- [ ] Recording/transcript/summary retention is defined separately
- [ ] Privacy statements match actual technical behavior
- [ ] Integration permissions are no broader than product need where practical
- [ ] Disconnecting an integration explains consequences
- [ ] Data access/export/deletion actions are appropriately permission-controlled
- [ ] Sensitive administrative/privacy actions are auditable
- [ ] One tenant cannot access another tenant's privacy data
- [ ] Manual opt-out overrides cannot casually erase consumer revocation
- [ ] Provider failure does not bypass compliance checks
- [ ] Every outbound channel uses centralized eligibility logic
- [ ] Eligibility decisions have deterministic reason codes
- [ ] AI does not decide regulated communication eligibility
- [ ] AI does not invent consent
- [ ] Privacy/compliance terminology is canonical
- [ ] UI does not claim blanket “compliance” based on one state
- [ ] UI distinguishes law, carrier policy, industry guidance, and Transovo policy
- [ ] Regulatory text/rules are centralized and updateable
- [ ] Compliance rules have regression tests
- [ ] Secondary/internal sending paths cannot bypass policy enforcement

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md              → WCAG 2.2 AA
Guide #2  TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md     → ISO 9241 HCD
Guide #3  TRANSOVO-IA-NAVIGATION-STANDARDS.md             → IA & navigation
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md    → Forms & validation
Guide #6  TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md    → Responsive/reflow/zoom
Guide #7  TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md      → Tables & grids
Guide #8  TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Privacy/consent/compliance (this file)
Guide #9  TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Security & authentication
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Internationalization & localization
TRANSOVO-UI-DESIGN-GUIDE.md                               → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                       → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                           → Visual tokens
```

---

*Guide #8: Privacy, Consent & Compliance UX Standards. Next: Guide #9 — `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md` · Guide #10 — `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`.*
