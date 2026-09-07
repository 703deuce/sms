# Transovo MCTB Page Inventory & Route Manifest

**Status:** Active — mandatory completeness reference for the MCTB frontend rebuild  
**Audience:** Engineers, product owners, and Cursor agents implementing the MCTB frontend  
**Product:** Transovo Missed Call Text Back  
**Role:** Defines every required MCTB route, page, major page section, route relationship, operational state, and legacy migration mapping

**Cursor rule:** `.cursor/rules/transovo-mctb-page-manifest.mdc` (`alwaysApply: true`)

---

## Master Cursor rule

Cursor must account for every route and page in this manifest before declaring the MCTB frontend rebuild complete. Existing screenshots and legacy code are evidence of current content and behavior, not authority over the final layout. The approved Transovo standards govern architecture, interaction, responsiveness, accessibility, forms, tables, privacy, security, time, and visual implementation. The MCTB IA map governs where each feature lives. **This manifest governs completeness.** Cursor may recompose page layouts substantially, but must not silently omit working functionality, states, controls, workflows, or data already in scope. Every visible control must have real runtime behavior or be explicitly unavailable. Every route must use the canonical shared shell and component system unless the route is intentionally public, onboarding, immersive, or admin-only.

---

## 1. Canonical route families

MCTB routes fall into six categories:

- **A. Operational**
- **B. Configuration**
- **C. Compliance / audit**
- **D. Temporary process**
- **E. Public/customer**
- **F. Admin/support**

Every route must belong clearly to one category.

---

## 2. Canonical operational route set

**Recommended canonical routes:**

- `/mctb`
- `/mctb/missed-calls`
- `/mctb/missed-calls/:id`
- `/mctb/conversations`
- `/mctb/conversations/:id`
- `/mctb/analytics`

**Optional operational route:**

- `/mctb/voicemail` — only if voicemail is treated as a recurring inbox rather than setup-only functionality.

---

## 3. Canonical configuration route set

**Recommended:**

- `/mctb/setup`
- `/mctb/setup/phone`
- `/mctb/setup/messaging`
- `/mctb/setup/consent`
- `/mctb/setup/schedule`
- `/mctb/setup/voicemail`
- `/mctb/setup/exclusions`
- `/mctb/setup/test`

These may be separate routes or one Setup route with robust local section navigation.

If Cursor retains a single-page setup architecture, the manifest still requires every section below.

---

## 4. Canonical compliance/audit route set

**Recommended:**

- `/mctb/compliance`
- `/mctb/compliance/consent`

**Potential shared/global route** if compliance becomes cross-product:

- `/settings/messaging`
- `/settings/messaging/business-texting`

Cursor must not maintain two unrelated registration systems.

---

## 5. Temporary/process routes

- `/onboarding/mctb`
- Potential migrated route: `/mctb/onboarding`

This is temporary workflow architecture, not product navigation.

---

## 6. Public/customer route

- `/f/mctb/:token`

This is a public request form and must use public/customer presentation, not the authenticated app shell.

---

## 7. Admin/support surfaces

Current relevant support/admin routes may include:

- `/admin/customers/:id`

MCTB data may appear here, but this route is not part of user-facing MCTB IA.

---

## 8. PAGE: MCTB Overview

**Canonical route:** `/mctb`  
**Category:** Operational

### Primary job

Let the business understand today's recovery activity and what requires attention.

### Required page header

- Page title: **Overview**
- Product context: Missed Call Text Back
- Primary action only if there is a clear dominant operational action
- Current service state if paused/degraded

### Required summary metrics

At minimum:

- Missed calls today
- Text-backs sent today
- Replies today

Potentially:

- Conversations needing response
- Recovery rate if formally defined
- Delivery failures
- Voicemails

Do not overload with all analytics.

### Required operational sections

**Needs attention** — conversations needing reply, setup incomplete, forwarding not verified, compliance blocker, sender unavailable, delivery issue. Each item must link to its actual canonical resolution path.

