# TRANSOVO POWER DIALER — COMPLETE BUILD DIRECTIVE FOR GROK → CURSOR

**Issued:** October 23, 2026  
**Existing production baseline:** `master` commit `485275b3f` (confirm current HEAD before edits)  
**Input inventory:** 193-feature Kixie / PhoneBurner / JustCall gap report supplied by product owner; prior Grok master specification and completion ledger.  
**Status:** This document **supersedes the earlier scope/exclusions**. It is an implementation assignment, not a request for another audit or a product brainstorm.

## 0. NONNEGOTIABLE DIRECTION

**Finish the entire practical Power Dialer platform.** Close **all 29 partial features** and implement **all 86 absent features except the specific exclusions in §1**, including items previously labeled *deferred*. Those prior deferments are rescinded. Do not quietly remove features for being complex, 'enterprise', optional, or outside your personal MVP preference. Use the report's detailed code evidence to locate existing modules and reuse them; do not replace completed functionality unnecessarily.

In addition, **build a usable built-in mini CRM** so customers without Salesforce or another CRM can store, organize, update and work their contacts and leads natively inside Transovo. Existing CRM-connected customers must continue to be supported. This is a shared Contacts-centered capability, not a duplicate isolated contact database.

**Parallel Dialer must be a VISIBLE, first-class selectable dialing mode in Campaigns and Dialer, with the full supporting UI even before high-volume traffic is authorized. Do NOT hide it from the interface, remove its menu/control, or mark it a future-only product.** Safety rules apply to every real call; unavailable carrier entitlements should be shown accurately without removing the feature.

**Grok owns the project from decomposition through completion. Cursor implements code.** Keep a feature-by-feature implementation ledger, delegate batches, review Cursor's reported code and behavior, repair gaps, and continue until all included requirements are implemented. Do not pause to ask for routine sequencing or styling choices. Identify unavoidable external dependencies accurately instead of simulating them.

**All Power Dialer pages and all new CRM views must use the exact components, typography, navigation, forms, panels, dialogs, and visual styling of the *current* Phone and Conversational IVR application.** Do not revive New UI2, introduce a separate theme, insert fake data into production, or replace working features with placeholders.

## 1. THE ONLY FEATURE EXCLUSIONS AUTHORIZED BY THE OWNER

Do **not** build these in this project:

1. **New CRM-provider integrations:** HubSpot, GoHighLevel/HighLevel, Outreach, Salesloft, Apollo, Copper, Freshsales, Follow Up Boss, Keap, Vendasta, Nimble, and other *additional* CRM vendors. **Finish existing Salesforce, Zoho, Pipedrive implementation**, mappings and writeback, and make the mini CRM fully usable. Do not remove existing integrations. **Do not build new external CRM vendors.** Build Zapier-compatible connectivity through the public API and webhooks where possible; if an actual Zapier app submission is required, treat publishing as external-dependency work, not permission to omit the API/webhook integration.
2. **Native iOS/Android mobile apps.** Responsive browser use remains required.
3. **Billing/plan-page rebuild or new billing/subscription product work.** Do not build the real `/app/settings?tab=billing` page, rework `/app/billing`, invent prices, or add subscription checkout. **Keep the existing real call-usage accounting, hard limits, cost ceilings, and anti-abuse safeguards fully functional**—these are necessary telephony controls, not a billing-page project.

**Customer-facing outbound webhooks ARE IN SCOPE** (the owner said 'maybe', not a firm exclusion). Build the sensible underlying event subscription/delivery feature, with secure signing, delivery attempts, idempotency, and a small configuration UI; do not build every hypothetical third-party connector.

Everything else in §3 and §4 is in scope, **even if the old specification called it deferred**. If an item depends on paid external carrier/reputation/DNC products, build honest integration and activation paths without enabling unpurchased services or fabricating results.

## 2. EXISTING PRODUCT FOUNDATION: DO NOT REBUILD

The first-class Power Dialer menu already exists with these ten sections under `/app/power-dialer/`: Overview, Dialer, Campaigns, Calling Lists, Callbacks, Call History, Number Health, Analytics, Integrations, Settings. Extend each section with appropriate detail routes, drawers, tabs and actions. Keep Numbers and Contacts global/shared, but extend Contacts into the requested native mini CRM and make it natural to access from the Dialer and lists.

The report identifies **28 browser-verified**, **43 fully coded**, **29 partial**, **71 never-scoped**, **15 previously deferred**, **7 not-applicable** items. **Do not confuse verification state with missing implementation.** Use existing Prisma models, `new-app/lib/server/phone/power-dialer/*`, shared Telnyx/Phone runtime, UI and APIs. Preserve Phone, Conversational IVR, messaging, Numbers, workspace membership and core contacts.

## 3. CLOSE EVERY PARTIAL FEATURE (ALL 29; NO OMISSIONS)

### Dialing/session (4)
- **P01 Pause and Preview:** finish pre-dial lead review, skip, available SMS/email quick actions, notes, and explicit manual preview-to-dial progression.
- **P02 Resume unfinished sessions:** expose resume from session history, browser refresh/re-attachment and durable session state; reconcile running calls without duplicates.
- **P03 Upcoming-contact queue:** show and manage multiple upcoming eligible contacts, not just one next lead; honor list/campaign order and restrictions.
- **P04 Live controls:** wire shared softphone mute, hold, transfer to Power Dialer UI; correct state, errors and permissions.

