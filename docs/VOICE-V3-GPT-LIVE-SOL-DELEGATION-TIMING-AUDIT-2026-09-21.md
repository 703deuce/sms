# Voice V3 — GPT-Live → Sol (Responses delegation) timing audit

**Date:** 2026-09-21  
**Mode:** READ-ONLY forensics / instrumentation investigation — **no runtime changes in this task**  
**Installed stack (verified on audit VM):** `livekit-agents` **1.8.2**, `livekit-plugins-openai` **1.8.2**

**Call under study**

| Field | Value |
|--------|--------|
| Room suffix | `vcrbyQoJ7aLi` |
| GPT-Live session | `live_u1_EQXyQp3oNLUlkOZ40P012CFGt7hb74Qr` |
| Backend (delegated Responses) | `gpt-5.6-sol` |
| Reasoning effort | `none` (set in `voice-runtime-python/transovo_voice/voice_v3/session.py` → `responses_options.reasoning`) |
| Architecture | Telnyx PSTN → LiveKit SIP → `AgentSession` → `GPTLiveModel(gpt-live-1, delegation="responses")` → Sol → `FunctionTool` → `TransovoV3ToolClient` → Node `/api/internal/voice-runtime` |

**Related artifacts (tool chain, not delegation-native):**

- `docs/VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.md`
- `docs/VOICE-V3-LAST-CALL-TOOL-CHAIN-vcrbyQoJ7aLi.backend-events.json`

---

## 1. Installed execution path (LiveKit 1.8.2, `delegation="responses"`)

Transovo wires the worker in `voice-runtime-python/transovo_voice/voice_v3/session.py`:

- `GPTLiveModel(model="gpt-live-1", delegation="responses", responses_options={ model: astra, instructions, reasoning.effort, ... })`
- `AgentSession(llm=gpt_live, tools=session_tools, max_tool_steps=...)`
- `VoiceV3CallForensics.attach_session(session, agent)` — subscribes to **`session.on("metrics_collected")`** only (plus conversation items, usage, errors).

**Installed plugin entrypoints**

| Layer | Class / module | Path (site-packages) |
|--------|----------------|----------------------|
| Duplex LLM | `GPTLiveModel` | `livekit/plugins/openai/realtime/gpt_live_model.py` |
| WebSocket session | `GPTLiveSession` | same file |
| Framework adapter | `DuplexRealtimeAdapter` / `_DuplexRealtimeSession` | `livekit/agents/llm/duplex_adapter.py` |
| Tool execution | `AgentSession` + `tool_executor` | `livekit/agents/voice/agent_activity.py`, `tool_executor.py` |
| Transovo tools | `@function_tool` wrappers | `voice-runtime-python/transovo_voice/voice_v3/tools.py` |

**Documented backend “response” lifecycle (in-plugin comment)**

From `gpt_live_model.py` (installed):

```
response.created → response.output_item.done ×N (function calls) → response.completed
```

After `response.completed`, tool outputs are sent via `response.item.create`; when all calls are answered, the client may send `response.create` to continue the chain (`_maybe_continue_response`).

**Important:** The **first** delegated Responses turn after caller speech is started by the **GPT-Live service** (wrapped in `response.event` on the WebSocket). Client `response.create` is used for **continuations** after tool outputs (`_backend_response_pending` + `_maybe_continue_response`), not necessarily for the initial delegation beat.

**PSTN LiveKit worker vs Node “sideband”**

- Python worker: **no** `live-sideband` usage (grep clean under `voice-runtime-python/`).
- Node `src/lib/voice-v3/live-sideband-session.ts` + `VoiceV3LiveResponseCoordinator` observe `session.delegation.created` and nested `response.event` when the **OpenAI Live sideband** path is active.
- For **`vcrbyQoJ7aLi`**, delegation timing on the worker is visible only through what the **Python forensics** buffer records unless we attach to **`GPTLiveSession`** provider events (see §9).

---

