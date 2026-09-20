# Voice V3 LiveKit + GPT-Live-1 — Source-of-Truth Audit

**Status:** AUDIT COMPLETE — **STOP BEFORE DEPLOYMENT** (no further production changes from this pass).  
**Branch:** `cursor/voice-v3-gpt-live-audit-2304`  
**Installed reference:** `livekit-agents==1.8.2` (inspected in audit environment)  
**Authority order used:** OpenAI GPT-Live / Live API → LiveKit GPT-Live plugin docs → installed 1.8.2 signatures/source → Transovo `voice_v3` + `voice-v3-livekit` bridge.

**Governing rule:** **REPLACE PLUMBING. KEEP TRANSOVO.** LiveKit + GPT-Live own realtime session, delegation, and function-tool execution. Transovo owns wizard compilation, business executors, persistence, idempotency, and provider truth.

---

## 1. GPT-Live architecture (front / back)

### Intended stack (confirmed by OpenAI Live API + LiveKit `GPTLiveModel`)

```
PSTN (Telnyx)
  → LiveKit SIP / Room / media I/O
  → AgentSession(llm=GPTLiveModel(...))
  → gpt-live-1 (Amy) — full-duplex speech, conversational front
       delegation="responses"
  → Responses backend (Astra) — reasoning + tool_choice
  → LiveKit FunctionTool loop (Python)
  → TransovoV3ToolClient → /api/internal/voice-runtime
  → executeVoiceTool + domain executors (Microsoft, callback, SMS, DB, …)
  → structured JSON tool result
  → LiveKit → Responses → GPT-Live → caller audio
```

### Current Transovo V3 LiveKit implementation (`voice-runtime-python/transovo_voice/voice_v3/`)

| Layer | Current code | Matches target? |
|--------|----------------|-----------------|
| Front model | `GPTLiveModel(model="gpt-live-1", voice=..., delegation="responses")` | **YES** |
| Amy instructions | `Agent(instructions=amyInstructions)` | **YES** |
| Astra instructions | `responses_options["instructions"]` | **YES** |
| Astra model | `responses_options["model"]` (from bridge: `VOICE_V3_ASTRA_MODEL`) | **YES** |
| Tool loop | `AgentSession(..., tools=lk_tools)` + `function_tool(..., raw_schema=...)` | **YES** (minimal) |
| Manual Live websocket / `response.create` | **Not present** on `voice_v3` path | **YES** |
| `delegation="client"` | **Not used** | **YES** |

**Discrepancy (docs vs memory):** Do **not** add LiveKit VAD, STT, TTS, or external turn-detector around `GPTLiveModel`. GPT-Live-1 is speech-to-speech; interruption is owned by the Live model + LiveKit duplex adapter, not a classic STT→LLM→TTS pipeline.

---

## 2. LiveKit 1.8.2 implementation map

### Installed signatures (verified)

| API | Installed 1.8.2 |
|-----|------------------|
| `GPTLiveModel.__init__` | `model`, `voice`, `delegation` (default `'responses'`), `responses_options: ResponsesDelegationOptions`, … |
| `AgentSession.__init__` | Optional `stt`, `vad`, `tts`, `llm`, `tools`, `userdata`, `max_tool_steps`, … — all default `NOT_GIVEN` |
| `AgentSession.start` | Returns after **startup** completes; does **not** block until call end unless `capture_run=True` and `RunResult` is awaited |
| `function_tool` | `raw_schema`, `flags: ToolFlag`, `on_duplicate`, `duplicate_scope: Literal['name','name_and_args']` |
| `DuplicateScope` | **`typing.Literal['name', 'name_and_args']`** — **not** an enum with `.NAME_AND_ARGS` |
| `ToolFlag` | `NONE`, `CANCELLABLE`, `IGNORE_ON_ENTER` |

### LiveKit 1.8.2 vs current Transovo `tools.py` (deploy branch note)

