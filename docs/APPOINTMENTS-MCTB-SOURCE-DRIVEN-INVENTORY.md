# Appointments + MCTB — Source-Driven Feature Inventory

**Generated:** 2026-09-07  
**Authority:** Repository source code (not conversation memory or prior checklists)  
**Machine route scan:** `docs/.generated/appointments-mctb-route-inventory.json` via `npx tsx scripts/generate-appointments-mctb-inventory.ts`

## Purpose

This document is **Step 1–5** of the certification workflow:

```
repo inventory → feature map → action map → workflow map → AI map → coverage matrix → tests
```

Do **not** run certification from memory-only checklists. Every customer-facing feature discovered here must appear in `APPOINTMENTS-MCTB-MASTER-CERTIFICATION-MATRIX.md` with at least one test ID.

---

## Scope

| Product | In scope | Route scan (pages / APIs) |
|---------|----------|---------------------------|
| **Appointments** | V1 launch product | 53 pages · 64 APIs |
| **MCTB** | V1 launch product (product shell) | 58 pages · 83 APIs |
| **Shared** | Conversations, Contacts, Settings when used by both | Cross-linked below |
| **Deferred** | Smart Routing, AI Receptionist, Mass SMS | Inventory only — not cert-required for V1 |

---

## Feature flags (enabled today)

| Flag | File | Value | Effect |
|------|------|-------|--------|
| `APPOINTMENTS_IN_V1_NAV` | `src/lib/products/v1-launch-nav.ts` | `true` | Appointments in primary nav |
| `APPOINTMENTS_V1_PRIMARY` | `src/lib/products/platform-launch.ts` | `true` | Default product shell |
| `MISSED_CALL_TEXT_BACK_IN_V1_NAV` | `v1-launch-nav.ts` | `false` | MCTB via product switcher, not top-level V1 nav |
| `TRANSOVO_MCTB_FOCUSED_NAV` | env (default on) | focused MCTB sidebar | Hides SR from MCTB shell |
| `MASS_MESSAGING_IN_V1_NAV` | `v1-launch-nav.ts` | `false` | Campaigns hidden |
| `AI_RECEPTIONIST_IN_V1_NAV` | `v1-launch-nav.ts` | `false` | Voice agents hidden |
| Workspace `mctb` feature | `feature-entitlements.ts` | per workspace | Gates MCTB |
| `ai_notetaker` / `transovo_video` | `feature-entitlements.ts` | per workspace | Meeting AI entitlements |

---

## Step 1 — Complete feature inventory

### Appointments — operational

| Feature | Canonical route | API / service | Customer actions | Persisted data | Side effects | External deps | Existing tests | Gaps |
|---------|-----------------|---------------|------------------|----------------|--------------|---------------|----------------|------|
| Overview / Home | `/appointments/overview` | `/api/appointments/overview` | View KPIs, setup health | Aggregates | — | — | `test-appointments-nav` | Browser E2E |
| Calendar | `/appointments/calendar` | `/api/appointments`, `/api/calendar/events` | View/create/edit | `VoiceAppointment` | Reminder reschedule | Calendar sync | `diagnose-appointments-calendar` | UI walkthrough |
| List | `/appointments` | `/api/appointments` | Filter, open detail | `VoiceAppointment` | — | — | nav test | Filter URL persistence |
| Detail | `/appointments/[id]` | `/api/appointments/[id]` | Confirm, cancel, notes, video, **notetaker panel** | `VoiceAppointment`, `MeetingSession` | Reminders, workflows | Telnyx meetings/video | partial | Full lifecycle E2E |
| Manual create | `/appointments/new` | POST `/api/appointments` | Staff books customer | `VoiceAppointment` | Reminders, sync | SMS/email | `create-sms-test-appointment` | Payment attach |
| Waitlist | `/appointments/waitlist` | `/api/appointments/waitlist` | Manage queue | `AppointmentWaitlistEntry` | `appointment_waitlist_notify` | SMS | — | Public accept E2E |
| Recalls / no-show | `/appointments/recalls`, `no-show-recovery` | recalls hub API | Configure recovery | Platform config | workflow scans | SMS | — | Live recall |

### Appointments — booking configuration