### Lists/contacts/CSV (6)
- **P05 CSV duplicate processing:** ensure skip/update/add works and show accurate imported/updated/invalid/duplicate counts; no hardcoded `Updated: 0`.
- **P06 Custom import fields:** wizard maps arbitrary authorized fields; persist custom types, map to mini CRM and merge fields, and support useful text/number/selection types.
- **P07 Standard contact fields:** import/edit title, email and refresher notes; show where agents need them.
- **P08 Timezone CSV mapping:** expose and validate timezone columns and use them for actual eligibility.
- **P09 Multiple phone numbers:** contact number priority, fallthrough rules, remove/always-use number, and per-number call outcomes.
- **P10 Complete session contact card:** email, title, CRM record/deal link, local time, relevant custom fields and previous interactions.

### Campaigns/callbacks (4)
- **P11 CRM ownership:** enforce lead-owner routing, reassignment and permitted cross-agent handling—not merely stored metadata.
- **P12 Callback UI:** reschedule, assign, edit notes/phone/timezone; implement against existing APIs and state transitions.
- **P13 Timezone coverage:** use contact timezone reliably, expose full timezone choices and correct fallbacks; don't silently assume US Eastern.
- **P14 Campaign schedules:** allowed days, per-day windows, breaks/lunch windows, 15-minute time selection as useful, server enforcement.

### Dispositions (2)
- **P15 Finish disposition effects:** `removeFromQueue` and `markContactCompleted` must work by flags, not magic hardcoded label strings; idempotent updates.
- **P16 Require notes:** enforce in backend and UI; prohibit progression/save until satisfied when configured.

### Screening (1)
- **P17 Runtime handling:** make notify/skip/rep-handles/uncertain modes actually control call processing and agent UI. Handle early audio/greetings honestly and avoid false human metrics.

### Numbers (4)
- **P18 Number-pool UI:** select/assign/remove owned pool numbers, stable caller ID policies and routing strategies; do not facilitate spam-evasion rotation.
- **P19 Free registration guidance:** expand Hiya, First Orion and Free Caller Registry links into progress tracking and responsible gradual-volume guidance; never fake registrations.
- **P20 Callback routing:** campaign/editor settings and working inbound routing to rep, shared flow, externally supplied number, or existing AI receptionist as configured.
- **P21 Number purchase/rep assignments:** reuse global Numbers purchase/assignment, enforce allowed use, maintain clear ownership.

### Compliance/recording (3)
- **P22 Frequency limits:** per phone/person/workspace across campaigns; include permitted follow-up SMS frequency where applicable, not only per-campaign attempts.
- **P23 Recording settings:** dialer settings must drive actual recording start/stop, consent announcements, retention, jurisdiction-aware restrictions and live call controls; don't let unrelated Phone global setting silently override.
- **P24 Legal/usage notices:** publish coherent in-product acknowledgments, opt-out notices and jurisdiction notes where appropriate. Regulatory texts and prerecorded-message behavior must be reviewed by qualified counsel before commercial enablement.

### Analytics (3)
- **P25 Call source:** display manual / dialer / click-to-call / API / cadence etc. and source-list navigation.
- **P26 Pickup analytics:** machine/human/unclassified/screener metrics, accurate denominators, real event classification and reporting.
- **P27 Real AI summaries:** use a real summary generation process (with optional sentiment, action items, objection/topic extraction and safe fallbacks); no misleading 400-character transcript excerpt labeled AI.

### Team/integrations (2)
- **P28 Agent number enforcement:** apply `repNumberAssignments` at dial origination with permissions and deterministic fallback.
- **P29 CRM writeback:** complete provider-specific call notes, outcome, recording links, follow-up task and callback mappings for **existing** Salesforce, Zoho, Pipedrive connectors.

## 4. BUILD ALL PREVIOUSLY MISSING/DEFERRED FEATURES, EXCEPT §1

Each item below must either be implemented end-to-end or documented as blocked **only by a genuine external/legal/carrier dependency**. Previous 'deferred', 'later', and 'not core' judgments are rescinded for this assignment.