## 2. Native events / hooks / metrics (installed 1.8.2)

### 2.1 `GPTLiveSession` — extra provider events (not forwarded by default)

Documented on `GPTLiveSession` (`gpt_live_model.py`):

| Event name | Emitter | Represents | Timestamp | `resp_*` / tool IDs | Passive observe? | Transovo today |
|------------|---------|------------|-----------|---------------------|------------------|----------------|
| `openai_server_event_received` | `GPTLiveSession.emit` on each inbound WS JSON | Raw server events (`session.*`, `response.event`, …) | Only inside payload (e.g. transcript `start_ms`); **no** unified “event received at” in payload | `response.event` → inner `response.created` / `response.completed` → `response.id`; `output_item.done` → `call_id`, `name` | Yes — subscribe on `duplex_session` | **No** |
| `openai_client_event_queued` | before WS send | Outbound client events (`response.create`, `response.item.create`, appends, audio) | No (queue time only if you stamp handler) | Client `event_id` on creates; tool output `call_id` | Yes | **No** |
| `delegation_created` | `_handle_delegation_created` | **Client** delegation only (`delegation="client"`) | No | `delegation.id` | N/A for `responses` mode | **No** (not used in responses mode) |
| `function_call` | `_handle_response_event` on `response.output_item.done` | Completed backend function call ready for LiveKit tool runner | No | OpenAI `call_id`, tool `name`, `arguments` | Yes (on duplex session) | **Partial** — Transovo logs `FUNCTION_TOOL_STARTED` in `tools.py` when runner invokes tool, not when OpenAI emits call |
| `metrics_collected` | `_handle_response_event` on `response.completed` | **End** of one delegated Responses request | `LLMMetrics.timestamp` = `time.time()` at completion | `LLMMetrics.request_id` = `response.id` (`resp_…`) | Yes — already on `AgentSession` | **Yes** → `BACKEND_LLM_METRICS_COLLECTED` |
| `metrics_collected` | `_handle_usage` on session usage | GPT-Live **voice** usage deltas | `RealtimeModelMetrics.timestamp` | `request_id` = **GPT-Live session id**, not `resp_*` | Yes | **Yes** → `GPT_LIVE_METRICS_COLLECTED` |
| `input_speech_started` / `input_speech_stopped` | transcript / end-of-user-turn | User turn boundaries (duplex) | `turn_started_at` on final transcription | No | Yes | **Not** used for Sol timing (and must not be used as latency clocks per scope) |
| `transcript_delta` | assistant/user text deltas | Streaming text | `start_ms` / `end_ms` on delta | No | Yes | Forensics conversation items only |

### 2.2 Nested `response.event` types (inside `openai_server_event_received`)

Handled in `GPTLiveSession._handle_response_event` (`gpt_live_model.py`):

| Inner `event.type` | Handler behavior | Start time exposed? | IDs exposed? |
|--------------------|------------------|-------------------|--------------|
| `response.created` | Initializes `delegation_id → set()` of in-flight `call_id`s | **No** metric emitted | **No** `response.id` persisted by LiveKit to metrics; may exist on `event.response` in raw WS JSON |
| `response.output_item.done` | If `function_call` + `completed`, emits `function_call` to adapter | **No** | `item.call_id`, `item.name`, `item.id` |
| `response.completed` | Emits `LLMMetrics` (Sol), merges call sets, may `_maybe_continue_response` | **Completion only** (`timestamp`) | `response.id` → `request_id`; token usage |
| `response.failed` / `response.incomplete` | Warning log only | No | `delegation_id`, error fields in logs |

**Boundaries NOT emitted as first-class metrics by LiveKit on this path**

- Delegated **request started** (`response.created`) — **NOT** in `metrics_collected`; only in raw `openai_server_event_received` if subscribed.
- **TTFT / first token** for delegated Responses — **NOT** populated (see §8).
- **Duration** of delegated Responses — hardcoded **0** at emit site (see §8).
- **Sol continuation started** — only inferable from next `response.created` in raw stream or client `response.create` in `openai_client_event_queued`.