| Feature | Route | API | Actions | Persistence | Tests | Gaps |
|---------|-------|-----|---------|-------------|-------|------|
| Booking types | `/appointments/types` | `/api/appointments/types` | CRUD services | `VoiceService` | `test-availability-engine` | Type editor UI |
| Booking pages / links | `/appointments/booking` | booking-links | Copy/embed links | `SolutionSetup` | `test-booking-protection` | Embed iframe |
| Availability | `/appointments/availability` | availability API | Hours, overrides | `SolutionSetup.configJson` | availability engine | DST edges |
| Staff | `/appointments/staff` | org/settings | Staff hours | `VoiceStaffMember` | tenant isolation | Calendar blocks |
| Locations | `/appointments/locations` | settings | Multi-location | config JSON | — | Public picker |
| Routing forms | `/appointments/routing-forms` | routing-forms API | Qualify → route | `routingForms[]` | — | Public routing |
| Routing rules | `/appointments/routing` | settings | Rule builder | `routingRules[]` | — | Complex rules |
| Meeting polls | `/appointments/polls` | meeting-polls | Group scheduling | `meetingPolls[]` | — | Poll → book |
| Team pages | `/appointments/team-pages` | team-pages + public team-book | Multi-host | `teamBookingPages[]` | — | Public team E2E |
| AI booking channels | `/appointments/ai-booking` | `/api/appointments/ai-booking` | Enable SMS/web/email AI | platform + channels | `test-appointment-ai-hardening` | Live LLM |

### Appointments — public / customer

| Feature | Route | API | Actions | Persistence | Tests | Gaps |
|---------|-------|-----|---------|-------------|-------|------|
| Public book | `/book/[slug]` | `/api/public/book/[slug]` | Book, pay, OTP | `VoiceAppointment` | `test-book-idempotency`, double-booking | Full payment path |
| Embed book | `/embed/book/[slug]` | same | iframe book | same | — | Cross-origin |
| Confirm / cancel / reschedule | `/appointments/{action}/[token]` | public appointments APIs | Token self-service | metadata tokens | reschedule script | Token expiry |
| Waitlist accept | `/waitlist/accept/[token]` | public waitlist | Accept slot | waitlist + appt | — | Race conditions |
| Payment return | `/book/payment/*` | checkout APIs | Pay deposit | `AppointmentMerchantPayment` | `test-merchant-payments` | Square live |
| Public AI book | `/book/[slug]` (AI widget) | `/api/public/book/[slug]/ai` | NL booking | `AppointmentAiMutationRecord` | AI hardening | Live LLM |

### Appointments — automations

| Feature | Route | Service | Actions | Persistence | Tests | Gaps |
|---------|-------|---------|---------|-------------|-------|------|
| Reminder sequences | `/appointments/reminders` | `reminder-delivery` | Configure SMS/email | platform `reminders` | `test-appointments-reminder-state` | Open/click tracking |
| Voice reminders | `/appointments/voice-reminders` | voice-reminders API | Outbound call templates | `voiceReminders` | `test-appointment-voice-reminders` | Live PSTN call |
| Workflows | `/appointments/workflows` | `appointment-workflows/` | Trigger → step flows | `AppointmentWorkflow*` | workflow hardening ×3 | Unknown-reply E2E |
| Templates / activity | `/appointments/automations/*` | workflow logs | Browse audit | execution logs | workflow minutes | UI drilldown |

### Appointments — meetings & AI note taker (**required**)

| Feature | Route | Service | Actions | Persistence | Tests | Gaps |
|---------|-------|---------|---------|-------------|-------|------|
| **AI Notetaker settings** | `/settings/ai-notetaker` | `meeting-assistant/service` | Bot defaults, join rules | settings JSON | `test-voice-notetaker-wiring` | Per-type override E2E |
| **Meeting recaps** | `/meetings`, `/meetings/[id]` | `/api/meetings/*` | Summary, transcript, action items | `MeetingSession`, segments, `MeetingActionItem` | notetaker wiring | Live bot join |
| **Notetaker on appointment** | `/appointments/[id]` | `NotetakerPanel` | Enable/view recap | linked `MeetingSession` | certify-appointment-stack-live | — |
| **Transovo Video** | `/video`, `/appointments/[id]/video/host` | `transovo-video/` | Host/join, waiting room | `VideoMeeting` | `test-transovo-video-wiring` | Guest join |
| **Public recap share** | `/recap/[token]` | share service | External stakeholder view | `MeetingRecapShare` | — | Scoped transcript |
| Transcript pipeline | (background) | `transcription/service`, jobs | Deepgram + summary | segments | `test:ai-transcription` | — |

