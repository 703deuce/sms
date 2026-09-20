# AI Voice Agent (Voice V3 / Appointment Receptionist) — feature status

**Purpose:** One copy-paste reference for everything built around the **after-hours AI receptionist** (Appointment Receptionist wizard, LiveKit + GPT-Live “Amy”, GPT delegation “Astra”). **Not** MCTB, mass SMS, Smart Routing, or generic Telnyx “Caller Amy” Voice V2 unless noted as legacy.

**Last updated:** 2026-09-20  
**Repo baseline:** `master` (through post-call / spam work) **plus** in-flight **Google Calendar** on branch `cursor/google-calendar-voice-v3-implementation-2304` (draft PR #459). If Google rows say “in-flight,” they are **not** on `master` until that PR merges.

**Legend**

| Label | Meaning |
|--------|---------|
| **DONE** | Implemented and wired on the canonical Voice V3 path in repo. |
| **MOSTLY DONE** | Code complete; small gaps, polish, or **your** live PSTN/OAuth sign-off still open. |
| **NOT DONE** | Missing, stubbed, or config-only without live runtime. |
| **INTENTIONAL** | By design (frozen, deferred product, or legacy preserved). |
| **MANUAL SIGN-OFF** | You must validate on a real phone / production workspace (not “missing code”). |

**Combined inventory (Voice + MCTB):** `docs/TRANSOVO-V1-AI-AGENT-AND-MCTB-FEATURE-INVENTORY.md`  
**All gaps (wizard vs runtime, P0–P2):** `docs/AI-VOICE-AGENT-GAP-REGISTER.md`  
**Google Calendar detail only:** `docs/GOOGLE-CALENDAR-INTEGRATION-STATUS.md`

---

## 0. What this product is (scope)

| In scope | Out of scope (separate products / deferred) |
|----------|-----------------------------------------------|
| Inbound PSTN → SIP → **LiveKit** room → GPT-Live + Astra tools | **MCTB** TeXML missed-call + SMS (`mctb_texml_final_v1`) |
| Appointment Receptionist **wizard** → publish → live calls | **Mass texting** campaigns / drips |
| Find / book / manage appointments (provider-backed) | **Smart Routing** live-call routing product |
| Transfer, callback, send booking link, intake, knowledge answers | **Generic AI receptionist** builder (`/voice/agents` LiveKit factory) — deferred per V1 launch |
| Post-call recording, transcript, summary, notifications, webhooks | Full **contact-center** monitoring / barge-in |
| Spam/solicitor policies + blocklist | **Voice V2** Telnyx assistant path — preserved, not the forward V3 path |

**Mental model:** Caller ↔ **Amy** (audio) → delegates to **Astra** (tools) → Microsoft/Google/callback/transfer/SMS → structured results back to Amy.

**Media truth (do not confuse with MCTB voicemail):**

| Piece | Technology |
|--------|------------|
| Conversation audio | LiveKit + GPT-Live (OpenAI Realtime via Telnyx transport where configured) |
| Call recording | **LiveKit Egress** (dual-channel agent mix) → storage → `VoiceRecording` |
| Post-call transcript | **Deepgram** on recording file (`post-call/transcription.ts`) |
| Structured AI summary | LLM + **system facts** (`system-facts.ts` overrides narrative when outcomes are known) |

Doc: `docs/VOICE-V3-RECORDING-MEDIA-PATH-DECISION.md`

---

## 1. Runtime & telephony

| Feature | Status | Where / notes |
|---------|--------|----------------|
| Telnyx SIP → LiveKit inbound session | **DONE** | `resolveVoiceV3LiveKitSession`, Python worker `voice-runtime-python/transovo_voice/voice_v3/` |
| Python ↔ Node tool bridge | **DONE** | `executeVoiceV3ToolForLiveKit`, `/api/internal/voice-runtime` |
| Inbound `VoiceCall` persist + wizard metadata | **DONE** | `persistInboundCallForPython`, `voiceV3WizardBound` |
| Call runtime, intake merge, call rules | **DONE** | `src/lib/voice-v3/state/`, intake objective module |
| Conversation freshness / turn revision | **DONE** | `src/lib/voice-v3/conversation/` |
| Amy → Astra delegation protocol | **DONE** | Prompts + delegation extract/complete pipeline |
| Operation lifecycle (find/book in flight, stale reads) | **DONE** | `operations/registry`, `find-dispatch` stale generation |
| LiveKit egress webhook ingest | **DONE** | `livekit-egress-ingest.ts`, `/api/webhooks/livekit` |
| Post-call job enqueue on eligible hangup | **DONE** | `voice_v3_post_call`, `post-call-router.ts` |
| Media backend pinning (LiveKit) | **DONE** | `src/lib/voice/media-backend/` |
| Native `end_call` (Python) | **DONE** | LiveKit hangup tool |
| `report_unwanted_solicitor` (Python + billing metadata) | **DONE** | Not in Node Astra catalog; LiveKit tool list in `voice-v3-livekit.ts` |
| Real PSTN audio quality / interruption under latency | **MANUAL SIGN-OFF** | Policy doc: `VOICE-V3-LIVEKIT-GPT-LIVE-INTERRUPTION-POLICY.md` |

---

## 2. Agent tools (Astra function tools)

Catalog: `src/lib/voice-v3/tools/voice-tool-catalog.ts`  
Contracts: `src/lib/voice-v3/tools/astra-tool-contracts.ts`

| Tool | Status | Enabled when |
|------|--------|----------------|
| `update_intake` | **DONE** | Always (intake objective / fields) |
| `set_scheduling_preference` | **DONE** | Direct calendar booking strategies |
| `find_availability` | **DONE** | Microsoft or Google direct calendar |
| `book_appointment` | **DONE** | Microsoft or Google direct calendar |
| `find_appointment` | **DONE** | Microsoft or Google direct calendar |
| `reschedule_appointment` | **DONE** | Microsoft or Google direct calendar |
| `cancel_appointment` | **DONE** | Microsoft or Google (+ confirmation policy) |
| `transfer_call` | **DONE** | Wizard transfer capability |
| `end_call` | **DONE** | Always |
| `send_booking_link` | **DONE** | `bookingStrategy === SEND_LINK` + configured URL |
| `request_callback` | **DONE** | Callback capability; required fields from wizard |
| `report_unwanted_solicitor` | **DONE** | LiveKit/Amy path (spam decline policy) |

**Concurrency:** `parallel_tool_calls` default **off** for delegation (`VOICE_V3_PARALLEL_TOOL_CALLS` opt-in).

**Confirmations:** Cancel requires `confirmed=true` in executor (`confirmation-policy.ts`).

---

## 3. Booking modes (`bookingStrategy`)

Authority: `src/lib/voice-receptionist-wizard/booking-strategy.ts` → compiled `VoiceV3AgentConfig.scheduling.bookingStrategy`.

| Mode | Live Voice V3 scheduling | Status | Notes |
|------|--------------------------|--------|--------|
| `MICROSOFT_365` | Find / book / find / reschedule / cancel | **DONE** | Frozen path; regression-sensitive |
| `GOOGLE_CALENDAR` | Same tool surface, Google provider | **MOSTLY DONE** | **Code on PR #459 branch**; merge + **MANUAL SIGN-OFF** (OAuth, PSTN book/manage) |
| `SEND_LINK` | `send_booking_link` SMS | **DONE** | `booking-link/execute-send-booking-link.ts` |
| `REQUEST_ONLY` | Intake + messaging; no live calendar mutation | **DONE** | No find/book tools authorized |
| `NONE` | No appointment booking capability | **DONE** | Capability flags off |
| `CALENDLY` | — | **NOT DONE** (V3 live) | Wizard fields compile (`FUTURE_CALENDLY` in manifest); **no** `voice-v3/calendar` Calendly dispatch. Legacy Voice V2 / other paths may still reference Calendly. UI de-emphasized in favor of Google in appointments step. |

**Direct calendar providers in V3:** Microsoft + Google only (`calendar-provider-runtime.ts`).  
**Google detail:** `docs/GOOGLE-CALENDAR-INTEGRATION-STATUS.md`

---

## 4. Appointment Receptionist wizard & publish

UI: `src/components/solutions/appointment-receptionist/`  
Entry: `/voice/setup` (Appointment Receptionist)

| Wizard area | Status | Notes |
|-------------|--------|--------|
| Goals | **DONE** | Capabilities drive compile |
| Phone / number assignment | **DONE** | Tied to agent publish + Telnyx routing |
| Voice (Amy persona, accent, ElevenLabs where used) | **DONE** | Preview APIs exist |
| Information (business facts, hours, website URL) | **DONE** | `websiteUrl` → knowledge retrieval config |
| Appointments (types, duration, booking permission) | **DONE** | Microsoft + Google options; Calendly legacy state |
| Call handling (transfers, maturity, urgency) | **DONE** | Emergency transfer editor |
| Test | **DONE** | `/api/voice/agents/[id]/v3-wizard-live-test` |
| Activate / publish | **DONE** | Compile manifest + Telnyx/LiveKit provisioning hooks |
| V3 config compile | **DONE** | `compile-voice-v3-agent-config.ts` |
| Wizard ↔ runtime manifest inventory | **DONE** | `wizard-v3-manifest-builder.ts`, control inventory |
| Intake fields & **intake objectives** | **DONE** | `intake-objective/*`, operation requirements |
| Transfer targets & validation | **DONE** | Transfer wizard state + activation checks |
| After-hours **notifications** editor | **DONE** | Recipients, routing, digest-related settings |
| **Callback** required fields editor | **DONE** | Compiled to `request_callback` requirements |
| **Spam / unwanted calls** editor | **DONE** | `spam-unwanted-calls-editor.tsx` |
| Telnyx inbound screening sync on publish | **DONE** | `sync-telnyx-inbound-screening.ts` |
| Operating maturity / urgency rules | **DONE** | Editors + compile bridge |
| **Business auto-import** (website crawl → wizard) | **NOT DONE** / unverified | Inventory once claimed COMPLETE; no dedicated `VoiceV3BusinessImport` module found in current tree—treat as **partial** (website URL + manual KB) until re-audited |
| **On-call routing** (manifest) | **NOT DONE** | Manifest marks `future on-call routing` |
| Wizard browser test without auth | **MANUAL SIGN-OFF** | Needs dev bypass or logged-in session |

---

## 5. Transfers, callbacks, end-call

| Feature | Status | Notes |
|---------|--------|--------|
| Transfer system (targets, warm/cold, outcomes) | **DONE** | `transfer_call`, Python bridge, notifications |
| Transfer failure / emergency notifications | **DONE** | `notify-transfer-outcome.ts` |
| Callback contract + shared facts with booking | **DONE** | Callback reports in `docs/VOICE-V3-CALLBACK-*` |
| End-call native tool | **DONE** | `VOICE-V3-END-CALL-IMPLEMENTATION-REPORT.md` |
| Transfer preflight / cert docs | **DONE** | Transfer directive + cert readiness docs |

---

## 6. Post-call pipeline (after-hours)

Processor: `processVoiceV3CompletedCall()` (`post-call/process-completed-call.ts`).

| Stage | Status | Implementation |
|-------|--------|----------------|
| Wait for recording ready | **DONE** | Retries via `voice_v3_post_call` job |
| Deepgram transcription | **DONE** | `post-call/transcription.ts` |
| Structured summary + system facts | **DONE** | `summary.ts`, `system-facts.ts` |
| Knowledge gap candidates | **DONE** | `VoiceKnowledgeGap`, API + UI tab |
| Post-call email/SMS (summary) | **DONE** | Same object as call detail AI Summary card |
| Skip summary for spam/solicitor | **DONE** | `shouldSkipSummaryEmail` |
| Outbound webhooks (signed, retries) | **DONE** | `src/lib/voice-v3/webhooks/` |
| After-hours analytics aggregates | **DONE** | `voiceV3Analytics`, `/api/voice/analytics/after-hours` |
| Daily digest email | **DONE** | `digest-email.ts`, cron `voice_after_hours_digest_scan` |
| Retry transcript (staff) | **DONE** | `POST /api/voice/calls/[id]/retry-transcript` |
| Listen to egress file / Brevo / webhook receiver in prod | **MANUAL SIGN-OFF** | |

---

## 7. Spam & solicitor protection

| Feature | Status |
|---------|--------|
| Wizard policies (spam likely, solicitor decline) | **DONE** |
| Telnyx screening header → call metadata | **DONE** |
| Workspace blocklist | **DONE** | `/api/voice/blocked-callers` |
| Block caller from call detail | **DONE** |
| Solicitor billing / outcome recording | **DONE** |
| Screening badges on calls list/detail | **DONE** |
| Real carrier `spam_likely` on PSTN | **MANUAL SIGN-OFF** |

Docs: `docs/VOICE-V3-SPAM-SOLICITOR-PROTECTION-FINAL-REPORT.md`

---

## 8. Knowledge & RAG

| Feature | Status |
|---------|--------|
| Knowledge bases CRUD | **DONE** | `/api/voice/knowledge/*` |
| Text / URL / file sources | **DONE** | Embeddings via Telnyx RAG integration |
| Test search in UI | **DONE** | `/voice/knowledge` |
| Runtime business answers during call | **DONE** | `resolve-business-answer.ts` |
| Post-call gap queue | **DONE** | See post-call section |

---

## 9. Notifications (in-call + post-call)

Loaded per call: `load-config-for-call.ts`

| Event | Channels | Status |
|-------|----------|--------|
| Callback requested | Email / SMS / in-app | **DONE** |
| Appointment booked | Email / SMS / in-app | **DONE** |
| Transfer connected / failed | Email / SMS / in-app | **DONE** |
| Post-call summary | Email / SMS | **DONE** |
| Daily digest | Email | **DONE** |
| Legacy immediate call completed | Optional | **DONE** | May defer when V3 post-call runs |

---

## 10. Customer & ops UI (Voice V3)

| Surface | Route | Status |
|---------|-------|--------|
| Appointment Receptionist wizard | `/voice/setup` | **DONE** |
| Calls inbox | `/voice/calls` | **DONE** | Filters, screening, post-call hints |
| Call detail | `/voice/calls/[id]` | **DONE** | Recording, summary, transcript, block |
| After-hours analytics | `/voice/analytics/after-hours` | **DONE** |
| Knowledge + gaps | `/voice/knowledge` | **DONE** |
| Callback requests | `/voice/callback-requests` | **DONE** |
| Needs attention | `/voice/needs-attention` | **DONE** |
| Voice outbound webhooks | Integrations panel | **DONE** |
| Operations / testing pages | `/voice/operations`, `/voice/testing` | **DONE** | Internal / cert oriented |
| Real-time supervisor wallboard | — | **NOT DONE** | Partial ops pages only |

---

## 11. Integrations (calendar & telephony)

| Integration | Voice V3 use | Status |
|-------------|--------------|--------|
| Microsoft 365 calendar OAuth | Direct book/manage | **DONE** |
| Google Calendar OAuth (`calendar.events.owned`) | Direct book/manage | **MOSTLY DONE** | PR #459; Google Cloud app verification **MANUAL SIGN-OFF** |
| Calendly | Live V3 find/book | **NOT DONE** | Config fields only |
| Telnyx numbers / SIP | Ingress | **DONE** |
| LiveKit cloud / egress | Media + recording | **DONE** (env-dependent) |
| Deepgram | Post-call transcript | **DONE** (env-dependent) |
| Brevo / SMS transport | Notifications + SEND_LINK | **DONE** (env-dependent) |

---

## 12. Legacy & parallel code (still in repo)

| Surface | Role | Status |
|---------|------|--------|
| Voice V2 after-hours (Telnyx assistant, tools webhook) | Legacy contract preserved | **INTENTIONAL** | `docs/VOICE-V2-AFTER-HOURS-PRODUCT-CONTRACT.md` — do not break; V3 is forward path for wizard |
| `/voice/agents`, flows, campaigns | Old agent builder / outbound | **INTENTIONAL** | Hidden or secondary; generic receptionist **deferred** |
| `/voice/inbound-routing`, Smart Routing webhooks | Separate product | **INTENTIONAL** | Not Appointment Receptionist V3 |
| `src/lib/voice/calendar/oauth.ts` (broad Google scope) | Duplicate legacy OAuth | **NOT DONE** cleanup | Integrations use `src/lib/calendar/oauth.ts` |
| MCTB TeXML routes under `/api/telnyx/voice/mctb*` | Missed call product | **INTENTIONAL** | Never mix with V3 LiveKit ingress |

---

## 13. Known gaps & honest limits

**Full gap-by-gap list (104 wizard controls not implemented, RAG, after-hours policy, qualification, transfers, booking behavior, etc.):** `docs/AI-VOICE-AGENT-GAP-REGISTER.md`

| Item | Status |
|------|--------|
| Full PSTN certification for **every** booking mode × edge case | **MANUAL SIGN-OFF** |
| Google Calendar on `master` | **NOT DONE** until PR #459 merges |
| Calendly live scheduling in V3 | **NOT DONE** |
| In-call linked KB / website RAG on PSTN | **NOT DONE** (hot context only) |
| After-hours `whenClosed.*` policy enforcement | **NOT DONE** |
| Qualification / urgency rules enforcement | **NOT DONE** |
| `bookingBehavior` toggles in FIND/BOOK executors | **NOT DONE** (compile only) |
| Multi-calendar picker (beyond `primary` / env calendar id) | **NOT DONE** |
| On-call rotation routing in wizard | **NOT DONE** (manifest future) |
| Website crawl auto-fill wizard | **NOT DONE** / needs re-audit |
| Contact-center features (monitor, whisper, barge) | **NOT DONE** |
| Voice V2 post-call stubs | **INTENTIONAL** unused by V3 |

---

## 14. Production sign-off gates (you close these)

Code may be **DONE** while product completion is **NOT DONE** until you confirm:

| Gate | Microsoft agent | Google agent (after merge) |
|------|-----------------|----------------------------|
| Wizard publish → live PSTN answers | **MANUAL SIGN-OFF** | **MANUAL SIGN-OFF** |
| Find → book on real calendar | **MANUAL SIGN-OFF** | **MANUAL SIGN-OFF** |
| Reschedule + cancel | **MANUAL SIGN-OFF** | **MANUAL SIGN-OFF** |
| Transfer to real target | **MANUAL SIGN-OFF** | **MANUAL SIGN-OFF** |
| Callback + notifications received | **MANUAL SIGN-OFF** | **MANUAL SIGN-OFF** |
| SEND_LINK SMS received | **MANUAL SIGN-OFF** | N/A |
| Post-call recording + summary + email | **MANUAL SIGN-OFF** | **MANUAL SIGN-OFF** |
| Spam decline + blocklist | **MANUAL SIGN-OFF** | **MANUAL SIGN-OFF** |

---

## 15. Key code locations

| Domain | Path |
|--------|------|
| Voice V3 core | `src/lib/voice-v3/` |
| Tools & dispatch | `src/lib/voice-v3/tools/`, `src/lib/voice-v3/calendar/` |
| Google provider (in-flight) | `src/lib/voice-v3/calendar/google/` |
| Microsoft provider | `src/lib/voice-v3/calendar/microsoft/` |
| Post-call | `src/lib/voice-v3/post-call/` |
| Spam | `src/lib/voice-v3/spam-protection/` |
| LiveKit bridge | `src/lib/voice/python-runtime-bridge/` |
| Wizard | `src/components/solutions/appointment-receptionist/` |
| Python worker | `voice-runtime-python/transovo_voice/voice_v3/` |

---

## 16. Related source-of-truth docs

| Topic | Document |
|-------|----------|
| Architecture | `docs/VOICE-V3-FINAL-ARCHITECTURE.md`, `docs/VOICE-V3-ARCHITECTURE.md` |
| Agent tools completion | `docs/VOICE-V3-PRODUCTION-AGENT-COMPLETION-REPORT.md` |
| Post-call audit | `docs/VOICE-V3-AFTER-HOURS-POST-CALL-AUDIT.md` |
| LiveKit cutover | `docs/VOICE-V3-LIVEKIT-CUTOVER-STATE.md` |
| Intake objectives | `docs/VOICE-V3-INTAKE-OBJECTIVE-REPORT.md` |
| Microsoft appointment management | `docs/VOICE-V3-MICROSOFT-APPOINTMENT-MANAGEMENT-FINAL-GATE-REPORT.md` |
| Google Calendar | `docs/GOOGLE-CALENDAR-INTEGRATION-STATUS.md` |
| Wizard mapping | `docs/VOICE-V3-PROMPT-WIZARD-MAPPING-AUDIT.md` |

---

## 17. Summary verdict

| Area | Verdict |
|------|---------|
| **Voice V3 core runtime** (LiveKit, delegation, tools bridge, state) | **DONE** |
| **Microsoft direct booking & appointment management** | **DONE** in repo — **MANUAL SIGN-OFF** for your tenant |
| **Google direct booking** | **MOSTLY DONE** on PR #459 — merge + **MANUAL SIGN-OFF** |
| **SEND_LINK, REQUEST_ONLY, callbacks, transfers, end_call** | **DONE** in repo |
| **Calendly on V3 live path** | **NOT DONE** |
| **Wizard + publish + compile** | **DONE** |
| **Post-call, analytics, knowledge gaps, webhooks, digest** | **DONE** in repo |
| **Spam / solicitor / blocklist** | **DONE** in repo |
| **Ops UI** (calls, detail, analytics, knowledge) | **DONE** |
| **Deferred / legacy** (V2 assistant, generic agents, SR, MCTB voice) | **INTENTIONAL** — separate tracks |

**Bottom line:** The **Appointment Receptionist / Voice V3** stack is **feature-complete in code** for Microsoft-backed scheduling, messaging modes, transfers, callbacks, knowledge, post-call, and spam—plus **Google scheduling implemented on the integration branch**. **Product “done”** still requires your **live PSTN and OAuth validation** per Section 14, and **Calendly + on-call + website auto-import** are **not** finished V3 capabilities.

---

**End of document.** Copy path: `docs/AI-VOICE-AGENT-FEATURE-STATUS.md`
