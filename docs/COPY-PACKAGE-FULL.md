# COPY PACKAGE — FULL (sections 1–4)

---

# SECTION 1 — MCTB truthful surface audit report

# MCTB truthful surface — pre-merge verification report

**Branch:** `cursor/mctb-truthful-surface-audit-2304`  
**Status:** Verification complete — see merge recommendation below.

---

## A. Ownership

### Canonical customer switcher (source of truth)

| Item | Location |
|------|----------|
| Component | `CallHandlingSwitcher` in `src/components/call-handling/call-handling-switcher.tsx` |
| Shell placement | `src/components/layout/sidebar.tsx` and `src/components/layout/header.tsx` via `shouldShowCallHandlingSwitcher` |
| Read API | `GET /api/call-handling` → `loadCallHandlingOwnershipState` |
| Mutation API | `PATCH /api/call-handling` → `setActiveCallHandler` |
| Telnyx mutation | `routePhoneToMctbCallHandlingIngress` (MCTB) or `routePhoneToVoiceV3BasicCallControl` (AI) — patches `connection_id` on canonical voice ingress DID |
| Tests | `npx tsx scripts/test-call-handling-ownership.ts` |

`CallHandlingDashboardCard` is a layout wrapper that embeds the same `CallHandlingSwitcher` for MCTB Overview only — not a second mutation path.

### Voice Agent page

- **Before:** duplicate `CallHandlingDashboardCard` on Voice Agent page.
- **After:** no Call Handling control on Voice Agent page — customers use the global left-nav / header switcher only (`mctb-voice-agent-page.tsx`).

### Remaining `/api/mctb/inbound-handling` and library callers

| # | File | Function / action | Mutates `connection_id`? | Telnyx function (if any) | Config vs ownership | Canonical ingress? | Customer UI? |
|---|------|-------------------|---------------------------|--------------------------|---------------------|--------------------|--------------|
| 1 | `src/app/api/mctb/inbound-handling/route.ts` | `PATCH` | **Yes, via delegate** | `setActiveCallHandler` → MCTB or V3 routes | Ownership (legacy API shape) | Yes — resolves line → ingress phone | Only if something still PATCHes (no product UI after Voice Agent fix) |
| 2 | `src/app/api/mctb/inbound-handling/route.ts` | `GET` | No | — | Read-only status | Yes | Wizard phone step (`phone-step.tsx`) |
| 3 | `src/lib/mctb/inbound-handling/switch-mode.ts` | `setInboundHandlingMode` | **Yes, via delegate** | `setActiveCallHandler` only (no `routePhoneToTexml*`) | Metadata + canonical switch | Yes | Internal / legacy callers |
| 4 | `src/app/api/solutions/appointment-receptionist/route.ts` | publish / live sync | **When `!explicitCallHandling`** | Same delegate through `setInboundHandlingMode` | First-time wizard default | Yes, when publish targets ingress | Wizard Activate (not Call Handling UI) |
| 5 | `src/components/solutions/appointment-receptionist/steps/phone-step.tsx` | load status | No | — | Read | — | Wizard |
| 6 | `src/lib/mctb/overview.ts`, `line-config`, voice tools, `ensure-call-from-event` | load / parse | No | — | Config / routing hints | — | No |
| 7 | `scripts/mctb-voice-agent-call-ready.ts`, cert scripts | ops | Same as #3 | Delegate | Ops | Yes | No |

**Conclusion:** No remaining path uses `routePhoneToTexmlAssistant` / `routePhoneToTexmlApp` for ownership. All Telnyx `connection_id` mutations for ingress go through `setActiveCallHandler`. Customer-facing ownership control plane: **Call Handling switcher → `/api/call-handling`**.

**Regression (ownership):**

- `npx tsx scripts/test-call-handling-ownership.ts` — **PASS**
- `npx tsx scripts/test-cross-surface-ownership-audit.ts` — **PASS**
- `npx tsx scripts/test-mctb-simplified-launch.ts` (includes static inbound-handling guard) — **PASS**

---

## B. Existing Customer

### Launch vs full AI Lead Recovery UI

| Surface | `existing_customer` scenario | Behavior |
|---------|-------------------------------|----------|
| Simplified launch (`defaultLaunchEnabledScenarios`) | **Off** | Intents `EXISTING_CUSTOMER_ISSUE` / `CANCEL_REQUEST` not in `enabledIntents` → classified intents clamped to `UNKNOWN` / fallback |
| Full AI Lead Recovery page | Opt-in toggle | When on, seeds `EXISTING_CUSTOMER_ISSUE` + `CANCEL_REQUEST` policies from `policy-defaults.ts` |

### Supported (scenario on + `treatDifferently` on)

- **Intents:** `EXISTING_CUSTOMER_ISSUE`, `CANCEL_REQUEST` (when scenario enabled).
- **Actions:** `CREATE_CALLBACK_REQUEST`, `SEND_EMAIL_SUMMARY`, `ESCALATE_HUMAN`, `ROUTE_TO_TEAM` (notify handoff), `CUSTOMER_MESSAGE`.
- **Collection:** `ISSUE_DESCRIPTION` for existing-customer issue path.
- **Cancel:** Does **not** auto-cancel appointments — message + callback / human handoff only (UI copy added).

### Unsupported / bounded

- **Scenario off:** Policy engine uses `fallback:scenario_off`; runtime clamps disallowed intents.
- **`treatDifferently` off:** Uses `fallback:existing_customer_generic` (same as general take-message fallback).
- **No CRM/job lookup:** No automatic identification of “existing” beyond LLM intent classification.
- **Launch profile:** Scenario hidden/disabled by default — no implied existing-customer automation at launch.

### Tests

- `npx tsx scripts/test-mctb-existing-customer-policy.ts` — **PASS** (supported case, scenario off, treatDifferently off, cancel handoff)

---

## C. Calls detail (cherry-pick isolation)

**Files in scope (only these changed for activity feed on this branch):**

- `src/lib/voice/calls/customer-activity-feed.ts`
- `src/lib/voice/calls/customer-activity-feed.test.ts`
- `src/app/(app)/voice/calls/[id]/page.tsx`
- `src/app/api/voice/calls/[id]/route.ts`

**Isolation checks:**

1. Voice V3 runtime / booking tools — **not modified** by these files (read-only API aggregation + presentation).
2. Call persistence — **unchanged** (GET/PATCH feedback only on `voiceCall` metadata).
3. Telnyx provider behavior — **unchanged**.
4. Real call path — cost/provider from `formatCallCostCents` / `formatTelephonyProviderLabel`; **no** fake $0.15 or hardcoded Twilio on non-demo IDs.
5. Activity feed — built from `voiceCallEvent`, tool executions, transfers, recordings; **empty → explicit pipeline states**, not invented events.
6. `MOCK_ACTIVITY_EVENTS` / demo IDs — **demo-only** (`isDemoCallId`); not used for production call IDs.