| Item | Docs / 1.8.2 | `master` | `cursor/voice-v3-livekit-implementation-2304` (Coolify App 2 branch) |
|------|----------------|----------|------------------------------------------------------------------------|
| `duplicate_scope` | `"name_and_args"` string | **Fixed** (`"name_and_args"`) | **BUG:** `DuplicateScope.NAME_AND_ARGS` → `AttributeError` at tool registration |
| `RunContext` in tool handler | Supported (`ctx: RunContext`) | **Not used** | **Not used** |
| `ToolError` | For model-recoverable errors | **Not used** | **Not used** |
| `userdata` on `AgentSession` | Supported | **Not used** | **Not used** |

**Job/session lifecycle (installed source):** `AgentSession.start` registers `job_ctx.add_shutdown_callback(lambda: self._aclose_impl(...))` when a job context exists. Startup finishes with comment: *"important: no await should be done after this!"* — i.e. **`start()` is not call-lifetime**.

**Transovo fix (on `master`, not yet verified in production):** `ctx.add_shutdown_callback(shutdown_backend)` + **no** `finally: backend.close()` immediately after `start()`. Legacy `run_inbound_session` already used the same shutdown pattern.

---

## 3. Active pipeline (GPT-Live media ownership)

**Production V3 session (`session.py`):**

| Component | Active? |
|-----------|---------|
| `GPTLiveModel` / `gpt-live-1` | **YES** |
| Separate STT | **NO** (`AgentSession` created without `stt=`) |
| Separate TTS | **NO** |
| LiveKit VAD | **NO** (`vad` not passed) |
| External turn detector / Silero | **NO** |
| Legacy `build_realtime_session` (OpenAI Realtime) | **NO** on `voice_v3` entrypoint |

**Legacy path** (`WORKER_PROFILE != v3`) still uses `gpt-realtime` via `session_factory.py` — **out of scope** for Phase 54 PSTN cutover; preserve for rollback.

---

## 4. Tool loop (end-to-end trace)

### Happy path (as designed)

1. **Caller speech** → LiveKit room audio → `GPTLiveModel` (duplex).
2. **Delegation** → OpenAI Live API Responses backend (`responses_options`).
3. **Astra** selects function → LiveKit `tool_executor` invokes registered `FunctionTool`.
4. **Python** `build_livekit_tools` → `_execute_raw(raw_arguments)` → `TransovoV3ToolClient.execute`.
5. **HTTP** `POST /api/internal/voice-runtime` action `execute_voice_v3_livekit_tool`.
6. **TypeScript** `executeVoiceV3ToolForLiveKit` → `executeVoiceTool` → catalog executor (Microsoft, intake, …).
7. **Return** `dict` JSON → `serialize_tool_result` → **string** returned to LiveKit.
8. LiveKit plugin injects function output into Responses delegation → Astra continues → Amy speaks.

### Gaps vs target architecture

| Transition | Owner today | Issue |
|------------|-------------|--------|
| Tool args | LiveKit + certified `raw_schema` from bridge | Schemas come from `buildVoiceV3AstraFunctionToolsFromCatalog` — **good** |
| Execution context | `VoiceV3CallContext` dataclass closed over in closure | **No `RunContext`** — cannot use `ctx.userdata`, `ctx.update`, `disallow_interruptions` |
| Result type | JSON string | Acceptable if LiveKit serializes; **no `ToolError`** for business outcomes |
| Cancellation | `ToolFlag.CANCELLABLE` on READ tools only | Backend FIND cancellation depends on Transovo `executeVoiceTool` + HTTP client still open |
| Dynamic tools | `filterToolsForLiveKitCert` hard-limits to **4 tools** | **Cert surface only** — not full wizard capability set |
| Utterance commit | `user_input_transcribed` → `commit_voice_v3_livekit_caller_utterance` | **ADAPT** — feeds Transovo `conversation-revision`; not GPT-Live context channels |

### Installed LiveKit delegation (reference)

`livekit/plugins/openai/realtime/gpt_live_model.py` implements Responses delegation, builds delegation tools from flattened session tools, and manages Live websocket — **Transovo must not duplicate this**.

---

## 5. Current PSTN call errors (job `AJ_Ai9vVmzcFatU`, ~2026-09-20 03:23 UTC)

Real call: pickup OK, 4 tools registered, conversation toward booking.

