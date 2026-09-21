# READ-ONLY AUDIT: Voice V3 vs LiveKit GPT-Live documented pattern

**Date:** 2026-09-21  
**Scope:** Compare Voice V3 implementation against LiveKit’s documented GPT-Live `responses` delegation + FunctionTool lifecycle.  
**No code was changed** for this audit.

Findings are from the repository and production Voice container `tgjridm6vrmrgljkfrr0rpjn-175115384657` (web container has no Python packages).

---

## A. Installed versions

| Location | `livekit-agents` | `livekit-plugins-openai` |
|----------|------------------|---------------------------|
| **Source** (`voice-runtime-python/pyproject.toml`) | `~=1.8` (not pinned to patch) | bundled via `[openai]` extra |
| **Production Voice container** | **1.8.2** | **1.8.2** |

Source (`voice-runtime-python/pyproject.toml`):

```toml
"livekit-agents[openai]~=1.8",
```

Dockerfile (`voice-runtime-python/Dockerfile`):

```dockerfile
"livekit-agents[openai]~=1.8" \
```

We did not verify whether 1.8.2 includes the specific “ignore incomplete and duplicate GPT Live backend tool calls” fix (that requires checking LiveKit release notes/changelog for 1.8.2 vs your cited commit).

**Do NOT upgrade anything during this audit** (per request).

---

## B. `GPTLiveModel` construction

File: `voice-runtime-python/transovo_voice/voice_v3/session.py`

```python
        responses_options: dict[str, Any] = {
            "model": config.get("astraModel") or "gpt-6-astra",
            "instructions": config.get("astraInstructions") or "",
            "tool_choice": "auto",
            "parallel_tool_calls": bool(config.get("parallelToolCalls", False)),
        }
        if config.get("reasoningEffort"):
            responses_options["reasoning"] = {"effort": config["reasoningEffort"]}
        if config.get("textVerbosity"):
            responses_options["text"] = {"verbosity": config["textVerbosity"]}

        gpt_live = GPTLiveModel(
            model="gpt-live-1",
            voice=str(config.get("liveVoiceId") or "marin"),
            delegation="responses",
            responses_options=responses_options,
        )

        max_tool_steps = int(config.get("maxToolSteps") or 5)
        session = AgentSession(llm=gpt_live, tools=session_tools, max_tool_steps=max_tool_steps)
```

| Setting | Value |
|---------|--------|
| `model` | `"gpt-live-1"` |
| `voice` | `config.liveVoiceId` (default `"marin"`) |
| `delegation` | **`"responses"`** (explicit) |
| `responses_options.model` | `astraModel` from bootstrap (default `"gpt-6-astra"`) |
| `responses_options.instructions` | `astraInstructions` from bootstrap |
| `tool_choice` | `"auto"` |
| `parallel_tool_calls` | from config; bootstrap sets **`false`** |
| `reasoning` | `{"effort": ...}` when `reasoningEffort` set (bootstrap: `"low"`) |
| `text` | `{"verbosity": ...}` when set (bootstrap: `"low"`) |
| **service tier** | **Not configured** (no matches in Voice V3 path) |

Bootstrap values (`src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts`):

```typescript
    parallelToolCalls: false,
    maxToolSteps: 5,
    reasoningEffort: "low",
    textVerbosity: "low",
```

---

## C. Amy instructions (`Agent.instructions`)

Compiled in Node, sent as `amyInstructions`, applied on the voice `Agent`.

`src/lib/voice-v3/prompts/build-voice-v3-prompts.ts`:

```typescript
  const liveInstructions = buildLiveFrontendInstructions({
    agentName,
    businessName,
    agentConfig,
    suspectedSpamLikely: input.suspectedSpamLikely,
  });
```

`src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts`:

```typescript
  const { liveInstructions, astraInstructions } = buildVoiceV3Prompts({
    ...promptInput,
    toolNames: astraDelegationToolNames,
    suspectedSpamLikely,
  });
```

`voice-runtime-python/transovo_voice/voice_v3/session.py`:

```python
        agent = Agent(instructions=str(config.get("amyInstructions") or ""))
```

---

## D. Astra instructions (`responses_options.instructions`)

`src/lib/voice-v3/prompts/build-voice-v3-prompts.ts`:

```typescript
  const astraInstructions = buildAstraBackendInstructions({
    businessName,
    timezone,
    currentLocalDateTime,
    intakeFieldCatalog,
    intakeTransport: resolveVoiceV3IntakeTransport(),
    toolSurface: resolveVoiceV3DelegationToolSurface(),
    serviceCatalog: serviceCatalogForAstra(agentConfig),
    ...
  });
```

`src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts`:

```typescript
    amyInstructions: liveInstructions,
    astraInstructions,
    astraModel: VOICE_V3_ASTRA_MODEL,
```