**Test:** `customer-activity-feed.test.ts` — **PASS**

---

## D. Regression (full set run this verification)

| Script | Result |
|--------|--------|
| `test-call-handling-ownership.ts` | PASS |
| `test-cross-surface-ownership-audit.ts` | PASS |
| `test-mctb-simplified-launch.ts` | PASS |
| `test-mctb-existing-customer-policy.ts` | PASS |
| `customer-activity-feed.test.ts` | PASS |

---

## E. Merge recommendation

**READY FOR MERGE** (pending human review of this report — do not auto-merge).

---

## Prior audit items (unchanged intent)

- Text-to-Pay hidden from MCTB LR UI; shared `/payments` untouched.
- AI_BOOK hidden in UI; backend preserved.
- Missed Calls consent filter removed (no `consentMode` on rows).
- PaymentsEditor dead code — intentionally left in place.

---

# SECTION 2 — Pre-merge ownership source review

# MCTB pre-merge — `connection_id` ownership source review

**Branch:** `cursor/mctb-truthful-surface-audit-2304`  
**Purpose:** Human review appendix for PR #487 — confirms no second customer ownership switcher mutates Telnyx ingress outside `setActiveCallHandler`.

---

## Production callers of `setActiveCallHandler`

| Caller | When |
|--------|------|
| `PATCH /api/call-handling` | Customer **Call Handling** switcher (canonical) |
| `setInboundHandlingMode` in `src/lib/mctb/inbound-handling/switch-mode.ts` | Legacy `PATCH /api/mctb/inbound-handling`; wizard publish when `!hasExplicitCallHandlingSelection` |

No other product UI should PATCH inbound-handling for ownership after Voice Agent duplicate switcher removal.

---

## Inside `setActiveCallHandler` (ingress routing)

| Mode | Telnyx path |
|------|-------------|
| MCTB recovery | `routePhoneToMctbCallHandlingIngress` — patches `connection_id` on canonical voice ingress DID |
| After-hours / Voice Agent | `routePhoneToVoiceV3BasicCallControl` — patches `connection_id` for AI handler |

**Removed from ownership path:** direct `routePhoneToTexmlAssistant` / `routePhoneToTexmlApp` inside `setInboundHandlingMode`.

---

## Other `connection_id` writers (not a second switcher)

These still exist for setup, provisioning, and publish policy — they do **not** replace the customer Call Handling switcher:

- `provisionMctbPhoneTexmlIngressMode` → `routePhoneToTexmlApp` (setup / ingress provisioning)
- `switchDidToMctbTexmlIngress` (provisioning / repair)
- Voice agent publish with `getCallHandlingPublishPolicy` / `skipIngressRouting` when user already chose handler explicitly
- Number assignment, PBX/outbound, and other non–ownership flows

