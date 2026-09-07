# Transovo MCTB Product Scope & Domain Rules

**Status:** Active — mandatory product-scope authority for all Missed Call Text Back work  
**Audience:** Engineers, product owners, designers, Cursor agents, and anyone modifying MCTB  
**Product:** Transovo Missed Call Text Back  
**Role:** Defines what MCTB is, what it is not, which domain objects belong to it, which user jobs it serves, which features are in scope, and which neighboring capabilities must not be allowed to blur the product boundary

**Cursor rule:** `.cursor/rules/transovo-mctb-product-scope.mdc` (`alwaysApply: true`)

---

## Master Cursor rule

Transovo Missed Call Text Back must be developed as a focused standalone operational product for recovering missed business calls through compliant text conversation, not as a generic phone system, CRM, mass-messaging product, or AI receptionist. The product exists to detect a missed/no-answer business call, establish or respect valid messaging permission, send an appropriate text-back, surface the resulting conversation to the business, and help the business recover the opportunity. Every page, feature, status, workflow, setting, and navigation destination must serve that job directly. Existing code may be preserved where correct, but old telephony, voice-AI, SMS-marketing, PBX, routing, campaign, or unrelated messaging features do not gain product authority merely because they exist in the repository. MCTB must have one coherent domain model, one canonical information architecture, one canonical runtime truth, and one clearly enforced boundary from other Transovo products.

---

## 1. Product definition

### MCTB exists to answer one business problem

**"What happens when a customer calls my business and I don't answer?"**

The Transovo MCTB product should help the business:

1. detect or receive the missed/no-answer call
2. identify the caller
3. determine the applicable consent/eligibility path
4. send the correct first text interaction
5. receive the customer's reply
6. surface the conversation to the business
7. allow the business to respond or call back
8. show whether the missed opportunity was recovered

That is the product.

Anything that does not materially support this workflow should be questioned before inclusion.

---

## 2. MCTB is a standalone product domain

MCTB is not merely a hidden feature under Appointments.

It is its own product/domain because the user is performing a distinct recurring job:

**Recover missed calls through text conversation.**

The user mental model is not:

- scheduling
- phone system administration
- marketing campaigns
- AI reception
- bulk texting

It is:

**Missed Calls → Text Back → Conversation → Recovery**

---

## 3. Canonical product name

The product is called:

**Missed Call Text Back**

Canonical short form internally/documentation:

**MCTB**

Do not rename the same product across pages as:

- Missed Call Recovery
- Text Back
- Call Rescue
- Missed Call Automation
- Call Recovery AI
- SMS Recovery

unless one of those is deliberately introduced later as a separate marketing label.

Within the product UI, one concept gets one name.

---

## 4. Core user jobs

The product should be organized around these jobs.

### Job A — See missed calls

The user wants to know:

- who called
- when they called
- whether they were texted
- whether they replied
- whether someone followed up
- whether the lead/opportunity was recovered

### Job B — Reply to missed callers

The user wants to:

- open the conversation
- see the customer's reply
- respond from Transovo
- call the customer back from the customer number shown
- understand the communication status

### Job C — Configure how text-back works

The user wants to control:

- consent mode
- text-back wording
- working-hours/after-hours behavior where supported
- sender configuration
- callback behavior
- business identity
- routing/notification behavior related specifically to MCTB

Configuration belongs in setup/settings, not mixed into daily call queues.

### Job D — Set up phone forwarding

The user wants to:

- connect their existing business number to MCTB
- configure no-answer/busy/unreachable forwarding
- verify forwarding works
- understand the hidden ingress number
- test the call flow

This is setup/infrastructure, not an everyday operational object.

### Job E — Understand compliance and messaging eligibility

The user wants to know:

- whether texting is available
- which sender is being used
- whether consent was captured
- whether the recipient opted out
- whether business texting registration is required
- what specifically blocks a text

This must be factual and derived from runtime/compliance state.

### Job F — Measure recovery

The user wants to know things such as:

- missed calls
- text-backs sent
- customer replies
- conversations started
- callbacks requested
- recovered opportunities
- response/recovery rate

Analytics should measure MCTB outcomes, not generic telephony metrics unless directly useful.

---

## 5. Canonical MCTB domain objects

