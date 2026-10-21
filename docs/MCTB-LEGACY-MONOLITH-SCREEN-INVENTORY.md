# Missed Call Text Back — Legacy monolith screen inventory (`src/app`)

**Purpose:** Copy-friendly list of every MCTB customer route in the **legacy monolith** (`src/`, not `new-app`) and what appears on each screen when **Stage 2 UI is off** (`isNewUiStage2Enabled() === false`).

**UI source:** `src/components/mctb/*` (+ shared shells such as `src/components/inbox/kimi-conversations-connected.tsx`).

**Route index (no per-control detail):** `docs/MCTB-UI-ROUTE-AND-SURFACE-INVENTORY.md`

**Generated from code audit:** October 2026

---

## How legacy vs Stage 2 works

- Same URLs under `src/app/(app)/mctb/*`.
- **Legacy:** components in `src/components/mctb/**`.
- **Stage 2:** `src/newui-transplant/connected/mctb/**` (not documented here).
- Several launch shortcuts **redirect** in legacy mode (see [Redirect-only routes](#redirect-only-routes-legacy)).

---

## Shared chrome (many MCTB pages)

### Product layout (`src/app/(app)/mctb/layout.tsx`)

- Legacy: injects `MctbLegacyShellStyles` only (no first-run wizard host).
- Stage 2: adds `MctbFirstRunWizardHost` (legacy onboarding host is separate at `/onboarding/mctb`).

### Setup workspace shell (`MctbSetupShell`)

Used on Setup overview and several full-width setup editors.

- Page title (usually **Setup** or section-specific).
- Optional description, header icon, header actions (Save, save meta).
- **Horizontal section nav** (`MctbSetupSectionNav`) — 11 tabs from `MCTB_SETUP_SECTIONS`:
  1. Overview  
  2. Phone & Forwarding  
  3. Missed-call rules  
  4. Consent  
  5. Text Back  
  6. Recovery  
  7. Voicemail  
  8. Notifications  
  9. Exclusions  
  10. Links  
  11. Test  

### Setup section layout (`MctbSetupSectionLayout`)

Used on smaller setup sections.

- Section **title** + **description**.
- **Save changes** (with saving / saved / error states) unless `showSave={false}`.
- Optional paused banner (`MctbPausedNotice`).

### Pause control (`MctbSetupPauseControl`)

- Appears on Setup overview status rail and inside Recovery setup.
- Resume / pause recovery (manual, timed presets, custom) — shared with operational pause semantics.

### Number drawer (`mctb-number-drawer-host`)

Opened from Phone & Forwarding (manage / add / verify sender) — drawer flows for MCTB numbers, not a separate route.

---

## Operational pages

### `/mctb` — Overview

**Component:** `overview-view.tsx` + `home/mctb-home-sections.tsx`

| Region | Contents |
|--------|----------|
| Header | H1 **Overview**; status chip (**Active**, **Paused**, **Needs attention**, **Setup incomplete**); subtitle; primary CTA (**Finish setup**, **Resume now**, **Fix messaging**, or **Manage setup** when shown) |
| Setup banner | Shown when setup incomplete — link **Continue setup** → `/mctb/setup/start` (redirects to `/mctb` in legacy) |
| Call handling card | `CallHandlingDashboardCard` — only when **not** compact overview flag |
| KPI strip | **Missed calls**, **Recovery texts sent**, **Customer replies**, **Needs reply** (with window label, e.g. Today); metrics may link to filtered lists |
| AI Recovery summary | Card: status, **Manage** → `/mctb/ai-recovery`, optional **Fix issue** |
| Needs attention | List of attention rows (title, subtitle, link) or “all clear” strip |
| Recent activity | Timeline-style activity + links to **Setup**, **Test** |
| Setup status | Rows: **Business line**, **Forwarding**, **Consent**, **Text-back sender**, **Recovery**, **Call recovery** — each links to relevant setup section |
| Recent missed calls | Table: caller, recovery, reply; **View all** → `/mctb/missed-calls` |
| Recent conversations | List with preview; **Open conversations** → `/mctb/conversations` |

**Layout note:** `MCTB_LAUNCH_COMPACT_OVERVIEW` changes column order (attention + activity vs full-width missed calls + conversations/setup pair).

---

### `/mctb/missed-calls` — Missed Calls list

**Component:** `missed-calls-view.tsx`

| Region | Contents |
|--------|----------|
| Header | H1 **Missed Calls**; link **Manage setup** → `/mctb/setup` |
| Summary metrics | **Missed calls**, **Recovery texts**, **Replies**, **Needs reply** (for selected date range) |
| Controls | **Search** (caller or number); **Recovery outcome** filter (All, Needs attention, Replied, Waiting for consent, Suppressed, Failed); **Date** (Today, 7d, 30d, All time); **Trigger** (No answer, Busy, Rejected, Unreachable, Voicemail); **Sort** (Newest/Oldest); **Clear filters**; mobile filter sheet |
| Table columns | **Caller** (row link to detail), **Missed**, **Trigger**, **Recovery**, **Reply**, **Business line** (md+), **Actions** |
| Row menu | **Open details**, **Call back**, **Open conversation** (if thread exists), copy number |
| Pagination | Page controls when multiple pages |
| Empty / loading | Skeleton rows; empty state with setup CTA |

**URL params:** `q`, `status`, `date`, `trigger`, `consentMode`, `page`, `pageSize`, `sort`, legacy `recovery`.

---

### `/mctb/missed-calls/[id]` — Missed Call detail

**Component:** `missed-call-detail-view.tsx`

| Region | Contents |
|--------|----------|
| Nav | **← Missed Calls** (preserves list filters via `return` query) |
| Header | Caller name/phone; missed timestamp; business line called; **status badge**; primary action **Open conversation** or **Call customer** |
| Recovery lifecycle | Ordered steps: **Call**, **Consent**, **Compliance text** (press-1), **Recovery text**, **Reply** — with values |
| Call details | Caller, phone, missed time, trigger, business line, duration (as available) |
| Consent | Mode, captured state, timestamps, link to consent settings |
| Text-back | Compliance + recovery message states/content (separate when press-1) |
| Voicemail | Shown when voicemail attached — audio/transcript summary |
| Conversation | Thread summary + **Open conversation** |
| Call customer | `BusinessCallBackButton` when applicable |
| Link activity | Tracked link clicks when present |
| Request form | Submission summary when present |
| Diagnostics | Collapsed `<details>` — timeline steps / technical fields (no secrets) |

---

### `/mctb/conversations` — Conversations (MCTB-filtered inbox)

**Component:** `KimiConversationsConnected` with `mctbInboxContext` + server `product=mctb`

| Region | Contents |
|--------|----------|
| Layout | Shared Kimi **split inbox**: conversation list \| thread \| optional context |
| List | MCTB-scoped threads; filters from URL (`filter`, search, assignment, etc. per inbox) |
| Thread | Historical SMS; delivery states; opt-out/system events |
| Composer | Eligibility-gated send; blocked when platform sender disallows manual reply (`MCTB_PLATFORM_SENDER_MANUAL_REPLY_MESSAGE`) |
| Deep link | `?conversation=<id>`, `?product=mctb`, `?draft=`, contact params |

*Full inbox control inventory lives in Mass Texting / Inbox glue docs — this route reuses that shell.*

---

### `/mctb/voicemail` — Voicemail inbox

**Component:** `voicemail/mctb-voicemail-workspace.tsx`

| Region | Contents |
|--------|----------|
| Header | H1 **Voicemail**; **Voicemail settings** → setup; **Managing number** selector |
| Metrics | **Total voicemails**, **Unread**, **Minutes**, **Transcription** rate |
| List controls | Search; inbox chips (e.g. all/unread); sort |
| Master-detail | Row: unread dot, caller, time, duration; detail pane below |
| Detail | Audio player (speed control); **AI summary**; **Transcript** (+ English translation if any); **Internal notes**; actions: call, conversation, missed call, mark reviewed, delete confirm |
| Settings drawer | **Voicemail enabled**, **Auto-transcription**, **Email/SMS alerts**, alert destinations, greeting summary, link to greeting studio |
| Greeting studio modal | TTS/generate, library of greetings, preview, activate |

---

### `/mctb/analytics` — Analytics

**Component:** `analytics/mctb-analytics-view.tsx`

| Region | Contents |
|--------|----------|
| Header | H1 **Analytics**; date range toggles **7 days / 30 days / 90 days** |
| KPI cards | **Missed calls**, **Recovery texts sent**, **Customers replied**, **Reply rate** (with drilldown links) |
| Recovery funnel | Missed → Eligible → Recovery texts sent → Customer replies (counts + rates) |
| Charts | **Missed calls over time**, **Recovery texts over time**, **Replies over time** |
| Outcomes & delivery | Delivery failures, booking links sent, callback requests, AI-assisted conversations, tracking link clicks, opt-outs |
| Definitions | Eligible, recovery texts sent, customer replies, reply rate |
| Suppression table | **Why some callers weren't texted** — reason, count, %, links to missed calls |
| Voicemail panel | Count in range; **Open voicemail** |

---

### `/mctb/ai-recovery` — AI Recovery settings

**Component:** `ai-recovery/ai-recovery-settings-page.tsx`

| Region | Contents |
|--------|----------|
| Header | **AI Recovery**; **Save changes**; saved indicator |
| Alerts | Messaging not ready banner → setup phone |
| Master toggle | **AI Recovery** on/off |
| Sender note | Sender label; links to **Inbox** and **Missed Calls** |
| Business information | Name, services, service area, hours; **Edit business information** → settings |
| Information to collect | Toggle rows per simplified field (name, phone, email, etc. — from `AI_RECOVERY_SIMPLIFIED_FIELDS`) |
| Booking link | Optional **Enable booking link**; select existing booking link or enter URL |

**Deprecated alias:** `/mctb/ai-lead-recovery` → same page.

---

## Setup pages (`/mctb/setup/*`)

### `/mctb/setup` — Setup overview

**Component:** `setup/setup-overview-view.tsx`

| Region | Contents |
|--------|----------|
| Status rail | **Recovery** Active/Paused/Inactive; **Business line**; **Text-back sender**; **Forwarding** Verified/Pending; **Recovery texts this month** (used/limit); **Last test**; **Pause control** |
| Health strip | **Needs attention** or **Setup healthy**; “X of Y core systems ready” |
| Attention list | Issue messages with fix links; **View N issues** |
| Flow strip | Visual setup stages (hidden when compact setup home flag) |
| **Call flow** summary rows | **Phone & Forwarding**, **Consent**, **Text Back**, **Recovery**, **Voicemail** — each: summary, status, link |
| **Operations** summary rows | **Notifications**, **Exclusions**, **Links**, **Test** |
| Recent system activity | Timeline (optional) |
| Quick actions | **Run live test**, **Forwarding instructions**, **Edit recovery message**, **Change consent method**, **Change voicemail greeting** |

---

### `/mctb/setup/phone` — Phone & Forwarding

**Component:** `setup/setup-phone-forwarding-view.tsx`

| Region | Contents |
|--------|----------|
| Header | **Phone & Forwarding**; Save |
| Status strip | Business line, **Forwarding to**, **Carrier**, **Connection** state |
| Business line | E.164 input; Verified / Not verified chip |
| Forwarding destination | Ingress number; voice/messaging chips; **Manage number** / switch active MCTB number |
| Carrier | Provider grid (from forwarding guides dataset) |
| Forwarding setup | **Walk me through it** / **Show instructions**; carrier-specific codes |
| Ring before forwarding | Preset seconds + custom seconds input |
| Verification | States: verified, testing, failed, ready to test; **I've turned it on** / retry; evidence from server |
| Aside rail | **Connection summary**, troubleshooting links, link to **Test** |
| Paused notice | When recovery paused |

---

### `/mctb/setup/missed-call-rules`

**Component:** `setup/setup-missed-call-rules-view.tsx`

| Region | Contents |
|--------|----------|
| Title | **Missed-call rules** + description |
| Trigger cards | Toggles: **No answer**, **Busy**, **Rejected**, **Unreachable**, **Voicemail** (each with helper text) |
| Validation | Error if zero triggers selected |
| Footer note | Link to **Recovery controls** for cooldown |

---

### `/mctb/setup/consent`

**Component:** `setup/setup-consent-view.tsx`

| Region | Contents |
|--------|----------|
| Header | **Consent**; Save |
| Status strip | **Status**, **Method**, **Text-back sender**, **Evidence** |
| Consent method | Cards: **Ask callers to press 1** (recommended badges); **Use permission my business already has** (disabled if not eligible) |
| Caller experience | Step flow diagram (mode-dependent) |
| Press-1 only | **Voice disclosure** preview; preview audio button |
| Existing consent | Attestation checkbox (not pre-checked); legal copy |
| If caller does not press 1 | Outcome explanation |
| Evidence & audit | Link to **Consent history** |
| Sidebar | Preview / compliance notes; link to **Text Back** |

---

### `/mctb/setup/text-back`

**Component:** `setup/setup-text-back-view.tsx`

| Region | Contents |
|--------|----------|
| Title | **Text Back** |
| Consent context | Current method + **Change consent method** |
| Recovery goal | Cards: **Get a reply**, **Request a callback**, **Collect details**, **Book an appointment** (`MctbRecoveryGoalCards`) |
| Opener preview | Message preview; sender presentation title; locked copy note when not editable |
| Advanced | **Customize opener** textarea (flag-gated) |
| Delivery timing | **Delay before sending (seconds)**; link to **Links & request form** for `{{link}}` |

---

### `/mctb/setup/recovery`

**Component:** `setup/setup-recovery-view.tsx`

| Region | Contents |
|--------|----------|
| Header | **Recovery**; Save |
| Warnings | Forwarding not verified banner |
| Command bar | Paused/active; **Resume** / pause actions; **Qualifying** triggers summary; **Cooldown**; **Last recovery** |
| Recovery status module | Active/paused with pause/resume buttons |
| Missed call outcomes | Same trigger toggles as missed-call rules (recovery page copy) |
| Repeat caller protection | Cooldown duration segments (off / presets / custom minutes); mini flow diagram |
| AI Recovery promo | Link to `/mctb/ai-recovery` |
| AI booking section | `MctbSetupBookingSection` — booking links for AI (when not hidden by launch flag) |
| Safeguards | Max automated messages / guards (as implemented) |
| Diagnostics | **Why callers weren't texted** reason codes (read-only insight) |

---

### `/mctb/setup/voicemail`

**Component:** `setup/setup-voicemail-editor-view.tsx` + `voicemail-setup-section.tsx`

| Region | Contents |
|--------|----------|
| Title | **Voicemail** (no save bar — inline saves in section) |
| Link | **Open voicemail inbox** |
| Greeting | **Voicemail greeting** — sources: **Transovo voice**, **Record yourself**, **Upload audio** |
| Build & preview | Record/upload/generate; activate for future calls |

---

### `/mctb/setup/notifications`

**Component:** `setup/setup-notifications-view.tsx`

| Region | Contents |
|--------|----------|
| Header | **Notifications**; Save |
| Status strip | **Alerts**, **Primary email**, **SMS alerts**, **AI replies** |
| AI replies | Toggle; **Information to collect** per-field requirement selects |
| Emergency handling | **Emergency detection** toggle; keyword textarea; escalation phone/message fields |
| Team recipients | Rows: enable, **Name**, **Role**, **Email**, **Mobile**; per-recipient event channel toggles |
| Notification events table | Events: Missed call detected, Customer replied, Lead captured, Callback requested, Urgent situation detected, Human required, Appointment booked, Voicemail received, Recovery failure — columns Email / SMS / In-app |
| Quiet hours | Enable; start/end time; timezone note |
| Response mode | AI vs human routing labels (`RESPONSE_MODE_LABELS`) |

---

### `/mctb/setup/exclusions`

**Component:** `setup/setup-exclusions-view.tsx`

| Region | Contents |
|--------|----------|
| Header | **Exclusions**; **Add exclusion** |
| Summary strip | Total exclusions, Added here, Personal blocks, Recently added |
| Toolbar | Search; filters **Reason**, **Source**, **All types**; sort Newest/Oldest/Phone A–Z |
| Table | Caller, Phone, Reason, Source, Added; row actions (remove, copy, etc.) |
| Add/edit modal | Phone, reason, notes |

---

### `/mctb/setup/links`

**Component:** `setup/setup-links-view.tsx`

| Region | Contents |
|--------|----------|
| Title | **Links & request form** |
| Cross-links | AI Recovery booking vs this page scope |
| Default link URL | Input for `{{link}}` when form off |
| Request form presets | Buttons per recovery goal to apply field presets |
| Toggles | **Enable public request form**; **Lead capture** (requires form) |
| Form fields | Read-only list of field label, type, required |
| Public URL | Copy link, **Preview form** |
| Resolved preview | Shows URL used for `{{link}}` |

---

### `/mctb/setup/test`

**Component:** `setup/setup-test-view.tsx` (+ embedded try-it patterns)

| Region | Contents |
|--------|----------|
| Title | **Test & diagnostics** |
| Production path test | Checklist: Call reached MCTB number, Workspace resolved, Consent mode loaded, Greeting played, Press 1 received (if press-1), Consent recorded, Missed call event created, Recovery SMS queued, SMS accepted by provider |
| Forwarded business line test | Instructions; live forward test checklist: call detected, missed call, consent, SMS sent, delivered, reply in inbox |
| After testing | Links to operational pages |

**Legacy `/voice/try-it`** redirects here.

---

## Compliance & process

### `/mctb/compliance/consent` — Consent history

**Component:** `consent-log-view.tsx`

| Region | Contents |
|--------|----------|
| Nav | **← Setup**; **Consent settings** button |
| Header | **Consent history** + audit callout |
| Stats | Total consent events; Consents today; Texts sent after consent today |
| Filter | Caller phone search + **Search** |
| Table | Caller/consenting number, Business number, Transovo number, Method, Timestamp, Follow-up text, **Details** expand |
| Expanded row | Scope, session ids, missed call link, SMS timestamp, etc. |

**Legacy `/voice/consent-log`** redirects here.

---

### `/onboarding/mctb` — First-time onboarding wizard

**Component:** `onboarding-wizard.tsx` → `lib/mctb/onboarding/mctb-onboarding-runtime.tsx` (`shell="legacy"`)

**Progress labels (7 steps):** Business → Consent → Text Back → Voicemail → Notifications → Connect Phone → Test & Go Live

| Step | Screen title | Main controls |
|------|----------------|---------------|
| Business line | Set up your business line | Business name, business phone, carrier, website; aside “Keep your existing number” |
| Connect calls | Connect calls | Forwarding panel (`mctb-phone-forwarding-panel`); verify state; Continue / Save & verify later |
| Consent | How should callers give permission to text? | Press-1 vs existing permission cards |
| Recovery | Recovery message & texting | Recovery goal cards, opener, delay; demo number sidebar when enabled |
| Voicemail | Set up voicemail | `OnboardingVoicemailStep` |
| Notifications | (notifications step content in runtime) | Team alerts / handoff basics |
| Review & test | Review & test | Summary rows with jump links; live test progress checklist; **Finish setup** |

---

## Public (no app chrome)

### `/f/mctb/[token]` — Public request form

**Component:** `public-request-form-legacy.tsx`

| State | Contents |
|-------|----------|
| Load error | Error message |
| Form | Workspace name; dynamic fields from config (text, phone, email, textarea); Submit |
| Success | **Thank you** confirmation |

---

## Redirect-only routes (legacy)

When Stage 2 is **off**, these URLs do not render unique legacy UI:

| Route | Legacy behavior |
|-------|-----------------|
| `/mctb/missed-call-recovery` | Redirect → `/mctb/setup/recovery` |
| `/mctb/text-back` | Redirect → `/mctb/setup/text-back` |
| `/mctb/phone` | Redirect → `/mctb/setup/phone` |
| `/mctb/notifications` | Redirect → `/mctb/setup/notifications` |
| `/mctb/numbers` | Redirect → `/mctb/phone?open=manage` (then setup phone) |
| `/mctb/setup/start` | Redirect → `/mctb` |
| `/mctb/setup/business-hours` | Redirect → `/mctb/setup/recovery` |
| `/mctb/setup/follow-up` | Redirect → `/mctb/setup/recovery` |

**Legacy `/voice/*` MCTB routes** — redirect to the `/mctb/*` equivalents (no separate UI). See `docs/MCTB-UI-ROUTE-AND-SURFACE-INVENTORY.md`.

---

## Ancillary MCTB-adjacent routes (legacy components)

These live under `/mctb/*` but are appointments/booking satellites or deprecated entries:

| Route | Legacy UI |
|-------|-----------|
| `/mctb/appointments`, `/mctb/appointments/new`, `/mctb/appointments/[id]` | `booking/mctb-appointments-client.tsx` — appointments list/detail tied to MCTB booking |
| `/mctb/calendar` | `booking/mctb-calendar-client.tsx` |
| `/mctb/booking`, `/mctb/booking/[id]` | Booking type management for MCTB AI booking |
| `/mctb/reminders` | Appointment reminders surface (MCTB nav legacy) |
| `/mctb/billing/checkout` | MCTB billing checkout |
| `/mctb/voice-agent` | `voice-agent/mctb-voice-agent-page.tsx` — Opus voice agent wizard entry (deprecated; product points to `/voice/agents`) |

---

## Modals / drawers (not routes)

| Surface | Opened from |
|---------|-------------|
| MCTB number drawer | Phone & Forwarding — manage/add/verify sender |
| Voicemail greeting studio | Voicemail inbox / setup |
| Voicemail settings drawer | Voicemail inbox |
| Voicemail delete confirm | Voicemail detail |
| Exclusion add/edit | Exclusions setup |
| Call-back flow | Missed call detail (`BusinessCallBackButton`) |
| Try It session UI | Embedded in test/onboarding/demo flows (`try-it-view.tsx` — consent mode pick, demo number, step checks) |

---

## Try It (`try-it-view.tsx`) — checkpoints

Used inside test/onboarding contexts:

- Consent mode selection (press-1 vs existing consent + attestation)
- **Start test** / polling status
- Demo number display
- Step checks: call detected, text delivered, consent steps (mode-dependent)
- Links back to setup sections

---

## Recovery goal cards (shared: Text Back setup + onboarding)

| Goal | Title |
|------|--------|
| `get_reply` | Get a reply |
| `request_callback` | Request a callback |
| `collect_details` | Collect details |
| `book_appointment` | Book an appointment |

Each goal drives default opener text and optional request-form field presets.

---

## File map (legacy views → routes)

| Route | Primary component file |
|-------|-------------------------|
| `/mctb` | `src/components/mctb/overview-view.tsx` |
| `/mctb/missed-calls` | `src/components/mctb/missed-calls-view.tsx` |
| `/mctb/missed-calls/[id]` | `src/components/mctb/missed-call-detail-view.tsx` |
| `/mctb/conversations` | `src/components/inbox/kimi-conversations-connected.tsx` |
| `/mctb/voicemail` | `src/components/mctb/voicemail/mctb-voicemail-workspace.tsx` |
| `/mctb/analytics` | `src/components/mctb/analytics/mctb-analytics-view.tsx` |
| `/mctb/ai-recovery` | `src/components/mctb/ai-recovery/ai-recovery-settings-page.tsx` |
| `/mctb/setup` | `src/components/mctb/setup/setup-overview-view.tsx` |
| `/mctb/setup/phone` | `src/components/mctb/setup/setup-phone-forwarding-view.tsx` |
| `/mctb/setup/missed-call-rules` | `src/components/mctb/setup/setup-missed-call-rules-view.tsx` |
| `/mctb/setup/consent` | `src/components/mctb/setup/setup-consent-view.tsx` |
| `/mctb/setup/text-back` | `src/components/mctb/setup/setup-text-back-view.tsx` |
| `/mctb/setup/recovery` | `src/components/mctb/setup/setup-recovery-view.tsx` |
| `/mctb/setup/voicemail` | `src/components/mctb/setup/setup-voicemail-editor-view.tsx` |
| `/mctb/setup/notifications` | `src/components/mctb/setup/setup-notifications-view.tsx` |
| `/mctb/setup/exclusions` | `src/components/mctb/setup/setup-exclusions-view.tsx` |
| `/mctb/setup/links` | `src/components/mctb/setup/setup-links-view.tsx` |
| `/mctb/setup/test` | `src/components/mctb/setup/setup-test-view.tsx` |
| `/mctb/compliance/consent` | `src/components/mctb/consent-log-view.tsx` |
| `/onboarding/mctb` | `src/components/mctb/onboarding-wizard.tsx` |
| `/f/mctb/[token]` | `src/app/f/mctb/[token]/public-request-form-legacy.tsx` |

---

*End of legacy monolith MCTB screen inventory.*
