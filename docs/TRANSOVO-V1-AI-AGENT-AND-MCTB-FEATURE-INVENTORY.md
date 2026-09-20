# Transovo V1 — AI Receptionist & Missed Call Text Back feature inventory

**Purpose:** Single copy/download reference for what is **built in the repo** today — completed or **mostly complete** — versus what still needs **live PSTN/SMS/provider QA** only.

**Voice-only status (Appointment Receptionist / Voice V3):** `docs/AI-VOICE-AGENT-FEATURE-STATUS.md`

**Generated:** 2026-09-20 (Cloud Agent pass)  
**Primary codebases:** `master` + in-flight Voice V3 work on branch `cursor/voice-v3-after-hours-post-call-2304` (PR #457, includes merged spam/solicitor protection)

**How to use this doc:** Sections marked **COMPLETE** have implementation + automated contract/script coverage in-repo. **MOSTLY COMPLETE** = UI/runtime wired; ledger or spec calls out small gaps or live QA only. **MANUAL CERT ONLY** = needs real phone, carrier, Stripe, or external webhook — not missing application code.

---

## Important architecture notes (read first)

### AI Receptionist (Voice V3) — call media & post-call

| Stage | What actually runs in code | Common misconception |
|--------|---------------------------|----------------------|
| **PSTN ingress** | Telnyx → SIP → **LiveKit room** (Amy / GPT-Live) | Not Telnyx Call Control as the conversation path |
| **Recording** | **LiveKit Egress** (`startRoomCompositeEgress`, `audioOnly`, `AudioMixing.DUAL_CHANNEL_AGENT`) → file storage → `VoiceRecording` | **Not** Telnyx carrier-leg record for the full agent+caller mix |
| **Transcription** | **Deepgram** (`DEEPGRAM_API_KEY`) via `src/lib/voice-v3/post-call/transcription.ts` after recording is `ready` | Not realtime Deepgram in the live Amy audio path |
| **Structured summary** | `ensureVoiceV3CallSummary()` — LLM + **system facts** (`system-facts.ts` wins on outcomes) | Stored on call insight + exposed as `voiceV3StructuredSummary` on call detail API |
| **Customer notification** | **Same summary object** drives post-call email/SMS via `sendVoiceV3PostCallSummaryEmail()` → `dispatchVoiceV3Notification()` | Call detail page reads the same structured summary fields for the AI Summary card |
| **In-call notifications** | Separate paths: callback booked, transfer, appointment booked, etc. (`notify-*.ts`) | Post-call summary is additional to those event-driven notifications |

Canonical post-call processor: `processVoiceV3CompletedCall()` in `src/lib/voice-v3/post-call/process-completed-call.ts` (job type `voice_v3_post_call`).

Recording decision doc: `docs/VOICE-V3-RECORDING-MEDIA-PATH-DECISION.md` (Option B: LiveKit Egress).

### MCTB — voice vs SMS

MCTB **voice ingress is TeXML-only** (frozen `mctb_texml_final_v1`). It does **not** use the Voice V3 LiveKit receptionist on the MCTB DID. SMS recovery uses the existing MCTB messaging/consent/eligibility stack.

Doc: `docs/MCTB_FINAL_PRODUCTION_PIPELINE.md`.

### MCTB voicemail — recording & transcript (operational inbox)

On the **MCTB voicemail** product surface (`/mctb/voicemail`), caller audio is tied to the **Telnyx / phone voicemail pipeline** (TeXML record + stored message), not LiveKit egress. After the recording is available, **transcription uses our Deepgram integration** (`DEEPGRAM_API_KEY`), same pattern as other voicemail surfaces. The **summary shown in the inbox** is generated from that transcript/metadata; alert email/SMS copy should match what the UI shows (no separate “fake preview” summary).

Voice V3 after-hours calls use the **LiveKit egress + post-call** path in the table above — do not conflate the two products’ media stacks.

---

# Part A — AI Receptionist (Voice V3 / Appointment Receptionist)

Product surface: **After-hours AI receptionist** (wizard: Appointment Receptionist), LiveKit + GPT-Live (“Amy”) with GPT delegation (“Astra”), Microsoft/Calendly booking paths, transfers, callbacks, post-call pipeline.

## A1. Runtime & telephony — COMPLETE (code)

| Feature | Status | Where |
|---------|--------|--------|
| LiveKit SIP inbound session | COMPLETE | `voice-runtime-python/`, `resolveVoiceV3LiveKitSession` |
| Python worker tools (incl. native `end_call`) | COMPLETE | `voice-runtime-python/transovo_voice/voice_v3/` |
| Node tool execution bridge | COMPLETE | `executeVoiceV3ToolForLiveKit`, `/api/internal/voice-runtime` |
| Inbound `VoiceCall` persist (LiveKit) | COMPLETE | `persistInboundCallForPython` + `voiceV3WizardBound` metadata |
| Call runtime / intake state | COMPLETE | `src/lib/voice-v3/state/`, intake objective system |
| Conversation freshness / turn revision | COMPLETE | `src/lib/voice-v3/conversation/` |
| Delegation protocol (Amy → Astra) | COMPLETE | Prompts + `test-voice-v3-delegation-protocol-*` |
| Media backend pinning (LiveKit) | COMPLETE | `src/lib/voice/media-backend/` |
| LiveKit egress webhook ingest | COMPLETE | `livekit-egress-ingest.ts`, `/api/webhooks/livekit` |
| Post-call job routing | COMPLETE | `voice_v3_post_call`, `post-call-router.ts` |

**MANUAL CERT ONLY:** End-to-end PSTN audio quality, interruption policy under real latency, dual-channel recording listen-test.

## A2. Agent tools & scheduling — COMPLETE (code)

Catalog: `src/lib/voice-v3/tools/voice-tool-catalog.ts`

| Tool | Purpose | Status |
|------|---------|--------|
| `update_intake` | Collect / merge caller fields | COMPLETE |
| `set_scheduling_preference` | Narrow scheduling intent | COMPLETE |
| `find_availability` | Slot search (Microsoft / providers) | COMPLETE |
| `book_appointment` | Create appointment | COMPLETE |
| `find_appointment` | Lookup for manage flows | COMPLETE |
| `reschedule_appointment` | Reschedule | COMPLETE |
| `cancel_appointment` | Cancel (confirmation policy) | COMPLETE |
| `transfer_call` | Warm/cold transfer system | COMPLETE |
| `end_call` | Native LiveKit hangup | COMPLETE |
| `send_booking_link` | SMS booking link mode | COMPLETE |
| `request_callback` | Callback contract + shared facts | COMPLETE |
| `report_unwanted_solicitor` | Spam/solicitor decline + billing metadata | COMPLETE (spam merge) |

**Script bundles (representative):** `npm run test:voice-v3-intake`, `test:voice-v3-booking`, `test:voice-v3-reschedule`, `test:voice-v3-cancellation`, `test:voice-v3-microsoft-appointment-management`, `test:voice-v3-transfer-system`, `test:voice-v3-agent`.

## A3. Wizard & configuration — MOSTLY COMPLETE

| Area | Status | Notes |
|------|--------|-------|
| Appointment Receptionist wizard UI | COMPLETE | `components/solutions/appointment-receptionist/` |
| Steps: goals, phone, voice, information, appointments, call handling, test, activate | COMPLETE | Wired to save/publish |
| V3 config compile / manifest | COMPLETE | `compile-voice-v3-agent-config.ts`, wizard manifest builder |
| Intake fields & objectives | COMPLETE | Intake objective module + cert scripts |
| Transfer targets & emergency transfer editor | COMPLETE | Transfer wizard state + activation validation |
| After-hours notifications editor | COMPLETE | Recipients, routing; **daily digest** + recording disclosure (post-call branch) |
| Operating maturity / urgency rules | COMPLETE | Editors + wizard bridge |
| Callback required fields | COMPLETE | Editor + defaults |
| **Spam / unwanted calls** editor | COMPLETE | `spam-unwanted-calls-editor.tsx` (merged) |
| Telnyx inbound screening sync | COMPLETE | `sync-telnyx-inbound-screening.ts` |
| Business auto-import (website crawl) | COMPLETE | Separate pass — wizard onboarding + jobs |
| Live wizard test | COMPLETE | `/api/voice/agents/[id]/v3-wizard-live-test` |

**MANUAL CERT ONLY:** Wizard publish → production PSTN behavior per workspace; ElevenLabs voice preview on real calls.

## A4. Transfers, callbacks, end-call — COMPLETE (code)

| Feature | Status | Docs / tests |
|---------|--------|----------------|
| Transfer system (targets, outcomes, notifications) | COMPLETE | `test-voice-v3-transfer-system`, transfer preflight docs |
| Callback request tool + PSTN fixes | COMPLETE | Callback contract reports, `request_callback` |
| End-call native tool | COMPLETE | `VOICE-V3-END-CALL-IMPLEMENTATION-REPORT.md` |
| Transfer failure / emergency notifications | COMPLETE | `notify-transfer-outcome.ts` |

## A5. Post-call pipeline (after-hours) — MOSTLY COMPLETE

| Stage | Status | Implementation |
|-------|--------|----------------|
| Wait for recording | COMPLETE | Retries via `voice_v3_post_call` |
| Deepgram transcription | COMPLETE | `transcription.ts` |
| Structured summary + system facts | COMPLETE | `summary.ts`, `system-facts.ts` |
| Knowledge gap candidates → DB | COMPLETE | `VoiceKnowledgeGap`, `/api/voice/knowledge-gaps` |
| Post-call email/SMS (summary) | COMPLETE | `email.ts` — **same summary as UI** |
| Skip summary for spam/solicitor | COMPLETE | `shouldSkipSummaryEmail` |
| Outbound webhooks (signed, retries) | COMPLETE | `src/lib/voice-v3/webhooks/`, `voice_webhook_deliver` |
| Analytics aggregates | COMPLETE | `voiceV3Analytics` on call metadata, `/api/voice/analytics/after-hours` |
| Daily digest email | COMPLETE | `digest-email.ts` + `voice_after_hours_digest_scan` cron |
| Retry transcript API | COMPLETE | `POST /api/voice/calls/[id]/retry-transcript` |

**UI — COMPLETE (code):**

| Surface | Route | Status |
|---------|-------|--------|
| Calls inbox | `/voice/calls` | Filters, screening badges, date range, post-call processing hint |
| Call detail | `/voice/calls/[id]` | Recording player, structured summary, transcript + retry, screening section, block caller |
| After-hours analytics | `/voice/analytics/after-hours` | KPIs from `voiceV3Analytics` |
| Knowledge gaps | `/voice/knowledge?tab=gaps` | `KnowledgeGapsPanel` |
| Outbound webhooks | Integrations → Voice panel | Create/test/deliveries |
| Needs attention | `/voice/needs-attention` | Exists (ops) |

**Automated:** `scripts/test-voice-v3-post-call-pipeline.ts` — PASS.

**MANUAL CERT ONLY:** Listen to egress file (caller + Amy), live Brevo email, webhook receiver, digest in production cron.

## A6. Spam & solicitor protection — MOSTLY COMPLETE

| Feature | Status |
|---------|--------|
| Wizard policies (spam likely, solicitor decline) | COMPLETE |
| Telnyx call screening header → metadata | COMPLETE |
| Blocklist (workspace) | COMPLETE | `blocklist.ts`, `/api/voice/blocked-callers` |
| Block from call detail | COMPLETE | `/api/voice/calls/[id]/block-caller` |
| Solicitor billing / outcome tool | COMPLETE | Python + `billing.ts` |
| Screening UI on calls list/detail | COMPLETE | `screening-display.ts`, `CallScreeningSection` |
| Automated tests | COMPLETE | `scripts/test-voice-v3-spam-solicitor-protection.ts` — PASS |

**MANUAL CERT ONLY:** Real carrier `spam_likely` header on PSTN; Telnyx trunk screening sync in production.

## A7. Knowledge & RAG — COMPLETE (code)

| Feature | Status |
|---------|--------|
| Knowledge bases CRUD | COMPLETE | `/api/voice/knowledge/*` |
| Text / URL / file upload sources | COMPLETE | Telnyx RAG embeddings |
| Test search | COMPLETE | Knowledge page |
| Runtime business answers | COMPLETE | `resolve-business-answer.ts` |
| Post-call gap queue | COMPLETE | See A5 |

## A8. Notifications (in-call + post-call) — COMPLETE (code)

| Event | Channel | Module |
|-------|---------|--------|
| Callback requested | Email/SMS/in-app | `notify-callback-requested.ts` |
| Appointment booked | Email/SMS/in-app | `notify-appointment-booked.ts` |
| Transfer connected/failed | Email/SMS/in-app | `notify-transfer-outcome.ts` |
| Call completed (legacy immediate) | Optional | `notify-call-completed.ts` (V3 post-call can defer) |
| Post-call summary | Email/SMS | `post-call/email.ts` |
| Daily digest | Email | `digest-email.ts` |

Config loaded per call from published wizard: `load-config-for-call.ts`.

## A9. Legacy / parallel voice surfaces (still in repo)

These exist for migration, Smart Routing, campaigns, or Voice V2 — **not** the canonical V3 after-hours path:

- `/voice/agents`, `/voice/campaigns`, `/voice/inbound-routing`, Telnyx assistant paths with `telnyxConversationId`
- Voice V2 after-hours contract (`docs/VOICE-V2-AFTER-HOURS-PRODUCT-CONTRACT.md`) — preserved; V3 is the forward path for Appointment Receptionist wizard

## A10. Voice V3 — known gaps (honest)

| Item | Status |
|------|--------|
| PSTN certification matrix (all modes) | MANUAL CERT ONLY |
| Real-time call monitoring UI | Partial / ops pages exist; not full contact-center |
| V2 `transcription-pipeline.ts` stubs | Intentional — V3 does not use V2 post-call stubs |
| Some wizard “test” surfaces | Browser cert blocked without auth session |

---

# Part B — Missed Call Text Back (MCTB)

Canonical product docs: `docs/TRANSOVO-MCTB-*.md` (scope, IA, manifest, page specs 01–12).

## B1. Production voice + SMS runtime — COMPLETE (code, frozen pipeline)

| Feature | Status | Reference |
|---------|--------|-----------|
| TeXML CFNA ingress | COMPLETE | `mctb-entry`, `docs/MCTB_FINAL_PRODUCTION_PIPELINE.md` |
| **press_1** mode (consent audio + Gather 1) | COMPLETE | PSTN certified per pipeline doc |
| **existing_consent** mode (greeting + record + auto SMS) | COMPLETE | PSTN certified per pipeline doc |
| Consent → SMS trigger | COMPLETE | `mctb-consent`, eligibility engine |
| Voicemail record + transcript path | COMPLETE | `mctb-texml-voicemail`, texml-status |
| MCTB SMS send / suppression / opt-out | COMPLETE | `src/lib/mctb/`, shared messaging |
| Both consent modes required | COMPLETE | Never single-mode |
| Pipeline verify scripts | COMPLETE | `npm run verify:mctb-final-pipeline`, `test:mctb-final-pipeline-contract` |
| Legacy `/voice/*` → `/mctb/*` migration | IN PROGRESS | Many redirects; rebuild per `MCTB-FRONTEND-REBUILD-KICKOFF.md` |

**MANUAL CERT ONLY:** Per-workspace CFNA, TFV/10DLC sender readiness, live SMS on your handsets.

## B2. MCTB operational UI — COMPLETE per completion ledger

Source: `docs/MCTB-PAGE-BY-PAGE-COMPLETION-LEDGER.md` (reconciled through analytics, setup subsections, onboarding).

| Page / area | Route | Ledger status |
|-------------|-------|----------------|
| Overview / Home | `/mctb` | **COMPLETE** (locked) |
| Missed calls list | `/mctb/missed-calls` | **COMPLETE** (minor: consent filter enrichment PARTIAL) |
| Missed call detail | `/mctb/missed-calls/[id]` | Built (spec 03); see operational routes |
| Conversations | `/mctb/conversations` | Route + shared inbox patterns |
| Voicemail inbox | `/mctb/voicemail` | **COMPLETE** (premium pass) |
| Analytics | `/mctb/analytics` | **COMPLETE** |
| Compliance consent log | `/mctb/compliance/consent` | Route + API `consent-log` |
| Public request form | `/f/mctb/[token]` | Route exists |
| AI Lead Recovery UI | `/mctb/ai-lead-recovery` | **COMPLETE** (runtime in `lib/mctb/lead-recovery`) |

**MANUAL CERT ONLY:** `*_CONSOLE_NETWORK` rows in ledger (authenticated browser QA).

## B3. MCTB setup & onboarding — MOSTLY COMPLETE

| Section | Route | Status |
|---------|-------|--------|
| Setup overview | `/mctb/setup` | **COMPLETE** |
| Phone & forwarding | `/mctb/setup/phone` | **COMPLETE** |
| Recovery (rules + pause + cooldown) | `/mctb/setup/recovery` | **COMPLETE** (replaces legacy business-hours/follow-up) |
| Consent | `/mctb/setup/consent` | **COMPLETE** |
| Notifications / handoff | `/mctb/setup/notifications` | **COMPLETE** |
| Exclusions | `/mctb/setup/exclusions` | **COMPLETE** (ledger also lists NOT_STARTED in older setup table row — **superseded** by exclusions section PASS) |
| Text back message editor | `/mctb/setup/text-back` | Route exists; aligns with spec 10 |
| Missed-call rules | `/mctb/setup/missed-call-rules` | Legacy redirect → recovery |
| Links | `/mctb/setup/links` | Route exists |
| Test & activate | `/mctb/setup/test` | Route exists; ledger once NOT_STARTED — treat as **needs live QA** |
| Voicemail setup (config only) | `/mctb/setup/voicemail` | Ledger: NOT_STARTED for dedicated setup sub-page (inbox is complete) |
| Guided onboarding | `/onboarding/mctb` | **COMPLETE** (6 steps) |
| Numbers / A2P UI consolidation | Phone drawer + TFV | **COMPLETE** |

## B4. MCTB APIs (representative) — COMPLETE

Under `src/app/api/mctb/`:

- `setup`, `overview`, `missed-calls`, `analytics`, `consent-log`, `exclusions`, `handoff`, `try-it`, `live-test`, `onboarding`, `numbers`, `tfv`, `booking-links`, `ai-booking`, `lead-recovery`, `inbound-handling`, admin/bootstrap routes.

Telnyx voice: `mctb-entry`, `mctb-consent`, `mctb-press-1`, `mctb-texml-voicemail`, `texml-status`, `mctb-call-control` (legacy boundaries — pipeline doc defines certified path).

## B5. MCTB AI & payments adjacent — COMPLETE (code)

From `docs/MCTB-PRODUCT-IMPLEMENTATION-STATUS.md`:

| Feature | Status |
|---------|--------|
| AI Booking over SMS | COMPLETE | `handleMctbAiBookingInboundSms`, durable sessions |
| AI Lead Recovery | COMPLETE | Policies, multi-intent, simulate API, UI |
| Stripe Text-to-Pay / invoice | COMPLETE | Wired; env-dependent for Connect |
| Microsoft / Calendly booking targets | COMPLETE | Integration-owned; LR/AI booking consumes |

**MANUAL CERT ONLY:** Live Microsoft/Calendly/Stripe/SMS as in status doc.

## B6. MCTB frontend rebuild — IN PROGRESS (intentional)

- New shell under `/mctb/*` with page specs 01–12 as north star.
- Interim: `mctbShellHome()` and some legacy `/voice/*` links until full redirect pass.
- **Not a missing backend** — migration/polish track (`docs/MCTB-FRONTEND-REBUILD-KICKOFF.md`).

## B7. MCTB — automated test inventory (sample)

`package.json` includes extensive MCTB scripts, e.g.:

- `verify:mctb-final-pipeline`, `test:mctb-final-pipeline-contract`
- `test:mctb-try-it-*`, `test:mctb-setup-consent`, `test:mctb-setup-exclusions`, `test:mctb-onboarding-wizard-flow`
- `test:mctb-timeout-retry-voice-hardening`, `test:mctb-pipeline-trace`
- Lead recovery / e2e cert scripts under `docs/MCTB-AI-LEAD-RECOVERY-*` (manual live runbook for cloud)

---

# Part C — Cross-product (shared platform)

| Capability | Used by | Status |
|------------|---------|--------|
| Workspaces, auth, roles | Both | COMPLETE |
| Contacts / Conversations inbox | MCTB + Mass SMS + MCTB filter | COMPLETE |
| Phone numbers & A2P / TFV | MCTB sender, Voice numbers | COMPLETE (registration env-dependent) |
| SMS transport (Telnyx) | MCTB, notifications | COMPLETE |
| Jobs / cron (`processDueJobs`) | Post-call, digests, campaigns | COMPLETE |
| Prisma / migrations | Both | Deploy via `npm run db:deploy` |

---

# Appendix 1 — Quick route index

### Voice V3 (customer-facing)

- `/voice/setup` — Appointment Receptionist wizard entry
- `/voice/calls`, `/voice/calls/[id]`
- `/voice/analytics/after-hours`
- `/voice/knowledge`, `/voice/knowledge?tab=gaps`
- `/voice/needs-attention`, `/voice/callback-requests`
- `/integrations/webhooks` — Voice V3 outbound webhooks panel

### MCTB

- `/mctb`, `/mctb/missed-calls`, `/mctb/conversations`, `/mctb/voicemail`, `/mctb/analytics`
- `/mctb/setup/*`, `/onboarding/mctb`, `/mctb/ai-lead-recovery`
- `/f/mctb/[token]`

---

# Appendix 2 — Key libraries

| Domain | Path |
|--------|------|
| Voice V3 core | `src/lib/voice-v3/` |
| Voice V3 post-call | `src/lib/voice-v3/post-call/` |
| Voice V3 spam | `src/lib/voice-v3/spam-protection/` |
| LiveKit bridge | `src/lib/voice/python-runtime-bridge/` |
| MCTB runtime | `src/lib/mctb/`, `src/lib/agents/missed-call-text-back/` |
| MCTB TeXML ingress | `src/lib/mctb/texml-ingress/` |
| MCTB UI | `src/components/mctb/`, `src/app/(app)/mctb/` |

---

# Appendix 3 — Related source-of-truth docs

| Topic | Document |
|-------|----------|
| MCTB page completion | `docs/MCTB-PAGE-BY-PAGE-COMPLETION-LEDGER.md` |
| MCTB product status | `docs/MCTB-PRODUCT-IMPLEMENTATION-STATUS.md` |
| MCTB frozen voice pipeline | `docs/MCTB_FINAL_PRODUCTION_PIPELINE.md` |
| Voice V3 agent tools | `docs/VOICE-V3-PRODUCTION-AGENT-COMPLETION-REPORT.md` |
| Voice V3 post-call audit | `docs/VOICE-V3-AFTER-HOURS-POST-CALL-AUDIT.md` |
| Voice V3 spam protection | `docs/VOICE-V3-SPAM-SOLICITOR-PROTECTION-FINAL-REPORT.md` |
| MCTB page specs | `docs/TRANSOVO-MCTB-PAGE-BUILD-SPECS.md` |

---

**End of inventory.** For GitHub: clone or browse  
`docs/TRANSOVO-V1-AI-AGENT-AND-MCTB-FEATURE-INVENTORY.md`  
on branch `cursor/voice-v3-after-hours-post-call-2304` (or `master` after merge).