**Recent activity** — compact list/timeline of missed call, consent captured, text sent, customer replied, voicemail left, callback completed where tracked.

### Required states

Normal active | First-use/setup incomplete | Paused | Degraded | Loading | Partial data | Error

### Prohibited duplication

Do not render the full Missed Calls table here. Do not render full Conversation threads. Do not turn Overview into a second Analytics page.

---

## 9. PAGE: Missed Calls

**Route:** `/mctb/missed-calls`  
**Category:** Operational

### Primary job

Review all missed-call events and determine recovery status.

### Header

- Page title: **Missed Calls**
- Contextual description optional
- Primary action generally not necessary
- Setup/configure action can be secondary if product incomplete

### Summary cards

Current implementation evidence includes: Missed today, Texts sent today, Replies today. Keep only if they improve scanning and do not duplicate Overview excessively.

### Filters/search

Recommended/filterable fields as supported: Search caller, Date range, Status, Replied / not replied, Suppressed, Needs attention, Business line, Consent mode if operationally useful. Filters are not navigation.

### Required table/list fields

Current known fields: Caller, Business line, Detected time, SMS sent time, Status, Suppression reason.

Potential useful fields: Reply state, Consent state, Repeat caller indicator.

**Repeat caller behavior:** Current UI includes badge such as *Called 3x today* — remain visible where meaningful.

### Row behavior

Primary row identity should be caller/phone. Opening row goes to Missed Call Detail. Do not require whole-row pointer interaction only; preserve explicit keyboard-accessible link.

### Required states

populated | no missed calls yet | no results for filters | loading | error | partial/degraded

---

## 10. PAGE: Missed Call Detail

**Route:** `/mctb/missed-calls/:id`  
**Category:** Operational (object detail)

### Primary job

Explain exactly what happened for one missed call and what happened afterward.

### Required header information

- Caller identity or phone
- Event status
- Event date/time
- Business line
- Primary relevant action, likely **Call back**

### Required metadata

Caller, Public business line, Transovo forwarding ingress where appropriate in diagnostics, Detected time, Trigger/disposition, Consent mode, Current recovery state.

### Required sections

**Recovery timeline** — Missed call detected → Eligibility evaluated → Consent requested/captured → Text scheduled → Text sent → Delivered → Customer replied. Also support: suppressed, failed, voicemail, callback, link click, public form submission. Timeline must reflect runtime truth.

**Consent** — If Press-1: consent captured state, method, timestamp, link to consent evidence/log. If existing-consent: show applicable consent mode/provenance truthfully; do not fabricate platform-captured consent.

**Caller history** — repeat caller history; previous missed calls/recovery where useful.

**Link activity** — if recovery SMS included a link: link clicked, time, target/context if appropriate.

**Request form activity** — if public request form enabled: submission, timestamp, entered fields where appropriate and permitted.

**Related conversation** — compact conversation preview/status. Action: **Open conversation**.

**Voicemail** — if voicemail exists: recording/playback, transcription if available, timestamp, duration, link to full voicemail view if separate.

### Required actions

Call back | Open conversation | Open contact | View consent evidence. Avoid unnecessary action clutter.

### Required states

normal | suppressed | no consent | failed delivery | voicemail only | replied | missing/deleted | unauthorized | loading/error

---

## 11. PAGE: Conversations

**Route:** `/mctb/conversations` (or filtered canonical Transovo Conversations)  
**Category:** Operational

### Primary job

Respond to customers who replied to MCTB recovery messages.

### Required layout

Prefer standard inbox model: Conversation list + Selected thread (or responsive equivalent).

### List content

Caller/contact name, Phone, Last message, Time, Unread/needs-reply state, MCTB source indicator where useful.

### Filters

Needs reply | Unread | Resolved | Date | Assigned person if assignment exists.

### Thread content