### 2.3 Framework (`DuplexRealtimeAdapter`)

| Hook | File | Role |
|------|------|------|
| `duplex.on("function_call", …)` | `duplex_adapter.py` | Inserts call into chat context; schedules tool burst |
| `duplex.on("metrics_collected", …)` | forwards to `AgentSession` | Same metrics as above |
| `duplex_session` property | `duplex_adapter.py` | **Escape hatch** for provider-specific listeners (`openai_server_event_received`, etc.) |

Docstring explicitly: *“provider-specific events the adapter does not forward.”*

### 2.4 Transovo Node (only when sideband is in use)

Not on the LiveKit-worker PSTN path for this call, but relevant for completeness:

| API / log | File | Timestamps |
|-----------|------|------------|
| `onDelegationCreated` | `live-response-coordinator.ts` | `noteSemanticTimingEvent(..., "delegationCreatedAt")` |
| `response.event` nested handlers | `live-sideband-session.ts`, coordinator | `delegatedResponseCompletedAt`, `responseCreateRequestedAt`, … |
| `VOICE_TOOL_EXECUTION_*` | `execute-voice-tool.ts` | Node `Date.now()` per tool |

For **`vcrbyQoJ7aLi`**, authoritative cross-process tool timing uses **UTC on `NODE_TOOL_*` and `FUNCTION_TOOL_*`**, not mixed monotonic (§6).

---

## 3. What Transovo currently captures (this call)

| Source | Event kinds | Clock | `resp_*` | Tool `call_*` |
|--------|-------------|-------|----------|----------------|
| Python forensics | `BACKEND_LLM_METRICS_COLLECTED` | `occurred_at_utc` + broken cross-process `monotonic_ms_from_call_start` | **Yes** (`request_id`) | No |
| Python forensics | `FUNCTION_TOOL_STARTED` / `COMPLETED` | `occurred_at_utc` (Python) | No | **Yes** (`call_id`) |
| Node (via tool HTTP) | `NODE_TOOL_EXECUTION_*` in forensics flush from Node checkpoints | `occurred_at_utc` / `occurred_at_ms` | No | **Yes** |
| Python forensics | `GPT_LIVE_METRICS_COLLECTED` | same | Session-level `live_u1_…`, not `resp_*` | No |
| DB `voiceV3Forensics.backendLlmUsage` | Copy of metrics dicts | same as metrics | Yes | No |
| DB `voiceToolExecution` | — | — | — | **0 rows** for this V3 call id (tool trace not in that table) |

**We are already receiving** delegated **completion** footprints (`resp_*` + token fields) but **not** request-start boundaries.

---

## 4. What Transovo currently misses

1. **`response.created`** (delegated Sol request **start**) — not persisted.  
2. **Per-`resp_*` linkage to `call_*`** — LiveKit correlates internally; we only time-align by wall clock heuristics.  
3. **`openai_client_event_queued`** for `response.create` / `response.item.create` (continuation boundaries).  
4. **`delegation_id`** on each `response.event` envelope — available in raw WS, not in forensics.  
5. **TTFT / duration** for Sol — intentionally **not** set by plugin (§8).  
6. **Node `callerTurnTiming` / sideband delegation timeline** — not populated for LiveKit-only worker calls.  
7. **Any metric for GPT-Live → “hand off to backend”** before first `response.created`.

---

## 5. Forensics clock bug (Python ↔ Node)

`VoiceV3CallForensics._t0` is set at worker bootstrap (`VoiceV3CallForensics(...)` in `session.py`), **before** SIP participant resolution and **before** Node session bootstrap events.

Node forensics events use **`occurred_at_ms`** from the Node runtime (absolute epoch ms).

**Rule for this audit:** Use **UTC / wall timestamps** for Python ↔ Node correlation. **Do not** subtract Python `monotonic_ms_from_call_start` from Node `monotonic_ms_from_call_start`.