These are the primary conceptual objects.

### 5.1 Missed Call

Represents a call that entered the MCTB recovery workflow because the business did not answer under the configured conditions.

Typical fields conceptually:

- caller
- caller phone number
- business/workspace
- source/public business number
- received time
- forwarding ingress
- call disposition
- consent path/result
- text-back state
- linked conversation
- callback/recovery state

A missed call is not the same thing as a conversation.

### 5.2 Conversation

Represents the text exchange with the caller.

A conversation may include:

- compliance confirmation message
- first conversational text
- caller replies
- business replies
- delivery state
- opt-out events
- internal assignment/comment state if supported

Conversation is the authoritative communication object.

Do not create separate duplicate SMS thread models on different pages.

### 5.3 Contact / Caller

The person who called.

MCTB can identify them by phone number and optionally associated contact data.

Do not invent a separate MCTB-only "lead person" object if the main Transovo Contact domain can represent the same person.

If a caller becomes or already is a Transovo Contact, use the canonical Contact.

### 5.4 Forwarding Setup

Represents configuration required to route missed/no-answer calls into Transovo.

It may include:

- provider/carrier instructions
- forwarding destination
- no-answer/busy/unreachable setup
- verification state
- last successful test
- troubleshooting state

This is configuration, not a daily operational object.

### 5.5 Messaging Sender

Represents the number/identity used to send MCTB SMS.

Possible models:

- Transovo verified toll-free sender
- dedicated local 10DLC number
- another approved sender type later

Voice ingress and SMS sender are separate concepts.

**Hard rule:** Never model "the MCTB number" as one universal phone number object when voice ingress and SMS sender may be different numbers.

### 5.6 Consent / Messaging Eligibility State

This represents authoritative messaging permission and blockers.

It is not one boolean.

It may include:

- consent mode
- consent provenance
- consent captured
- opt-out status
- sender eligibility
- sender registration state
- recipient/channel eligibility
- reason code
- first-message compliance requirements

This state must come from the canonical compliance/eligibility layer.

### 5.7 Recovery Outcome

Represents whether the missed opportunity progressed after text-back.

Possible factual states may later include:

- no reply
- replied
- callback requested
- business replied
- business called back
- recovered
- closed/lost

Do not fake a recovery outcome the system cannot actually determine.

If Transovo only knows the caller replied, show **Replied**, not **Recovered** unless recovery is explicitly established.

---

## 6. MCTB product boundary

The following are inside scope.

### Core V1 operational scope

- Missed call capture
- Missed call list/history
- Text-back initiation
- Press-1 consent mode
- Existing-consent mode where configured and valid
- Two-message Press-1 start where required by the MCTB compliance model
- SMS conversation inbox/thread
- Business reply
- Direct callback access
- Caller/customer details
- Delivery/opt-out/eligibility states
- Forwarding setup
- Forwarding verification/test
- Sender setup
- Compliance/business texting setup relevant to MCTB
- MCTB analytics
- Notifications relevant to missed-call follow-up
- Workspace settings specific to MCTB

---

## 7. Explicitly out-of-scope product areas

These must not creep into MCTB merely because code exists elsewhere.

### 7.1 Full PBX / phone system

MCTB is not:

- desk phone replacement
- softphone
- extension system
- internal calling
- call queues
- call park
- hold music system
- enterprise PBX

Do not redesign MCTB into a general phone platform.

### 7.2 AI receptionist

AI receptionist is a separate product decision.

Do not add AI voice agent configuration, AI answering, scripted reception flows, or voice-agent analytics into MCTB primary IA unless explicitly approved later.

MCTB must remain complete and coherent without AI voice.

### 7.3 Smart Routing / IVR as a separate product

Smart Routing may exist as a distinct Transovo product.

MCTB may depend on a small consent/phone-tree mechanism such as Press-1, but that does not mean the entire Smart Routing builder belongs inside MCTB.

**Rule:** Use the minimal runtime capability required for MCTB. Do not import the separate routing product's entire management UI.

### 7.4 SMS marketing

MCTB is not:

- campaigns
- blasts
- newsletters
- bulk promotional texting
- drip marketing
- reactivation
- mass contact lists
- keyword marketing campaigns

Texting exists to recover and continue the specific missed-call interaction.