`src/lib/voice-v3/intake/delegation-config.ts`:

```typescript
export const VOICE_V3_ASTRA_MODEL = "gpt-6-astra";
```

Wired into `GPTLiveModel` via `responses_options["instructions"]` in `session.py` (see B).

---

## E. FunctionTool registration (`update_intake`, `find_availability`, `book_appointment`)

**Node:** schemas + executors in catalog (`src/lib/voice-v3/tools/voice-tool-catalog.ts`):

- `update_intake` → `updateIntakeTool` + `buildUpdateIntakeOpenAiTool`
- `find_availability` → `findAvailabilityTool` + `buildFindAvailabilityOpenAiTool`
- `book_appointment` → `bookAppointmentTool` + `buildBookAppointmentOpenAiTool`

Merged into `toolSchemas` for LiveKit bootstrap (`voice-v3-livekit.ts` ~211–220).

**Python:** one `function_tool` wrapper per schema name; `update_intake` uses the generic `_execute_raw` path (not `collect_intake_field`).

File: `voice-runtime-python/transovo_voice/voice_v3/tools.py`

- `build_livekit_tools()` loops schemas and wraps each in `function_tool(_execute_raw, raw_schema=...)`.
- Non-intake tools call `_execute_transovo_tool()` → `await client.execute(tool_name=...)`.
- `collect_intake_field` / `set_intake_*` use `_dispatch_intake_tool()` (separate path).

Tools are attached to **`AgentSession(..., tools=session_tools)`**, not to `Agent(...)`:

```python
        session = AgentSession(llm=gpt_live, tools=session_tools, max_tool_steps=max_tool_steps)
        agent = Agent(instructions=str(config.get("amyInstructions") or ""))
```

---

## F. `update_intake` — complete path and YES/NO checklist

There is **no** dedicated `async def update_intake(...)` in Python. **`update_intake` is the schema name** for the generic `_execute_raw` → `_execute_transovo_tool` → `client.execute(tool_name="update_intake", ...)`.

**Node executor:** `src/lib/voice-v3/tools/update-intake-tool.ts`

- Validates/normalizes args, `mergeIntakeUpdate`, `ctx.runtime.replaceContext(nextContext)`, returns `toolOk("INTAKE_UPDATED", { updated_fields, missing_required_fields, objective, state_version, ... })`.

| Question | Answer |
|----------|--------|
| Does `update_intake` call `ctx.update()`? | **NO** — no `ctx.update` anywhere under `voice-runtime-python/` |
| `ctx.with_filler()`? | **NO** (no matches in repo) |
| `ctx.filler()`? | **NO** |
| `ctx.foreground()` on `update_intake`? | **NO** — only `collect_intake_field` → `run_active_intake_collection` uses `foreground()` |
| `asyncio.create_task()` in tool path? | **NO** for `update_intake` (only utterance commit + transfer helper elsewhere in `voice_v3/`) |
| Background task for Transovo request? | **NO** |
| Fire-and-forget HTTP? | **NO** |
| Return before Transovo completes? | **NO** |
| Await HTTP/RPC bridge? | **YES** — `await client.execute(...)` |
| Await authoritative persistence? | **YES** — `await tool.execute` → `replaceContext` before return |
| Return Transovo result? | **YES** — JSON string of Node `VoiceToolResult` |

`voice-runtime-python/transovo_voice/voice_v3/tool_client.py`:

```python
        result = await self._backend.call("execute_voice_v3_livekit_tool", payload)
```

`voice-runtime-python/transovo_voice/voice_v3/tools.py`:

```python
    result = await client.execute(
        tool_name=tool_name,
        arguments=raw_arguments,
        function_call_id=str(function_call_id) if function_call_id else None,
    )
```

**Separate path:** `collect_intake_field` / `set_intake_*` delegate to the same Node `update_intake` but may run LiveKit collection tasks first (`intake_active_collection.py` with `ctx.foreground()`). The cert PSTN call (`JUSYBrzenWLq`) used the **`update_intake` FunctionTool** directly per logs, not `collect_intake_field`.

---

## G. Execution trace (with await boundaries)

```
Astra (GPT-6 via delegation="responses")
  ↓ LiveKit selects tool
LiveKit FunctionTool (_execute_raw in tools.py)
  ↓ await
TransovoV3ToolClient.execute()
  ↓ await httpx
POST /api/internal/voice-runtime  action=execute_voice_v3_livekit_tool
  ↓ await
executeVoiceV3ToolForLiveKit()  (voice-v3-livekit.ts)
  ↓ await
executeVoiceTool() → getVoiceTool("update_intake") → updateIntakeTool.execute()
  ↓ await (sync in-process merge + replaceContext)
VoiceToolResult returned to HTTP
  ↓ await response body
Python serialize_tool_result → return str to LiveKit
  ↓
FunctionCallOutput → Astra continuation → GPT-Live / Amy speaks
```