Compliance confirmation messages, Recovery message, Customer replies, Business replies, Delivery state, Opt-out events, timestamps. Do not falsely make system compliance messages look like business-authored chat if that distinction matters.

### Context panel (optional)

Linked missed call, caller/contact, callback, appointment if later connected, follow-up state.

### Required states

no conversations | no matching conversations | loading | failed load | unavailable thread | opted-out | message-send blocked | message-send pending | message-send failed

---

## 12. PAGE: Conversation Detail (if separate-route architecture)

**Route:** `/mctb/conversations/:id`  
**Category:** Operational (object detail)

If using split-pane inbox, route may still deep-link to selected conversation. Must support direct loading.

### Required capabilities

Load canonical thread | compose reply | enforce messaging eligibility | show opt-out | preserve linked missed-call context | callback | relevant assignment/follow-up if implemented.

---

## 13. PAGE: Analytics

**Route:** `/mctb/analytics`  
**Category:** Operational (insights)

### Primary job

Measure missed-call recovery performance.

### Required date ranges

Current implementation evidence: 7d, 30d, 90d. Could add custom if real.

### Known KPI inventory

Missed calls, Text-backs, Consent/send rate, Conversations, Replies, Reply rate, Delivery rate, Voicemails, Suppressed, Delivery failures, Opt-outs, Link clicks.

### Top suppression reasons

Current implementation includes this concept. Examples: opted out, no consent, cooldown, sender unavailable, registration incomplete, no phone, quiet-hours/schedule if applicable.

### Analytics requirements

No mock data | consistent definitions | same authoritative state as operational pages | timezone-aware date grouping | meaningful empty state.

### Deep links

Metrics can link to filtered Missed Calls or Conversations (e.g. *12 suppressed → View suppressed calls*).

---

## 14. PAGE: Setup Overview

**Route:** `/mctb/setup`  
**Category:** Configuration

### Primary job

Show configuration/readiness and route user to incomplete setup areas.

### Required content

Current MCTB status, Setup completion/readiness, Phone/forwarding status, Messaging sender status, Consent mode/status, Schedule status, Compliance status, Test readiness. Can act as a configuration dashboard.

### Required actions

Continue setup | Save where the page itself edits something | Test setup | Go to compliance where blocked.

Do not duplicate every configuration control on this overview.

---

## 15. SETUP SECTION/PAGE: Phone

**Route:** `/mctb/setup/phone`  
**Category:** Configuration

### Primary job

Configure the voice path from business line into Transovo MCTB.

### Required concepts

- **Business line** — existing public customer-facing voice number
- **Forwarding destination** — hidden Transovo toll-free voice ingress
- **Messaging sender** — do not treat as the same field

### Required controls/content

Select business line, Show forwarding target, Show carrier forwarding instructions, Current forwarding verification state, Link/manage numbers, Production test guidance.

**Important copy:** Production testing should instruct the user to call the **business line**, not the hidden forwarding number.

### Required states

no business line selected | forwarding not configured | forwarding verification pending | verified | test failed | ingress unavailable | loading/error

---

## 16. SETUP SECTION/PAGE: Messaging

**Route:** `/mctb/setup/messaging`  
**Category:** Configuration

### Primary job

Configure which number sends recovery texts and what conversational recovery message follows.

### Required content

**Sender:** current sender number, sender type, readiness, platform toll-free vs dedicated local 10DLC where applicable.

**Message configuration:** default recovery template, optional business-hours message, optional after-hours message, delay before sending, live preview.

**Important compliance architecture (Press-1):** distinguish **System compliance confirmation** (required first system message) from **Conversational recovery message** (business-facing text that follows). Do not collapse both into one editable generic "First Text" if doing so would violate Press-1 architecture.

**Links/request form:** default link URL, template variable, enable public request form, public form URL, upsert contacts setting, direct-dial forward E164 if still supported and valid.

### Required states