### 7.5 Generic CRM

Do not turn MCTB into:

- pipeline manager
- sales opportunity CRM
- deal stages
- account management suite
- contact marketing database

A minimal caller/contact relationship is fine. A generic CRM product is not MCTB.

### 7.6 Appointment scheduling

Scheduling can integrate contextually later, but Appointments remains its own product/domain.

MCTB may later provide a contextual action such as **Book appointment** — that should use the canonical Appointment engine.

Do not duplicate appointment scheduling logic inside MCTB.

### 7.7 Review requests

Review requests are outside the MCTB product boundary.

### 7.8 Generic automation builder

MCTB can have product-specific automatic behavior.

That does not mean the full generic automation/workflow builder belongs under MCTB.

If automation is exposed, it must directly serve the missed-call recovery workflow and should reuse the canonical automation engine rather than fork it.

---

## 8. Voice ingress and SMS identity are separate architectural concepts

This distinction is mandatory.

A customer's flow may use:

- **existing public business number** — the number customers dial
- **hidden Transovo toll-free ingress** — receives conditional forwarded voice
- **SMS sender** — verified toll-free or dedicated local 10DLC

These are separate roles.

Do not design pages that imply all three must be one phone number.

Do not expose the hidden toll-free ingress as if it were the business's customer-facing texting number.

---

## 9. Existing business number remains central to the product value proposition

MCTB is specifically valuable because the business can keep its normal public number for incoming calls.

The customer does not need to replace their public business phone number merely to use MCTB.

The product should explain setup around:

**Keep your business number. Forward missed calls to Transovo.**

Do not design onboarding that implies:

**Get a new business number and give it to your customers**

unless the user is explicitly purchasing some separate phone-number product.

---

## 10. Hidden ingress should stay conceptually hidden from customers

The forwarding destination is infrastructure.

The business may need to see it during setup.

The caller generally does not.

Do not give the hidden toll-free ingress excessive product prominence after setup.

It belongs under:

- Setup
- Numbers/Phone setup
- Forwarding
- Diagnostics

not as a primary daily object.

---

## 11. Dedicated local SMS number is an optional sender upgrade

If supported, a customer may use a dedicated local 10DLC number for MCTB texting.

Canonical language should be:

**Dedicated local text-back number**

Do not claim:

**Text from your existing business number**

unless Transovo truly hosts/enables SMS on that exact public business number.

Product copy must describe actual capability.

---

## 12. Press-1 consent is part of MCTB, not a separate product journey

When using Press-1:

1. missed call forwards into Transovo
2. caller hears the consent prompt
3. caller presses 1
4. Transovo records the consent event
5. compliance confirmation SMS is sent
6. conversational text follows
7. replies enter the MCTB conversation

This is one MCTB workflow.

Do not scatter it across unrelated Voice, IVR, Campaign, and SMS product sections.

---

## 13. Existing-consent mode is also a first-class supported MCTB mode

MCTB supports multiple consent modes.

At minimum:

- `press_1`
- `existing_consent`

The product must not silently eliminate one because the other is easier to explain.

If a workspace uses existing consent, the UI must represent that configuration truthfully.

The specific legal/runtime eligibility remains governed by the compliance rules.

---

## 14. Consent mode is configuration, not a daily navigation destination

Do not create global nav items:

- Press-1
- Existing consent

They are configuration choices inside MCTB setup/settings.

Daily work remains:

- Missed Calls
- Conversations

---

## 15. MCTB primary operational objects vs configuration

### Operational

These are frequent:

- Missed Calls
- Conversations
- Caller/Contact
- Follow-up status
- Recovery state

### Configuration

These are occasional:

- Forwarding
- Sender
- Consent mode
- Business identity
- Notifications
- Business texting registration
- working-hours behavior
- advanced message configuration

Configuration should not compete with daily operational work in navigation hierarchy.

---

## 16. Daily work must dominate product placement

The most frequent user questions are:

- Who called me?
- Did they get a text?
- Did they respond?
- What did they say?
- Has anyone followed up?
- Can I call them back?

Those questions should be inexpensive to answer.

A2P settings, phone forwarding, and sender setup are important but lower-frequency.

---

## 17. Home/Dashboard is a summary, not a duplicate product