### 4.1 Dialing modes and session engine (13)
- **M01** Keyboard shortcuts/hotkeys for call, answer, end, lead navigation, disposition (with focus/accessibility guards).
- **M02** Save and reuse dial-session presets.
- **M03** Allow reps to connect via verified cellphone or desk phone as an alternative to browser audio, using supported Telnyx legs and cost accounting.
- **M04** Session convenience options: ring tone, duplicate-number skips, duplicate-per-contact prevention, optional email delivery, display time format.
- **M05** Leave live voicemail manually.
- **M06** Three-way conference and warm-transfer directory/agent selection using supported call-control capabilities.
- **M07** Handle incoming calls during outbound sessions with clearly configured busy/interrupt behavior.
- **M08** Parallel dialing: **2–5 lines initially**, architecture may support up to 10 if authorized; server-coordinated attempts, deterministic winner selection, proper media bridge. Do not claim simple concurrent calls equal a working parallel dialer.
- **M09** Machine-filtered parallel dialing with real AMD/human/screener classification and first-human routing.
- **M10** Predictive pacing/dialing as **restricted advanced mode** with carefully controlled capacity, consent, abandonment and carrier limits. It remains inactive publicly until carrier and legal requirements are met.
- **M11** Dynamic dialer: live additions/removals, shared campaign and waiting-state presentation.
- **M12** Shared team queues, controlled lead assignment/distribution, preview/blind pull, round-robin, recycling and appropriate ownership rules.
- **M13** Abandoned-call handling: timed fallback identification/opt-out messaging where legally applicable, state transitions, tracking/reporting, low-threshold auto-throttle and emergency shutoff.

### 4.2 Lists and contacts (6)
- **M14** Alternate-number fallthrough after no answer, voicemail or invalid; configurable next-number vs next-contact logic.
- **M15** In-session phone-number management (always use/remove number/remove contact).
- **M16** Mini CRM contact folders, subfolders, saved/pinned views, layouts, bulk edits, tags and contact local-time visibility.
- **M17** Keep dial lists synchronized with connected **existing** CRM lists (bidirectional only where provider supports); avoid duplicate/misassigned records.
- **M18** Add/remove leads via authenticated customer API/automation, including list-level auditability.
- **M19** Country code defaults and international destination restrictions/controls; keep disabled routes disabled unless carrier and workspace eligibility permit.

### 4.3 Campaigns, retries, scheduling (11)
- **M20** Rerun a completed campaign with appropriate inclusion/attempt policies.
- **M21** Campaign completed/end statuses and reason codes.
- **M22** Multi-step retry schedules (several intervals and caps, campaign presets).
- **M23** Lead-vs-retry priority and dial ordering (newest/oldest/explicit priority).
- **M24** List priority and waterfall to next list/campaign with standby handling.
- **M25** Automatically inject scheduled callbacks into the correct representative's active workflow, using non-duplicative due-time scheduling.
- **M26** Optional callback exemption from ordinary retry cooldown, without overriding DNC/consent/calling-hour rules.
- **M27** Mini CRM appointments/calendar and in-session appointment creation; Google Calendar integration only if existing shared connection can be reused without embarking on a **new CRM provider** integration. Otherwise retain a fully functional internal calendar and document provider connector as external dependency.
- **M28** Contact timezone inference from number area code as **approximate fallback only**, with editable overrides; mobile portability means area code is not reliable residence.
- **M29** State/jurisdiction-specific and regional calling-hour policy handling, including multiple windows.
- **M30** Server-side mandatory legal time restrictions where applicable; do not simply hardcode one 8am–9pm rule as universally sufficient for all jurisdictions and types of call.

### 4.4 Dispositions, scripts, automation (9)
- **M31** Separate configurable no-answer and live-answer disposition sets.
- **M32** Functional disposition-triggered follow-up engine (existing trigger flag must actually execute actions).
- **M33** Move/requeue lead to other list/campaign from outcomes.
- **M34** Assign owners/tags and follow-up email/voicemail/CRM actions based on disposition.
- **M35** Authorized template-based SMS follow-ups triggered by dispositions, reusing existing messaging infrastructure, sender, opt-out/suppression; no new carrier-approval gate invented for already operational numbers.
- **M36** Disposition-triggered customer webhooks (signed, retried, observable).
- **M37** Configurable call/SMS/email cadences with conditions, pause/stop, suppression and business hours.
- **M38** Call ratings and after-call-work timeout.
- **M39** Admin-script publishing/assignment to teams, with versioning as appropriate.

### 4.5 Voicemail and screening (3)
- **M40** Beep detection with automatic voicemail playback, full completion and proper state transition; **counsel/carrier gate for prerecorded-message use**.
- **M41** Truthful, configurable introduction for Apple/Google/other call-screening services, detecting screeners accurately and transitioning smoothly to live rep when appropriate.
- **M42** Recorded abandonment identification/opt-out messages, timing/recordkeeping and abandoned-call handling; not an outbound sales pitch. Subject to counsel review and actual use-case applicability.

### 4.6 Numbers, caller ID, reputation (11)
- **M43** Caller ID selection/rotation controls limited to **legitimate owned and authorized numbers**, with assignment rules and anti-evasion controls; no rapid spam-label circumvention.
- **M44** Local-presence caller ID via eligible owned area-code numbers, without spoofing or misleading identities.
- **M45** Number acquisition and managed local number pools; implement through carrier-supported inventory rather than promise 50,000+ numbers without a supplier.
- **M46** Internal number-health states, daily usage thresholds and explainable metrics; **do not represent heuristic classifications as verified carrier spam labels**.
- **M47** Optional official reputation/spam-label integration, including Telnyx Number Reputation activation and customer-specific cost entitlements; never share a per-business $100 cost as though pooled across customers.
- **M48** Flag alerts, remediation requests and policy-based suppression of poor-reputation numbers when actual data exists.
- **M49** Callback routing pool strategies (same rep, best eligible rep, group/flow, external destination) with explicit rules.
- **M50** CNAM, branded identity and verified caller-ID capabilities **where officially available and purchased**, no false guarantee of presentation to recipients.
- **M51** Authorized bring-your-own caller ID with actual proof-of-control validation where supported; not arbitrary spoofing.
- **M52** Role-sensitive caller-ID masking and dialer-specific number categorization.
- **M53** STIR/SHAKEN/attestation visibility to the extent Telnyx exposes reliable data; show unknown otherwise.