sender ready | sender pending | sender blocked | invalid template | link/form disabled | save pending/error/success

---

## 17. SETUP SECTION/PAGE: Consent

**Route:** `/mctb/setup/consent`  
**Category:** Configuration

### Primary job

Choose and configure how MCTB obtains or relies on texting permission.

### Required mode picker

- **Verified Call Consent** (`press_1`)
- **Existing Consent** (`existing_consent`)

**Mode: Verified Call Consent** — explanation, spoken consent script, voice selection, preview, generate audio, playback, publish, selected number, current published state. Behavior: Caller presses 1 → consent captured → message flow eligible; Caller does not press 1 → no text under Press-1 path.

**Mode: Existing Consent** — clear explanation, no Press-1 prompt, business attestation/certification, truthful provenance language. Do not claim Transovo captured consent.

**Compliance helper block:** messaging use case description, opt-in description, link to compliance/campaign — may be moved/refined but must remain available where relevant.

### Required states

no mode selected if possible during setup | Press-1 not published | Press-1 published | existing-consent attestation incomplete | saved | validation error | audio generation failure | publish failure

---

## 18. SETUP SECTION/PAGE: Schedule

**Route:** `/mctb/setup/schedule`  
**Category:** Configuration

### Primary job

Control when MCTB is active and when messages are allowed.

### Current known modes

Always on | Only business hours | Only after business hours | Custom weekly schedule.

### Temporary pause controls

Current implementation evidence: 1 hour, 4 hours, Until tomorrow 8 AM, Until resumed, Resume. Retain if runtime supports them.

### Weekly schedule

Per-day enable/disable, start/end, timezone, save.

### Required states

ACTIVE | PAUSED | pause reason | scheduled active period | validation errors | timezone visible | loading/save state

---

## 19. SETUP SECTION/PAGE: Voicemail

**Route:** `/mctb/setup/voicemail`  
**Category:** Configuration

### Primary job

Configure voicemail behavior associated with MCTB.

### Current known controls

Voicemail greeting text, custom audio upload, TTS greeting, link to Visual Voicemail if separate inbox, note that voicemail trigger must be enabled to text on voicemail.

**Trigger relationship:** Voicemail trigger state must be clear. Do not let user configure voicemail-triggered recovery while trigger is off without explaining that it is inactive.

---

## 20. PAGE: Visual Voicemail (if operational)

**Route:** `/mctb/voicemail`  
**Category:** Operational (optional)

### Required content

Per-number voicemail inbox, caller, time, duration, playback, transcription where enabled, linked missed call, callback, linked conversation if relevant.

### Entitlement state

If user lacks entitlement: clearly explain, no fake controls, offer upgrade only if real.

---

## 21. SETUP SECTION/PAGE: Exclusions

**Route:** `/mctb/setup/exclusions`  
**Category:** Configuration

### Primary job

Manage MCTB-specific do-not-text exclusions.

### Required controls

Add phone, Reason, List current exclusions, Remove exclusion.

**Important distinction:** recipient opt-out vs global/customer suppression vs MCTB operator-created exclusion. Do not let removing an MCTB exclusion erase a genuine consumer opt-out.

---

## 22. SETUP SECTION/PAGE: Test

**Route:** `/mctb/setup/test`  
**Category:** Configuration

### Primary job

Test MCTB before/after production setup.

### Required mode selection

Press-1 | Existing-consent, with attestation if needed.

### Required instructions

Demo number to call directly, explain no forwarding required for demo, production test uses business line.

### Required live progress

Call received → Greeting → Press 1 → Consent → SMS queued → SMS sent. Add delivery/reply if supported.

### Required actions

Start test | Retry | Go to Setup | View missed-call log | View consent evidence | View conversation.

### Required states

idle | waiting | partial progress | success | failed | timeout | no call detected | consent not captured | SMS failed

---

## 23. PAGE: Compliance Overview