If MCTB has a Home/Overview, it should summarize operational health.

Possible content:

- missed calls today
- unreplied conversations
- recent customer replies
- recovery rate
- setup/compliance blocker when one exists
- recent activity

Home should link into canonical objects.

It must not duplicate complete Missed Calls, Conversations, Analytics, and Setup pages inside one giant page.

---

## 18. Missed Calls is the canonical missed-call management location

This should be where the user finds and reviews missed-call records.

It should not be duplicated under:

- Analytics
- Messages
- Setup
- Home

Those areas may link/filter into the canonical Missed Calls view.

---

## 19. Conversations is the canonical text-thread management location

A caller's MCTB text conversation should have one authoritative thread.

Do not maintain:

- one thread under `/inbox`
- another copy under Missed Calls
- another copy under Contact
- another copy under some legacy Agent page

Multiple access paths can open the same conversation. One underlying object.

---

## 20. Missed Call and Conversation must cross-link

From a missed call: **Open conversation**

From a conversation: **View missed call**

The system should carry context. Do not make users search manually across modules.

---

## 21. Contact integration should reuse the canonical Contact domain

If the caller already exists as a Contact, show the relationship.

If they do not, MCTB may expose **Create contact** — that should create/use the canonical Transovo Contact object.

Do not fork a separate MCTB contact database for UI convenience.

---

## 22. Callback should remain simple

A business user can call the customer back using the customer's phone number.

The product does not need to proxy every callback through Transovo merely to claim ownership of the action.

If calling directly from the business's normal phone is the simpler valid workflow, preserve it.

The UI can provide **Call customer** without turning MCTB into a phone app.

---

## 23. No mobile app requirement for V1

MCTB should remain usable as a web product.

Do not make critical functions depend on a native mobile app.

Responsive web must support:

- viewing missed calls
- opening conversations
- replying
- copying/tapping caller number
- seeing status
- basic setup/status review

---

## 24. Notifications are supporting behavior, not the product itself

Notifications may alert the business about:

- new missed call
- caller reply
- callback request
- unresolved conversation

Notifications should bring the user into the canonical MCTB object.

Do not create duplicate conversation state inside notification-only systems.

---

## 25. Recovery analytics must use facts Transovo can actually observe

Allowed factual metrics may include:

- number of missed calls
- texts sent
- text delivery status
- replies received
- response rate
- callback-request rate
- conversations with business replies
- follow-up time

A metric such as **Revenue recovered** must not be shown unless Transovo has authoritative data to calculate it.

Do not fabricate business outcomes from proxies.

---

## 26. "Recovered" requires a defined business rule

Before using a KPI named Recovered Calls or Recovery Rate, define exactly what counts.

Possible future definition:

- customer replied
- business replied
- callback occurred
- appointment booked
- business marks recovered

Pick one authoritative definition.

Do not let the dashboard use one definition and Analytics another.

---

## 27. Product scope must remain compatible with future expansion

The architecture may later support:

- callback requests
- visual voicemail
- transcription
- team assignment
- working-hours messages
- SMS links
- booking action
- analytics enhancements

But new capability must still pass this question:

**Does this materially serve recovering and managing missed calls?**

If not, it belongs in another product.

---

## 28. Visual Voicemail is subordinate if introduced

If MCTB later captures voicemail/transcription, it should be contextual to the missed call.

Do not turn MCTB into a generic voicemail hosting product unless explicitly approved.

Likely relationship: **Missed Call → Voicemail → Transcript**

---

## 29. Callback Requests are subordinate if introduced

A callback request is a state/action within the missed-call recovery journey.

It should not automatically become its own top-level product domain.

Possible placement:

- conversation state
- missed-call state
- queue/filter

---

## 30. Team assignment is subordinate if introduced

Assigning a conversation/missed call to a staff member can support recovery.

That should remain within the object: **Assigned to Sarah**

Do not create a project-management system around it.

---

## 31. Working hours are MCTB configuration only where behavior changes

If MCTB supports different behavior after hours:

- different greeting
- different first conversational message
- different notification behavior

then working-hours configuration is in scope.

Do not import the full Appointment availability engine unless the behavior genuinely needs it.

Reuse workspace hours where an authoritative shared setting already exists.