Example (this call, `update_intake`):

| Layer | Wall UTC | Monotonic (forensics) |
|-------|----------|---------------------|
| Python `FUNCTION_TOOL_STARTED` | `2026-09-21T13:04:41.243Z` | 54823 |
| Node `NODE_TOOL_EXECUTION_STARTED` | `2026-09-21T13:04:41.280Z` | 51527 |

Wall time: Node ~**37 ms** after Python start (HTTP to Node). Monotonic values wrongly imply the opposite offset (~3.3 s).

---

## 6. Exact timing we can establish today (call `vcrbyQoJ7aLi`)

### 6.1 User-provided / forensics anchors (not transcript clocks)

| Anchor | Wall UTC | Notes |
|--------|----------|--------|
| Info-dump end (Harriet/yahoo utterance committed) | **`2026-09-21T13:04:27.616Z`** | Matches forensics phase `infoDumpEndMonotonicMs` + call start |
| First `update_intake` `FUNCTION_TOOL_STARTED` | **`2026-09-21T13:04:41.243Z`** | |
| Gap dump-end → first tool start | **~13.6 s** | **Cannot** attribute to Sol without `response.created` / request-start hook |
| Amy scheduling question (agent turn committed) | **~2026-09-21T13:05:13Z** (mono 84064 ms + call start) | Content not used as clock |
| Four tool executions (Node slice) | see tool-chain doc | Fast (13 ms – 1.6 s) |

### 6.2 Seven delegated `resp_*` completions (`BACKEND_LLM_METRICS_COLLECTED`)

Deduped **7** unique `request_id` values (forensics records each twice in raw flush). Completion times are `occurred_at_utc` on the forensics row (metrics emit time ≈ `response.completed`).

| # | `request_id` (suffix) | Completed (UTC) | Δ from previous |
|---|------------------------|-----------------|-----------------|
| 1 | `…b086c87d1945822c06579ab76` | `2026-09-21T13:04:41.429Z` | — |
| 2 | `…b6981e087d1adcbec5abe9ea389` | `2026-09-21T13:05:04.427Z` | +22.998 s |
| 3 | `…8c6d2887d18c91ff30f3189ee8` | `2026-09-21T13:05:34.326Z` | +29.899 s |
| 4 | `…9e68d887d19685b3c78bacd5c4` | `2026-09-21T13:05:48.149Z` | +13.823 s |
| 5 | `…ad966087d19bb86a9a5335c34c` | `2026-09-21T13:06:01.126Z` | +12.977 s |
| 6 | `…c23d9487d1bffe2f50fb08e624` | `2026-09-21T13:06:19.364Z` | +18.238 s |
| 7 | `…bcd0c0087d1b7d56fd5002b975c` | `2026-09-21T13:06:29.468Z` | +10.104 s |

All rows: `metadata.model_name = gpt-5.6-sol`, `ttft = -1`, `duration = 0`, `tokens_per_second = 0`.

### 6.3 Four `FunctionTool` executions (wall UTC)

| Order | Tool | OpenAI `call_id` | Python start → end (UTC) | Node exec (UTC) |
|-------|------|------------------|---------------------------|-----------------|
| 1 | `update_intake` | `call_KvtlIoH78FtiPkEB9XG4tBnE` | 13:04:41.243 → .301 | 13:04:41.280 → .293 (~13 ms) |
| 2 | `set_scheduling_preference` | `call_4Y8j05aHSLSl9HFy4aYwreI7` | 13:05:33.635 → .717 | 13:05:33.707 → .713 (~6 ms) |
| 3 | `find_availability` | `call_IlkgFx9N2md9JhUW333WjGEt` | 13:05:47.980 → 13:05:49.507 | 13:05:48.036 → 13:05:49.503 (~1468 ms) |
| 4 | `book_appointment` | `call_1q45tRWbe1qQ05ohBrPrgqXW` | 13:06:19.179 → 13:06:20.964 | 13:06:19.324 → 13:06:20.962 (~1638 ms) |