**Route:** `/mctb/compliance` or shared global business-texting location  
**Category:** Compliance / audit

### Primary job

Show sender/compliance readiness that affects MCTB.

### Required content

Toll-free verification status, A2P status where dedicated local sender used, sender readiness, campaign/use-case state, blocking reason, next action.

### Required lifecycle states

Not started | Information required | Submitted | Pending | Approved | Needs information | Rejected | Suspended. Do not flatten into one Connected badge.

---

## 24. PAGE: Consent Evidence / Consent Log

**Route:** `/mctb/compliance/consent`  
**Category:** Compliance / audit

### Primary job

Provide searchable audit evidence for Press-1 / consent events.

### Current known explainer

Distinguishes: caller, business number, Transovo number. Preserve identity clarity.

### Current known summary cards

Total consents, today, texts sent after consent today.

### Current known table fields

Consenting caller, Customer business number, Transovo number, Method, Timestamp, Follow-up text status.

### Expandable detail

Identity status, method, scope, consent mode, capture mode, call reference, prompt audio asset, missed-call event link. Keep audit details available; presentation may be simplified.

### Required states

empty | filtered | loading | error | no matching caller

---

## 25. PAGE: Onboarding

**Route:** `/onboarding/mctb`  
**Category:** Temporary process

### Primary job

Get a first-time customer from zero to active trial/product.

### Current 10-step inventory

1. Business info
2. Consent method
3. See how it works
4. Your Transovo number
5. Text-back message
6. Toll-free verification
7. Verification pending
8. Connect your business line
9. Live test
10. Trial active

Cursor may simplify or combine steps if global HCD rules justify it, but all required underlying setup decisions must still exist.

### Required properties

Progress visible, Back/Next, preserve data, loading/error/retry, browser back behavior sane, no duplicate hidden setup system, final configuration must populate canonical MCTB settings.

---

## 26. PAGE: Public Request Form

**Route:** `/f/mctb/:token`  
**Category:** Public/customer

### Primary job

Allow caller/customer to submit a request after receiving the MCTB recovery link.

### Public-shell requirements

No admin sidebar, simple branding, clear business identity, mobile-first, accessible, minimal fields.

### Fields

Depend on actual current backend. Likely: name, contact info, request/message. Do not invent unnecessary fields.

### Optional behavior

Upsert contact from submission — must match runtime truth.

### Required states

valid form | invalid token | expired/disabled form | submitted | validation error | network error | duplicate/resubmission behavior if relevant

---

## 27. PAGE: Numbers / Phone inventory (if retained)

**Legacy route:** `/voice/numbers`  
**Target:** `/settings/numbers` or folded into `/mctb/setup/phone`

### Required features if retained

List owned/assigned numbers, role/use, status, add/buy action, MCTB assignment, messaging readiness. Do not expose internal provider IDs as primary fields.

---

## 28. FLOW: Add/Buy Number

**Legacy route:** `/voice/numbers/buy`  
**Category:** Process action (not persistent nav)

### Required states

search/select if applicable, purchase confirmation, payment/entitlement, provisioning, success, failure, number assignment. Only keep if actual product still supports number acquisition.

---

## 29. PAGE/VIEW: Needs Attention

**Legacy route:** `/voice/needs-attention`  
**Recommended target:** Overview queue | Missed Calls filter | Conversations filter

If route remains `/mctb/needs-attention`, it should aggregate canonical objects, not create duplicate data models.

---

## 30. PAGE: Reports

**Legacy route:** `/voice/reports`  
**Recommendation:** keep global cross-product Reports; MCTB-specific detail remains Analytics.

MCTB report section may include: missed calls, texts sent, delivery rate, reply rate, link to full analytics.

---

## 31. Admin Support Snapshot

**Route:** `/admin/customers/:id`  
**Category:** Admin/support

Current admin customer view includes: toll-free number, TFV status, trial SMS usage, onboarding step. Potentially also: business line, sender, MCTB active/paused, last missed call, last reply.