### Appointments — integrations & payments

| Feature | Route | API | External | Tests |
|---------|-------|-----|----------|-------|
| Calendar sync | `/integrations/calendars` | integrations/calendars | Google, Microsoft | `test-native-integrations` |
| Merchant payments | `/integrations/payments`, `/payments` | merchant-payments | Stripe, Square | `test-merchant-payments` |
| Analytics suite | `/appointments/analytics/*` | analytics + export | — | — (gap) |

### MCTB — operational

| Feature | Route | API | Actions | Persistence | Tests | Gaps |
|---------|-------|-----|---------|-------------|-------|------|
| Overview | `/mctb` | `/api/mctb/overview` | KPIs, needs attention | aggregates | — | Handoff attention cards |
| Missed calls list | `/mctb/missed-calls` | missed-calls API | Filter, open detail | `MissedCallEvent` | filter test | — |
| Missed call detail | `/mctb/missed-calls/[id]` | detail API | Timeline, call back | event + traces | — | Handoff section UI |
| Conversations | `/mctb/conversations` | shared inbox | Reply, handoff panel | `Conversation` + automation state | inbox product filter | Takeover E2E |
| Voicemail inbox | `/mctb/voicemail` | phone/voicemail | Listen, transcript, summary | `VoicemailMessage` | voicemail entitlements | — |
| Analytics | `/mctb/analytics` | analytics API | Funnel metrics | aggregates | — | Handoff metrics UI |
| Numbers | `/mctb/numbers` | setup/TFV | Sender management | phone rows, TFV | TFV gates | Live A2P |
| Consent log | `/mctb/compliance/consent` | consent-log | Audit | `ConsentRecord` | consent-log test | — |

### MCTB — setup & onboarding

| Section | Route | API | Persistence |
|---------|-------|-----|-------------|
| Setup overview | `/mctb/setup` | `/api/mctb/setup` | `SolutionSetup`, `MissedCallTextConfig` |
| Wizard | `/onboarding/mctb` | `/api/mctb/onboarding` | wizard state |
| Phone & forwarding | `/mctb/setup/phone` | live-test, setup | forwarding verification |
| Missed-call rules | `/mctb/setup/missed-call-rules` | setup | trigger flags |
| Consent | `/mctb/setup/consent` | consent-prompt | `press_1` / `existing_consent` |
| Text back | `/mctb/setup/text-back` | setup | templates |
| **Notifications & handoff** | `/mctb/setup/notifications` | `/api/mctb/handoff` | `MctbHandoffConfig`, recipients |
| Recovery controls | `/mctb/setup/recovery` | setup | pause, cooldown, max sends |
| Voicemail setup | `/mctb/setup/voicemail` | setup | `VoicemailBox` |
| Exclusions | `/mctb/setup/exclusions` | exclusions API | `Suppression` |
| Test & diagnostics | `/mctb/setup/test` | try-it, setup-test | traces |

**Spec gap:** `/mctb/setup/links` — request form infra exists (`/f/mctb/[token]`) but no dedicated setup links page yet.

### MCTB — runtime (voice + SMS)

| Component | Entry | Service | Frozen? |
|-----------|-------|---------|---------|
| TeXML CFNA ingress | `/api/telnyx/voice/mctb-entry` | `texml-ingress/` | **Yes** (`mctb_texml_final_v1`) |
| Press-1 consent | mctb-consent, press-1 routes | consent texml | Yes |
| Existing consent voicemail | mctb-texml-voicemail, texml-status | existing-consent capture | Yes |
| Missed call classification | voice webhooks | `classify.ts` | — |
| Eligibility engine | send path | `eligibility.ts` | — |
| Recovery SMS job | BullMQ `john_mctb_send` | `send.ts` | — |
| Inbound SMS | Telnyx webhook | `customer-sms.ts` → handoff → John LLM | — |
| Handoff orchestrator | inbound reply | `process-inbound-reply.ts` | Four response modes |

