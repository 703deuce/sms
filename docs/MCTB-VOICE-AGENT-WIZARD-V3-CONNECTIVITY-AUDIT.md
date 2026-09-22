# MCTB Voice Agent wizard → Voice V3 AI receptionist connectivity audit

**Question:** For each wizard surface, does a **Save / Activate (republish)** change what the **Voice V3 GPT-Live receptionist** actually does on the **next call**?

**Runtime path (authoritative):**

1. Wizard **Save draft** or **Activate** → `POST /api/solutions/appointment-receptionist` → `buildWizardAgentConfig()` stores wizard snapshot in `VoiceAgent` draft/published config (`advanced.appointmentReceptionistWizard` + `capabilityPack: appointment_receptionist`).
2. On each call / live test → `resolveVoiceV3AgentConfigForAgent()` → `compileVoiceV3AgentConfig()` → GPT-Live session + Astra delegation (`src/lib/voice-v3/config/from-published-agent.ts`).

**Legend**

| Rating | Meaning |
|--------|---------|
| **Connected** | Persists on save/activate; compiles into `VoiceV3AgentConfig`; **observably affects** prompts, tools, intake, booking, or transfer on the **next** session. |
| **Partial** | Persists and compiles, but only **some** sub-fields work, only affects **telephony/MCTB shell** (not the AI brain), only **prompt tuning** (no tool behavior), or needs **external setup** (Integrations, calendar OAuth) to take effect. |
| **Not connected** | Display-only, test metadata, stub UI, or persisted **without a runtime consumer** in Voice V3 (changing it does not change agent behavior). |

**Engineering references:** `wizard-v3-manifest-builder.ts` (`executionStatus`), `compile-voice-v3-agent-config.ts`, `scripts/test-voice-v3-wizard-backend-propagation.ts` (compiler/persist propagation — does **not** prove every field changes live behavior).

**MCTB-specific:** The **Call handling** card (`PATCH /api/mctb/inbound-handling`) is **outside** the wizard republish path. It switches MCTB TeXML vs Voice Agent on the same ingress; it is not updated when you click Save on a wizard step.

---

## Page chrome (above wizard)

| UI element | Rating | Notes |
|------------|--------|-------|
| Page title / status pill (Active, Draft, Needs attention) | **Partial** | Reflects `VoiceAgent` status from API; not a wizard field. |
| Subtitle | **Not connected** | Static copy. |
| **Test agent** button | **Not connected** | Scrolls to footer; does not publish. |
| **Call handling** card (MCTB vs Voice Agent, Turn on / Switch) | **Partial** | Real product behavior via `inbound-handling` API; **not** part of wizard republish. |
| **Finish setup to enable** link | **Not connected** | Navigation only. |

---

## Wizard chrome

| UI element | Rating | Notes |
|------------|--------|-------|
| Stepper (8 steps) | **Partial** | Navigation + readiness hints; republish is Save/Activate, not stepper clicks. |
| Mobile “Step N of M” | **Not connected** | Display. |
| **Back** | **Not connected** | Navigation. |
| **Save** | **Connected** | Persists draft; next call/live test uses updated snapshot when agent is resolved from draft/published config. |
| **Continue** | **Partial** | Navigation; may trigger `create_draft` / `save_draft` before Test step. |
| Footer error text | **Not connected** | Display. |

---

## Step 1 — Purpose

| UI element | Rating | Notes |
|------------|--------|-------|
| **Agent name** (`solutionName`) | **Partial** | Persisted; primarily **control plane** (page title, inventory). Spoken name is **`agentName`** on Voice step. |
| **Capability cards** (answer questions, take messages, qualify, transfer, send SMS, …) | **Connected** | `capabilities.*` → tool catalog + `authorize-tool-for-config` on next session. |
| **When should this agent answer?** (3 radios) | **Partial** | Persisted (`answerWhen`, `ringBehavior`). Drives **telephony / routing** metadata; MCTB forwarding + inbound-handling mode often dominate real ingress. Not GPT-Live “personality.” |
| Side panel **Agent summary** | **Not connected** | Read-only summary. |

---

## Step 2 — Phone

