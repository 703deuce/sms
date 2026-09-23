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