### MCTB — public

| Feature | Route | API |
|---------|-------|-----|
| Request form | `/f/mctb/[token]` | `/api/public/mctb-request-form` |

---

## Step 2 — Action inventory (canonical pages)

Every control must map to **real behavior + cert test ID**. Controls marked **DEFECT** have no authoritative backend.

### `/appointments/overview`
| Control | Behavior | Test ID |
|---------|----------|---------|
| Retry (error state) | Refetch overview API | APT-OP-001 |
| Setup health links | Navigate to setup sections | APT-OP-002 |
| KPI drilldowns | Navigate to calendar/list/analytics | APT-OP-003 |

### `/appointments/calendar` & `/appointments`
| Control | Behavior | Test ID |
|---------|----------|---------|
| Create appointment | POST `/api/appointments` | APT-OP-010 |
| Open detail | GET detail | APT-OP-011 |
| Filter/search | Query params → API | APT-OP-012 |
| Reschedule drag (if enabled) | PATCH appointment | APT-OP-013 |

### `/appointments/[id]`
| Control | Behavior | Test ID |
|---------|----------|---------|
| Confirm / cancel / reschedule | Lifecycle PATCH | APT-OP-020 |
| Internal notes | Persist notes metadata | APT-OP-021 |
| **Notetaker panel** — enable | `enableNotetakerForAppointment` | AI-MTG-010 |
| **Notetaker panel** — view recap | GET meetings API | AI-MTG-011 |
| Video host link | Provision/join video | AI-MTG-012 |
| Reminder timeline | GET reminder-timeline | APT-AUT-010 |

### `/appointments/reminders`, `/appointments/workflows`
| Control | Behavior | Test ID |
|---------|----------|---------|
| Save reminder config | PATCH settings | APT-AUT-001 |
| Send test reminder | POST reminders/test | APT-AUT-002 |
| Create/edit workflow | CRUD workflows | APT-AUT-003 |
| Workflow preview/test | preview API | APT-AUT-004 |

### `/settings/ai-notetaker`
| Control | Behavior | Test ID |
|---------|----------|---------|
| Save notetaker defaults | PATCH meetings settings | AI-MTG-001 |
| Join rule toggles | Persist join rules | AI-MTG-002 |
| Summary template select | Persist template id | AI-MTG-003 |

### `/meetings`, `/meetings/[id]`
| Control | Behavior | Test ID |
|---------|----------|---------|
| Open recap | GET meeting session | AI-MTG-020 |
| Share recap | Create `MeetingRecapShare` | AI-MTG-021 |
| Complete action item | PATCH action item | AI-MTG-022 |
| Settings shortcut | Navigate settings | AI-MTG-023 |

### `/book/[slug]` (public)
| Control | Behavior | Test ID |
|---------|----------|---------|
| Select type/slot | availability + book | APT-PUB-001 |
| OTP verify | OTP API | APT-PUB-002 |
| Checkout pay | merchant checkout | APT-PUB-003 |
| AI chat book | `/ai` endpoint | AI-APT-010 |

### `/mctb` (overview)
| Control | Behavior | Test ID |
|---------|----------|---------|
| Finish setup CTA | Navigate wizard | MCTB-OP-001 |
| Needs attention items | Filtered deep links | MCTB-OP-002 |
| Recent missed calls | List subset | MCTB-OP-003 |

### `/mctb/missed-calls` & detail
| Control | Behavior | Test ID |
|---------|----------|---------|
| Row open / filters | List API | MCTB-OP-010 |
| Call back | tel: link | MCTB-OP-011 |
| Open conversation | Inbox deep link | MCTB-OP-012 |
| **Handoff section** (pending UI) | handoff context API | MCTB-HO-010 |

### `/mctb/conversations`
| Control | Behavior | Test ID |
|---------|----------|---------|
| Reply composer | SMS send + eligibility | MCTB-OP-020 |
| Take over | POST handoff/actions | MCTB-HO-020 |
| Resume automation | POST handoff/actions | MCTB-HO-021 |
| Mark called back / resolved | follow-up status | MCTB-HO-022 |