| Time (UTC) | Symptom | Tool / action | First boundary | Root cause |
|------------|---------|---------------|----------------|------------|
| 03:23:06 | `voice_v3_session_starting`, toolCount=4 | — | — | Session started correctly |
| 03:23:16+ | `RuntimeError: client has been closed` | `commit_voice_v3_livekit_caller_utterance` | **F** (Python ↔ Transovo HTTP) | `finally: backend.close()` ran when `session.start()` returned (~10s after start), while call continued ~90s |
| 03:24:05 | Tool exception | `update_intake` | **F** | Same — HTTP client closed |
| 03:24:09 | Tool exception | `set_scheduling_preference` | **F** | Same |
| 03:24:30 | Tool exception | `set_scheduling_preference` | **F** | Same |
| 03:24:48 | Session end | SIP disconnect | — | Normal hangup |
| 03:25:12 | `process exiting` / parent shutdown | — | — | Job teardown (expected after disconnect) |

**Boundary key (Phase 54):** **F** = Voice worker → Transovo web internal API. Failures were **not** missing tools on the bridge (schemas resolved; model invoked tools). They were **lifecycle**: adapter torn down early.

**Secondary risks (not proven on this call):**

- Deploy branch `DuplicateScope.NAME_AND_ARGS` would prevent reliable tool registration on workers built from that branch.
- `executeVoiceTool` still passes `conversationRevision` / `delegationId: null` — **legacy direct-Live fields**; harmless if executors ignore on LiveKit path, but should be **ADAPT** (document/bypass stale-delegation checks where inappropriate).

---

## 6. Intake design

| Layer | Owner | Current LiveKit path |
|-------|--------|----------------------|
| Wizard `collectFields` | Transovo compiler | `compileWizardCollectFieldsToV3Intake` → `VoiceV3AgentConfig.intakeFields` |
| Tool schema | Transovo catalog | `buildUpdateIntakeOpenAiTool(config)` per agent |
| LiveKit exposure | Python | `raw_schema` on `update_intake` only (when in cert filter) |
| Authoritative persistence | Transovo | `update_intake` executor via `executeVoiceTool` |
| In-call working copy | **Should be** `AgentSession.userdata` | **Not implemented** — no userdata type, no refresh after intake |
| Per-field dynamic tools | LiveKit docs allow programmatic tools | **Not implemented** — single `update_intake` with wizard-driven schema is correct for cert; evaluate per-field tools only if schema size/quality requires |

**KEEP:** `update_intake` semantic tool and Transovo intake executor.  
**ADAPT:** Add typed `VoiceV3Userdata`, hydrate from `resolve_session_config`, refresh from tool results.  
**DO NOT:** Replace with Agent Builder data-collection or a second Python intake DB.

---

## 7. Wizard → runtime mapping (LiveKit path)

Authoritative exhaustive manifest: `src/lib/voice-v3/config/wizard-v3-manifest-builder.ts` (`buildWizardV3FieldManifest()`).  
LiveKit/GPT-Live destinations for **this** runtime:

| Wizard / compiled field | Amy (GPT-Live front) | Astra (Responses) | LiveKit session | Transovo business |
|-------------------------|----------------------|-------------------|-----------------|-------------------|
| `agentName`, persona, tone, behaviors, guardrails, `livePromptControls` | `buildLiveFrontendInstructions` → `Agent.instructions` | — | — | — |
| `openingGreeting`, `speaksFirst` | Woven into live instructions; **no separate TTS greeting** on V3 LiveKit path | — | — | `greeting.ts` used on direct-Live path only |
| `capabilities.*` | Prompt hints | Astra tool surface text | Initial tools via `listVoiceV3AstraToolNamesForConfig` **then cert filter** | `isToolEnabledForConfig` |
| `collectFields` / custom fields | — | Intake catalog in Astra instructions | `update_intake` raw schema | Intake executor + DB |
| `appointmentTypes` / services | Business context in prompts | Service catalog in Astra | `set_scheduling_preference`, FIND/BOOK tools | Scheduling/OfferSets |
| `bookingStrategy` / Microsoft | — | — | Enables Microsoft tool subset | Calendar executors |
| `bookingLinkUrl`, SEND_LINK | — | — | `send_booking_link` (not in cert 4-pack) | SMS/link executor |
| Callback wizard fields | — | — | `request_callback` | Callback persistence |
| `transferDestinations`, capabilities.transfer | — | — | `transfer_call` (**not wired** in Python SIP yet) | Authorize + LiveKit `TransferSIPParticipant` |
| `liveVoiceId` / custom voice | `GPTLiveModel.voice` | — | — | `resolveTelephonyVoiceFromWizard` |
| `timezone`, business hours, knowledge | Hot context in prompts | Astra instructions | — | Runtime truth for FIND |
| `telephony.*` (numbers, recording, connection greeting) | — | — | — | Telnyx/provisioning (not LiveKit session) |
| `qualification`, `recovery`, `integrations` | Prompts / flags | — | Partial tool gating | Domain executors |