---

## 32. Message templates are MCTB-specific only when they directly govern the MCTB interaction

Examples:

- Press-1 compliance confirmation
- first conversational message
- existing-consent text-back message
- after-hours variant

Do not expose generic SMS campaign template management inside MCTB.

---

## 33. Message content must preserve business identity and product role truthfully

MCTB may send customer-facing text on behalf of the business.

UI/copy must not imply Transovo is the business.

Prefer wording such as:

**Reply here to message Joe's Plumbing.**

Avoid ambiguous phrasing that makes Transovo sound like Joe's Plumbing unless sender identity/branding is actually configured accordingly.

Exact compliance copy is governed separately.

---

## 34. Setup should guide to operational readiness, not every possible feature

A setup flow should get the business to:

1. identify business
2. choose/confirm consent mode
3. configure forwarding
4. verify call flow
5. configure sender
6. satisfy required messaging registration/eligibility
7. test text-back
8. go live

Do not force advanced optional features into setup.

---

## 35. MCTB should have a clear readiness model

Conceptually:

- Phone forwarding ready?
- Voice ingress ready?
- Consent path configured?
- SMS sender ready?
- Required registration ready?
- Test successful?

The product can show readiness.

Do not reduce everything to **Setup complete = true** if some critical dependency is actually broken.

---

## 36. Readiness is not one generic "Connected" status

Use specific states.

Examples:

- Forwarding verified
- Sender ready
- Business texting under review
- Test call failed
- SMS blocked — registration required

Status terminology must correspond to actual subsystem state.

---

## 37. Legacy code does not define product scope

The repository may contain:

- generic voice AI pages
- legacy inbox
- old John agent UI/API
- vanity number code
- Smart Routing
- review request modules
- orphaned routes

These are not MCTB merely because they are nearby.

**Hard rule:** Existing implementation is evidence, not product authority.

---

## 38. Preserve working MCTB runtime

Do not rebuild correct business logic solely to match new UI.

Use: **Audit → Preserve → Extend → Consolidate**

Preserve working:

- consent modes
- voice ingress logic
- SMS runtime
- setup APIs
- forwarding verification
- tests
- eligibility
- thread/reply behavior

UI redesign must not fork working runtime.

---

## 39. Do not create duplicate MCTB engines

There should be one canonical implementation for each major behavior.

Examples:

- one consent-mode model
- one eligibility model
- one missed-call model
- one conversation model
- one sender-selection model
- one forwarding-verification model
- one recovery-state definition

Do not create a "new UI version" with separate business logic.

---

## 40. UI must reflect authoritative runtime truth

If backend says:

- recipient opted out
- sender not registered
- forwarding test failed
- message delivered
- conversation has reply

the UI must show that actual state.

Do not derive conflicting states independently in components.

---

## 41. No fake controls

Every MCTB button, toggle, filter, sender selector, status control, test action, notification preference, forwarding test, and compliance setting must have real runtime behavior.

If unsupported:

- hide it, or
- show explicitly unavailable

Do not ship decorative controls based only on screenshots.

---

## 42. Screenshots are references, not product authority

Existing MCTB screenshots can be used to identify:

- pages
- existing features
- workflows
- useful content
- visual reference

But if screenshot conflicts with:

- these scope rules
- Transovo IA standards
- privacy/compliance
- runtime truth
- accessibility
- shared component system

the standards win.

Do not reproduce legacy mistakes merely for visual fidelity.

---

## 43. MCTB must share the Transovo design system

MCTB is a separate product domain but not a visually separate application.

It must use:

- same shell architecture
- same typography
- same spacing
- same color tokens
- same buttons
- same tables
- same badges/status grammar
- same form grammar
- same responsive patterns
- same focus/keyboard behavior

unless the MCTB task genuinely requires a controlled exception.

---

## 44. Existing Appointment screens are the visual-system reference

When rebuilding MCTB, Cursor should inspect approved Appointment screens to understand:

- shell
- density
- page headers
- navigation
- accent usage
- forms
- cards
- tables
- spacing
- empty states
- alerts
- status badges

MCTB should feel like the same Transovo product family.

Do not copy Appointment-specific information architecture.

Reuse the visual language, not unrelated appointment concepts.