---

## 7. Mapping each `resp_*` to behavior (evidence-based)

**Legend:** ✅ established by time order + LiveKit lifecycle docs · ⚠️ plausible but not proven · ❓ insufficient evidence

LiveKit emits **one `LLMMetrics` per `response.completed`**. A response that ends with a function call still completes **before** the tool runs; continuation is a **later** response after tool output.

| # | `resp_*` (short) | Completed UTC | Tool / outcome | Evidence |
|---|------------------|---------------|----------------|----------|
| 1 | `…79ab76` | 13:04:41.429 | **`update_intake`** (`call_Kvtl…`) | ✅ Tool start 13:04:41.243; completion metric 186 ms later; matches “response ended with function call” pattern |
| 2 | `…ea389` | 13:05:04.427 | **No FunctionTool** in interval until 13:05:33 | ⚠️ Sol/backend turn with **no** Transovo tool between intake and scheduling preference; likely backend text/thinking for spoken “thank you / checking” phase — **cannot** confirm without `response.output_item` capture |
| 3 | `…3189ee8` | 13:05:34.326 | **`set_scheduling_preference`** (`call_4Y8j…`) | ✅ Tool 13:05:33.635–.717; metric ~0.6 s after tool done (continuation response) |
| 4 | `…bacd5c4` | 13:05:48.149 | **`find_availability`** (`call_Ilkg…`) | ✅ Overlaps find window (starts 13:05:47.98, ends 13:05:49.507); metric mid-flight — consistent with completion of the response that **issued** find or an early continuation |
| 5 | `…35c34c` | 13:06:01.126 | **No FunctionTool** (between find complete and book) | ⚠️ ~11.6 s after find completes; likely post-offer Sol turn (offer slot / wait for “yes”) — ❓ no native text-output flag in forensics |
| 6 | `…08e624` | 13:06:19.364 | **`book_appointment`** (`call_1q45…`) | ✅ Book starts 13:06:19.179; metric during book |
| 7 | `…02b975c` | 13:06:29.468 | **No FunctionTool** after book | ⚠️ Post-book wrap / closing copy — ❓ |

**Count check:** 7 `resp_*` vs 4 tools ⇒ **3** delegated completions without a matching new FunctionTool in the same beat — consistent with no-tool responses and post-tool continuations.

**What we cannot do yet:** For any row, state **“Sol took X seconds”** because **`response.created` time is missing**; we only have **completion** timestamps.

---

## 8. Why `LLMMetrics.ttft = -1` and `duration = 0` (installed source, not speculation)

In `GPTLiveSession._handle_response_event`, branch `response.completed` (`livekit/plugins/openai/realtime/gpt_live_model.py`, ~764–789):

```python
self.emit(
    "metrics_collected",
    LLMMetrics(
        label=self._live_model.label,
        request_id=response.id or "",
        timestamp=time.time(),
        duration=0,
        ttft=-1,
        ...
        tokens_per_second=0,
        metadata=Metadata(model_name=response.model or ..., ...),
    ),
)
```

- **`duration=0`** and **`ttft=-1`** are **literal constants** on the delegated Responses path — not measured failures.
- **`timestamp`** is wall time at **`response.completed`** handling (end boundary only).
- Compare: classic `realtime_model.py` computes `ttft` and `duration` from generation timestamps (~2221–2227) — **not** used for GPT-Live Responses delegation metrics.

`RealtimeModelMetrics` for voice usage (`_handle_usage`) also sets `ttft=-1`, `duration=0` with session-level `request_id` (GPT-Live session id).

---

## 9. Timing we cannot establish today

