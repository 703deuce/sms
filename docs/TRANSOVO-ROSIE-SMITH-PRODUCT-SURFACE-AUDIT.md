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
