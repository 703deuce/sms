# MCTB Voice Agent wizard → Voice V3 AI receptionist connectivity audit

**Updated for production code:** `master` @ `47adf8d5f20be4f93aafd1aa5fa987285e61e0ff`  
**Scope:** **Code completeness only** — PSTN/browser certification and “not tested yet” do **not** downgrade ratings. External prerequisites (OAuth, SMS sender, indexed KB) still count as **Partial** where the code cannot act without them.

**Question:** For each wizard surface, does a **Save / Activate (republish)** change what the **Voice V3 GPT-Live receptionist** (or its **post-call** product hooks) actually does on the **next** session?

**Runtime path (authoritative):**

1. Wizard **Save draft** or **Activate** → `POST /api/solutions/appointment-receptionist` → `buildWizardAgentConfig()` stores wizard snapshot in `VoiceAgent` draft/published config (`advanced.appointmentReceptionistWizard` + `capabilityPack: appointment_receptionist`).
2. On each call / live test → `resolveVoiceV3AgentConfigForAgent()` → `compileVoiceV3AgentConfig()` → GPT-Live session + Astra delegation (`src/lib/voice-v3/config/from-published-agent.ts`).

**Legend**

| Rating | Meaning (code) |
|--------|----------------|
| **Connected** | Persists on save/activate; compiles into `VoiceV3AgentConfig`; has a **runtime consumer** (in-call prompts/tools/policy, telephony publish, or **post-call** handlers wired from compiled config). |
| **Partial** | Persists/compiles but: **telephony/MCTB shell only** (not GPT-Live brain), **subset of sub-fields** wired, **external setup required** (calendar OAuth, SMS sender, vector store index), or **prompt-only** with no tool effect. |
| **Not connected** | Display/navigation, test/quality **metadata only**, stub UI, or persisted **with no Voice V3 consumer**. |

**MCTB-specific:** The **Call handling** card (`PATCH /api/mctb/inbound-handling`) is **outside** the wizard republish path. It switches MCTB TeXML vs Voice Agent on the same ingress; it is not updated when you click Save on a wizard step.

---

## Page chrome (above wizard)

| UI element | Rating | Notes |
|------------|--------|-------|
| Page title / status pill (Active, Draft, Needs attention) | **Partial** | Reflects `VoiceAgent` status from API; not a wizard field. |
| Subtitle | **Not connected** | Static copy. |
| **Test agent** button | **Not connected** | Scrolls to footer; does not publish. |
| **Call handling** card (MCTB vs Voice Agent, Turn on / Switch) | **Partial** | Real via `inbound-handling` API; **not** wizard republish. |
| **Finish setup to enable** link | **Not connected** | Navigation only. |

---

## Wizard chrome

| UI element | Rating | Notes |
|------------|--------|-------|
| Stepper (8 steps) | **Partial** | Navigation + readiness; republish is Save/Activate. |
| Mobile “Step N of M” | **Not connected** | Display. |
| **Back** | **Not connected** | Navigation. |
| **Save** | **Connected** | Persists draft; next call/live test uses updated snapshot. |
| **Continue** | **Partial** | Navigation; may trigger `create_draft` / `save_draft` before Test. |
| Footer error text | **Not connected** | Display. |

---

## Step 1 — Purpose

| UI element | Rating | Notes |
|------------|--------|-------|
| **Agent name** (`solutionName`) | **Partial** | Control plane (page title). Spoken name is **`agentName`** on Voice step. |
| **Capability cards** (8 capabilities) | **Connected** | `capabilities.*` → `voice-tool-catalog` + `authorize-tool-for-config` + `effective-tool-authorization`. |
| **When should this agent answer?** (3 radios) | **Partial** | `answerWhen` / `ringBehavior` → telephony/routing publish; MCTB inbound-handling + forwarding can override ingress. |
| Side panel **Agent summary** | **Not connected** | Read-only. |

---

## Step 2 — Phone