**Stranded on LiveKit PSTN today:**

- Cert filter exposes only 4 tools — booking/transfer/end_call/send_link omitted by policy, not by wizard.
- Connection greeting / ring behavior — **Telnyx/LiveKit ingress**, not duplicated in `voice_v3/session.py`.
- RAG — manifest `CONFIGURED_NOT_IMPLEMENTED`.

---

## 8. Framework duplication (active on LiveKit path)

### REMOVE / BYPASS (when touching LiveKit path only)

| Mechanism | Location | Notes |
|-----------|----------|--------|
| `finally: backend.close()` after `session.start()` | `voice_v3/session.py` (pre-fix) | **Fixed on master** — use shutdown callback |
| `getCurrentConversationRevision` as orchestration | `voice-v3-livekit.ts` execute path | **ADAPT** — keep for stale FIND/WRITE; do not use for manual delegation |
| `commit_voice_v3_livekit_caller_utterance` if GPT-Live history suffices | `session.py` + bridge | **ADAPT** — justify vs `conversation_item_added` + Transovo audit |
| Hard-coded cert tool filter | `VOICE_V3_LIVEKIT_INITIAL_TOOL_NAMES` | **TEMP** — replace with wizard capability list when cert expands |

### KEEP (not on LiveKit Python path, preserve for direct-Live rollback)

- `src/lib/voice-v3/delegation/live-response-coordinator.ts`
- `src/lib/voice-v3/live-sideband-session.ts`
- `handle-delegated-voice-tools.ts`, `live-response-trigger.ts`
- `scripts/voice-v3-live-delegation-continuation-lab.ts`

### KEEP (shared business — always)

- `voice-tool-catalog.ts`, all `*-tool.ts` executors
- `compile-voice-v3-agent-config.ts`, wizard manifest
- `execute-voice-tool.ts`, generations, OfferSets, reconciliation
- `createVoiceV3CallRuntime` / in-memory call state on web for tool execution

---

## 9. Business logic preservation (unchanged ownership)

- Wizard compile → `VoiceV3AgentConfig`
- DID/workspace/agent routing (`resolveAgentByCalledNumber`)
- All tool executors in `src/lib/voice-v3/tools/*`
- Microsoft FIND/BOOK, idempotency, `OUTCOME_UNKNOWN`, stale suppression
- Callback, SEND_LINK/SMS, authorization helpers
- Intake field definitions and `update_intake` validation
- Prisma/provider persistence (web only)
- Phase 54 SIP provisioning scripts (Telnyx FQDN + LiveKit trunk/dispatch)

---

## 10. Tool catalog (LiveKit cert + full catalog)