---

## 45. MCTB gets its own domain IA under the shared system

Do not force MCTB pages into Appointment labels such as Booking or Appointment List just for consistency.

Consistency means shared system behavior.

Domain labels still reflect the MCTB mental model.

---

## 46. Canonical MCTB vocabulary

Use these terms unless the final IA map formally changes them:

- Missed Call
- Conversation
- Caller
- Contact
- Text back
- Forwarding
- Sender
- Consent mode
- Business texting
- Opted out
- Eligible
- Suppressed
- Delivered
- Replied
- Callback
- Recovery

Avoid exposing provider/internal terms as primary UI.

---

## 47. Canonical states should be centralized

Examples:

**Missed call:** New | Texted | Replied | Followed up | Closed

**Message:** Scheduled | Sending | Sent | Delivered | Failed | Suppressed

**Sender:** Ready | Under review | Needs attention | Unavailable

**Forwarding:** Not configured | Verification pending | Verified | Failed

Exact final vocabulary must be defined once and reused. Do not improvise per page.

---

## 48. Product state and setup state are different

A workspace can have MCTB active operationally while one optional sender upgrade is **Under review**.

Do not block the whole product merely because an optional feature is incomplete.

Conversely, do not show **Ready** if the core flow cannot function.

---

## 49. Scope of V1 should favor reliability

The first MCTB product should prioritize:

- correct call capture
- correct consent
- correct SMS
- correct conversation
- correct callback/follow-up
- clear status
- setup reliability

before adding advanced AI, complex routing, broad CRM, or large automation builders.

Operational trust is more valuable than feature count.

---

## 50. Core MCTB journey must work end-to-end

The core certification journey is:

1. Customer calls business number.
2. Business does not answer.
3. Call conditionally forwards to Transovo.
4. MCTB consent path executes.
5. Text-back sends correctly.
6. Customer replies.
7. Reply appears in Transovo.
8. Business can respond or call back.
9. Status/history reflects what happened.
10. Opt-outs/eligibility are enforced.

Any redesigned UI must preserve this complete journey.

---

## 51. Secondary journey — existing consent

Where configured and valid:

1. Missed call occurs.
2. Runtime identifies existing-consent mode.
3. Eligibility layer evaluates send.
4. Appropriate text-back sends.
5. Customer replies.
6. Conversation appears.
7. Business follows up.

Do not force Press-1 UI onto an existing-consent workspace.

---

## 52. Premium sender journey must remain separate from voice forwarding

Where dedicated local SMS sender is used:

1. Voice still forwards to hidden toll-free ingress.
2. Press-1 or applicable consent occurs.
3. SMS is sent from dedicated local 10DLC sender.
4. Replies return to the same MCTB conversation.

The local text-back number does not have to be the voice forwarding destination.

This distinction must survive every page and setup flow.

---

## 53. Never promise exact public-number texting unless actually supported

Do not use:

**Texts come from the same number your customers already call**

unless hosted SMS or another verified mechanism truly makes that exact number the SMS sender.

Use precise product language.

---

## 54. Provider implementation is secondary to product concepts

Today MCTB may use Telnyx, Twilio, toll-free verification, 10DLC.

The user-facing product should say:

- Forwarding
- Sender
- Business texting
- Under review
- Ready

Provider-specific details belong in deeper setup/diagnostics when needed.

Do not architect the IA around Telnyx object names.

---

## 55. MCTB should remain sellable as a standalone product

The product must not require purchasing Appointments to function.

It may integrate naturally with other Transovo modules.

But its core promise must stand alone:

**Recover missed calls through text.**

---

## 56. Cross-product integrations must use canonical engines

If MCTB later integrates with Appointments:

**Book appointment** must use the existing Appointment engine.

If it creates a Contact: use Contact.

If it triggers a Workflow: use canonical automation engine.

No duplicate engines.

---

## 57. Cross-product links are allowed; cross-product duplication is not

**Good:** Conversation → Book appointment

**Bad:** MCTB builds a second calendar/appointment editor inside Conversation.

**Good:** Caller → Open contact

**Bad:** MCTB creates a duplicate CRM profile system.

---

## 58. MCTB setup should not expose unrelated products