**After merge:** run live Call Handling matrix on deployed Telnyx (per PR #483) — cloud agents cannot certify PSTN.

---

## Explicit non-goals for merge PR #487

- Do not remove legacy `/api/mctb/inbound-handling` (compatibility delegate only).
- Do not implement sender mode, merge scope, or Voice V3 runtime changes.
- Leave `PaymentsEditor` dead code in place.
- Do not auto-merge; human clicks merge after reading `docs/MCTB-TRUTHFUL-SURFACE-AUDIT-REPORT.md`.

---

## Verification commands (all PASS on branch at audit time)

```bash
npx tsx scripts/test-call-handling-ownership.ts
npx tsx scripts/test-cross-surface-ownership-audit.ts
npx tsx scripts/test-mctb-simplified-launch.ts
npx tsx scripts/test-mctb-existing-customer-policy.ts
npx vitest run src/lib/voice/calls/customer-activity-feed.test.ts
```

---

# SECTION 3 — MCTB menu & page inventory

# Missed Call Text Back — menu & page inventory

**Purpose:** Everything visible on each item in the MCTB product sidebar (plus **Calls**, which you plan to add to this menu).  
**Source:** Code audit (`src/lib/products/mctb-nav.ts`, page components, setup shells).  
**As of:** repository `master` lineage (September 2026).

**Canonical sidebar today** (`buildMctbV1Nav`):

| # | Nav label | Route |
|---|-----------|--------|
| 1 | Overview | `/mctb` |
| 2 | Missed Calls | `/mctb/missed-calls` |
| 3 | Conversations | `/mctb/conversations` |
| 4 | Voicemail | `/mctb/voicemail` |
| 5 | AI Lead Recovery | `/mctb/ai-lead-recovery` |
| 6 | Voice Agent | `/mctb/voice-agent` |
| 7 | Analytics | `/mctb/analytics` |
| 8 | Setup | `/mctb/setup` |
| 9 | Payments | `/payments` |
| 10 | Integrations | `/integrations` |

**Planned nav addition (your note):**

| Nav label | Route today | Notes |
|-----------|-------------|--------|
| **Calls** | `/voice/calls` | List; detail `/voice/calls/[id]`. Currently on Voice / other menu — not in `mctb-nav.ts` yet. |

**Mobile bottom nav** (`buildMctbV1MobileNav`): Home (`/mctb`), Missed, Inbox (`/mctb/conversations`), Setup.

**Not in main sidebar but linked from Setup / Overview:** `/mctb/numbers`, `/mctb/compliance/consent`, `/onboarding/mctb` (guided first-time setup; `/mctb/setup/start` redirects here).

---

## 1. Overview — `/mctb`

**Page title:** Overview  
**Subtitle:** Missed-call recovery activity, replies, and setup health.

**Header**

- Status chip: Active | Paused | Needs attention | Setup incomplete
- Primary CTA (state-dependent): Finish setup | Resume now | Fix messaging | Manage setup
- Setup-incomplete banner with link: Continue setup → `/onboarding/mctb`

**Sections (top → bottom)**

1. **Call handling dashboard card** — workspace call-handling ownership (MCTB recovery vs Voice Agent); ties to `/api/call-handling` / overview card component
2. **Today KPI strip** (links)
   - Missed calls (today) → Missed Calls
   - Recovery texts sent (today) → Missed Calls
   - Replies (today) → Conversations
   - Need a reply → Conversations `?filter=needs_reply`
3. **AI Lead Recovery** — enabled/disabled, policy count, status, attention + Manage → AI Lead Recovery
4. **Recent missed calls** — table: Caller | Missed | Recovery | Reply; View all → Missed Calls; row opens detail
5. **Needs attention** (when items exist) — actionable rows (replies, forwarding, sender, messaging blocked, setup incomplete, paused, reply-needed missed calls)
6. **Nothing needs attention** inline strip (when healthy and table shown)
7. **Recent conversations** — preview list; Open inbox → Conversations
8. **Setup status** — rows with links:
   - Business line → Phone & Forwarding
   - Forwarding → Phone & Forwarding
   - Consent → Consent setup
   - Text-back sender → Numbers
   - Recovery → Recovery controls
   - Call recovery (mode + forwarding) → Voice Agent
   - Footer: last 7 days snapshot + View analytics

---

## 2. Missed Calls — `/mctb/missed-calls`

**List page**

**Summary metrics** (for selected date range): Missed calls | Recovery texts | Replies | Needs reply

**Toolbar / filters**

- Search: caller or number
- Recovery outcome: All | Needs attention | Replied | Waiting for consent | Suppressed | Failed
- Date: Today | Last 7 days | Last 30 days | All time
- Trigger: All | No answer | Busy | Rejected | Unreachable | Voicemail
- More filters panel: Consent mode (All | Press 1 | Existing permission); Reply status; Business line (when multi-line)
- Sort: Newest first | Oldest first
- Pagination

**Table columns**

- Caller (row link → detail)
- Missed (time)
- Trigger
- Recovery
- Reply
- Business line (desktop)
- Actions (call back, open conversation, more menu)

**Deep link:** `/mctb/missed-calls/[id]` — Missed Call Detail (below).

### 2a. Missed Call Detail — `/mctb/missed-calls/[id]`

**Header**

- Back: ← Missed Calls (preserves list query via `return` param when present)
- H1: caller name or phone + missed metadata
- Primary status badge + dominant action: Open conversation | Call customer | View consent | Fix setup (state-dependent)

**Sections**

1. **Recovery lifecycle** — ordered steps: Call → Consent (mode-specific) → Compliance text (Press-1) → Recovery text → Reply
2. **Call details** — time, trigger, business line, repeat caller stats
3. **Consent** — mode, evidence, link to consent record when applicable
4. **Text-back** — compliance + recovery message states/content (Press-1 vs existing permission)
5. **Voicemail** (when present) — transcript/summary snippet, link to voicemail
6. **Conversation** — thread summary, open conversation
7. **Call customer** (when allowed)
8. **Link activity** — tracked link clicks
9. **Request form** — submissions when form enabled
10. **Recovery timeline** (`<ol>` authoritative events)
11. **Diagnostics** (collapsed)

---

## 3. Conversations — `/mctb/conversations`

Uses shared **Kimi inbox** (`KimiConversationsConnected`) with `product=mctb` filter.

**Layout**

- **Conversation list** (left) — filters, search, status counts
- **Thread** (center) — messages, delivery states, MCTB context
- **Context panel** (optional) — contact / missed-call links

**Product filter bar** (MCTB route defaults to MCTB): All | Missed Call Text Back | Mass Texting | Manual | Automation | Unread

**Common inbox filters** (URL-driven): `filter=` all | mine | unassigned | needs_reply | unread | open | pending | archived; `status=`; `tag=`; `assigneeId=`; `conversation=` deep link; `draft=` prefill composer

**Thread**

- Header: identity, “Started from missed call”, View missed call when linked
- Historical SMS (compliance vs recovery bubbles where applicable)
- **Composer** — eligibility-gated send; opt-out blocked

**Related route:** `/conversations?product=mctb` (canonical shared inbox equivalent).

---

## 4. Voicemail — `/mctb/voicemail`

**Operational inbox** (`MctbVoicemailWorkspace`).

**Header:** Voicemail + link to **Voicemail settings** → `/mctb/setup/voicemail`

**Master pane — Voicemail inbox**

- Search: caller or transcript
- Inbox filter chips: All | Unread | Read
- Sort: Newest first | Oldest first
- Paginated list rows (select message)
- Empty: Test voicemail
- Utility rail: forwarding explanation, settings shortcuts

**Detail pane — Selected voicemail**

- Audio player (authoritative)
- **AI summary** (labeled derived)
- **Transcript** (+ English translation when present)
- **Internal notes**
- Actions: Call customer | Open conversation | View missed call | Mark reviewed (when supported) | Delete (confirm modal)

**Deep link:** `/mctb/voicemail/[id]`

### 4a. Voicemail setup — `/mctb/setup/voicemail`

(Reached from operational inbox or Setup local nav.)

- Greeting studio: Transovo TTS | ElevenLabs | Record | Upload; library of greetings; preview; activate
- Behavior: transcription, text-back after voicemail when supported

---

## 5. AI Lead Recovery — `/mctb/ai-lead-recovery`

**Header:** AI Lead Recovery — Test AI | Save changes

**Status strip:** Enabled/Disabled | Policies active | Overall health | Last saved

**Main**

1. **What should Transovo handle?** — scenario capability cards (toggle each):
   - Take a message
   - Booking
   - Emergencies
   - Pricing questions
   - Service-area questions
   - Payments
   - Existing-customer issues
   - General FAQs
2. **Per-scenario policy editors** (when scenario on):
   - Booking — modes: Send booking link | AI book | Notify business | Collect only | Do nothing
   - Emergencies
   - Take a message
   - Pricing questions
   - Payments (Text-to-Pay policy)
   - Service-area questions
   - Existing-customer issues
   - Questions & FAQs (knowledge readiness)
3. **When Transovo is unsure** — human handoff when uncertain (locked default)

**Right rail**

- Policy health list (enabled scenarios)
- **Connected services** panel (booking calendar, payments/Stripe, notifications)
- **Safety rules** (locked copy)

**Modal/drawer:** Test AI (`LeadRecoveryTestDrawer`)

---

## 6. Voice Agent — `/mctb/voice-agent`

**Header:** After-Hours Voice Agent (title can follow solution name) — status pill Draft | Active | Needs attention — **Test agent** button

**Call handling mode switch** — toggle inbound handling:
- Missed Call Text Back recovery flow
- After-Hours Voice Agent (confirm dialogs; uses `/api/mctb/inbound-handling`)

**Embedded wizard** (`AppointmentReceptionistWizard`, MCTB presentation) — steps (labels in UI):

| Step query | UI label |
|------------|----------|
| `?step=goals` | Purpose |
| `?step=phone` | Phone |
| `?step=information` | Business Knowledge |
| `?step=booking` | Booking |
| `?step=call-handling` | Call Handling |
| `?step=voice` | Voice |
| `?step=test` | Test |
| `?step=activate` | Activate |

Each step contains the full Voice V3 / appointment-receptionist configuration surfaces (capabilities, number source, knowledge sources, booking strategy, answer-when rules, voice selection, test call, publish/activate).

---

## 7. Analytics — `/mctb/analytics`

**Header:** Analytics — date range toggles: **7 days | 30 days | 90 days**

**KPIs** (with drilldown links)

- Missed calls
- Recovery texts
- Customers replied
- Reply rate

**Sections**

- **Recovery funnel** — Missed calls → Recovery texts → Customers replied → Reply rate
- **Charts:** Missed calls over time | Recovery texts over time | Replies over time
- **Delivery & engagement** — Delivery rate | Link clicks | Delivery failures | Opt-outs
- **Why some callers weren't texted** — suppression reason table (Reason | Count | %) with links to filtered missed calls
- **Voicemail** — count in range + Open voicemail

---

## 8. Setup — `/mctb/setup` and section routes

**Shell:** Horizontal section nav (`MCTB_SETUP_SECTIONS`) + **local sidebar** (`MctbSetupLocalNav`).

**Horizontal tabs (8):** Overview | Phone & Forwarding | Recovery | Consent | Voicemail | Notifications | Exclusions | Test

**Local sidebar links (11):** Overview | Phone & Forwarding | Missed-call rules | Text Back | Links & request form | Consent | Notifications & Handoff | Recovery controls | Voicemail | Exclusions | Test & diagnostics

**First-time wizard:** `/onboarding/mctb` (redirect from `/mctb/setup/start`)

### 8a. Setup Overview — `/mctb/setup`

- Global status rail: Active/Paused/Inactive, business line, text-back sender, forwarding, last test
- **Pause / resume** control (Recovery)
- Health strip: Needs attention vs Setup healthy; core systems ready count
- Attention rows with fix links
- **How recovery works** flow strip: Missed call → Forward → Consent → Text sent → Voicemail
- **Call flow** summary rows: Phone & Forwarding | Recovery | Consent | Text-back message | Voicemail
- **Operations** summary rows: Notifications | Exclusions | Test & diagnostics
- **Recent system activity** timeline (when events exist)
- **Quick actions:** Run live test | Forwarding instructions | Edit recovery message | Change consent method | Change voicemail greeting

### 8b. Phone & Forwarding — `/mctb/setup/phone`

- Business line (public number customers call)
- Forwarding destination (Transovo ingress)
- Text-back sender (link only, not configured here)
- Carrier selection
- Forwarding setup method (walkthrough vs instructions)
- Ring timing / no-answer delay (when shown)
- **Verification** — test call evidence, verified/pending/failed states
- Side rail: Connection summary

### 8c. Missed-call rules — `/mctb/setup/missed-call-rules`

- Trigger toggles: No answer | Busy | Rejected | Unreachable | Voicemail
- Paused notice when recovery paused
- Save; link to Recovery controls for cooldown/max sends

### 8d. Text Back — `/mctb/setup/text-back`

- Consent method summary + Change consent method
- **Recovery goal** cards: Get a reply | Request a callback | Collect details | Book an appointment
- Recovery opener preview (+ optional advanced custom opener when launch flag allows)
- **Delivery timing** — delay before send (seconds)
- Link to Links & request form for `{{link}}`

### 8e. Links & request form — `/mctb/setup/links`

- Default link URL (`{{link}}` in template)
- Request form enable + public URL copy
- Lead capture toggle
- Request form field list (presets per recovery goal)
- Public form route: `/f/mctb/:token`

### 8f. Consent — `/mctb/setup/consent`

- **Consent method:** Ask callers to press 1 | Use permission my business already has
- **Caller experience** preview (mode-specific)
- Press-1: voice disclosure editor/preview, publish, if caller does not press 1
- Existing permission: attestation checkbox (never prechecked)
- Evidence / compliance summary; link to Consent Log

### 8g. Notifications & Handoff — `/mctb/setup/notifications`

- **AI replies** / handoff configuration
- **Information to collect** (required fields before notify)
- **Emergency handling**
- **Team recipients** (email/SMS per recipient)
- **Notification events** (per-event email/SMS subscriptions)
- **Quiet hours** (start/end)
- **Test notifications**
- Right rail: summary, when a caller responds, related links

### 8h. Recovery controls — `/mctb/setup/recovery`

(Also absorbs legacy `/mctb/setup/business-hours`, `/follow-up`, `/schedule` redirects.)

- **Recovery status** — Active / Pause (presets, 24h, custom, indefinite) / Resume
- **Missed call outcomes** (trigger grid; overlaps missed-call rules in places)
- **Repeat caller** — cooldown duration presets + custom minutes; max automated recovery messages
- **AI Lead Recovery** promo blocks (when not hidden by launch flags)
- **Booking** section (when not hidden by launch flags)
- **Guardrails** / eligibility explanation
- **Why callers weren't texted** education block
- Modals: Pause recovery | Recovery delay
- Right rail: recovery summary / funnel checklist

### 8i. Voicemail (setup) — `/mctb/setup/voicemail`

- Greeting configuration (same studio patterns as spec 05)
- Transcription / behavior toggles

### 8j. Exclusions — `/mctb/setup/exclusions`

- Do-not-text list (add/remove numbers)
- How exclusions work
- Modals: Add exclusion | Remove confirmation

### 8k. Test & diagnostics — `/mctb/setup/test`

- **Production path test** callout
- **Setup test checkpoints** sequence: Call reached MCTB | Workspace resolved | Consent mode | Greeting | Press 1 (if press_1) | Consent recorded | Missed call event | SMS queued | Provider accepted
- **Live forward test** from business line: Call arrived | Missed classified | Consent completed | Recovery SMS sent | Delivered | Reply in inbox
- **After testing** guidance

### 8l. Guided onboarding wizard — `/onboarding/mctb`

**Progress steps:** Business line → Connect calls → Consent → Recovery → Voicemail → Review & test → Ready

**Step contents (high level)**

1. **Business line** — business name, trial/provisioning, number drawer
2. **Connect calls** — forwarding panel, carrier guides, verify/save & verify later
3. **Consent** — Press 1 vs existing permission cards, TFV/messaging activation panel
4. **Recovery** — recovery goal + opener (same section as Text Back setup)
5. **Voicemail** — voicemail setup section
6. **Review & test** — checklist summary, live test progress, finish setup
7. **Ready** — completion; optional Try It demo (when launch flag enabled)

---

## 9. Payments — `/payments`

(Shown in MCTB shell via `isMctbSharedWorkspacePath`.)

**Header:** Payments — Stripe connected chip — **Request payment**

**Banner** when Stripe not connected

**Summary:** Requested | Paid | Outstanding | Requests

**Toolbar:** Search | Status filter (All, Outstanding, Paid, Opened, Sent, Delivered, Failed, Expired, Cancelled, Refunded)

**Table:** Customer | Amount | Status | Sent | Description | Actions  
**Mobile:** card list

**Modals/drawers:** Create payment request | Payment request detail

**Related:** `/payments/transactions`, `/payments/invoices`, `/settings/payments`, `/integrations?provider=stripe`

---

## 10. Integrations — `/integrations`

(Shown in MCTB shell.)

**Top tabs:** Directory | Calendars | Payments | Connect apps | CRM | API | Webhooks | Developer logs

**Home (`IntegrationsHomeClient`):** connector directory, connection status, focus by `?provider=` (e.g. calendar, stripe, microsoft)

**Sub-routes (tab targets):** `/integrations/native`, `/integrations/crm`, `/integrations/api`, `/integrations/webhooks`, `/integrations/logs`, provider-specific connect flows

---

## 11. Calls (planned MCTB menu item) — `/voice/calls`

**List page**

**Title:** Calls — “Track and manage all calls handled by your AI receptionist.”

**Metrics row:** Answered | Leads | Appointments | Talk time (with vs last 7 days trends when API provides)

**Toolbar:** Search calls | Date range button (UI) | Export button

**Filter tabs:** All Calls | Leads | Appointments | Messages | Transfers | Voicemails | No Answer

**Table columns:** Caller | Call Date & Time | Duration | Outcome | AI Summary | row actions (recording icon, message, open detail)

**Data:** `/api/voice/calls` (`useDemo = false` on list page)

### 11a. Call detail — `/voice/calls/[id]`

**Breadcrumb:** AI Receptionist → Calls → Call from {name}

**Header:** Call from {name} — outcome badges — date/time/duration — actions: Transfer | Add Note | More menu

**Tabs:** Overview | Transcript

**Overview tab**

- Recording player (or processing/unavailable state)
- Callback requested card (when present)
- Outcomes list
- AI Summary
- Call Information fields (editable affordance in UI)
- Transcript preview (show details toggle)

**Transcript tab:** full segment list with speaker labels

**Sidebar**

- **Call Data:** Status, Date, Direction, Length, Cost, Provider, To, From
- **Activity Feed** (timeline; demo/mock segments may appear for some calls)

**Data:** `/api/voice/calls/[id]`

---

## Appendix A — Setup horizontal vs local nav mapping

| Local sidebar | Grouped under horizontal tab |
|---------------|------------------------------|
| Missed-call rules | Recovery |
| Text Back | Recovery |
| Links & request form | Recovery |
| Recovery controls | Recovery |
| All others | Same-name tab or Overview |

---

## Appendix B — Legacy redirects (still reachable)

| Legacy | Target |
|--------|--------|
| `/voice/missed-calls` | `/mctb/missed-calls` |
| `/voice/setup` | `/mctb/setup` |
| `/voice/analytics` | `/mctb/analytics` |
| `/mctb/setup/business-hours` | `/mctb/setup/recovery` |
| `/mctb/setup/follow-up` | `/mctb/setup/recovery` |
| `/mctb/setup/schedule` | `/mctb/setup/recovery` |

---

## Appendix C — Implementing “Calls” on the MCTB menu

Add a nav item in `src/lib/products/mctb-nav.ts` (e.g. label **Calls**, href `/voice/calls` or future `/mctb/calls` if you migrate the route). No code change is included in this inventory document.

---

# SECTION 4 — Rosie / Smith product surface audit

# Transovo vs Rosie vs Smith — Product Surface Inventory & Organization Audit

**Branch inspected:** `master` (code as of audit run)  
**Type:** Audit only — no UI, route, or navigation changes were made.

---

## A. Current Transovo Navigation

Navigation is **product-shell driven** (`src/lib/products/product-shell.ts`, `src/lib/products/resolve-product-nav.ts`). The product switcher selects among shells: `appointments`, `mctb`, `mass_sms`, `ai_after_hours`. URL path can override stored shell (`resolveEffectiveProductShell`).

### Canonical switcher (header + sidebar)

- **Component:** `CallHandlingSwitcher` (`src/components/call-handling/call-handling-switcher.tsx`)
- **Visibility:** `shouldShowCallHandlingSwitcher({ hasMctb, hasVoice })` — both entitlements required (`src/lib/call-handling/show-switcher.ts`)
- **API:** `GET/PATCH /api/call-handling` → `setActiveCallHandler` (`src/app/api/call-handling/route.ts`)
- **Also embeds same switcher:** `CallHandlingDashboardCard` on MCTB Overview only (`src/components/mctb/overview-view.tsx`) — same component, not a second mutation path
- **Legacy / parallel surfaces (not canonical ownership):** `/voice/inbound-routing` (rule builder UI), `GET /api/mctb/inbound-handling` (read in wizard phone step); ownership mutations should go through `/api/call-handling` per PR #483 architecture

### MCTB shell sidebar (`buildMctbV1Nav` — `src/lib/products/mctb-nav.ts`)

| Surface | Route | Label | Product | Purpose | Real/partial/dead | Where accessed |
|---------|-------|-------|---------|---------|-------------------|----------------|
| Overview | `/mctb` | Overview | MCTB | Operational snapshot | Real | MCTB sidebar |
| Missed Calls | `/mctb/missed-calls` | Missed Calls | MCTB | Missed-call events list | Real | MCTB sidebar |
| Missed call detail | `/mctb/missed-calls/[id]` | (detail) | MCTB | Single missed-call lifecycle | Real | List row link |
| Conversations | `/mctb/conversations` | **Conversations** | MCTB | SMS inbox (MCTB-filtered) | Real | MCTB sidebar |
| Voicemail | `/mctb/voicemail` | Voicemail | MCTB | Visual voicemail inbox | Real | MCTB sidebar |
| AI Lead Recovery | `/mctb/ai-lead-recovery` | AI Lead Recovery | MCTB | Lead recovery / AI replies config | Real (launch-trimmed UI on some branches) | MCTB sidebar |
| Voice Agent | `/mctb/voice-agent` | Voice Agent | MCTB | Appointment Receptionist Wizard (MCTB presentation) | Real | MCTB sidebar |
| Analytics | `/mctb/analytics` | Analytics | MCTB | MCTB metrics | Real | MCTB sidebar |
| Setup | `/mctb/setup` | Setup | MCTB | Configuration hub | Real | MCTB sidebar |
| Setup children | `/mctb/setup/*` | (section titles) | MCTB | Phone, rules, text-back, consent, recovery, voicemail, exclusions, test, notifications, links | Real / some legacy redirects | Setup overview + wizard |
| Payments | `/payments` | Payments | Shared | Payment requests (not MCTB-only) | Real | MCTB sidebar link |
| Integrations | `/integrations` | Integrations | Shared | Integration directory | Real | MCTB sidebar |
| Numbers | `/mctb/numbers` | — | MCTB | Redirects to shared numbers | Redirect | Legacy path |
| Onboarding | `/onboarding/mctb` | Setup | MCTB | First-time wizard entry | Real | Process nav |
| Compliance consent | `/mctb/compliance/consent` | Consent Log | MCTB | Audit | Real | Contextual / compliance |
| Calendar/appointments under `/mctb/*` | various | — | Cross-product | Appointments shortcuts | Partial / entitlement | Deep links, not primary MCTB IA |

**MCTB mobile bottom nav** (`buildMctbV1MobileNav`): Home, Missed, **Inbox** (href still `/mctb/conversations`), Setup — desktop label “Conversations” vs mobile “Inbox” is already inconsistent.

### AI After Hours shell (`buildAiAfterHoursNav` — `src/lib/products/ai-after-hours-nav.ts`)

| Surface | Route | Label | Purpose | Real/partial |
|---------|-------|-------|---------|--------------|
| Overview | `/voice/overview` | Overview | AI product home | Real |
| AI Agent | `/voice/agents/...` | AI Agent | Per-agent about/capabilities/integrations/advanced/voice-test | Real |
| **Calls** | `/voice/calls` | **Calls** | Voice call history | **Real list API**; demo rows when `demo-call*` IDs |
| Knowledge | `/voice/knowledge` | Knowledge | KB list / website crawl enqueue | Real |
| Call Handling | `/voice/inbound-routing` | Call Handling | Legacy inbound **rules** UI | Partial — not the canonical MCTB↔AI switcher |
| Numbers | `/voice/numbers` | Numbers | AI phone numbers | Real |

### Appointments V1 shell (`buildAppointmentsV1Nav` — `src/lib/products/appointments-nav.ts`)

- Primary scheduling surfaces (`/appointments/*`), optional **Inbox** at `APPOINTMENTS_INBOX_PATH` when `CONVERSATIONS_IN_V1_NAV` (`/conversations` family)
- Shared: Integrations, Settings, Analytics (flags in `v1-launch-nav.ts`)

### Legacy / full platform nav (`src/lib/nav.ts`)

Large tree still in repo: Campaigns, AI Voice (includes **Calls** + **voice/conversations**), Business Phone, Reports, etc. Used when **not** on a focused V1 shell (`buildMctbShellNav` fallback).

### Hidden / deprioritized (flags in `v1-launch-nav.ts`)

- `MISSED_CALL_TEXT_BACK_IN_V1_NAV = false` (MCTB reached via product shell, not top-level V1 list)
- `MASS_MESSAGING_IN_V1_NAV = false` — routes preserved
- `SMART_ROUTING_IN_V1_NAV`, `AI_RECEPTIONIST_IN_V1_NAV`, `COMPLIANCE_IN_V1_NAV`, `NUMBERS_IN_V1_NAV` — often false; routes exist

### **CALLS NAVIGATION GAP**

| Context | Is `/voice/calls` in primary nav? |
|---------|-----------------------------------|
| **MCTB product shell** | **No** — `buildMctbV1Nav` has no Calls entry |
| **AI After Hours shell** | **Yes** — “Calls” |
| **Legacy AI Voice nav** | **Yes** — under Activity |
| **Global `mobilePrimaryNav`** | **Yes** — `/voice/calls` (legacy mobile strip) |

**Conclusion:** For customers living in the **MCTB shell**, voice call history is implemented (`/voice/calls`, `/voice/calls/[id]`) but **not surfaced in MCTB sidebar**. Deep links from notifications, outcomes, and tooling still target `/voice/calls`. This is an **organization gap**, not a missing implementation.

---

## B. Existing Appointment Receptionist Wizard

**Entry points:** `/mctb/voice-agent` (MCTB presentation), legacy `/voice/setup` / solutions flows, `AppointmentReceptionistWizard` (`src/components/solutions/appointment-receptionist/wizard.tsx`).

**MCTB step labels** (`src/lib/mctb/voice-agent/wizard-steps.ts`):

| Step | MCTB label | UI module | Persisted / API | Runtime consumer | Production | Notes |
|------|------------|-----------|-----------------|------------------|------------|-------|
| Purpose | Purpose | `goals-step.tsx` | Wizard state → `POST/GET /api/solutions/appointment-receptionist` | Voice agent compile, capabilities, answer-when | Real | Maps Rosie “agent profile / operating mode” — **ALREADY COVERED BY WIZARD** |
| Phone | Phone | `phone-step.tsx` | `phoneNumberId`, forwarding; reads `GET /api/mctb/inbound-handling` | Telnyx routing, trigger deployments on activate | Real | Number assignment — not separate Numbers settings page for agent |
| Business Knowledge | Business Knowledge | `information-step.tsx` | `knowledgeItems`, business fields, schedule; Company Brain hydrate | `loadBusinessBrain`, voice knowledge bases (`/api/voice/knowledge`), approved facts | Real / partial crawl | Website URL + docs + guided profile — overlaps Rosie train/FAQs/custom training |
| Booking | Booking | `appointments-step.tsx` | Calendar connection, booking strategy (MS/Calendly/link/request), appointment types | Voice V3 booking tools, calendar adapters | Real | Rosie Appointments / text-a-link — **ALREADY COVERED BY WIZARD** |
| Call Handling | Call Handling | `call-handling-step.tsx` | Transfers, urgency, callbacks, after-hours behavior, on-call, spam editors | Voice runtime policies, transfer tools, notifications | Real | Rosie transfer/take-message/spam — **ALREADY COVERED BY WIZARD** (not global PR #483 switcher) |
| Voice | Voice | `voice-step.tsx` | Voice provider, greeting modes, ElevenLabs/TTS | Telnyx assistant / Voice V3 publish | Real | Rosie greeting/agent voice — **ALREADY COVERED BY WIZARD** |
| Test | Test | `test-step.tsx` | Test scenarios | Voice test / simulation | Real | Rosie test call — **ALREADY COVERED BY WIZARD** |
| Activate | Activate | `activate-step.tsx` | Publish, trigger deployments, optional inbound mode sync | `activateFlowTriggers`, Telnyx publish proof | Real | Rosie launch — **ALREADY COVERED BY WIZARD** |

**Protected constraint:** Do **not** split these into Rosie-style Agent Settings sections; wizard remains the canonical receptionist configuration surface.

---

## C. Rosie Comparison Matrix (capability-level)

| Rosie capability | Transovo equivalent | Where | Status | Notes |
|------------------|---------------------|-------|--------|-------|
| Quick Start — Train | Business Knowledge step + Company Brain | Wizard | EXISTS — WIZARD | Manual + KB items |
| Google Business Profile | — | — | MISSING / FUTURE | No GBP ingest in code (marketing copy only) |
| Website train | Website knowledge source + `voice_website_crawl` job | Wizard + `/voice/knowledge` API | PARTIAL | Crawl job exists; not full Rosie quick-start |
| Customize agent | Purpose + Voice steps | Wizard | EXISTS — WIZARD | |
| Test / Launch | Test + Activate | Wizard | EXISTS — WIZARD | |
| Conversations — calls | Voice Calls list/detail | `/voice/calls` | EXISTS — VOICE | Not in MCTB nav |
| Conversations — SMS | MCTB Conversations / shared Inbox | `/mctb/conversations`, `/conversations` | EXISTS — MCTB | SMS threads, not PSTN history |
| Website chat | — | — | NOT APPLICABLE / FUTURE | |
| Unified cross-channel inbox | Separate Inbox vs Calls | — | NOT APPLICABLE (by design) | Do not merge for Rosie parity |
| Agent Settings — Business Information | Business Knowledge + Company Brain | Wizard + `/api/company-brain` | EXISTS — WIZARD / SHARED | |
| Agent Profile | Purpose step | Wizard | EXISTS — WIZARD | |
| Greeting | Voice step | Wizard | EXISTS — WIZARD | |
| FAQs | Knowledge + LR approved info | Wizard + MCTB AI Lead Recovery | EXISTS — WIZARD / MCTB | |
| Take a Message | Call Handling + runtime tools | Wizard + voice tools | EXISTS — WIZARD / VOICE | |
| Spam Filters | `spam-unwanted-calls-editor` | Wizard Call Handling | EXISTS — WIZARD | |
| Appointments | Booking step | Wizard | EXISTS — WIZARD | |
| Text a Link | Booking link / SEND_LINK strategy | Wizard + MCTB text-back links | EXISTS — WIZARD / MCTB | |
| Transfer Calls | Call Handling transfer editors | Wizard | EXISTS — WIZARD | |
| Custom Training | Knowledge upload/website | Wizard + voice KB | PARTIAL | |
| Launch Instructions | Activate + forwarding docs | Wizard + MCTB setup phone | EXISTS — WIZARD / MCTB | |
| Website Widgets | — | — | FUTURE / NOT APPLICABLE | |
| Integrations — Calendar | Integrations + wizard booking | `/integrations/calendars` + Wizard | EXISTS — SHARED / WIZARD | |
| Integrations — CRM/Zapier | Integrations hub | `/integrations/*` | PARTIAL | Breadth in nav; depth varies |
| Account — Team/Roles/Billing | Settings + account nav | `/settings/*`, Stripe | EXISTS — SHARED | |

---

## D. Smith Comparison Matrix

| Smith capability | Transovo equivalent | Where | Status | Notes |
|------------------|---------------------|-------|--------|-------|
| Call history + filters | Voice Calls list | `/voice/calls` + `GET /api/voice/calls` | EXISTS — VOICE | Real `voiceCall` rows |
| Call quota / export | Usage/billing, partial export UI on calls page | `/voice/calls`, reports | PARTIAL | |
| Call detail — caller | Call detail header, contact | `/voice/calls/[id]` | EXISTS — VOICE | Real |
| Recording | `voiceRecording` + player | Detail API + page | EXISTS — VOICE | Real when present |
| Transcript | `loadTranscriptsWithSegmentsForCall` | Detail API | EXISTS — VOICE | Real segments |
| Summary | `voiceConversationInsight` | Detail API | PARTIAL | Shown when generated |
| Call decisions / actions | `customer-activity-feed.ts` from events + tool executions + transfers | Detail page | PARTIAL | Truthful when data exists; not full Smith disposition model |
| Follow-up / callback | Callback requests linked to call | Detail API `callbackRequest` | PARTIAL | |
| Transfer / voicemail / block | Transfers table, voicemail flags, suppression elsewhere | Voice runtime + detail | PARTIAL | |
| Call Handling — number / transfer lines | Wizard Call Handling + canonical switcher | Wizard + sidebar switcher | EXISTS — WIZARD / SHARED | |
| Blocked numbers | MCTB exclusions + voice spam config | `/mctb/setup/exclusions`, wizard | PARTIAL | Split across products |
| Voicemail | MCTB voicemail + voice voicemail paths | `/mctb/voicemail` | EXISTS — MCTB / VOICE | |
| Instructions / receptionist rules | Wizard Call Handling + compiled agent | Wizard | EXISTS — WIZARD | |
| Integrations | `/integrations` | Shared | PARTIAL | |
| Settings / billing / users | Settings, memberships | `/settings/*` | EXISTS — SHARED | |

---

## E. MCTB Surface Audit

**Operational (daily):** Overview, Missed Calls, Conversations (SMS inbox), Voicemail, Analytics.

**Configuration:** Setup sections (phone, missed-call rules, text-back, consent, recovery, voicemail, exclusions, notifications, links, test).

**Cross-product on MCTB nav:** Voice Agent wizard, AI Lead Recovery, Payments, Integrations (shared routes).

**Not MCTB-native:** `/voice/calls` (voice product), canonical Call Handling switcher (shared ownership when both products entitled).

**Redundant / legacy:** `/mctb/setup/business-hours`, `follow-up` (redirect to recovery per specs); `/voice/*` legacy mirrors during migration.

**Launch-only / hidden:** Mass SMS nav; Smart Routing; some compliance/numbers flags off in `v1-launch-nav.ts`.

**Keep separate from Voice:** MCTB recovery pipeline (missed call → SMS), consent, text-back sender, lead recovery — do not collapse into receptionist Calls UI.

---

## F. Inbox vs Calls

### `/mctb/conversations` (label: Conversations)

- **Implementation:** Server page loads `loadConversations` with `product: "mctb"` (`src/app/(app)/mctb/conversations/page.tsx`, `inboxFiltersFromUrlParams`).
- **Data model:** `conversation` rows filtered by `productSource = mctb` (`buildConversationWhere` in `inbox-filters.ts`).
- **Content:** SMS/MMS threads — inbound/outbound messages, missed-call-linked conversations (`missedCallEvent` join), lead recovery replies, human handoff threads. **Not** `voiceCall` records.
- **Shared engine:** `KimiConversationsConnected` — same as `/conversations` with different product filter.

### `/voice/calls` (label: Calls)

- **Implementation:** Client fetches `GET /api/voice/calls`; detail `GET /api/voice/calls/[id]`.
- **Data model:** `voiceCall`, recordings, transcripts, insights, `voiceCallEvent`, `voiceToolExecution`, transfers.

**RENAME CANDIDATE:** MCTB sidebar label **Conversations → Inbox** (mobile nav already says Inbox). Route can remain `/mctb/conversations` until a dedicated rename pass.

**Do not** unify with Voice Calls into one Rosie-style conversation hub.

---

## G. Call Detail Comparison

| Capability | Transovo today | Rosie | Smith |
|------------|----------------|-------|-------|
| Caller identity | Real contact / E.164 | ✓ | ✓ |
| Summary | Insight when present; pipeline state when missing | ✓ | ✓ |
| Transcript | Real segments or empty state | ✓ | ✓ |
| Recording | Real audio when `voiceRecording` exists | ✓ | ✓ |
| Outcome badges | `deriveOutcomeBadges` from call fields | ✓ | partial |
| Appointment booked | From call flags + tool timeline | ✓ | partial |
| Actions / timeline | `buildCustomerActivityFeed` — events, tools, transfers | ✓ actions | ✓ decisions |
| Copy summary | Not audited as dedicated control | ✓ | — |
| Provider / cost | `formatTelephonyProviderLabel`, `formatCallCostCents`; unavailable when absent | — | metadata |
| Demo data | Only `demo-call*` IDs use `MOCK_*` | — | — |

---

## H. Shared Surfaces

| Surface | Route | Status | Notes |
|---------|-------|--------|-------|
| Integrations | `/integrations` (+ children) | Real | Calendars, CRM, webhooks, native apps |
| Numbers | `/numbers`, `/voice/numbers` | Real | Multiple nav homes by shell |
| Billing | Settings / voice billing / Stripe | Real | Entitlements drive shells |
| Team/users | `/settings` membership | Real | |
| Company Brain | `/api/company-brain`, wizard hydrate | Real | Workspace business facts |
| Analytics | Product-specific (`/mctb/analytics`, `/voice/analytics`, appointments) | Real | Not one global Rosie dashboard |
| Compliance | `/compliance` | Real | Often nav-gated off |
| Payments | `/payments` | Real | Shared PaymentRequest service |

---

## I. Missing / Partial / Buried

**Missing / future**

- Google Business Profile ingestion for training
- Unified cross-channel inbox (intentionally not pursued)
- Website widget / web chat (Rosie)
- GBP-powered quick start

**Partial**

- Website crawl → approved knowledge (job + API exist; end-to-end “Rosie train” UX incomplete)
- Call detail execution timeline (depends on telemetry density per call)
- Smith-style disposition taxonomy on list view
- MCTB **Calls** surfacing when user stays in MCTB shell

**Buried**

- `/voice/calls` under MCTB-primary UX
- Legacy `/voice/inbound-routing` vs canonical switcher
- Full platform nav (`nav.ts`) vs focused shells
- Mass SMS / campaigns (hidden, routes live)

---

## J. Duplication / Fragmentation

| Concept | Locations | Risk |
|---------|-----------|------|
| Call Handling ownership | Sidebar `CallHandlingSwitcher` → `/api/call-handling` | **Canonical** |
| Call Handling (rules) | `/voice/inbound-routing` | Legacy; different purpose |
| Inbox label | MCTB desktop “Conversations” vs mobile “Inbox” vs Appointments “Inbox” | Terminology |
| Conversations | `/conversations`, `/mctb/conversations`, `/voice/conversations` | Three routes; different filters/products |
| Receptionist config | MCTB Voice Agent wizard vs `/voice/agents/*` editors | Same backend, two presentations for AI After Hours shell |
| Numbers | `/numbers`, `/voice/numbers`, `/mctb/numbers` redirect | IA duplication |

---

## K. Proposed Navigation Organization (proposal only)

**Model 1 — Preserve two products + shared spine (recommended alignment with current architecture)**

| Area | Proposal |
|------|----------|
| Product switcher | Appointments \| MCTB \| AI After Hours \| (SMS hidden) |
| MCTB sidebar | Overview, Missed Calls, **Inbox** (rename), Voicemail, AI Lead Recovery, Analytics, Setup; Voice Agent under MCTB or cross-link |
| Voice (AI After Hours) sidebar | Overview, AI Agent (wizard entry or agent hub), **Calls**, Knowledge |
| Call Handling | **Only** global switcher (when both entitled) — no per-page clones |
| Integrations / Billing / Settings | Shared footer/account nav |
| Hidden | Mass SMS, legacy voice mega-nav, smart routing (until entitled) |

**Model 2 — Minimal change**

- Rename MCTB Conversations → Inbox (label only).
- Add **Calls** to MCTB shell as deep link to `/voice/calls` (or switcher context) without merging inboxes.

---

## L. Recommended Rename Candidates

| Current | Candidate | Rationale |
|---------|-----------|-----------|
| MCTB nav “Conversations” | **Inbox** | SMS/missed-call recovery; mobile already uses Inbox |
| (optional) `/mctb/conversations` URL | `/mctb/inbox` | Future route alias — **not in this audit** |

---

## M. Future / Not V1

- Unified Rosie-style omnichannel conversation hub
- GBP quick-start training
- Website chat widget
- Splitting wizard into Rosie-style 12 settings pages
- PLATFORM/CUSTOMER sender mode (separate initiative)
- Merging MCTB and Voice operational inboxes

---

## N. Files Reviewed

- `src/lib/products/mctb-nav.ts`, `resolve-product-nav.ts`, `product-shell.ts`, `ai-after-hours-nav.ts`, `appointments-nav.ts`, `v1-launch-nav.ts`, `voice-nav.ts`
- `src/lib/nav.ts`, `src/components/layout/sidebar.tsx`, `src/components/layout/header.tsx`
- `src/components/call-handling/call-handling-switcher.tsx`, `src/lib/call-handling/show-switcher.ts`
- `src/app/(app)/mctb/conversations/page.tsx`, `src/lib/mass-texting/inbox-filters.ts`, `src/lib/workspace-data.ts`
- `src/app/(app)/voice/calls/page.tsx`, `src/app/(app)/voice/calls/[id]/page.tsx`
- `src/app/api/voice/calls/route.ts`, `src/app/api/voice/calls/[id]/route.ts`
- `src/lib/voice/calls/customer-activity-feed.ts`, `mock-data.ts`
- `src/components/solutions/appointment-receptionist/wizard.tsx`, `wizard-steps.ts`, step components
- `src/lib/mctb/routes.ts`, `src/lib/mctb/voice-agent/wizard-steps.ts`
- `src/lib/agents/appointment-booking/business-brain.ts`, `src/lib/voice-v3/knowledge/website-crawl/run-crawl-job.ts`
- `src/app/api/voice/knowledge/route.ts`, `src/lib/mctb/approved-business-information.ts`

---

## O. Tests / Verification

No product tests were required for this audit. Spot-check: grep/read only; no test suite run.

---

## P. Implementation Decision

**AUDIT ONLY — NO UI OR ROUTE CHANGES MADE**