### 4.7 Compliance and recording (6)
- **M54** FTC National DNC screening via **each seller's own properly authorized subscription/SAN or qualified screening provider**; internal screening/import remains free. Do not share one seller's restricted DNC dataset across unrelated customers or pretend nationwide registry access is universally free.
- **M55** Per-list permission/consent exception recording with evidentiary basis; preserve opt-outs and statutory restrictions.
- **M56** Actually consume contact-level consentSource/consentDate/consentRecords for applicable call eligibility.
- **M57** Area-code allow/block control with workspace-level enforcement.
- **M58** Pause/resume recording, including redaction-sensitive states when supported.
- **M59** Campaign-level abandoned-call metrics, safeguards, recordkeeping and jurisdiction-specific reporting periods; do not assume a generic '3% over 30 days' satisfies every rule.

### 4.8 Reporting and intelligence (9)
- **M60** Export call history and dial sessions to CSV with proper permissions.
- **M61** Disposition Summary reporting.
- **M62** Lead source, funnel, agent, team, activity and configurable reports.
- **M63** Scheduled/emailed reports and permitted CSV/recording exports.
- **M64** Define conversion/success by dispositions/ratings per campaign.
- **M65** Live leaderboard.
- **M66** Live call board, representative presence and queue visibility.
- **M67** Supervisor listen/whisper/barge and coaching with rights, consent and call control.
- **M68** Actual conversation intelligence (keywords, sentiment, topic extraction, scoring, playbooks), with labeled model-derived outputs.

### 4.9 Team and permissions (5)
- **M69** Granular role/permission matrix (calls, recordings, contacts, campaigns, number tools, scripts, reports, workflows).
- **M70** Supervisor-specific role, controlled delegated access and temporary contact sharing. Any 'login as' function must be audited and impersonation-safe, not silent credential bypass.
- **M71** Team/user groups with scoped list and queue ownership.
- **M72** Manager permissions, personal lists and team-level access restrictions.
- **M73** DND, call waiting and find-me/follow-me by integrating shared Phone behavior without duplicating a business-phone product.

### 4.10 Messaging and AI (2)
- **M74** Inbound callback handling by existing AI receptionist **when explicitly configured**, with correct dialer-context handoff and lead records; never enable unsolicited AI outbound calling by default.
- **M75** One-touch email from the active dialing session with templates, logging, permissions, provider delivery and suppression rules.

### 4.11 Integrations/API/extensions (10 inventory rows; specified exclusions)
- **M76** Two-way custom-field mapping/sync for **existing Salesforce, Zoho and Pipedrive** where supported.
- **M77** HubSpot — **EXCLUDED by owner**.
- **M78** GoHighLevel — **EXCLUDED by owner**.
- **M79** Other new CRM providers — **EXCLUDED by owner**.
- **M80** Zapier connectivity — **INCLUDED** via secure trigger/action API and webhook interfaces; publish an official Zapier app only with available account access and approval.
- **M81** Customer-facing outbound webhooks with signing, retries, event catalog, delivery history and security controls — **INCLUDED**.
- **M82** Public API, scoped keys, CRUD for lists/contacts, activity status, supported call actions, rate limits, audit logging — **INCLUDED**.
- **M83** Browser extension / desktop click-to-call companion — **INCLUDED**, reuse authenticated product workflows; no separate mobile app.
- **M84** Native mobile iOS/Android — **EXCLUDED by owner**.
- **M85** Auto-create/update mini-CRM contact for inbound unknown caller under configurable rules and minimum connection duration.

### 4.12 Billing (1)
- **M86** Real billing dashboard — **EXCLUDED by owner**. Preserve backend usage accounting, configured usage enforcement, cost protection and safety shutoffs; do not fabricate billing UI.

## 5. NEW EXPLICIT REQUIREMENT: NATIVE MINI CRM

A customer must be able to use Power Dialer **without any third-party CRM**. Extend the existing shared Contacts data model and UI—do not create a second unrelated source of truth.

### 5.1 Mini CRM navigation and views
- **Global Contacts** remains the authoritative contact area, expanded into native mini CRM: Contacts, contact detail, Companies, Deals/Opportunities, Tasks & Follow-ups, Calendar/Appointments, activity timeline and saved views. Use subnavigation/tabs within existing app conventions; do not clutter Power Dialer's 10-item menu unnecessarily.
- Power Dialer Calling Lists and Dialer contact card deep-link into the same record.
- Optional pipeline kanban and table view; simple editable stages and opportunity values.
- Notes, call history, recordings/transcripts (permissions-aware), dispositions, callbacks, messages, emails, tasks, and appointments on a unified customer timeline.
- Contacts support multiple numbers, preferred number, email, title, company, tags, custom fields, owner, lead source, timezone, status, DNC/permission history and duplicate merge.
- CSV import/export with accurate mapping, normalization, previews, de-duplication and bulk edit.
- Native task assignment, reminders, due/overdue queues and campaign-linked follow-up tasks.
- Search, filtering, owner scoping, pinned views and permission controls.
- CRM integrations (existing three) may sync to native records without overwriting customer-entered values accidentally or creating duplicate objects.