### `/mctb/setup/notifications`
| Control | Behavior | Test ID |
|---------|----------|---------|
| Response mode cards | POST handoff config | MCTB-HO-001 |
| Field schema rows | Persist fieldSchema | MCTB-HO-002 |
| Emergency toggles/criteria | Persist emergency config | MCTB-HO-003 |
| Recipients CRUD | POST recipients | MCTB-HO-004 |
| Routing matrix | Persist matrix | MCTB-HO-005 |
| Quiet hours | Persist quiet hours | MCTB-HO-006 |
| Send test notification | POST handoff test | MCTB-HO-007 |
| Preview tabs | Template render (client) | MCTB-HO-008 |

### `/mctb/setup/*` (other sections)
| Control | Behavior | Test ID |
|---------|----------|---------|
| Save phone/forwarding | setup API + live-test | MCTB-SET-001 |
| Missed-call rule toggles | setup API | MCTB-SET-002 |
| Consent mode cards | setup + consent-prompt | MCTB-SET-003 |
| Text-back composer | setup templates | MCTB-SET-004 |
| Recovery pause/resume | schedule-shared | MCTB-SET-005 |
| Exclusions add/remove | exclusions API | MCTB-SET-006 |
| Test checkpoints | setup-test / try-it | MCTB-SET-007 |

**Known defects / incomplete wiring (flagged):**
- `/mctb/setup/links` — **missing route** (form works at `/f/mctb/[token]` only)
- Missed call detail **Handoff & Outcome** section — API exists, UI section incomplete
- Overview **urgent lead** cards — events exist, UI wiring incomplete
- MCTB analytics **handoff counters** — events queryable, UI incomplete
- Calendar **booking from MCTB thread** — `bookingBehavior` stored, attribution hook incomplete

---

## Step 3 — Domain workflow inventory

### Appointments workflows

| ID | Workflow | Touchpoints | Test ID |
|----|----------|-------------|---------|
| WF-APT-001 | Create booking (staff) | new → API → reminders | APT-OP-010 |
| WF-APT-002 | Public book + confirm | /book → token confirm | APT-PUB-001 |
| WF-APT-003 | Reschedule | public token or staff | APT-OP-020 |
| WF-APT-004 | Cancel + reminder suppress | cancel API | APT-OP-020 |
| WF-APT-005 | Availability → slot hold → book | slot-booking | APT-ENG-001 |
| WF-APT-006 | Waitlist offer → accept | notify job → public accept | APT-PUB-004 |
| WF-APT-007 | Reminder scan → SMS/email | cron `appointments_platform_reminder_scan` | APT-AUT-001 |
| WF-APT-008 | No-show scan → recovery workflow | `appointment_no_show_scan` | APT-AUT-005 |
| WF-APT-009 | Workflow time trigger → step send | `appointment_workflow_step` | APT-AUT-003 |
| WF-APT-010 | Voice reminder outbound + retry | voice reminder job | APT-AUT-005 |
| WF-APT-011 | Calendar OAuth → sync → webhook | integrations/calendars | APT-INT-001 |
| WF-APT-012 | Payment checkout → confirm appt | merchant-payments | APT-PUB-003 |
| WF-APT-013 | **AI book via SMS** | inbound → appointment AI | AI-APT-001 |
| WF-APT-014 | **AI book via public chat** | /book/ai | AI-APT-002 |
| WF-APT-015 | **Book → attach video → notetaker bot** | video + meeting assistant | AI-MTG-010 |
| WF-APT-016 | **Meeting end → transcript → summary → action items** | webhooks → process job | AI-MTG-020 |
| WF-APT-017 | **Share recap externally** | recap token | AI-MTG-021 |
| WF-APT-018 | Transovo Video record → recap | video process job | AI-MTG-030 |
| WF-APT-019 | Routing form → qualified book | public routing | APT-PUB-005 |
| WF-APT-020 | Team page multi-staff book | team-book API | APT-PUB-006 |

### MCTB workflows