| UI element | Rating | Notes |
|------------|--------|-------|
| Readiness chips (phone, inbound, AI voice, recording) | **Not connected** | Derived display. |
| **MCTB line connected** callout | **Partial** | Loads `/api/mctb/inbound-handling`; may auto-set `phoneNumberId` / ingress. |
| **Use existing MCTB line** / number source cards | **Partial** | Persisted; **activate** assigns DID / routing (`telephony.phoneNumberId`, `phoneNumberE164`). Affects **which number** reaches the agent, not prompt text. |
| Number list / forward-to buttons | **Partial** | Same as above. |
| Buy new / Open My Numbers | **Not connected** | Navigation. |
| Info callouts (TeXML, other agent, softphone) | **Not connected** | Copy. |
| **Answering behavior** (5 radios) | **Partial** | Same as Purpose `answerWhen`; control-plane / Telnyx routing. |
| **Ring team for** (seconds) | **Partial** | Persisted; **ring team** behavior is telephony-layer; manifest marks control-plane heavy. |
| **Call recording** | **Partial** | Telnyx/provider on republish; not GPT-Live instructions. |
| **Connection greeting** (mode, text, audio URL, preview) | **Partial** | **Pre-AI** audio on Telnyx while session starts; not the V3 opening greeting on Voice step. |
| Side panel **Phone setup** / call flow preview | **Not connected** | Display. |

---

## Step 3 — Business Knowledge

| UI element | Rating | Notes |
|------------|--------|-------|
| **Search uploaded documents during calls** | **Partial** | Compiles to `knowledge.retrieval`; activate hooks build/link KB. **No `retrieve` tool** in current V3 tool catalog — answers still primarily from **prompt hot context** + activate-time KB processing, not live RAG tool loop. |
| Source cards (website, guided profile, upload, connect) | **Partial** | Persisted; **activate** runs knowledge processors / links KB. Effect on **next call** depends on ingest finishing and summaries being present. |
| Website URL + **Scan** | **Partial** | Populates `knowledgeItems` + optional KB; not instant without successful scan/approve. |
| Guided profile fields + **Save profile to knowledge** | **Connected** | Writes into `knowledgeItems` → `hotContextFromWizard` → Amy/Astra prompts on republish. |
| Upload files | **Partial** | Same as RAG path; ingest + optional retrieval flags. |
| Connect existing KB + Integrations links | **Partial** | `linkedKnowledgeBaseId` compiles; runtime needs `resolveAgentKnowledgeRetrieval` at call time. |
| **Knowledge item** list (status, Approve, Edit modal) | **Connected** | `summary` / labels feed **business hot context** in compiled config (hours, services, FAQs, etc.). |
| **Approve all imported facts** | **Connected** | Changes which items are included in activate profile / prompts. |
| **Business hours & holidays** (weekly editor on this step) | **Partial** | **Weekly hours** → `businessHours` + `hoursDisplay` (**Connected** for Microsoft FIND/BOOK + spoken hours). **Holiday list** → compiled but manifest: **not implemented** in runtime executor. |
| Side panel **Knowledge quality** | **Not connected** | Display. |

---

## Step 4 — Booking

*Step hidden if no booking capability.*

| UI element | Rating | Notes |
|------------|--------|-------|
| **Microsoft Calendar** / **Calendly** provider cards | **Partial** | OAuth / Integrations; calendar connection gates **Book** tool. Calendly **strategy** largely **not implemented** in V3 booking executor. |
| **When someone wants an appointment** (5 strategy radios) | **Partial** | See per-strategy table below. |
| Calendly event type select | **Not connected** | Compiled; **CALENDLY** booking execution not live in V3 milestone. |
| Send link: URL, SMS sender, consent, preview, label | **Partial** | Compiled (`SEND_LINK`); SMS send path depends on sender + consent plumbing — not full Microsoft-class certification. |
| **Appointment types** table (enable, name, duration, …) | **Partial** | **Connected:** `enabled`, `durationMin` → `services[]` / FIND/BOOK. **Partial/Not:** name, calendar label, min/max notice, booking permission, per-type required fields (manifest: future / not wired per-service). |
| **Add appointment** | **Partial** | Same as row fields. |
| **Appointment configuration** (name, duration, staff/calendar, notice, max ahead) | **Partial** | Duration connected; most other fields stored but **weak runtime effect**. |
| **Enable caller qualification** + ZIP + rules | **Partial** | **Connected** when enabled: `evaluateVoiceV3Qualification` blocks calendar tools via `call-rules` / `effective-tool-authorization`. UI rules + ZIP **do** compile. |
| **What Amy must collect** / **Add field** | **Connected** | `collectFields` → `intakeFields` → `update_intake` schema + BOOK/callback gates. |
| **Booking permissions** (book directly / suggest / send link) | **Partial** | Persisted on appointment type; limited per-service enforcement in V3. |
| Side panel **Appointment tools** | **Not connected** | Display. |