`src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts`:

```typescript
      sendContext: () => {
        /* LiveKit path: no OpenAI sideband context injection */
      },
```

Every boundary above is **awaited** end-to-end for `update_intake`; no fire-and-forget on the tool HTTP call.

---

## H. Actual FunctionTool return payload (successful phone update)

Python returns **one JSON string** from `json.dumps(result)` (`tool_client.py` `serialize_tool_result`).

Shape from `src/lib/voice-v3/tools/types.ts` `toolOk`:

```typescript
export type VoiceToolOk<T = Record<string, unknown>> = {
  ok: true;
  status: string;
  data?: T;
};
```

Successful intake update (conceptually what Astra receives after parse):

```json
{
  "ok": true,
  "status": "INTAKE_UPDATED",
  "data": {
    "updated_fields": ["phone"],
    "rejected_fields": [],
    "missing_required_fields": ["email", "mother_s_name", "..."],
    "objective": {
      "status": "IN_PROGRESS",
      "missing_required_fields": ["..."]
    },
    "state_version": 12
  }
}
```

(Exact `missing_required_fields` list depends on wizard config; production WS1 agent had six intake keys including `mother_s_name`.)

---

## I. `ctx.update(` search

**Zero occurrences** under `voice-runtime-python/`.  
`update_intake` does **not** use LiveKit async-tool / progress-release semantics.

LiveKit docs: first `ctx.update()` releases control to the LLM with a synthetic tool return while the real tool continues. **We do not do this for intake.**

---

## J. Manual reply generation on `update_intake` path

**Voice V3 LiveKit session (`session.py`):** no `generate_reply`, `session.say`, or `response.create`.

**On successful `update_intake` in Node:** `LiveContextPublisher.appendThinking(...)` in `update-intake-tool.ts`.

On the **LiveKit** path, `sendContext` is a **no-op** in `executeVoiceV3ToolForLiveKit` (see G).

So `appendThinking` does **not** inject a competing manual Live response during `update_intake` on PSTN/LiveKit.

Legacy templates under `voice-runtime-python/transovo_voice/templates/` do use `generate_reply` / `say`, but **not** the Voice V3 GPT-Live session entrypoint (`run_voice_v3_livekit_session`).

Under normal responses delegation we expect: FunctionTool result → backend continuation → GPT-Live response. We are **not** manually creating an additional response on the LiveKit V3 intake path.

---

## K. `function_tools_started` / `function_tools_executed`

| Event | Voice V3 LiveKit session |
|--------|----------------------------|
| `function_tools_started` | **Not subscribed** |
| `function_tools_executed` | **Not subscribed** in `voice_v3/session.py` |

Handler exists only in generic observability (legacy/template paths): `voice-runtime-python/transovo_voice/observability/call_metrics.py` (`@session.on("function_tools_executed")`). **Voice V3 LiveKit does not wire `call_metrics` into `session.py`.**

**Production forensics today:** Node logs `VOICE_TOOL_REQUESTED` / `VOICE_TOOL_EXECUTION_SUCCEEDED` with `function_call_id` (measures Transovo HTTP completion, not LiveKit `FunctionCallOutput` vs Amy audio).

LiveKit’s `function_tools_executed` would give calls and corresponding `FunctionCallOutputs` with call IDs — **not currently logged for V3 PSTN.**

---

## L. Production call `JUSYBrzenWLq` vs duplicate questions

**What logs prove (Transovo / Node, not LiveKit lifecycle):**

| Event | UTC (approx) |
|--------|----------------|
| `book_appointment` failed `MISSING_REQUIRED_INFORMATION` | 01:47:49 |
| First `update_intake` with **`phone`** persisted | **01:48:39.606** (`updated_field_names: ['phone','notes']`) |
| `update_intake` **`email`** | 01:48:55.568 |
| `update_intake` **`phone`** correction | **01:49:17.644** |
| `update_intake` **`mother_s_name`** → objective COMPLETE | **01:49:35.986** |

Caller turns **17–25** (through 01:48:38) occur **before** the first phone write at 01:48:39. If the duplicate **phone** prompt happened while intake still had no phone in Transovo state (e.g. after failed book at 01:47:49), that is **consistent with “before authoritative phone persisted”** — not with `ctx.update()` early release (which we do not use).

For whether **Amy’s exact wording** repeated phone/mother **before vs after** the corresponding LiveKit `FunctionCallOutput`:

### NOT PROVABLE FROM CURRENT LOGGING