| UI element | Rating | Notes |
|------------|--------|-------|
| Readiness chips | **Not connected** | Derived display. |
| **MCTB line connected** callout | **Partial** | `/api/mctb/inbound-handling`; may set `phoneNumberId`. |
| **Use existing MCTB line** / number source cards | **Partial** | Persist + activate assigns DID (`telephony.phoneNumberId`, `phoneNumberE164`). |
| Number list / forward-to buttons | **Partial** | Same. |
| Buy new / Open My Numbers | **Not connected** | Navigation. |
| Info callouts | **Not connected** | Copy. |
| **Answering behavior** (5 radios) | **Partial** | Telephony/routing layer. |
| **Ring team for** (seconds) | **Partial** | Telephony-layer (`ringTeamSeconds`). |
| **Call recording** | **Partial** | Provider/Telnyx on publish; not GPT-Live instructions. |
| **Connection greeting** (mode, text, audio URL, preview) | **Partial** | Pre-AI Telnyx audio; distinct from Voice step opening greeting. |
| Side panel **Phone setup** / call flow preview | **Not connected** | Display. |

---

## Step 3 — Business Knowledge

| UI element | Rating | Notes |
|------------|--------|-------|
| **Search uploaded documents during calls** | **Connected** | Compiles `knowledge.retrieval` → `resolveAgentKnowledgeRetrieval` → LiveKit **FileSearch** + catalog tool **`search_business_knowledge`**. **Partial** until KB indexed / vector stores exist (external). |
| Source cards (website, guided profile, upload, connect) | **Partial** | Persist + activate processors; **Connected** once ingest completes and revision is on agent. |
| Website URL + **Scan** | **Partial** | Populates items/KB via scan jobs; code path complete. |
| Guided profile + **Save profile to knowledge** | **Connected** | `knowledgeItems` → `hotContextFromWizard` → Amy/Astra prompts. |
| Upload files | **Partial** | Ingest + retrieval flags; same as RAG path. |
| Connect existing KB + Integrations links | **Partial** | `linkedKnowledgeBaseId` → retrieval resolver; needs linked KB + index. |
| **Knowledge item** list (status, Approve, Edit) | **Connected** | Approved summaries → hot context in compiled config. |
| **Approve all imported facts** | **Connected** | Same. |
| **Business hours & holidays** (weekly + holidays on this step) | **Connected** | `operatingMaturity.businessSchedule` → `operatingPolicy` → `resolveVoiceV2OperatingState` (includes **holidays**) → `gateCapabilitiesForOperatingState` + FIND/BOOK + spoken `hoursDisplay`. |
| Side panel **Knowledge quality** | **Not connected** | Display. |

---

## Step 4 — Booking

*Step hidden if no booking capability.*

| UI element | Rating | Notes |
|------------|--------|-------|
| **Microsoft Calendar** provider card | **Partial** | OAuth via Integrations; code gates FIND/BOOK on `calendar.connectionId`. |
| **Google Calendar** (when selected) | **Partial** | V3 Google provider + dispatch in repo; **Partial** until OAuth connected (external). |
| **Calendly** provider card | **Partial** | UI + compile only for connection; live book strategy **not connected** (see below). |
| **When someone wants an appointment** (5 strategy radios) | **Connected** | Compiles `bookingStrategy`; tools authorized per strategy. |
| Calendly event type select | **Not connected** | Compiled; **no V3 Calendly booking executor**. |
| Send link: URL, SMS sender, consent, preview, label | **Connected** | `SEND_LINK` + `send_booking_link` tool + SMS plumbing. **Partial** if workspace has no outbound SMS sender (external). |
| **Appointment types** table | **Connected** | `enabled`, `durationMin`, `name`, `minNotice`, `maxDaysAhead`, `bookingPermission`, etc. → `services[]` + `service-policy` / FIND/BOOK. |
| **Add appointment** | **Connected** | Same pipeline. |
| **Appointment configuration** (per-type detail) | **Connected** | Wired via `servicePolicyFromWizardType` / `resolveActiveServicePolicy`. |
| **Enable caller qualification** + ZIP + rules | **Connected** | `evaluateVoiceV3Qualification` + `effective-tool-authorization` blocks calendar tools. |
| **What Amy must collect** / **Add field** | **Connected** | `collectFields` → `intakeFields` → `update_intake` + BOOK/callback gates. |
| **Booking permissions** (book directly / suggest / send link) | **Connected** | `bookingPermission` → `serviceAllowsLiveBooking` / tool auth. |
| Side panel **Appointment tools** | **Not connected** | Display. |

### Booking strategy → V3 (code)

| Strategy | Rating |
|----------|--------|
| **Microsoft 365 — Book for them** | **Connected** (calendar connected) / **Partial** (OAuth external) |
| **Google — Book for them** | **Partial** (code present; OAuth + provider connection external) |
| **Send our booking link** | **Connected** / **Partial** (SMS sender external) |
| **Take preferred time / confirm later (REQUEST_ONLY)** | **Connected** (`submit_appointment_request`) |
| **Calendly — book on call** | **Not connected** |
| **Message / follow up (NONE)** | **Connected** (live book tools off; message/callback paths) |