Do not cross-sell by inserting AI receptionist, Reviews, Smart Routing, and Payments into the setup wizard.

Cross-sell can happen in controlled product/upgrade areas.

Setup should focus on getting MCTB working.

---

## 59. Upgrade surfaces must not contaminate operational IA

If Transovo later offers:

- Dedicated local sender
- Visual voicemail
- Callback automation
- AI after-hours agent

those can be promoted contextually.

But daily Missed Calls/Conversations should not become a marketplace of upsells.

---

## 60. Product status wording must be factual

Use:

- Forwarding verified
- SMS sender ready
- Recipient opted out
- Registration under review
- Message delivered
- Customer replied

Avoid vague claims:

- Fully compliant
- Everything is perfect
- Guaranteed recovery
- AI-powered success

unless specifically supported.

---

## 61. The product should expose why something did not happen

High-value diagnostics:

- Why wasn't a text sent?
- Why didn't the call enter MCTB?
- Why can't I reply?
- Why did this message fail?
- Why is this sender unavailable?

The UI should receive deterministic reason codes and translate them.

Do not require support for ordinary diagnostics.

---

## 62. MCTB domain state must be auditable

Where important, history should capture:

- missed call received
- consent captured
- compliance message sent
- conversational message sent
- delivered/failed
- customer replied
- opt-out recorded
- business replied
- assignment changed
- callback requested
- closed/recovered state changed

This should derive from real events, not UI guesses.

---

## 63. Timeline/history may become the canonical "what happened?" pattern

For a specific missed call/conversation, a timeline can unify operational history.

Do not create five separate fragmented history widgets.

---

## 64. Product should preserve caller context

From Missed Calls → Conversation, system already knows:

- caller
- missed call
- time
- consent mode/result
- sender
- conversation

Do not make the business re-find or re-enter these.

---

## 65. Product should support interruption and return

A business user may:

- open missed call
- get interrupted
- return later

Filters, selected conversation, assignment, draft reply where appropriate should preserve useful context.

This follows the broader Transovo HCD rules.

---

## 66. MCTB does not own legal conclusions

MCTB can expose factual states:

- consent recorded
- opted out
- sender registration approved
- sender unavailable

It should not claim:

- This message is unquestionably legal
- Your business is TCPA compliant

based solely on platform state.

---

## 67. Product domain rules outrank legacy screenshot content

If old screen includes:

- redundant nav
- duplicate settings
- generic voice analytics
- wrong labels
- fake controls
- obsolete setup paths

do not reproduce them blindly.

The screen is inventory/reference only.

---

## 68. Product domain rules outrank aesthetic convenience

Do not merge Missed Calls and Conversations merely because one page looks cleaner if doing so makes the user mental model worse.

Do not split a simple configuration into six pages merely because screenshots already exist.

The final IA must follow the standards.

---

## 69. Every MCTB feature must answer these questions before implementation

For every capability:

1. What user problem does it solve?
2. Is it operational or configuration?
3. Which MCTB object owns it?
4. Is it core MCTB or another Transovo product?
5. What is its canonical home?
6. What runtime state powers it?
7. What existing engine can be preserved?
8. What must not be duplicated?
9. Which compliance/security rules apply?
10. Does it materially help recover missed calls?

If these are unclear, do not add the page/control yet.

---

## 70. New top-level MCTB destinations require a real recurring workspace

Do not create a new top-level navigation item just because a feature is important.

A top-level destination must represent recurring work.

For example:

- Missed Calls — yes
- Conversations — yes
- Analytics — possibly yes
- Forwarding Code — no
- Press-1 Prompt — no
- Sender Registration — probably setup/settings

Final placement comes from the IA mapping document.

---

## 71. MCTB product architecture must be documented separately from visual design

Cursor must first know:

- objects
- user jobs
- scope
- IA
- workflows
- page archetypes

Then apply the Appointment-family visual system.

Do not let visual screenshots determine product architecture.

---

## 72. Final governing principle

Transovo Missed Call Text Back is a focused product for:

**Missed call → Permission/eligibility → Text back → Conversation → Follow-up → Recovery**

Everything should reinforce that loop.

The product should remain:

- easy to understand
- easy to set up
- operationally reliable
- compliance-aware
- truthful about state
- visually consistent with Transovo
- independent of unnecessary telephony complexity
- capable of growing through shared Transovo engines without becoming a feature dump