We have no agent transcript, no `function_tools_executed` on Voice V3, and no timestamped Amy utterances. Node `VOICE_TOOL_EXECUTION_SUCCEEDED` is ~the same wall clock as Python returning to LiveKit (small HTTP RTT), but it is **not** a substitute for LiveKit’s call_id ↔ output pairing.

---

## M. Comparison table

| LiveKit documented pattern | Our implementation | Match? | Difference / significance |
|-----------------------------|-------------------|--------|---------------------------|
| `GPTLiveModel` / `gpt-live-1` | `model="gpt-live-1"` in `session.py` | **YES** | — |
| `delegation="responses"` | Explicit | **YES** | — |
| Separate voice instructions | `Agent(instructions=amyInstructions)` from `buildLiveFrontendInstructions` | **YES** | — |
| Separate backend instructions | `responses_options.instructions` = `buildAstraBackendInstructions` | **YES** | Backend model is **`gpt-6-astra`**, not a generic OpenAI model name in docs |
| Backend chooses tools | Tools on `AgentSession`; schemas from Node catalog | **YES** | Tools on **session**, not `Agent(...)` — verify against LiveKit 1.8.2 doc examples |
| Normal FunctionTool (no `ctx.update`) | Generic `function_tool(_execute_raw)`; full await chain | **YES** | — |
| Backend operation awaited | `await client.execute` → `await executeVoiceTool` | **YES** | — |
| Final result returned | `json.dumps(VoiceToolResult)` | **YES** | — |
| No `ctx.update` for short intake | No `ctx.update` in repo | **YES** | — |
| No fire-and-forget | No `create_task` on tool execute | **YES** | Utterance commit uses `create_task` separately |
| No manual competing reply on intake path | `sendContext` noop; no `generate_reply` in V3 session | **YES** | `appendThinking` is inert on LiveKit path |
| `parallel_tool_calls=false` | Bootstrap `parallelToolCalls: false` | **YES** | — |

---

## Differences found (code-backed only)

1. **Tools registered on `AgentSession`, not on `Agent`.**
2. **Astra model id** `gpt-6-astra` (Transovo), not a stock OpenAI Responses model name in docs.
3. **`tool_choice: "auto"`** set explicitly in `responses_options`.
4. **`appendThinking` after intake** on Node — **no effect** on LiveKit PSTN (`sendContext` noop).
5. **No `function_tools_executed` logging** on Voice V3 LiveKit sessions.
6. **Optional intake tools** (`collect_intake_field`, `set_intake_*`) can use `ctx.foreground()` — **not** the `update_intake` path used on call `JUSYBrzenWLq`.
7. **Production packages:** `livekit-agents` / `livekit-plugins-openai` **1.8.2** (GPT-Live line; patch-level fix inclusion not verified here).

---

## Most likely relevance to “duplicate intake question”

**If** the symptom were caused by LiveKit **async-tool** semantics (`ctx.update()` releasing the model before persistence), this audit **rules that out** for `update_intake`: no `ctx.update`, full await, return only after Node `replaceContext`.

**Therefore**, the comparison does **not** point to a non-blocking FunctionTool implementation on our side. Remaining explanations aligned with existing forensics:

1. **Astra/GPT-Live behavior before/without tool calls** (e.g. book at 01:47:49 before phone saved; speech ahead of `update_intake`).
2. **Model continuation ignoring or under-using** the JSON `data.missing_required_fields` / `objective` in the tool output (downstream of a normal blocking tool).
3. **LiveKit 1.8.x GPT-Live delegation edge cases** (duplicate/incomplete backend tool calls) — **possible but unproven** without `function_tools_executed` and version-specific changelog confirmation.

**Next diagnostic step (still read-only until you approve instrumentation):** on a repro call, log or capture **`function_tools_executed`** with `call_id` and outputs, correlated with Node `function_call_id`, to separate “Amy spoke before output” vs “Amy spoke after output.”

---

## Key file references

| Area | Path |
|------|------|
| GPT-Live session | `voice-runtime-python/transovo_voice/voice_v3/session.py` |
| FunctionTool wrappers | `voice-runtime-python/transovo_voice/voice_v3/tools.py` |
| HTTP tool client | `voice-runtime-python/transovo_voice/voice_v3/tool_client.py` |
| LiveKit bootstrap + execute | `src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts` |
| Prompt compile | `src/lib/voice-v3/prompts/build-voice-v3-prompts.ts` |
| `update_intake` executor | `src/lib/voice-v3/tools/update-intake-tool.ts` |
| Tool execute pipeline | `src/lib/voice-v3/tools/execute-voice-tool.ts` |
| Tool catalog | `src/lib/voice-v3/tools/voice-tool-catalog.ts` |
| PSTN call forensics | `docs/VOICE-V3-PSTN-CALL-FORENSICS-2026-09-21-JUSYBrzenWLq.md` |

---

*End of read-only audit document.*