| ID | Workflow | Touchpoints | Test ID |
|----|----------|-------------|---------|
| WF-MCTB-001 | CFNA → press_1 → DTMF → SMS | TeXML pipeline | MCTB-RT-001 |
| WF-MCTB-002 | CFNA → existing_consent → voicemail → SMS | texml-status job | MCTB-RT-002 |
| WF-MCTB-003 | Missed call → eligibility → delayed send | john_mctb_send | MCTB-RT-003 |
| WF-MCTB-004 | Inbound reply → notify_only | handoff | MCTB-HO-001 |
| WF-MCTB-005 | Inbound reply → guided collection | guided-collection | MCTB-HO-002 |
| WF-MCTB-006 | Inbound reply → AI conversation | John LLM loop | AI-MCTB-001 |
| WF-MCTB-007 | Inbound reply → immediate handoff | handoff | MCTB-HO-003 |
| WF-MCTB-008 | Urgency detected → emergency notify | urgency + notifications | MCTB-HO-003 |
| WF-MCTB-009 | Human takeover → AI blocked | automation-state | MCTB-HO-020 |
| WF-MCTB-010 | Resume automation (safe) | handoff actions | MCTB-HO-021 |
| WF-MCTB-011 | Callback requested → team SMS/email | notifications | MCTB-HO-004 |
| WF-MCTB-012 | Voicemail → transcribe → summarize | ai_transcription job | AI-VM-001 |
| WF-MCTB-013 | STOP opt-out → suppress sends | eligibility | MCTB-RT-004 |
| WF-MCTB-014 | Pause MCTB → no recovery texts | schedule-shared | MCTB-RT-005 |
| WF-MCTB-015 | Repeat caller → cooldown suppress | repeat-caller + eligibility | MCTB-RT-006 |
| WF-MCTB-016 | Public request form submit | /f/mctb | MCTB-PUB-001 |
| WF-MCTB-017 | TFV/A2P sender readiness gates | tfv + eligibility | MCTB-RT-007 |
| WF-MCTB-018 | **MCTB → appointment book attribution** | booking link (partial) | X-001 |

### Cross-product

| ID | Workflow | Test ID |
|----|----------|---------|
| WF-X-001 | Shared inbox: MCTB filter vs appointments | MCTB-OP-020 |
| WF-X-002 | Inbound SMS: Appointment AI before John | AI-APT-003 |
| WF-X-003 | Contact record shared across products | APT-ENG-005 |
| WF-X-004 | MCTB recovery → Transovo calendar book | X-001 |

---

## Step 4 — AI feature inventory (mandatory)

| ID | Feature | Trigger | Input | Output | Persistence | UI | Fallback | Human override | Failure | Offline test |
|----|---------|---------|-------|--------|-------------|-----|----------|----------------|---------|--------------|
| AI-APT-001 | Appointment understanding | Inbound SMS / public AI | NL + context | Intent JSON | mutation record | /book, /conversations | deterministic fallback | Staff manual book | OUT_OF_SCOPE / ERROR | `test-appointment-ai-hardening` |
| AI-APT-002 | Write verifier | Before book/cancel/reschedule | intent + slots | MATCH/CLARIFY | — | — | block unsafe writes | — | MISMATCH blocks | AI hardening |
| AI-APT-003 | Compose response | After resolve | facts | customer text | — | — | deterministic compose | — | template fallback | AI hardening |
| AI-MTG-001 | **AI Notetaker bot** | Appointment video URL | meeting audio | transcript | `MeetingSession` | /meetings, appt detail | — | staff edits action items | failed status | wiring test |
| AI-MTG-002 | Meeting summary | Artifact complete | transcript | summary text | session row | recap UI | placeholder | — | summaryStatus failed | wiring test |
| AI-MTG-003 | Action items extraction | Artifact complete | transcript | JSON items | `MeetingActionItem` | recap UI | Telnyx artifact | manual complete | parse fail | wiring test |
| AI-MTG-004 | Transovo Video recap | Video composition done | recording | transcript+summary | VideoMeeting + session | /video | — | — | process failed | video wiring |
| AI-MCTB-001 | John customer SMS | MCTB inbound + ai mode | SMS thread | reply SMS | messages, traces | conversations | runtime gateway synth | handoff modes, takeover | no sender | john-preprod |
| AI-MCTB-002 | John runtime gateway | Each LLM turn | proposed actions | authoritative state | traces | — | deterministic | — | — | john-preprod |
| AI-MCTB-003 | Owner settings LLM | Admin owner chat | NL commands | config changes | MissedCallTextConfig | /api/agents/john | UNKNOWN | owner explicit | parse fail | john-preprod |
| AI-MCTB-004 | Workflow architect | Owner workflow request | NL + catalog | workflow draft | draft store | admin | template draft | validate + approve | invalid nodes | john-preprod |
| AI-VM-001 | Voicemail transcription | Recording saved | audio URL | transcript | VoicemailMessage | /mctb/voicemail | skip if no Deepgram | mark reviewed | failed status | test:ai-transcription |
| AI-VM-002 | Voicemail AI summary | After transcript | text | 1-2 sentences | aiSummary field | voicemail UI | null summary | — | — | test:ai-transcription |
| AI-VM-003 | Translation to English | Non-English transcript | text | english | transcriptEnglish | — | stub | — | — | test-transovo-voicemail |
| AI-MCTB-005 | MCTB urgency (rules) | Inbound SMS | keywords | classification | `MctbUrgencyAssessment` | setup + panel | treat_normal | emergency config | — | test-mctb-handoff |
| AI-ADJ-001 | AI Replies (adjacent) | Inbound after appt AI | agent config | SMS | AiReplySession | /ai-replies | static fallback | human session | paused skip | partial |
| AI-DEF-001 | Caller Amy voice (deferred) | Live call | audio | speech+tools | VoiceCall | /voice/agents | heuristics | transfer | call error | caller-amy-preprod |