### 5.2 CRM completeness
This is **mini CRM**, not an unrelated massive Salesforce clone. Keep the implementation focused and coherent around leads, contacts, organizations, opportunities, appointments, notes, calls, tasks and sales follow-ups. Every displayed feature must persist and perform its advertised action, with normal permissions and data integrity. No 'Connect your CRM first' blocker for native workflows.

## 6. CRITICAL CROSS-CUTTING ENGINEERING FIXES FROM THE GAP REPORT

The following code issues are explicitly in scope even if they appear within a 'built' feature row:

1. **AMD initialization:** the `client.newCall(...)` WebRTC leg appears not to request AMD. Determine the Telnyx-supported architecture; implement actual detection-triggering call creation / supported bridge path, not dormant webhook handlers. Handle premium results such as `human_residence`, `human_business`, `silence`, `fax_detected`; retain uncertain classification honestly.
2. **Server-authoritative orchestration:** current sequential auto-advance is browser-effect-driven. Make scheduling, eligibility, attempt creation, state transitions and concurrency decisions server-authoritative and recoverable. Browser may display/command but must not be the only keeper of business rules or safe attempt state.
3. **Voicemail playback lifecycle:** don't tear down the media leg immediately after playback starts. Wait for meaningful completion/error event and record accurate outcomes.
4. **Recording runtime:** honor the actual Power Dialer recording setting, consent announce, retention and pause/resume independently of unrelated Phone defaults where required.
5. **Disposition enforcement:** implement flags and notes rather than relying on fixed label strings.
6. **Callback automation:** due-time assignment, queue insertion, skip/cooldown eligibility and state recovery.
7. **CSV wizard:** custom columns, timezone, standard fields, real update counters.
8. **Caller identity:** enforce permitted per-agent assignments and stable ownership, callbacks and outbound number policies.
9. **Screening behavior:** connect settings to real runtime and recorded states.
10. **Honest data:** only show real carrier reputation, real AI outputs, real call classifications. Mark unavailable integrations/features as unavailable rather than fake.
11. **Bounded resource use:** complete per-workspace/per-rep/per-campaign concurrent call and dialing-rate limits, global carrier-account capacity and customer spend ceilings; don't depend solely on plan billing.

## 7. TELNYX, PARALLEL DIALING, AND CARRIER SAFETY

**Parallel Dialer MUST be visible in the real product, in Campaign configuration and the Dialer mode selector. Build and ship its UI, orchestration, configuration and activity views; do not hide parallel because it is new, expensive, or considered an upgrade.** The owner decides whether to remove the service later. Do not turn the user's request into a hidden-feature policy.

**Safety is separate from visibility.** Actual call origination must enforce applicable carrier/account capacity, lawful use, verified sender ownership, consent/suppression, abandonment safeguards, per-customer spending/call caps, and emergency-stop controls. On an account that lacks technical capacity or required external authorization, show the visible mode with a specific, actionable unavailable/blocked reason rather than placing noncompliant calls. Avoid a blanket user-facing "parallel coming soon" or arbitrary invisible entitlement gate.

- Ask Telnyx for written guidance on multi-tenant human-operated 2–5-line parallel calls, Call Control-specific CPS/concurrency, cancel-before-answer ratios, complaints/abandonment and required carrier settings; do not invent an account-level limit from SIP defaults.
- Call pacing, reservation of exactly one winning human for one rep, media bridge, overlapping-answer fallback, event deduplication, carrier rejections, abandoned-call accounting, queue cleanup, and complete attempt histories must operate server-side.
- Account/workspace/rep/campaign limiters and an admin kill switch are required; safety caps cannot be disabled by a customer UI toggle.
- Build parallel up to five lines and implement predictive dialing as an additional configured mode with safeguards; do not quietly revert either to single-line-only. Actual dialing remains subject to externally required carrier/legal conditions, not an invented ban on displaying the product.
- Do not disguise high-risk rotation, unsolicited calling, or prerecorded marketing as compliance. Message/recording use depends on actual legal prerequisites; expose clear, precise reasons if an external approval/service is missing.

## 8. FEATURE DELIVERY AND ROUTE RESPONSIBILITIES

Expand the existing 10 pages, and the global mini CRM, so every included feature has a sensible visible or API entry point:

- **Overview:** readiness, recent activities, campaigns, callbacks, usage and safety alerts; quick route to dial, import, or CRM.
- **Dialer:** Power / Preview / Parallel / gated Predictive selector, preview queue, contact details, scripts, in-call controls, voicemail, email/SMS actions, outcomes, follow-ups, upcoming queue, session presets and recovery.
- **Campaigns:** advanced reattempts, schedule/jurisdiction windows, priority/waterfall, dynamic queues, ownership, routing, team members, dispositions and automation.
- **Calling Lists:** complete CSV/CRM import/sync, source and saved views, bulk editing, DNC/eligibility, phone fallthrough and API integration.
- **Callbacks:** complete calendar/timezone/ownership functionality, dial-session queue integration, return-call routing and AI option.
- **Call History:** source, dispositions, recording, transcript, AI analyses, email/SMS context, detailed exports and contacts/deals links.
- **Number Health:** authorized number pools, local presence, registration guidance, reliable health metrics, official reputation add-on, branded calling where provided, callback routing, alert/remediation controls.
- **Analytics:** pickup/disposition/funnel/team/lead-source/conversation intelligence, scheduled reports, live boards/leaderboards, abandoned-call audit reporting, export.
- **Integrations:** preserve existing Salesforce/Zoho/Pipedrive, field mappings, sync history, API keys and customer webhook endpoints; no new CRM vendors this round.
- **Settings:** dialing/number/voicemail/screening/recording/consent/dispositions/scripts/cadences/compliance/roles/usage safety; hide or clearly gate external premium services not purchased.
- **Global mini CRM:** native leads, contacts, companies, opportunities, tasks, appointments, activity and ownership, usable with no connected CRM.

Do not add an inert settings toggle, link, tab, 'premium' card, or workflow that doesn't actually work. If a provider-required service is unavailable, label the control as unavailable and explain the actual dependency.

## 8A. EXACT INFORMATION ARCHITECTURE AND PAGE COMPOSITION — NO CURSOR GUESSWORK

### Shared visual system — REQUIRED ON EVERY SCREEN

Inspect the current `new-app` production shell and use the components actually rendered by **Phone, Conversational IVR / AI Receptionist, and existing messaging / MCTB**. Components must be imported/reused from the production shared library, not recreated in a Power Dialer-only kit. Treat the current repository as visual source of truth; older design mocks and New UI2 are NOT authoritative.

**Frame:** existing global header + the existing single contextual product side menu; primary content aligns to existing page gutters/max width. Do not add a second nested sidebar beside the product sidebar. Global Numbers and global Contacts stay in established navigation. Keep ten main Power Dialer items already present; create nested routes/tabs only where specified.

**Page structure:** top header row = title and one-line purpose left, primary CTA right; under it a restrained summary/status strip where meaningful; underneath use the same responsive grid, section/panel primitives and table components used in Phone and Conversational IVR. Do not invent new font scales, emerald/teal theme, decorative gradients, oversized promotional tiles or fake sample contact rows. Reuse existing UI heading, secondary text, buttons, tabs, dropdowns, empty states, modal sheets and status badges. Tables should have search/filters at top, sortable headers where relevant, row actions at right, pagination at bottom. Detail pages use two-column main-content + compact contextual panel on wide screens; collapse to one column on narrow screens. Drawers/sheets for light edits; full route for long workflows. Every visible action needs backend persistence and loading/error/success UI. Use confirmed production breakpoint behavior and token names; don't hardcode imaginary component import paths.

**Design handoff required:** before implementing each screen, Cursor must cite the existing Phone/Conversational IVR/MCTB production screen(s) used as its structural/visual reference, list reused shared components and show the page route, row/column composition and actions in the task report. Grok rejects disconnected one-off page styling, dummy fields and unlabeled buttons. Avoid disrupting finished existing routes.

### Power Dialer root navigation (keep exactly these 10 primary entries)

