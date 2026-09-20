# Voice V3 LiveKit — Delegation trace report

**Failed PSTN job:** `AJ_9a4soz3r6fkB`  
**Window:** ~2026-09-20 08:30:33–08:32:18 UTC  
**Room / live session:** `transovo-call-*_kW2CMA3k4ABQ` / `lk_transovo-call-*_kW2CMA3k4ABQ`  
**Purpose:** Trace GPT-Live → Responses (Astra) → LiveKit FunctionTool → Transovo. No code changes; diagnosis only.

---

## Summary table

| Field | Value |
|--------|--------|
| **GPT-Live active** | **YES** — `transovo-voice-v3`, profile `voice_v3_gpt_live`, room linked, ~2 min audio session |
| **delegation runtime value** | **`"responses"`** (hardcoded in `voice-runtime-python/transovo_voice/voice_v3/session.py` — not `client`) |
| **Responses backend model** | **`gpt-6-astra`** (`config.astraModel` / `VOICE_V3_ASTRA_MODEL`) |
| **Amy/front instructions** | Same compiler as the old direct GPT-Live path: `buildVoiceV3Prompts()` → `buildLiveFrontendInstructions()` including `# BACKEND DELEGATION` + `buildLiveDelegationPolicySection()` (delegate when caller provides facts for authoritative state, booking, availability, etc.; Amy does not see tool names) |
| **Astra/backend instructions** | Compiled at resolve: web log `VOICE_V3_ASTRA_CONTEXT_COMPILED { char_count: 10510 }`; passed in `responses_options.instructions` |
| **Caller turns (Transovo transcript commits)** | **12** (`CALLER_TURN_COMMITTED` / `commit_voice_v3_livekit_caller_utterance` 200s) |
| **GPT-Live delegations (observable)** | **0** in production logs (see below) |
| **Astra/Responses requests (observable)** | **0** in production logs |
| **Astra backend token usage (observable)** | **Not present** in container stdout (no `metrics_collected` / `LLMMetrics` / `response.completed` lines; `LK_OPENAI_DEBUG` unset) |
| **Tools registered with AgentSession** | **17** (`voice_v3_session_starting.toolCount`) |
| **Tools actually sent to Astra** | **NOT REACHED** (no evidence any Responses cycle ran) |
| **Astra function calls requested** | **0** observable (`response.output_item.done` / `function_call` path never reached Transovo) |
| **LiveKit FunctionTools executed (Transovo)** | **0** (`execute_voice_v3_livekit_tool` count **0** on voice + web) |
| **Transovo tool requests** | **0** (only `resolve_voice_v3_livekit_session` + 12× `commit_voice_v3_livekit_caller_utterance`) |

---

## FIRST FAILED BOUNDARY: **A — no GPT-Live → Responses delegation (or no backend Responses work at all)**

**Not proven:** “Astra saw the turn and chose zero tools” (Case B/D).  
**Proven:** Nothing reached LiveKit FunctionTool → Transovo (`execute_voice_v3_livekit_tool` never fired).

### Evidence

1. **Transovo `CALLER_TURN_COMMITTED` ≠ delegation**  
   Those 12 commits are parallel transcript/revision logging from `user_input_transcribed` → `commit_voice_v3_livekit_caller_utterance`. They are **not** GPT-Live delegation events and were never the old orchestration trigger.

2. **Zero Transovo business tool HTTP**  
   Voice worker: only `resolve_voice_v3_livekit_session` + `commit_voice_v3_livekit_caller_utterance`.  
   Web: matching internal_voice actions only — **no** `execute_voice_v3_livekit_tool`, **no** `VOICE_TOOL_EXECUTION_*`.

3. **No GPT-Live backend lifecycle in logs**  
   Grep over the job window: no `gpt-live backend response`, no `function_call`, no `response.completed`, no `session.usage` lines. Worker has no `LK_OPENAI_DEBUG=1`.