Do not expose admin-only diagnostics to normal customer pages without need.

---

## 32. Legacy route migration matrix

Cursor must inventory and deliberately handle:

| Legacy route | Outcome required |
|--------------|------------------|
| `/voice/missed-calls` | Keep canonical / redirect |
| `/voice/missed-calls/:id` | Keep canonical / redirect |
| `/voice/setup` | Redirect |
| `/voice/schedule` | Redirect |
| `/voice/try-it` | Redirect |
| `/voice/voicemail` | Redirect / merge |
| `/voice/consent-log` | Redirect |
| `/voice/analytics` | Redirect |
| `/voice/reports` | Merge / global |
| `/voice/numbers` | Merge / settings |
| `/voice/numbers/buy` | Process action |
| `/voice/needs-attention` | Filter / merge |
| `/compliance` | Shared / contextual |
| `/compliance/campaign` | Shared Business Texting |
| `/onboarding/mctb` | Temporary process |
| `/f/mctb/:token` | Public — keep |
| `/solutions/missed-call-text-back/setup` | Redirect |
| `/agents/john` | Redirect / retire |
| `/voice/receptionist` | Redirect / retire |

Each route gets one outcome: **Keep canonical | Redirect | Merge | Admin-only | Retire safely**. No orphan routes.

---

## 33. Redirect expectations

Known legacy examples should likely redirect:

- `/solutions/missed-call-text-back/setup` → `/mctb/setup`
- `/agents/john` → `/mctb` or relevant canonical page
- `/voice/receptionist` → canonical MCTB destination or retire

Do not let obsolete product terminology remain user-visible.

---

## 34. Shared-shell rule

Authenticated MCTB pages must use: same Transovo global header, global sidebar/shell, spacing system, typography, buttons, form controls, table behavior, modal/drawer patterns.

Appointment product screenshots are visual reference language for shell, colors, density, spacing, typography, card treatment, borders, radius, buttons, tabs, tables, input styling, empty/error/loading states.

Do not copy appointment page content/IA into MCTB. Reuse its visual system.

---

## 35. Screenshot baseline requirement

Before rebuilding MCTB, Cursor should capture screenshots of representative finished appointment pages showing: global sidebar/header, standard list/table page, detail page, settings/configuration page, analytics page, form/editor page, modal/drawer, mobile representation if available.

These screenshots are visual calibration references. They do not override standards or MCTB requirements.

---

## 36. Shared visual-language reference pages

Cursor should prioritize appointment pages that best demonstrate:

1. App shell
2. List/table density
3. Form treatment
4. Detail hierarchy
5. Status badges
6. Analytics/KPI treatment
7. Tabs/local nav
8. Empty/loading/error
9. Mobile/reflow

---

## 37. Every page must define system states

At minimum, applicable pages require: Normal | Loading | First-use / empty | Filtered empty | Error | Partial/degraded | Success/updated | Read-only/permission blocked where applicable.

Do not build only the happy path.

---

## 38. Page-level permission states

If role/entitlement affects a page: render truthful read-only/unavailable state, hide dangerous unauthorized actions where appropriate, server enforcement remains canonical. Do not rely only on frontend visibility.

---

## 39. Responsive requirement per route

Every page must have defined narrow-screen behavior:

| Page | Mobile behavior |
|------|-----------------|
| Missed Calls | Desktop table → mobile structured records/cards |
| Conversations | Split pane → list → full-screen thread |
| Setup | Local side nav → mobile section navigation |
| Analytics | KPI grid → stacked/2-column |
| Missed Call Detail | 2-column → single-column |
| Consent Log | table → mobile record view or isolated horizontal table |

---

## 40. Page title system

**Canonical titles:** Overview, Missed Calls, Conversations, Analytics, Setup, Phone, Messaging, Consent, Schedule, Voicemail, Exclusions, Test, Compliance, Consent history.