1. **Overview** `/app/power-dialer` — header title + **Start Dialing** / **Import Contacts** actions. Row 1: four compact KPI tiles (attempts, human connections, callbacks due, remaining calling allowance). Row 2: left 2/3 active-campaign progress table, right 1/3 readiness/attention list. Row 3: recent activity table across width and a compact calling trend. Each row opens a real record. Empty state guides first list → campaign → session. No fake metrics.
2. **Dialer** `/app/power-dialer/dialer` — header with campaign selector + session status. **Setup screen:** two-column layout: left 2/3 campaign/list, agent, owned caller ID/pool, dialing mode **Power / Preview / Parallel / Predictive**, parallel-lines control 2–5, rules, presets, script/disposition/voicemail selections; right 1/3 eligible counts, schedule/permissions/usage warnings and primary Start. **Running screen:** top row prominent timer, selected mode, 1–5 line-state indicators and start/pause/resume/stop; left 2/3 active contact card (phones, timezone, email, company, deal, history), live media controls (mute, hold, warm/cold transfer, conference), outcome buttons + notes, voicemail, one-touch SMS/email; right 1/3 script, queued contacts/callbacks, current line events. Bottom pane shows per-attempt live states, human/machine/screener distinction and next action. **Ended:** summary metrics and return-to-campaign actions. No parallel mode hidden; actual disabled origination must show a specific carrier/limit reason.
3. **Campaigns** `/app/power-dialer/campaigns` — header + Create Campaign; filter row; wide table (name, status, owner/team, list/source, eligible/total, calls, conversations, next task, last activity, right actions). Create/edit uses the EXISTING production multi-section sheet, in this order: General, Contacts, Dialing & Modes (Power/Preview/Parallel/Predictive, line count, timeout, pacing), Retry & Priority (multi-step policy, waterfall), Schedule & Jurisdictions, Caller ID & Pools, Script/Voicemail/Screening, Dispositions & Cadences, Team/Routing, Review. Campaign detail nested tabs: **Contacts**, **Activity**, **Sessions**, **Analytics**, **Automation**. Include clone, rerun, pause, archive, campaign-complete reasons and dynamic membership controls.
4. **Calling Lists** `/app/power-dialer/calling-lists` — header Create/Import; search/filter toolbar; table list name, source, owner, total/eligible, campaigns, last synced/modified, row menu. **List detail** top list header + status/eligibility chips, second row actions Add Contact/Import/Sync/Export/Bulk Edit; main contact table with checkbox, name/company, all phones/preferred number, local time, status, owner, last disposition, attempt count, next callback, actions. Tabs **Contacts / Saved Views / Activity / Sync Settings**. CSV wizard: upload → preview & map standard/custom/phone/timezone fields → duplicate policy & validations → counts and rejected-row download. CRM connected-list refresh; live add/remove API; folder/subfolder and pinned views through shared CRM.
5. **Callbacks** `/app/power-dialer/callbacks` — header Schedule + calendar/list toggle; status tabs Due / Overdue / Upcoming / Completed / All; filter toolbar; table due date/local time, contact, campaign, rep, phone, previous result, notes, actions (Call, Reschedule, Reassign, Complete, Cancel). Callback editor sheet with date-time, zone, preferred phone, assignee, priority, notes. Show call queue placement and callback outcomes; calendar nested view and optional shared Phone/AI callback routing. No auto-call that bypasses actual dialing restrictions.
6. **Call History** `/app/power-dialer/call-history` — header + Export; filters date/campaign/rep/phone/answer type/outcome/source/recording; table timestamps, contact, caller ID, campaign, agent, duration/billed minutes, human/machine/screener, outcome, source, actions. Nested **Sessions** and **Call Detail**. Detail uses left 2/3 event timeline, transcript, genuine AI summary, notes, disposition and audio playback; right 1/3 contact/deal links, call metadata, follow-up and CRM sync, permissions. Include download/export as authorized; don't reveal sensitive media to unauthorized team members.
7. **Number Health** `/app/power-dialer/number-health` — header + Add/Assign Number from shared Numbers; KPI summary row with numbers, volume, connection/screening/failure trends; sortable per-number table with number/area code, assigned campaign/rep, daily attempts, response rates, callback route, declared health heuristic, official reputation status if provided, actions. Number detail tabs **Performance / Assignments & Pool / Inbound Callbacks / Reputation & Registration / Alerts**. Provide legitimate local presence by owned area-code identity, pools and stable per-contact usage; public Hiya/First Orion/registry links with checklists, and conditional paid Telnyx reputation integration—never invented scores. Caller ID/CNAM/STIR when support exists.
8. **Analytics** `/app/power-dialer/analytics` — header date picker + Export/Schedule Report, KPI row, responsive trend chart + disposition funnel, then breakdown tables. Route-backed tabs **Overview / Campaigns / Representatives / Numbers / Screening / Dispositions / Leads & Funnel / Sessions & Usage / Conversation Intelligence / Live Board / Abandonment & Compliance / Scheduled Reports**. Filters consistent across tabs; detail drill-throughs; export/email reports, controlled supervisor actions and lead-source breakdowns. Use a single semantic metric definition; calls ≠ contacts ≠ sessions and machines ≠ humans.
9. **Integrations** `/app/power-dialer/integrations` — header + connection status; connected-provider table/cards for **existing Salesforce, Zoho, Pipedrive ONLY**; vendor detail has overview, OAuth connection controls, contact/list import and two-way field map, activity/notes/recordings/callback writeback, sync activity/error and reconnect. Route tabs **Connected / Sync History / API Keys / Webhooks / Browser Extension**. Webhook detail includes event selection, URL/secret, test delivery, recent attempts, retries, signing; keys have scopes/expiry/revoke. No HubSpot/HighLevel/additional CRM tiles or fake Connected badges. Allow native CRM as default without external connection.
10. **Settings** `/app/power-dialer/settings` — keep same production tab navigation conventions; organized sections **General & Presets / Dialing & Attempts / Campaign Defaults / Calling Hours & Jurisdictions / Dispositions / Scripts / Voicemail Drops / Call Screening & Intro / Caller ID & Pools / Recording & Consent / Compliance & DNC / Automations & Cadences / Team & Roles / AI & Call Intelligence / Usage Safety**. Each section has heading + short descriptive subtitle + grouped settings rows, right-aligned inputs/controls, explicit Save/Cancel state, validation, and link to relevant records. Don't create isolated permanent sidebar entries for settings. Usage Safety is technical limits, NOT a billing-page rebuild.

### Native mini CRM — global Contacts and associated routes, not a second silo