| Question | Status |
|----------|--------|
| When did each delegated Sol **`response.created`** fire? | **NOT NATIVELY OBSERVABLE FROM CURRENT GPT-LIVE/LIVEKIT PATH** in Transovo forensics (available only via passive `openai_server_event_received`) |
| Per-`resp_*` **elapsed** duration | **NOT** from `LLMMetrics` (duration hardcoded 0); need start+end from raw events |
| **TTFT** / first output token on Sol | **NOT** in metrics; **NOT NATIVELY OBSERVABLE** unless raw stream exposes token deltas we subscribe to |
| GPT-Live audio/handoff → first backend byte | **NOT NATIVELY OBSERVABLE** without server event subscription |
| 13.6 s dump-end → `update_intake` start = “Sol latency” | **Invalid conclusion** — includes uninstrumented GPT-Live + backend queue + missing `response.created` |
| Map `resp_*` → `call_*` without raw `output_item.done` | **Partial** — time correlation only (§7) |

**Explicitly excluded per scope:** caller/assistant transcript commit times, STT/VAD pipelines, generic AgentSession STT→LLM→TTS timing.

---

## 10. Minimal proposed instrumentation (DO NOT IMPLEMENT YET)

**Goal:** Passive forensics only — append to existing `VoiceV3CallForensics` / flush payload; no awaits on critical path; no prompt/tool/config changes.

### 10.1 Subscribe on worker (`session.py` after `AgentSession` + `forensics.attach_session`)

Obtain provider session per LiveKit docs:

```python
# Pseudocode — integration point only
rt_session = session.llm  # DuplexRealtimeAdapter
duplex = rt_session.duplex_session  # GPTLiveSession
```

| Listener | Stamp (UTC ISO) | Persist fields |
|----------|-----------------|----------------|
| `openai_server_event_received` | `time.time()` at receive | `type`, full `response.event` → `event.type`, `envelope.delegation_id`, `event.response.id`, `event.item.call_id` / `name` on `output_item.done` |
| `openai_client_event_queued` | queue time | `type`, `event_id`, `item.call_id` for tool outputs, `response.create` |

Suggested forensics kinds (names illustrative): `GPT_LIVE_WS_SERVER_EVENT`, `GPT_LIVE_WS_CLIENT_EVENT` — store **redacted** payloads, cap size.

### 10.2 Correlate in post-processor (offline)

Join table:

`response.id` (`resp_*`) ↔ `response.created` time ↔ `output_item.done.call_id` ↔ existing `FUNCTION_TOOL_*` ↔ next `response.create` client event.

### 10.3 Optional: align monotonic clocks

Set single `forensics._t0` at **`AGENTSESSION_STARTED`** or first `session.started`, and/or stop writing Node monotonic into the same field name as Python monotonic.

### 10.4 Node sideband path (if used on other ingresses)

Already has `DELEGATION_REVISION_SNAPSHOTTED`, `ASTRA_DELEGATION_COMPLETED`, `callerTurnTiming` — **not** wired for LiveKit worker PSTN; do not duplicate; document transport per route.

### 10.5 Debug-only

`LK_OPENAI_DEBUG=1` logs raw events in worker logs — not a substitute for structured forensics.

---

## 11. Answers to the investigation questions

| Question | Answer |
|----------|--------|
| Are Transovo tools the bottleneck? | **No** on this call — Node + worker tool times are ms–1.8 s. |
| Is the ~13.6 s post-dump gap “Sol latency”? | **Unknown / not provable** without `response.created` (or equivalent) per delegation. |
| Do we have 7 Sol responses for 4 tools? | **Yes** — seven `resp_*` completions; consistent with tool calls + no-tool turns + continuations. |
| Can we optimize Sol config now? | **Out of scope** — insufficient start/end per `resp_*`. |
| Safest next step? | Passive `openai_server_event_received` + `openai_client_event_queued` capture (§10). |

---

## 12. Strict non-goals (confirmed)

This audit did **not** change: GPT-Live behavior, Sol/Amy prompts, reasoning effort, tools, booking/intake, conversation flow, persistence (`appointmentBooked`), or deploy any code.

---

*End of audit. Stop here per task scope.*