**Avoid:** Recovery Center, Agent John, Voice AI, Messaging Command Center, Smart Voice Recovery Engine.

---

## 41. Canonical object vocabulary

Use consistently: Missed call, Conversation, Caller, Contact, Business line, Forwarding destination, Text-back sender, Text-back, Consent, Voicemail, Suppressed, Opted out, Delivery failed, Replied, Needs attention.

---

## 42. Canonical number labels

**Mandatory:** Business line | Forwarding destination | Text-back sender

**Never ambiguous:** Your number | MCTB number | Phone number (without role context).

---

## 43. Canonical state vocabulary

Examples: Active, Paused, Setup incomplete, Verified, Pending, Needs information, Approved, Rejected, Suppressed, Delivered, Failed, Replied, No reply, Consent captured, Consent not captured, Opted out. One term per state definition.

---

## 44. Cross-page state consistency

If a missed call is *Suppressed — customer opted out*, then Missed Calls table, Detail, Analytics, Conversation, and Consent/compliance surfaces must not disagree. One authoritative domain state.

---

## 45. Required cross-links

| From | To |
|------|-----|
| Overview | Missed Calls, Conversations, Analytics, Setup blocker |
| Missed Calls | Missed Call Detail |
| Missed Call Detail | Conversation, Consent evidence, Contact, Voicemail |
| Conversation | Missed Call, Contact |
| Analytics | filtered Missed Calls, filtered Conversations |
| Setup | Compliance, Test, Phone/Numbers |

---

## 46. Return-context requirement

Preserve list context when user returns from detail: search, filters, sort, page, selected date range, reasonable scroll position. Same for Conversations.

---

## 47. Deep-link requirement

Every canonical detail route must work directly. No dependency on hidden list state.

---

## 48. No duplicate business logic

All pages must reuse canonical engines for: MCTB eligibility, consent state, sending, suppression, schedule, number assignment, voicemail, messaging status. Do not create frontend-only duplicate state logic.

---

## 49. No mock controls

Every visible toggle, select, button, filter, action menu, save, test button, pause button must work or be explicitly unavailable. No decorative frontend.

---

## 50. No mock analytics

All Analytics cards/charts must use real backend data. If metric not implemented, omit or mark unavailable intentionally.

---

## 51. No fabricated compliance states

If provider status unknown: **Status unavailable** — not **Approved**. If rejection reason absent: **Rejected — no detailed reason provided** — not AI speculation.

---

## 52. No fabricated consent

Press-1 evidence only when Press-1 actually occurred. Existing consent mode should never be shown as Transovo-captured consent.

---

## 53. Runtime truth wins

If UI says Active, runtime must actually be active. If UI says Paused until tomorrow at 8 AM, runtime must honor it. If UI says SMS sender ready, backend/provider must agree.

---

## 54. Cursor build order

Recommended implementation order:

1. Screenshot finished Appointment references
2. Audit shared shell/components/tokens
3. Create/confirm canonical MCTB nav config
4. Create canonical route structure
5. Rebuild shared MCTB page patterns
6. Rebuild operational pages
7. Rebuild setup pages
8. Rebuild compliance/audit
9. Rebuild onboarding/public pages
10. Map legacy routes
11. Functional integration
12. Responsive/accessibility/state QA
13. Cross-page consistency audit

---

## 55. Cursor audit-before-change rule

For every route: **Audit → Preserve correct behavior → Recompose UI if needed → Extend shared system → Consolidate duplicates**. Do not rebuild backend behavior simply because frontend changes.

---

## 56. Manifest completion matrix

Cursor should maintain tracking for each route:

| Route | Page | UI rebuilt | Runtime connected | States complete | Responsive | A11y | Tested |
|-------|------|------------|-------------------|-----------------|------------|------|--------|
| `/mctb` | Overview | | | | | | |
| `/mctb/missed-calls` | Missed Calls | | | | | | |
| `/mctb/missed-calls/:id` | Detail | | | | | | |
| `/mctb/conversations` | Conversations | | | | | | |
| `/mctb/analytics` | Analytics | | | | | | |
| `/mctb/setup` | Setup | | | | | | |
| `/mctb/setup/phone` | Phone | | | | | | |
| `/mctb/setup/messaging` | Messaging | | | | | | |
| `/mctb/setup/consent` | Consent | | | | | | |
| `/mctb/setup/schedule` | Schedule | | | | | | |
| `/mctb/setup/voicemail` | Voicemail setup | | | | | | |
| `/mctb/setup/exclusions` | Exclusions | | | | | | |
| `/mctb/setup/test` | Test | | | | | | |
| `/mctb/compliance` | Compliance | | | | | | |
| `/mctb/compliance/consent` | Consent history | | | | | | |
| `/onboarding/mctb` | Onboarding | | | | | | |
| `/f/mctb/:token` | Public form | | | | | | |

---

## 57. Legacy-route migration matrix

| Legacy route | New route | Action |
|--------------|-----------|--------|
| `/voice/missed-calls` | `/mctb/missed-calls` | Redirect |
| `/voice/setup` | `/mctb/setup` | Redirect |
| `/voice/schedule` | `/mctb/setup/schedule` | Redirect |
| `/voice/try-it` | `/mctb/setup/test` | Redirect |
| `/voice/consent-log` | `/mctb/compliance/consent` | Redirect |
| `/voice/analytics` | `/mctb/analytics` | Redirect |
| `/agents/john` | canonical MCTB | Redirect |
| `/voice/receptionist` | canonical/retire | Decide |
| `/solutions/missed-call-text-back/setup` | `/mctb/setup` | Redirect |

No dead links.

---

## 58. Definition of done for each page

A page is complete only when: Route exists | Correct IA placement | Correct title/terminology | Uses shared shell | Uses Appointment visual language | Uses Transovo tokens/components | Real runtime data | Real actions | Normal state | Loading state | Empty state | Error state | Partial/degraded state | Responsive behavior | Keyboard behavior | Focus behavior | Accessibility | Permission behavior | Cross-links | Deep link | Return context | No fake controls | No duplicate business logic.

---

## 59. Definition of done for the whole MCTB frontend

MCTB frontend is not complete until:

- every manifest route is accounted for
- every legacy route has a decision
- operational pages use the approved IA
- Setup is consolidated coherently
- appointment visual language is inherited consistently
- no old Voice-specific shell remains
- number roles are clearly distinguished
- Press-1 vs existing-consent UI is correct
- compliance/system message distinction is correct
- all visible controls work
- no mock analytics
- no fake status
- all core flows work mobile + desktop
- keyboard/accessibility QA passes
- screenshots across all pages look like one Transovo product

---

## Relationship to the governing stack

```
TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE
        ↓
MCTB PRODUCT SCOPE & DOMAIN RULES
        ↓
MCTB INFORMATION ARCHITECTURE & NAVIGATION MAP
        ↓
MCTB PAGE INVENTORY & ROUTE MANIFEST  ← completeness
        ↓
MCTB CANONICAL PRODUCT MAP
        ↓
MCTB PAGE-BY-PAGE BUILD SPECS  ← screen implementation (01 Overview published)
        ↓
TRANSOVO PAGE ARCHITECTURE
        ↓
TRANSOVO VISUAL DESIGN SYSTEM
        ↓
FORMAL STANDARDS GUIDES
        ↓
CURSOR IMPLEMENTATION
```

The next document should be the **MCTB Page-by-Page Build Spec** — telling Cursor exactly what each screen should contain, hierarchy, primary action, sections/cards/tables, states, and control behavior.

---

**This document is the authoritative completeness reference for the MCTB frontend rebuild. Cursor must read it (after product scope and IA map) before implementing or declaring any MCTB page complete.**