4. **Installed LiveKit 1.8.2 semantics (important)**  
   - `session.delegation.created` → `delegation_created` is emitted only when **`delegation.target == "client"`** (`gpt_live_model.py` `_handle_delegation_created`).  
   - With **`delegation="responses"`**, backend work shows up as **`response.event`** envelopes (`response.created` → `response.output_item.done` for function calls → `response.completed` with **`metrics_collected` / `LLMMetrics`** for backend token usage).  
   - **Absence of `delegation_created` is expected** for responses mode — it is **not** evidence that delegation happened.

5. **Lifecycle fix from earlier is no longer the blocker**  
   This call: stable HTTP client, 12 successful utterance commits, `toolCount: 17`. The failure moved **upstream** of Transovo tools.

---

## Architecture (locked mental model)

```
Caller
   ↓
GPT-Live / Amy  (front — talking; decides when backend work is needed)
   │
   │ delegation (not tool names on Amy)
   ↓
Responses / Astra  (backend — reasoning + tool selection)
   │
   ↓
LiveKit FunctionTool  (local execution)
   ↓
Transovo  (execute_voice_v3_livekit_tool → business layer)
```

Amy does **not** choose `update_intake` / `find_availability` by name. Astra does, after delegation.  
`CALLER_TURN_COMMITTED` is **not** evidence Astra saw anything.

---

## Runtime GPTLiveModel config (instantiated values)

From `session.py` + web resolve for this job:

```text
GPTLiveModel(
  model="gpt-live-1",
  voice=<wizard liveVoiceId, default marin>,
  delegation="responses",          # NOT client
  responses_options={
    model: "gpt-6-astra",
    instructions: <astraInstructions ~10.5k chars>,
    tool_choice: "auto",
    parallel_tool_calls: false,
    reasoning: { effort: "low" },
    text: { verbosity: "low" },
    # NOTE: no `tools` key here — tools come from AgentSession → adapter
  },
)
Agent(instructions=<amyInstructions / liveInstructions>)
AgentSession(llm=gpt_live, tools=17, max_tool_steps=5)
```

**Not client delegation:** `delegation="responses"` is explicit; client mode would raise if tools were non-empty (`_update_tools` guard in `gpt_live_model.py`).

**toolCount 17 ≠ proof Astra saw 17:** Session tools are flattened into the delegation block at GPT-Live `session.start` via `DuplexRealtimeAdapter` → `_rt_session._update_session(..., tools=ToolContext.flatten())` (`agent_activity.py` ~1256). That only matters **after** the voice model triggers backend Responses work.

---

## Installed LiveKit 1.8.2 chain (files / functions)

| Step | Location |
|------|-----------|
| AgentSession wraps duplex | `livekit/agents/voice/agent_session.py` — `DuplexRealtimeAdapter(llm)` when `llm` is `DuplexModel` |
| Session start + tools | `agent_activity.py` `_start_session` — `isinstance(self.llm, RealtimeModel)` → `_rt_session._update_session(..., tools=flatten())` |
| GPT-Live WS + delegation block | `livekit/plugins/openai/realtime/gpt_live_model.py` — `GPTLiveSession._session_start_event()` → `_build_delegation()` embeds `ResponsesConfig(tools=_build_delegation_tools(...))` |
| Backend function calls | `_handle_response_event` — `response.output_item.done` (`type==function_call`) → `emit("function_call", ...)` |
| Tool results back to backend | `_append_items` → `FunctionCallOutput` → `_maybe_continue_response()` |
| Our handlers | `voice_v3/tools.py` `function_tool` raw_schema → `_execute_transovo_tool` → `execute_voice_v3_livekit_tool` |

---

## Old working direct GPT-Live vs new LiveKit

### Plumbing (same Amy/Astra split, different tool attachment)

| | **Old (working) `buildBasicLiveSession` / `sessions.accept`** | **New LiveKit `session.py`** |
|---|----------------------------------------------------------------|------------------------------|
| Amy | `session.instructions` = `liveInstructions` | `Agent(instructions=amyInstructions)` — **same compiler** |
| Astra | `delegation.responses.instructions` + **`delegation.responses.tools`** = `buildVoiceV3AstraFunctionTools(config)` | `responses_options.instructions` only; **tools on `AgentSession`** → flattened into GPT-Live delegation at session start |
| Orchestration | OpenAI GPT-Live delegates → Responses runs tools → LiveKit plugin executes handlers | **Same intended model** per LiveKit docs; no Transovo “middle coordinator” |