### Booking strategy → V3

| Strategy | Rating |
|----------|--------|
| **Microsoft 365 — Book for them** | **Connected** (with calendar connected) |
| **Send our booking link** | **Partial** |
| **Take preferred time / confirm later (REQUEST_ONLY)** | **Partial** (`submit_appointment_request` tool path exists) |
| **Calendly — book on call** | **Not connected** (configured only) |
| **Message / follow up (NONE)** | **Connected** (disables live book tools; messages/callback) |

---

## Step 5 — Call Handling

| UI element | Rating | Notes |
|------------|--------|-------|
| MCTB flow strip (5 steps) | **Not connected** | Illustration. |
| **Booking behavior** checkboxes (4) | **Connected** | `bookingBehavior.*` → Astra scheduling instructions + SMS flag behavior. |
| **Emergency & human transfer** — policy triggers line | **Connected** | `transferTriggers[]` in prompts + policy. |
| Enable emergency & human transfer | **Connected** | `voiceV2HumanTransferEnabled` gates transfer tooling. |
| Allow caller-requested human | **Connected** | `allowCallerRequestedTransfer`. |
| Routing (single vs waterfall) | **Partial** | Compiled; waterfall depends on transfer policy executor (plan steps manifest: **partial**). |
| Default ring timeout | **Connected** | `transferRingSeconds`. |
| Transfer contacts (name, phone, mode, timeout, reorder) | **Partial** | Destinations **Connected** for `transfer_call`. **Warm** mode / per-step timeouts: **partial**. |
| Detect voicemail on transfer | **Partial** | Compiled; provider-dependent behavior. |
| Transfer fallback radios | **Connected** | `transferFallback` in call handling config. |
| **Urgent-call handling** + rules editor | **Not connected** | Compiles to config but **`evaluateVoiceV3Urgency` is not called** anywhere in `src/` (dead path). |
| **Sales / solicitation handling** | **Not connected** | Compiles only; no V3 consumer. |
| **Take messages and callback requests** | **Connected** | `callbackRequestsEnabled` + `request_callback` tool. |
| **Required before recording a callback** (field checkboxes) | **Connected** | `callbackRequiredCollectFieldIds` → operation requirements. |
| **After-hours notifications** (events + recipients) | **Partial** | Compiles; **notify-*** handlers run on **post-call events** (SMS/email to staff), not in-call AI behavior. |
| **AI Call Recovery** (all fields) | **Not connected** | Compiles to `recovery.*`; **no Voice V3 runtime** sends post-call SMS from these flags yet. |
| **Long-term caller memory** | **Partial** | Persisted in agent `advanced.memory`; limited V3 session continuity — not full memory product. |
| **Enable CRM tools** | **Partial** | `crmEnabled` compiles; tool surface limited vs UI promise. |
| **After-hours behavior** (checkbox grid) | **Not connected** | Compiled into operating maturity; **no V3 in-call consumer** for `whenClosed.*` toggles. |
| **On-call schedule** | **Not connected** | Compiled; not wired into live transfer selection in V3 milestone. |
| **Callback SLA** selects | **Not connected** | Stored; no V3 executor enforcing SLA on voice callbacks. |
| Side panel **Call handling preview** | **Not connected** | Display. |

---

## Step 6 — Voice