---

## Cursor MCTB Product-Scope Pre-Implementation Checklist

Before creating or changing an MCTB feature:

- [ ] Confirm the feature materially serves missed-call recovery
- [ ] Confirm it belongs inside MCTB rather than another Transovo product
- [ ] Identify the canonical MCTB object that owns it
- [ ] Classify it as operational vs configuration
- [ ] Identify its one canonical home
- [ ] Confirm canonical terminology
- [ ] Confirm existing runtime/business logic before creating new logic
- [ ] Preserve working MCTB engines
- [ ] Reuse canonical Contact/Appointments/Automation engines where applicable
- [ ] Keep voice ingress separate from SMS sender
- [ ] Keep existing public number separate from hidden ingress
- [ ] Keep sender registration separate from recipient consent
- [ ] Keep appointment origin separate from messaging eligibility
- [ ] Do not introduce PBX/AI receptionist/SMS marketing/CRM scope
- [ ] Avoid fake controls
- [ ] Ensure the UI can be powered by authoritative runtime state
- [ ] Verify the feature does not duplicate an existing MCTB object/system
- [ ] Verify screenshots are being used only as reference, not authority

---

## Cursor MCTB Product-Scope Completion Checklist

Before considering an MCTB area complete:

- [ ] Core missed-call recovery journey remains intact
- [ ] Press-1 mode remains supported
- [ ] Existing-consent mode remains supported where configured
- [ ] Missed Call and Conversation remain distinct authoritative objects
- [ ] Conversation thread has one source of truth
- [ ] Contact relationship uses canonical Transovo Contact domain
- [ ] Forwarding setup is configuration, not operational clutter
- [ ] Voice ingress and SMS sender are correctly separated
- [ ] Dedicated local sender does not incorrectly imply local voice ingress
- [ ] No claim of existing-number texting unless technically true
- [ ] UI does not expose provider architecture unnecessarily
- [ ] MCTB remains usable without Appointments
- [ ] Cross-product actions reuse canonical engines
- [ ] Analytics use observable facts
- [ ] Recovery terminology has a defined meaning
- [ ] Setup reflects actual readiness dependencies
- [ ] State shown in UI matches runtime
- [ ] Compliance blockers are factual and specific
- [ ] No legacy feature gained scope merely because code exists
- [ ] MCTB uses the shared Transovo design system
- [ ] MCTB still feels like one focused product, not a collection of telephony tools

---

## Relationship to the Transovo standards stack

This document sits at the product/domain scope layer for MCTB.

Use authority in this order:

```
LEVEL 0
TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md
    ↓
LEVEL 1 — MCTB PRODUCT SCOPE
TRANSOVO-MCTB-PRODUCT-SCOPE-AND-DOMAIN-RULES.md
    ↓
LEVEL 2 — MCTB IA & NAVIGATION
TRANSOVO-MCTB-INFORMATION-ARCHITECTURE-AND-NAVIGATION-MAP.md
    ↓
LEVEL 3 — MCTB CANONICAL PRODUCT MAP
TRANSOVO-MCTB-CANONICAL-PRODUCT-MAP.md
TRANSOVO-UI-DESIGN-GUIDE.md
TRANSOVO-IA-NAVIGATION-STANDARDS.md
    ↓
LEVEL 4
TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md
    ↓
LEVEL 5
TRANSOVO-PAGE-ARCHITECTURE-RULES.md
    ↓
LEVEL 6
TRANSOVO-VISUAL-DESIGN-GUIDE.md
    ↓
LEVEL 7
Shared Transovo components
    ↓
LEVEL 8
Accessibility
Interaction / Keyboard / Focus
Forms / Validation
Responsive / Reflow / Zoom
Tables / Grids
Privacy / Consent / Compliance
Security / Authentication
Date / Time / Timezone / Locale
Internationalization / Localization
    ↓
LEVEL 8
Existing MCTB implementation and screenshots
```

Existing code and screenshots remain the lowest authority.

---

**This document is the authoritative product-scope and domain-boundary ruleset for Transovo Missed Call Text Back. Cursor must read it before mapping, redesigning, or implementing MCTB pages.**