### Prompts

- **Same source:** `buildVoiceV3Prompts()` → `live-frontend-instructions.ts` + `astra-backend-instructions.ts` + `live-delegation-policy.ts`.
- Amy delegation section: delegate when caller provides storable facts, booking, availability, etc.; **not** to name internal tools.
- Astra: intake catalog (**6 fields**, including `mother_s_name`) and tool-surface rules.

**Semantic/prompt diff for this migration:** No intentional third layer; no evidence delegation policy was stripped from Amy. The gap on this call is **runtime behavior before Transovo**, not a missing `update_intake` wrapper.

### Agent intake fields at resolve (this workspace)

`name`, `phone`, `email`, `service_reason`, `notes`, `mother_s_name`

---

## One utterance (illustrative)

Logs do not label which turn had name/email. Any turn after identity/scheduling intent should be a delegation candidate per Amy policy (“caller provides information that must be stored…”). Observable chain for **all** turns:

```text
audio → GPT-Live (Amy spoke) ✓
→ user_input_transcribed → commit_voice_v3_livekit_caller_utterance ✓ (parallel telemetry)
→ GPT-Live delegation / response.event ?  NO LOG EVIDENCE
→ Responses / Astra ?  NO LOG EVIDENCE
→ function_call → LiveKit tool → execute_voice_v3_livekit_tool ?  ZERO
```

**First missing boundary:** **GPT-Live → Responses delegation** (Case A), not “Astra ignored tools” (Case D).

---

## Decision tree (this job)

| Case | Verdict |
|------|---------|
| **A** No GPT-Live delegation | **Best fit** — no backend Responses signals, no tool path |
| **B** Delegation but no Responses request | No direct evidence; would need plugin debug |
| **C** Responses ran, tools not present | Unlikely if session started with 17 tools wired at `_update_session` |
| **D** Responses ran, tools present, Astra called none | **Not established**; would need backend `LLMMetrics` / `response.completed` |
| **E/F** Tool requested but not executed / Transovo | **Ruled out** — zero `execute_voice_v3_livekit_tool` |

---

## Explicitly NOT recommended (yet)

- Caller-utterance → Responses bridge  
- Forced `update_intake` from `commit_voice_v3_livekit_caller_utterance`  
- Old semantic/tool pipeline on every turn  
- Stronger Astra tool prompts before proving delegation  
- Deployment merely to try prompts  

---

## Appropriate next step (observability only)

Hook **real** LiveKit/GPT-Live events on the worker (`livekit-agents==1.8.2`), e.g.:

- `openai_server_event_received` / `response.event` (when `LK_OPENAI_DEBUG=1` or explicit handlers on `GPTLiveSession`)
- `metrics_collected` on the realtime session (`LLMMetrics` with backend `model_name` = `gpt-6-astra` vs voice usage)
- `function_call` on the adapter session

That separates **Case A** vs **Case D** on the next PSTN call without rebuilding the old orchestrator.

---

## Bottom line

- Earlier **HTTP client closed** bug: **fixed** on this call (commits succeed, `toolCount: 17`).  
- Live failure: **upstream** — **no verified Amy → Astra delegation / Responses cycle**, so **zero** FunctionTool → Transovo executions.  
- **Not proven:** “Astra decided not to call tools.”  
- **Not** “one more required intake field” — **nothing** persisted; wizard lists six fields including `mother_s_name`.

---

## Containers / commit at time of trace

- Web: `ds8s3hjin60qs6g7s0iqkixs` — image `800203abf1c7f946de946ed449683ea2f07ff96c`  
- Voice: `tgjridm6vrmrgljkfrr0rpjn-082422767617` — image `800203abf1c7f946de946ed449683ea2f07ff96c`