- **CRM landing / Contacts** (existing global Contacts): header + Add Contact/Import; status/count row; search/filter/saved-view row; contact table with name, organization, preferred phone, email, owner, lead stage, next task, timezone, source, tags, actions. Optional compact pipeline filter; no sample users in production.
- **Contact detail** `/app/contacts/[id]` (adapt existing canonical path): two-column layout; left identity/header and editable standard/custom fields, phones, consent/DNC/ownership; tabbed timeline of calls, SMS, email, notes, meetings, tasks, callbacks and recordings; right summary, upcoming tasks, deals, campaigns, quick **Dial / Email / SMS / Set Callback / Add Task**.
- **Companies** global Contacts subroute: company table with search, owner, associated contacts, open deal values; company detail related contacts, notes and activities.
- **Deals/Opportunities** global Contacts subroute: toggle table/kanban; pipeline stage columns or compact table; drag/update stage safely, value, owner, close target, contact/company, next step; detail with activity and notes.
- **Tasks & Follow-ups**: status tabs Due / Overdue / Upcoming / Done; owner/source/priority filters, assignment and callback/email/meeting actions, task detail sheet.
- **Calendar/Appointments**: week/list view, create/edit appointment and attach contact/rep/deal; use existing calendar backend/connectors only, plus native storage.
- **Saved Views / Settings**: custom contact fields (text, number, selection), list layouts, tags, folder ownership, duplicate merge, team permission scopes, import/export; respect shared Contacts entity IDs and all existing messaging/Phone associations.

### Cross-screen workflows that must be coherent

**Without external CRM:** global Contacts → import/map & dedupe → create list → configure campaign and mode → Dialer call(s) → disposition → optional voicemail/email/SMS → callback/task/deal stage → history/analytics; all on same canonical contact. **With CRM:** same journey plus authorized CRM two-way sync. **Manager:** create teams/permissions → assign reps/caller IDs/lists → shared queue/personal lists → live board, coaching and reports. **Parallel:** set 2–5 lines → independent attempt state cards → first-human fast bridge → remaining call/cancel/second-answer handling → abandonment logging/suppression/usage. Every row-level CTA and tab in these journeys must have a real consumer.

### Implementation rule

Do not replace the finished UI wholesale. Map each new control/route onto existing primitives; extend the ten currently deployed sections and existing global Contacts screens. If current product screen components differ from descriptive examples above, preserve the production styling and implement the functional layout with their established patterns—not an ad hoc redesign.

## 9. HOW GROK MUST MANAGE CURSOR

1. Turn the included **P01–P29 and M01–M86 (minus explicit exclusions)** plus mini CRM and cross-cutting fixes into a maintained, concrete acceptance ledger. Use one requirement ID per item, associated DB/API/UI/runtime components, route and implementation status.
2. Reuse existing code and styles. Have Cursor implement in coherent batches (e.g., core session/AMD/voice; mini CRM/contacts; campaign/queues; dispositions/cadences; number health/callbacks; team/analytics; API/extension; advanced parallel/predictive), keeping shared products functional.
3. Review each Cursor report, inspect substantive changes and identify any missing subfunctionalities. 'File exists' or 'API exists' is not completion if advertised user action has no backend consumer.
4. Do not wait for owner approval on routine sequencing, component choice or normal bug fixing. Escalate only when external purchases/credentials, materially new costs, destructive changes, legal sign-off, or carrier activation decisions are necessary.
5. For production-bound batches: run appropriate automated checks, commit responsibly, push through existing authorized `master` workflow, confirm Coolify build and runtime state, inspect SSH deployment logs, verify `/api/health` commit and monitor disk/build-cache growth. Do not blindly clear volumes/databases or force-push.
6. Use browser inspection at `https://transovo.ai` to ensure pages, controls, and navigation expose what was coded; avoid creating fake production customers/contacts. All call-placement activity must use explicitly authorized controlled recipients; do not trigger unsolicited real calls.
7. Continue the implement → review → repair loop while tools/session allow. Preserve ledger/next task for continuation if the environment cannot autonomously run indefinitely. Do not claim unperformed work.
8. Completion report must distinguish implemented scope, carrier/legal/service-dependent activation gates, and remaining blockers. **Do not call the project complete with included P/M items left undone**; report exact exceptions.

## 10. ACCEPTANCE DEFINITION

The assignment is implemented when **all 29 partials are closed**, **every non-excluded M-row is implemented**, the **native mini CRM is fully functional**, the **existing Salesforce/Zoho/Pipedrive connectors and Power Dialer workflows are complete in code**, and the current unified Transovo design system is used everywhere. Features waiting for Telnyx/counsel/external paid providers may remain safely disabled **only when the code path is real and the dependency is accurately documented**, not because implementing them was inconvenient.

**Not to be excluded by assumption:** parallel, machine-filtered parallel, predictive engine, shared queues, dynamic lists, abandoned-call handling, number pools, local presence, CRM-like native records, cadences, email actions, reporting, supervisor tools, call recording controls, public API, customer webhooks, and browser click-to-call extension.

**Only actual owner exclusions:** new external CRM provider integrations, native mobile apps, and billing-page/subscription rebuild. **Parallel is included and visible.** Everything else listed here is assigned.