| Tool | Schema source | LiveKit registration | Class | Cancellable | duplicate_scope | Async/progress | Transovo executor |
|------|---------------|----------------------|-------|-------------|-----------------|----------------|-------------------|
| `update_intake` | `buildUpdateIntakeOpenAiTool` | `function_tool` + `raw_schema` | STATE | NO | `name_and_args` (intended) | NO | `updateIntakeTool` |
| `set_scheduling_preference` | catalog builder | same | STATE | NO | `name_and_args` | NO | `setSchedulingPreferenceTool` |
| `find_availability` | catalog builder | same | READ | **YES** (`ToolFlag.CANCELLABLE`) | `name_and_args` | NO (`ctx.update` N/A) | `findAvailabilityTool` |
| `request_callback` | catalog builder | same | WRITE | NO | `name_and_args` | NO | `requestCallbackTool` |
| `book_appointment` | catalog | **not in cert filter** | WRITE | NO | should be `name_and_args` | NO | `bookAppointmentTool` |
| `find_appointment` | catalog | not in cert | READ | YES | … | NO | `findAppointmentTool` |
| `reschedule_appointment` | catalog | not in cert | WRITE | NO | … | NO | `rescheduleAppointmentTool` |
| `cancel_appointment` | catalog | not in cert | WRITE | NO | … | NO | `cancelAppointmentTool` |
| `send_booking_link` | catalog | not in cert | WRITE | NO | … | NO | `sendBookingLinkTool` |
| `transfer_call` | catalog | not in cert | TELEPHONY | NO | … | NO | Authorize in TS; **execute in Python via LiveKit SIP API** (not implemented) |
| `end_call` | catalog | not in cert | TELEPHONY | NO | … | NO | Authorize in TS; **room hangup** (not implemented) |

**Python adapter today:** one generic `make_transovo_tool` pattern via `build_livekit_tools` — **correct direction**; needs `RunContext`, `ToolError`, and userdata refresh per tool class.

---

## A. LiveKit 1.8.2 API audit (summary table)

| Feature | Official intent | 1.8.2 installed | Transovo V3 LiveKit | Verdict | Change required |
|---------|-----------------|-----------------|---------------------|---------|-----------------|
| `GPTLiveModel` + Responses delegation | Front/back split | As documented | Used correctly | **KEEP** | None |
| `AgentSession.start` lifecycle | Startup only | Returns after init | Was closing HTTP in `finally` | **ADAPT** | Shutdown callback only (done on master) |
| `function_tool` + `raw_schema` | Certified schemas | Supported | Used | **KEEP** | Fix `duplicate_scope` literal on deploy branch |
| `RunContext` / `userdata` | Session state | Supported | Unused | **ADAPT** | Add `VoiceV3Userdata` + wire tools |
| `ToolError` | Model-visible errors | Supported | Unused | **ADAPT** | Map NEEDS_INFORMATION etc. |
| `agent.update_tools` | Dynamic gating | Supported | Unused | **ADAPT** | Post-start capability updates |
| `ToolFlag.CANCELLABLE` | READ cancel | Supported | Partial | **ADAPT** | Wire HTTP cancel to backend |
| `ctx.disallow_interruptions` | WRITE guard | Supported | Unused | **ADAPT** | Before commit phases |
| `ctx.update` / `with_filler` | Long READ progress | Supported | Unused | **ADAPT** | Optional for FIND only |
| GPT-Live context channels | append_thinking/commentary | Plugin API | Unused | **ADAPT** | Only if needed; no revision protocol |
| SIP `TransferSIPParticipant` | Cold transfer | livekit API | Not wired | **ADAPT** | New Python telephony tools |
| EndCallTool (beta) | Hangup | livekit | Not wired | **ADAPT** | Wrapper with Transovo auth |
| Observability session events | Metrics/traces | `AgentSession` events | Minimal custom logs | **ADAPT** | Subscribe to standard events |
| VAD/STT/TTS pipeline | Other agents | Optional on `AgentSession` | **Not used** | **KEEP absent** | **Do not add** for GPT-Live |

---

## B. PSTN error forensics

See **Section 5**. Primary root cause: **HTTP client lifetime ≠ job lifetime**. No evidence that `execute_voice_v3_livekit_tool` returned 4xx/5xx before client close — failures were local `httpx` closed client.

---

## C. Wizard mapping

See **Section 7** + `wizard-v3-manifest-builder.ts` for full inventory.

---

## D. Tool catalog

See **Section 10**.

---

## E. Intake

See **Section 6**.

---

## F. Session lifecycle (target)