---

## Step 5 — Call Handling

| UI element | Rating | Notes |
|------------|--------|-------|
| MCTB flow strip (5 steps) | **Not connected** | Illustration. |
| **Booking behavior** checkboxes (6 in state; 4+ in UI) | **Connected** | `bookingBehavior.*` → Astra scheduling instructions + SMS-after-book flag. |
| **Emergency & human transfer** — policy triggers | **Connected** | `transferTriggers[]` in prompts + transfer policy. |
| Enable emergency & human transfer | **Connected** | `voiceV2HumanTransferEnabled` gates `transfer_call`. |
| Allow caller-requested human | **Connected** | `allowCallerRequestedTransfer`. |
| Routing (single vs waterfall) | **Connected** | `transferRouting` + `transferPlanSteps` → `authorize-transfer` waterfall semantics. |
| Default ring timeout | **Connected** | `transferRingSeconds`. |
| Transfer contacts (name, phone, mode, timeout, reorder) | **Connected** | Destinations + plan steps → `transfer_call` executor. **Partial** for provider-specific warm/voicemail edge behavior. |
| Detect voicemail on transfer | **Partial** | Compiled; provider/LiveKit-dependent. |
| Transfer fallback radios | **Connected** | `transferFallback`. |
| **Urgent-call handling** + rules editor | **Connected** | `evaluateVoiceV3Urgency` in **`authorize-transfer`** and **`execute-request-callback`**. |
| **Sales / solicitation handling** | **Connected** | `spamProtection` from wizard → `report_unwanted_solicitor` + prompts + blocklist + Telnyx screening publish. |
| **Take messages and callback requests** | **Connected** | `callbackRequestsEnabled` + `request_callback` + `take_message`. |
| **Required before recording a callback** | **Connected** | `callbackRequiredCollectFieldIds` → operation requirements. |
| Callback UX (ANI, preferred time, confirm number) | **Connected** | `execute-request-callback` consumes flags. |
| **After-hours notifications** (events + recipients) | **Connected** | `afterHoursNotifications` → `notify-*` on transfer/book/callback/call-completed (post-call / staff notify). |
| **AI Call Recovery** (all fields) | **Connected** | `recovery.*` compiled → `maybeSendVoiceV3AiCallRecoverySms` from **call-history post-process**. **Partial** if no SMS sender (external). |
| **Long-term caller memory** | **Not connected** | `longTermMemory` compiles to `integrations`; **no V3 in-call memory consumer** in tool/session layer. |
| **Enable CRM tools** | **Not connected** | `crmEnabled` compiles; **no CRM tools** in V3 catalog. |
| **After-hours behavior** (when closed grid) | **Connected** | `whenClosed.*` → `gateCapabilitiesForOperatingState` in **`effective-tool-authorization`**. |
| **On-call schedule** | **Connected** | `onCallSchedule` → **`authorize-transfer`** on-call destination selection. |
| **Callback SLA** selects | **Connected** | `operatingPolicy.callbackSla` → metadata on callback persist + **overdue scan job** (in-app notification; **no auto-dial** in code). |
| Side panel **Call handling preview** | **Not connected** | Display. |

---

## Step 6 — Voice

| UI element | Rating | Notes |
|------------|--------|-------|
| **Identity** (agent name, business name, role, tone, style, language) | **Connected** | `identity` + `conversation` → GPT-Live + Astra instructions. |
| **Greeting behavior** (AI vs caller first) | **Connected** | `speaksFirst`. |
| **Opening greeting** textarea | **Connected** | Live frontend instructions. |
| **Conversation behavior** toggles (5) | **Connected** | `conversationBehaviors`. |
| **Choose a voice** + Play sample | **Connected** | `voiceId` → `telephony.liveVoiceId` on GPT-Live session (preview uses separate TTS API). |
| Speaking pace, accent, backchannels, patience, interrupts | **Connected** | `livePromptControls` in instructions. |
| Custom OpenAI voice ID (flag-gated) | **Partial** | Compiles when env flag on; needs org custom voice access. |
| Side panel **Voice settings** | **Not connected** | Display. |

---

## Step 7 — Test