**AI note taker:** Confirmed in repo — `NotetakerPanel`, `/settings/ai-notetaker`, `/meetings/*`, `meeting-assistant/*`. **Included in matrix** (AI-MTG-*).

---

## Step 5 — Gap report (code vs spec vs UI vs tests)

| Area | Code exists | Spec says | UI exposes | Tests cover | Gap |
|------|-------------|-----------|------------|-------------|-----|
| MCTB Overview | Yes | Spec 01 | Yes | Partial | Handoff needs-attention |
| MCTB Notifications setup | Yes | User spec | Yes | `test-mctb-handoff` | Live SMS to team |
| MCTB wizard handoff step | Partial | User spec | No dedicated wizard step | — | Add wizard step |
| MCTB detail handoff section | API yes | User spec | Partial | — | UI section |
| MCTB setup links page | Lib yes | Spec 07 | No route | — | Add `/mctb/setup/links` |
| MCTB analytics handoff | Events yes | User spec | No UI counters | — | Analytics UI |
| MCTB calendar attribution | Config yes | User spec | Partial | — | Booking hook |
| Appointments AI notetaker | Yes | V1 scope | Yes | wiring tests | Live meeting bot |
| Appointments analytics export | API yes | Spec | Yes | — | PDF golden test |
| Press-1 TeXML pipeline | Yes | Frozen doc | N/A | pipeline contract | **PSTN manual** |
| Existing consent TeXML | Yes | Frozen doc | N/A | pipeline contract | **PSTN manual** |
| TFV live approval | Partial | Cert | Status UI | manual matrix | **Provider manual** |
| Fax (V1 sibling) | Yes | V1 cert | Yes | v1-production-readiness | Out of this matrix |

---

## Related artifacts

| File | Purpose |
|------|---------|
| `docs/APPOINTMENTS-MCTB-MASTER-CERTIFICATION-MATRIX.md` | Step 6–7 — test IDs + coverage proof |
| `docs/.generated/appointments-mctb-route-inventory.json` | Machine route scan |
| `scripts/run-appointments-mctb-cert-staged.ts` | Step 8 — crash-safe test runner |
| `scripts/mctb-launch-readiness-matrix.ts` | Legacy MCTB provider/live matrix (A–T IDs) |

---

## Inventory completion statement

This inventory was built from:

- Route/API filesystem scan (262 product-scoped routes)
- Navigation builders (`appointments-nav.ts`, `mctb-nav.ts`, `v1-launch-nav.ts`)
- Prisma models, job handlers, webhook routes
- AI modules (`meeting-assistant`, `ai-scheduling`, John intelligence, transcription)
- 29+ npm test scripts and 50+ `scripts/test-mctb-*.ts` files
- Product specs under `docs/TRANSOVO-MCTB-*` and `docs/TRANSOVO-V1-APPOINTMENTS-*`

**Not claimed:** Live PSTN, live provider TFV, live meeting bot join, or browser UI walkthrough — marked BLOCKED in matrix.