```
JobContext entry (voice_v3_entrypoint)
  → TransovoBackend() created
  → ctx.add_shutdown_callback(close backend)   # idempotent guard
  → wait SIP participant + resolve config (HTTP)
  → build GPTLiveModel + AgentSession + tools
  → await session.start(...)                   # returns after startup
  → [call active — tools + commits use same backend]
  → SIP disconnect / job shutdown
  → AgentSession._aclose_impl (LiveKit)
  → shutdown_callback → backend.close() once
  → job process exit
```

**Invariant:** No `backend.close()` until shutdown callback (or explicit error path before `start` succeeds).

---

## G. GPT-Live config (production-shaped)

From `session.py` + bridge resolve:

```python
GPTLiveModel(
    model="gpt-live-1",
    voice=<wizard liveVoiceId>,
    delegation="responses",
    responses_options={
        "model": <astraModel>,
        "instructions": <astraInstructions>,
        "tool_choice": "auto",
        "parallel_tool_calls": False,
        "reasoning": {"effort": "low"},      # when set
        "text": {"verbosity": "low"},       # when set
    },
)
Agent(instructions=<amyInstructions>)
AgentSession(llm=gpt_live, tools=..., max_tool_steps=5)  # no stt/vad/tts
```

**GPT-Live media ownership audit:** STT **NONE**, TTS **NONE**, VAD **NONE** — **PASS**.

---

## H. Custom code removal / bypass list

See **Section 8**.

---

## I. Proposed diff (implementation phase — **not applied in this audit**)

| File | Change |
|------|--------|
| `voice-runtime-python/transovo_voice/voice_v3/session.py` | Confirm shutdown-only close; optional `ctx.connect()` early; `userdata=VoiceV3Userdata(...)`; subscribe `AgentSession` events; latency timestamps |
| `voice-runtime-python/transovo_voice/voice_v3/tools.py` | `RunContext` param; `duplicate_scope="name_and_args"`; `ToolError` mapping; WRITE `disallow_interruptions`; optional `ctx.update` on FIND |
| `voice-runtime-python/transovo_voice/voice_v3/userdata.py` | **New** typed userdata |
| `voice-runtime-python/transovo_voice/voice_v3/telephony_tools.py` | **New** `transfer_call` / `end_call` via LiveKit SIP APIs |
| `src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts` | Remove cert 4-tool cap when ready; pass full `listVoiceV3AstraToolNamesForConfig`; document LiveKit vs direct-Live revision behavior |
| `src/lib/voice-v3/tools/execute-voice-tool.ts` | LiveKit execution profile (skip delegation coordinator assumptions) |
| Tests | Tool registration, lifecycle (mock job shutdown), intake persistence, stale FIND |
| Docs | This file + update Phase 54 report when deploying |

---

## Tests required before next PSTN regression

Per directive §29: tool registration schema parity, intake (incl. custom fields), FIND + objective switches, tool error contracts, WRITE interruption/reconciliation, lifecycle (no closed HTTP client), **GPT-Live interruption** (natural barge-in — **no VAD added**).

---

## Deployment gate

1. Review this report.  
2. Implement **I** on `cursor/voice-v3-gpt-live-audit-2304` (or successor), with tests.  
3. Deploy **transovo-voice** only after `DuplicateScope` + lifecycle fixes are on the **same branch Coolify builds** (`cursor/voice-v3-livekit-implementation-2304` today).  
4. Align Coolify branch with `master` or cherry-pick `aab7a900` / lifecycle + `duplicate_scope` fixes.  
5. Real PSTN call + log proof of successful `execute_voice_v3_livekit_tool` HTTP 200.

**Note:** A deploy may have been queued during earlier incident response; **do not treat deploy success as architecture completion** until this audit is accepted and verification tests pass.

---

## Official references (for implementation phase)

- LiveKit: GPT-Live plugin, Function tools, AgentSession lifecycle, SIP participants  
- OpenAI: GPT-Live-1 model, Live API (`/v1/live/sessions`), Responses delegation  
- Transovo: `wizard-v3-manifest-builder.ts`, `voice-tool-catalog.ts`, `compile-voice-v3-agent-config.ts`