| UI element | Rating | Notes |
|------------|--------|-------|
| **Test scenarios** list | **Partial** | `testScenario` persisted; manual guidance only (no runtime branch on scenario id). |
| Expected outcomes / “Try saying” | **Not connected** | Copy. |
| Test mode tabs (browser / my phone / call agent) | **Connected** | Browser path compiles draft and starts V3 WebRTC/GPT-Live when `agentId` exists. |
| **Save draft for test** / **Build & start live test** | **Connected** | Persist + live session from compiled draft. |
| **Mark scenario checked** | **Partial** | Sets `lastTestPassed` for activate checklist only. |
| Scenario tools checklist | **Not connected** | UI placeholder; does not execute tools. |
| **Agent Quality Studio** | **Not connected** | Deprecated / hidden; no suite runtime. |
| Side panel **Test summary** | **Not connected** | Display placeholders. |

---

## Step 8 — Activate

| UI element | Rating | Notes |
|------------|--------|-------|
| Summary card / activation issues list | **Partial** | Gating UX from real checks. |
| Readiness grid | **Partial** | Mix of real gates (`lastTestPassed`) and display. |
| **Your receptionist will** list | **Not connected** | Marketing copy. |
| **Activation options** — Activate now | **Connected** | Publish + hooks (KB, Telnyx, spam screening sync, etc.). |
| **Schedule** / **Duplicate location** | **Partial** | Persisted; promote/duplicate product paths incomplete vs Activate now. |
| Schedule datetime input | **Partial** | Needs scheduled promote job. |
| Side panel **Activate now** / **Run final test** | **Connected** / **Partial** | Publish pipeline vs navigate to test. |
| Deployment side panel schedule line | **Not connected** | Static display; not wired to weekly editor. |

---

## Summary counts (UI groups, code-only)

Excluding pure copy/navigation/side-panel display:

| Rating | Approx. share | Meaning |
|--------|----------------|---------|
| **Connected** | ~55–60% | Full compile + runtime consumer (in-call, telephony publish, or post-call). |
| **Partial** | ~25–30% | External prerequisite, telephony-only, metadata/checklist, or provider edge behavior. |
| **Not connected** | ~10–15% | Calendly live book, CRM, long-term memory, Quality Studio, decorative UI. |

---

## Code-complete gaps (wizard suggests more than V3 consumes)

1. **Calendly live booking** — UI + compile; **no V3 booking executor** for Calendly strategy.  
2. **CRM enabled** — compiles; **no CRM tools** on GPT-Live catalog.  
3. **Long-term caller memory** — flag on config; **no session memory engine** wired in V3 calls.  
4. **Quality Studio** — not implemented.  
5. **MCTB Call handling switch** — separate API; not updated by wizard Save.  
6. **Ingress vs wizard “when to answer”** — telephony/MCTB can disagree with wizard routing fields.  
7. **Callback SLA** — code notifies staff when overdue; **does not auto-dial** callers (intentional in code).

---

## What changed vs older audit (same doc structure)

| Topic | Old rating | **Current (code)** |
|--------|------------|---------------------|
| Document search / RAG | Partial (no tool) | **Connected** (`search_business_knowledge` + FileSearch) |
| Urgency rules | Not connected | **Connected** |
| Sales / solicitation | Not connected | **Connected** |
| AI Call Recovery | Not connected | **Connected** (post-call SMS) |
| After-hours when closed | Not connected | **Connected** |
| On-call schedule | Not connected | **Connected** |
| Callback SLA | Not connected | **Connected** (metadata + overdue job) |
| Holidays | Partial (not implemented) | **Connected** (`matchHoliday` in operating state) |
| Appointment type fields | Mostly partial | **Connected** via `service-policy` |
| REQUEST_ONLY / SEND_LINK | Partial | **Connected** (tools + executors) |

---

## Engineering references

- `src/lib/voice-v3/config/wizard-v3-manifest-builder.ts`
- `src/lib/voice-v3/config/compile-voice-v3-agent-config.ts`
- `src/lib/voice-v3/policy/effective-tool-authorization.ts`
- `src/lib/voice-v3/transfer/authorize-transfer.ts`
- `src/lib/voice-v3/call-history/post-call-pipeline.ts`
- `scripts/test-voice-v3-wizard-backend-propagation.ts` (compile/persist only)

**Propagation PASS (209/209)** confirms leaves **compile and persist**; this audit is **runtime consumer** mapping at the UI-group level.