| UI element | Rating | Notes |
|------------|--------|-------|
| **Identity** (agent name, business name, role, tone, style, language) | **Connected** | `identity` + `conversation` → GPT-Live instructions + Astra context. |
| **Greeting behavior** (AI vs caller first) | **Connected** | `speaksFirst` in conversation config / session behavior. |
| **Opening greeting** textarea | **Connected** | Interpolated into live frontend instructions. |
| **Conversation behavior** toggles (5) | **Connected** | `conversationBehaviors` in prompts. |
| **Choose a voice** + Play sample | **Connected** | `voiceId` → `telephony.liveVoiceId` on GPT-Live session (sample uses separate TTS preview API). |
| Speaking pace, accent, backchannels, patience, interrupts | **Connected** | `LIVE_PROMPT_CONTROL` → `livePromptControls` in instructions (not separate audio DSP). |
| Custom OpenAI voice ID (flag-gated) | **Partial** | Compiles when env flag on; org must have custom voice access. |
| Side panel **Voice settings** | **Not connected** | Display. |

---

## Step 7 — Test

| UI element | Rating | Notes |
|------------|--------|-------|
| **Test scenarios** list | **Partial** | `testScenario` persisted; guides manual testing only. |
| Expected outcomes / “Try saying” | **Not connected** | Copy. |
| Test mode tabs (browser / my phone / call agent) | **Partial** | Browser uses **draft** V3 WebRTC path when `agentId` exists. |
| **Save draft for test** / **Build & start live test** | **Connected** | Persists + opens GPT-Live browser session from compiled draft. |
| **Mark scenario checked** | **Partial** | Sets `lastTestPassed` (activate checklist only). |
| Scenario tools checklist | **Not connected** | UI placeholder after “mark checked”; does not execute tools. |
| **Agent Quality Studio** | **Not connected** | Button shows deprecation message; no suite run. |
| Side panel **Test summary** | **Not connected** | Display (latency/tool rate placeholders). |

---

## Step 8 — Activate

| UI element | Rating | Notes |
|------------|--------|-------|
| Summary card / activation issues list | **Partial** | Gating UX; issues reflect real blockers (phone, calendar, transfer). |
| Readiness grid (phone, voice, greeting, calendar, test call, …) | **Partial** | Mix of real gates (`lastTestPassed`) and display. |
| **Your receptionist will** list | **Not connected** | Marketing-style list from state; not a runtime contract. |
| **Activation options** cards | **Partial** | **Activate now** → publish + hooks (**Connected**). **Schedule** / **Duplicate location** → partial or incomplete product paths. |
| Schedule datetime input | **Partial** | Persisted; promote job must run. |
| Side panel **Activate now** / **Run final test** | **Connected** / **Partial** | Activate triggers full publish pipeline; test jumps to step 7. |
| Deployment side panel schedule line | **Not connected** | Static “Mon–Fri 8–6” display; not driven by wizard weekly editor. |

---

## Summary counts (UI groups, not leaf fields)

Rough grouping of **user-visible controls** from the inventory (excluding pure copy/side-panel display):

| Rating | Approx. share | What this means for you |
|--------|----------------|-------------------------|
| **Connected** | ~35–40% | Republish reliably changes V3 prompts, tools, intake, booking (Microsoft), transfer, voice. |
| **Partial** | ~35–40% | Saves correctly but effect is telephony-only, post-call notifications, ingest lag, strategy gaps, or subset of fields. |
| **Not connected** | ~20–25% | UI suggests behavior that **does not** change the live agent (urgency rules, AI call recovery, on-call/SLA, Quality Studio, many appointment-type knobs). |

---

## Highest-impact gaps (if you expect “wizard = truth”)

1. **AI Call Recovery** (Call Handling) — configured in UI, **no V3 post-call SMS executor** hooked up.  
2. **Urgency rules** — editor + compile, **evaluator never invoked**.  
3. **Calendly live booking** — UI present, execution **not implemented** for V3.  
4. **Document RAG checkbox** — no retrieve tool in V3 catalog; rely on **knowledge item text** in prompts.  
5. **Waterfall transfer plan steps** — destinations work; full waterfall semantics **partial**.  
6. **MCTB Call handling switch** — separate from wizard; must be toggled independently of Save/Activate.  
7. **Purpose “when to answer”** vs **MCTB carrier forwarding** — AI config can disagree with real ingress unless phone + inbound-handling aligned.

---

## Verification commands (engineering)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-wizard-backend-propagation.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-gpt-live-wizard-audit.ts
```

Propagation PASS means **wizard leaves compile and persist** — use this audit for **live behavioral** connectivity.
