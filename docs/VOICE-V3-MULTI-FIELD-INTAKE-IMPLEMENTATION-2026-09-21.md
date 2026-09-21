# Voice V3 — multi-field `update_intake` implementation (extraction only)

**Date:** 2026-09-21  
**Scope:** Read-only documentation of the **current production path** for a single `update_intake` invocation that carries **multiple caller fields at once**. No runtime, prompt, tool, or LiveKit behavior was changed to produce this document.

**Question this answers:** When a caller gives Amy several pieces of information in one utterance, how does Voice V3 move from Sol’s delegated tool decision through deterministic Node state to the tool result and GPT-Live continuation—and could that **design** add extra Responses cycles beyond the one tool call?

---

## 0. Executive summary (evidence-based, not a redesign proposal)

| Finding | Detail |
|--------|--------|
| Multi-field in one call | **One** `update_intake` tool invocation → **one** loop over supplied keys in `mergeIntakeUpdate` → **one** in-memory `replaceContext` → **one** HTTP round-trip Node ↔ Python per FunctionTool execution. |
| DB on intake update | **No** Prisma/DB write in `update_intake` execute path; state lives in **in-process** `VoiceV3CallRuntime` (`Map` keyed by `liveSessionId`). |
| Required Sol cycles per tool | **Two** backend `response.*` lifecycles per delegated tool are **architecture-required**: (1) response that **emits** `function_call`, (2) **continuation** `response.create` after `function_call_output`. |
| Field count vs cycles | **1 field vs 6 fields** in the **same** `update_intake` call: same number of FunctionTool executions, Node requests, merges, and continuation pattern; only the **loop body** runs more iterations. |
| LiveKit “intake product” | LiveKit has **no** built-in intake/objective system for GPT-Live. Applicable primitives: **delegated Responses + FunctionTools**, `function_call` / `function_call_output`, `response.create` continuation (`_maybe_continue_response`), session history / thinking append (sideband). |
| LiveKit path nuance | On PSTN LiveKit, `sendContext` for tools is a **no-op**; `LiveContextPublisher.appendThinking` after intake **does not** reach GPT-Live (unlike sideband/OpenAI Live paths). |
| Call A (`dYDMLQvxF9xC`) | First info-dump `update_intake`: Node **13 ms**; delegation `item_EQZRPUrf52qjtwDsUVZFn` → `resp_…b7` (tool) → continuation `resp_…b552` (~3.4 s to `response.completed`); **new** `delegation_id` `item_EQZRYR5ozB9RlojFGMEQ0` appears later—consistent with a **new caller turn**, not six fields in one update. |

**Preliminary conclusion (for your audit):** **(A) CURRENT IMPLEMENTATION IS ALREADY APPROPRIATE** for multi-field batching at the deterministic layer; extra latency around the info-dump is dominated by **delegation / model / conversation timing**, not by per-field Node work. **(B)** Possible optimization opportunities are **outside** `mergeIntakeUpdate` (e.g. Sol continuation latency, GPT-Live turn boundaries)—not “replace intake with LiveKit magic.” **(C)** A LiveKit-native replacement of **authoritative Transovo intake state** is **not** provided by the framework; you would still need an application-owned state store and tool contract.

---

## 1. End-to-end path (file index)

| Step | Component | Path |
|------|-----------|------|
| Bootstrap tool schemas for Sol + LiveKit | `resolveVoiceV3LiveKitSession` | `src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts` |
| OpenAI tool schema for Sol (`strict`, zod) | `buildUpdateIntakeOpenAiTool` | `src/lib/voice-v3/tools/update-intake-tool.ts` |
| Zod shape (all configured fields, nullable) | `buildUpdateIntakeZodSchema`, `normalizeUpdateIntakeArguments` | `src/lib/voice-v3/intake-objective/build-intake-tool-schema.ts` |
| Tool description (multi-field explicit) | `UPDATE_INTAKE_TOOL_DESCRIPTION` | `src/lib/voice-v3/tools/astra-tool-contracts.ts` |
| Sol instructions (batch fields) | `buildAstraIntakeInstructions` | `src/lib/voice-v3/prompts/astra-intake-instructions.ts` |
| GPT-Live session + delegation options | `run_voice_v3_livekit_session` | `voice-runtime-python/transovo_voice/voice_v3/session.py` |
| LiveKit registers tools on backend delegation | `GPTLiveModel` + `AgentSession(tools=…)` | `livekit.plugins.openai.realtime.gpt_live_model` (installed) |
| Backend emits `function_call` | `_handle_response_event` | `gpt_live_model.py` |
| Python FunctionTool wrapper | `build_livekit_tools` → `_execute_transovo_tool` | `voice-runtime-python/transovo_voice/voice_v3/tools.py` |
| HTTP to web | `TransovoV3ToolClient.execute` | `voice-runtime-python/transovo_voice/voice_v3/tool_client.py` |
| Internal API | `execute_voice_v3_livekit_tool` | `src/app/api/internal/voice-runtime/route.ts` |
| Dispatch | `executeVoiceV3ToolForLiveKit` | `voice-v3-livekit.ts` |
| Executor registry | `executeVoiceTool` → `updateIntakeTool.execute` | `src/lib/voice-v3/tools/execute-voice-tool.ts`, `update-intake-tool.ts` |
| Merge semantics | `mergeIntakeUpdate` | `src/lib/voice-v3/intake-objective/merge-intake-update.ts` |
| Runtime store | `VoiceV3CallRuntime.replaceContext` | `src/lib/voice-v3/state/call-runtime.ts` |
| Tool result → LiveKit | `_append_items` → `ResponseItemCreateEvent` → `_maybe_continue_response` | `gpt_live_model.py` |

---

## 2. Tool schema presented to Sol (delegated `gpt-5.6-sol`)

Tools are built from the wizard-backed `VoiceV3AgentConfig.intakeFields`. The OpenAI function uses **strict** mode and a **dynamic zod object**: one property per configured field, each **nullable** (caller may omit fields in a given call).

```19:31:src/lib/voice-v3/tools/update-intake-tool.ts
export function buildUpdateIntakeOpenAiTool(config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "update_intake",
    parameters: buildUpdateIntakeZodSchema(config),
    description: UPDATE_INTAKE_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}
```

```31:49:src/lib/voice-v3/intake-objective/build-intake-tool-schema.ts
export function buildUpdateIntakeZodSchema(config: VoiceV3AgentConfig) {
  const fieldShape: Record<string, z.ZodNullable<z.ZodType<string>>> = {};
  for (const f of config.intakeFields) {
    fieldShape[f.key] = zodNullableFieldSchema(f);
  }
  return z.object(fieldShape);
}

export function normalizeUpdateIntakeArguments(
  config: VoiceV3AgentConfig,
  raw: unknown,
): Record<string, unknown> {
  const row =
    raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  for (const f of config.intakeFields) {
    if (!(f.key in row)) row[f.key] = null;
  }
  return row;
}
```

**Description (multi-field):**

```5:5:src/lib/voice-v3/tools/astra-tool-contracts.ts
export const UPDATE_INTAKE_TOOL_DESCRIPTION = `Save one or more pieces of caller-provided information in the authoritative state for the current call. ... Save every clearly provided configured field from the same caller statement in one call when possible. ...`;
```

**Astra prompt reinforcement:**

```1:4:src/lib/voice-v3/prompts/astra-intake-instructions.ts
export function buildAstraIntakeInstructions(): string {
  return `
When the caller provides multiple configured intake fields in the same statement, save all clearly provided fields together in one update_intake call rather than artificially processing one field at a time.
```

**Default PSTN booking config** (3 fields—production agents may have more via published wizard):

```29:54:src/lib/voice-v3/config/booking-agent-config.ts
  intakeFields: [
    { key: "name", label: "Name", type: "text", required: true, ... },
    { key: "email", label: "Email", type: "email", required: true, ... },
    { key: "phone", label: "Phone", type: "phone", required: true, ... },
  ],
```

**Registration:** `buildVoiceV3AstraFunctionToolsFromCatalog` includes `update_intake`; `resolveVoiceV3LiveKitSession` merges catalog + per-field LiveKit tools, then Python builds **FunctionTools** for every schema name. GPT-Live copies flattened tools to the backend via `_build_delegation_tools` when `delegation="responses"`.

---

## 3. Python FunctionTool wrapper

```48:80:voice-runtime-python/transovo_voice/voice_v3/tools.py
async def _execute_transovo_tool(
    *,
    tool_name: str,
    raw_arguments: dict[str, Any],
    context: RunContext,
    client: TransovoV3ToolClient,
    ...
) -> dict[str, Any]:
    ...
    result = await client.execute(
        tool_name=tool_name,
        arguments=raw_arguments,
        function_call_id=fc_id_str,
    )
    ...
    return result
```

```201:201:voice-runtime-python/transovo_voice/voice_v3/tools.py
            return TransovoV3ToolClient.serialize_tool_result(result)
```

**Duplicate policy for writes:** `on_duplicate` → `"reject"` for non-read tools (includes `update_intake`).

```42:45:voice-runtime-python/transovo_voice/voice_v3/tools.py
def _on_duplicate(name: str) -> str:
    if name in _READ_TOOLS:
        return "replace"
    return "reject"
```

`collect_intake_field` / `set_intake_*` are alternate LiveKit-only entry points that **collapse to** `update_intake` with a one-key payload (`tools.py` `_dispatch_intake_tool`).

---

## 4. TransovoV3ToolClient

```45:62:voice-runtime-python/transovo_voice/voice_v3/tool_client.py
    async def execute(
        self,
        *,
        tool_name: str,
        arguments: dict[str, Any],
        function_call_id: str | None = None,
    ) -> dict[str, Any]:
        fc_id = function_call_id or f"lk_fc_{uuid.uuid4().hex[:12]}"
        payload = {
            "liveSessionId": self._ctx.live_session_id,
            "toolName": tool_name,
            "arguments": arguments,
            "functionCallId": fc_id,
        }
        result = await self._backend.call("execute_voice_v3_livekit_tool", payload)
```

---

## 5. Backend route and dispatch

```242:247:src/app/api/internal/voice-runtime/route.ts
      case "execute_voice_v3_livekit_tool": {
        const { executeVoiceV3ToolForLiveKit } = await import(
          "@/lib/voice/python-runtime-bridge/voice-v3-livekit"
        );
        result = await executeVoiceV3ToolForLiveKit(payload as never);
        break;
      }
```

```210:258:src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts
export async function executeVoiceV3ToolForLiveKit(
  payload: VoiceV3LiveKitExecuteToolPayload,
): Promise<Record<string, unknown>> {
  ...
  const result = await executeVoiceTool(
    {
      callId: runtime.getSnapshot().callId,
      liveSessionId,
      delegationId: null,
      functionCallId: payload.functionCallId,
      runtime,
      ...
      sendContext: () => {
        /* LiveKit path: no OpenAI sideband context injection */
      },
      ...
    },
    payload.toolName,
    payload.arguments,
  );
```

---

## 6. Node executor (`update_intake`)

Full execute body (validation → merge → in-memory context → tool result):

```44:176:src/lib/voice-v3/tools/update-intake-tool.ts
  execute: async (ctx, raw) => {
    const config = ctx.runtime.config;
    const schema = buildUpdateIntakeZodSchema(config);
    const normalized = normalizeUpdateIntakeArguments(config, raw);
    const parsed = schema.safeParse(normalized);
    ...
    const updatePayload: Record<string, string | null> = {};
    for (const field of config.intakeFields) {
      const v = parsed.data[field.key as keyof typeof parsed.data];
      updatePayload[field.key] = typeof v === "string" ? v : null;
    }

    const merged = mergeIntakeUpdate({
      current: snap.intake.values,
      update: updatePayload,
      config,
      at: new Date(),
      sourceCallId: ctx.callId,
      sourceDelegationId: ctx.delegationId,
    });
    ...
    const nextContext = {
      ...snap,
      updatedAt: new Date().toISOString(),
      intake: { values: merged.values },
      runtime: { version: snap.runtime.version + 1 },
    };
    ctx.runtime.replaceContext(nextContext);
    ...
    const publisher = new LiveContextPublisher(ctx.sendContext);
    publisher.appendThinking(buildIntakeObjectiveContext(config, after), ctx.delegationId);
    ...
    return toolOk("INTAKE_UPDATED", {
      updated_fields: merged.updatedFields,
      rejected_fields: merged.rejectedFields.map((r) => ({
        field: r.field,
        code: r.code,
      })),
      missing_required_fields: objective.missingRequiredFields,
      objective: {
        status: objective.status,
        missing_required_fields: objective.missingRequiredFields,
      },
      state_version: after.runtime.version,
    });
  },
```

---

## 7. State merge semantics (`mergeIntakeUpdate`)

**Model:** Shallow copy of current `intake.values`, then **patch only keys present in `update`** with non-null values. Not a full replace of unrelated fields. Not one DB row per field.

```33:83:src/lib/voice-v3/intake-objective/merge-intake-update.ts
export function mergeIntakeUpdate(input: MergeIntakeUpdateInput): MergeIntakeUpdateResult {
  const values = { ...input.current };
  ...
  for (const [key, raw] of Object.entries(input.update)) {
    if (raw === null || raw === undefined) continue;
    ...
    const validated = validateAndNormalizeIntakeValue(field, String(raw));
    ...
    values[key] = {
      value: validated.value,
      source: "caller",
      confidence: 1,
      updatedAt,
      revision: valueChanged ? (existing?.revision ?? 0) + 1 : (existing?.revision ?? 0),
      verificationStatus,
    };
    updatedFields.push(key);
    ...
  }
  return { values, updatedFields, rejectedFields, fieldsChanged };
}
```

`normalizeUpdateIntakeArguments` fills **missing** schema keys with `null` so strict zod sees every field; merge **skips** nulls—so only explicitly provided non-null strings are applied.

---

## 8. Persistence

| Operation | Present on `update_intake`? |
|-----------|----------------------------|
| Prisma / SQL write of intake | **No** |
| In-memory `VoiceV3CallRuntime` map | **Yes** (`replaceContext`) |
| `state_version` bump | **Yes** (`runtime.version + 1`) |
| Transactions | **No** |
| Async post-return sync | **No** (execute is `async` but completes before FunctionTool returns) |
| Forensics | `NODE_TOOL_EXECUTION_*` events only |

Runtime store:

```57:59:src/lib/voice-v3/state/call-runtime.ts
  replaceContext(context: VoiceV3CallContext): void {
    this.commitContext(context, "replace_context");
  }
```

Initial intake bucket:

```184:186:src/lib/voice-v3/state/call-context.ts
    intake: { values: {} },
```

---

## 9. Exact successful tool result shape (Sol / FunctionTool output JSON)

Wrapper from `toolOk`:

```20:22:src/lib/voice-v3/tools/types.ts
export function toolOk<T>(status: string, data?: T): VoiceToolOk<T> {
  return data === undefined ? { ok: true, status } : { ok: true, status, data };
}
```

**Successful multi-field example structure:**

```json
{
  "ok": true,
  "status": "INTAKE_UPDATED",
  "data": {
    "updated_fields": ["name", "phone", "email", "service_reason", "address", "security_answer"],
    "rejected_fields": [],
    "missing_required_fields": [],
    "objective": {
      "status": "COMPLETE",
      "missing_required_fields": []
    },
    "state_version": 3
  }
}
```

**Note:** Sol does **not** receive full `intake.values` in the tool result—only `updated_fields`, rejections, objective summary, and `state_version`. Full authoritative values remain in Node runtime until a later tool or session end.

**Error example (validation):**

```json
{
  "ok": false,
  "status": "error",
  "code": "INVALID_ARGUMENTS",
  "message": "Intake update arguments are invalid.",
  "details": { "issues": ["..."] }
}
```

---

## 10. Sanitized six-field example (hypothetical wizard with six `intakeFields`)

**Caller (conceptual):** name, phone, email, address, service problem, security answer.

**Sol → LiveKit `function_call` arguments (one call):**

```json
{
  "name": "Anthony Johnson",
  "phone": "+15551234567",
  "email": "anthony.j@example.com",
  "address": "123 Main St, Austin TX",
  "service_reason": "Toilet is leaking",
  "security_answer": "Harriet",
  "other_configured_field": null
}
```

(`normalizeUpdateIntakeArguments` would add any missing configured keys as `null`.)

**Python → Node HTTP body:**

```json
{
  "liveSessionId": "lk_transovo-call-_+1…_dYDMLQvxF9xC",
  "toolName": "update_intake",
  "functionCallId": "call_hNd9X6VpgNvBZgYyG46Tmiz4",
  "arguments": { "... same object as above ..." }
}
```

**State before (abbreviated):**

```json
{
  "intake": { "values": {} },
  "runtime": { "version": 0 }
}
```

**State after (in-memory, abbreviated):**

```json
{
  "intake": {
    "values": {
      "name": { "value": "Anthony Johnson", "source": "caller", "revision": 1, "verificationStatus": "collected", "updatedAt": "2026-09-21T14:37:54.620Z" },
      "phone": { "value": "+15551234567", "source": "caller", "revision": 1, "verificationStatus": "collected", "updatedAt": "..." },
      "email": { "value": "anthony.j@example.com", "source": "caller", "revision": 1, "verificationStatus": "collected", "updatedAt": "..." }
      /* + address, service_reason, security_answer similarly */
    }
  },
  "runtime": { "version": 1 }
}
```

**Tool result returned to Sol:** see §9.

---

## 11. One call, many fields — proof (§4 directive)

**Answer: (A) one state mutation containing N fields** in a single synchronous `mergeIntakeUpdate` loop.

- **Not** (D) one Node call per field.
- **Not** (E) per-field reconciliation passes.
- **Sequential awaits:** one `await tool.execute` chain: validate (sync) → merge (sync) → `replaceContext` (sync) → optional `appendThinking` (sync no-op on LiveKit).
- **No** `Promise.all` / per-field HTTP inside `update_intake`.

Loop is `for (const [key, raw] of Object.entries(input.update))` in `merge-intake-update.ts`.

---

## 12. Race conditions (§5)

| Risk | Verdict | Evidence |
|------|---------|----------|
| RMW race on intake map | **POSSIBLE** (theoretical) | No mutex on `VoiceV3CallRuntime`; Node is single-threaded per event loop—concurrent HTTP tool calls for same session could interleave if parallel tool calls enabled. |
| Parallel `update_intake` | **NOT PRESENT** in production config | `parallelToolCalls: false` in bootstrap; Python `on_duplicate` → `reject` for writes. |
| Stale snapshot mid-merge | **NOT PRESENT** | Single `getSnapshot()` at start; merge writes once. |
| Python vs Node state drift | **POSSIBLE** after return | Authoritative state is Node-only; Python only holds JSON tool result string. |
| Post-return async intake sync | **NOT PRESENT** | No background job after `execute` returns. |
| `appendThinking` stale on LiveKit | **NOT PRESENT** (inert) | `sendContext: () => {}` on LiveKit bridge. |

---

## 13. After `update_intake` returns — LiveKit 1.8.x (installed)

**Function call emission (backend → local tool):**

```717:762:livekit/plugins/openai/realtime/gpt_live_model.py
    def _handle_response_event(self, envelope: types.ResponseEventEnvelope) -> None:
        ...
        elif event.type == "response.output_item.done":
            item = event.item
            if item is None or item.type != "function_call":
                return
            if item.status != "completed":
                return
            ...
            self.emit("function_call", fnc_call)
```

**Tool output → continuation:**

```1004:1045:livekit/plugins/openai/realtime/gpt_live_model.py
        for output in backend_outputs:
            self.send_event(
                types.ResponseItemCreateEvent(
                    event_id=utils.shortuuid("tool_output_"),
                    item=FunctionCallOutput(
                        type="function_call_output", call_id=output.call_id, output=output.output
                    ),
                )
            )
            self._backend_open_calls.discard(output.call_id)
            ...
        if backend_outputs:
            self._backend_response_pending = True
            self._maybe_continue_response()

    def _maybe_continue_response(self) -> None:
        if (
            self._backend_running_responses
            or self._backend_open_calls
            or not self._backend_response_pending
        ):
            return
        self._backend_response_pending = False
        self.send_event(types.ResponseCreateEvent(event_id=utils.shortuuid("response_create_")))
```

**Required cycles for one tool:** `response.created` → `function_call` → local FunctionTool → `function_call_output` → `response.create` → **second** `response.created` … → `response.completed` (may be no further tools).

---

## 14. What the tool result encourages Sol to do next (§7)

- `missing_required_fields` + `objective.status` tell Sol what is still missing for the **active operation** (`deriveIntakeObjective` / `operation-requirements`).
- Instructions say to batch fields and **not** put scheduling in `update_intake`.
- **No** mandatory second tool in the result JSON; Sol may choose to ask a question, call `set_scheduling_preference`, or finish with text for Amy on the continuation response.
- `buildIntakeObjectiveContext` text is appended via `appendThinking` but is **not delivered** on the LiveKit PSTN path (no-op `sendContext`).

---

## 15. LiveKit-native comparison (§8–9)

LiveKit does **not** ship a multi-field “intake” domain model for GPT-Live. What exists and applies:

| Primitive | Role |
|-----------|------|
| `delegation="responses"` | Sol runs on backend model with tools |
| `FunctionTool` / `function_call` | Deterministic execution hook (Transovo uses this for `update_intake`) |
| `function_call_output` + `response.create` | Required continuation protocol |
| `ChatContext` / history items | Conversation memory—not typed intake |
| `session.thinking.append` / commentary | Optional sideband context (disabled on current LiveKit bridge) |
| `userdata` / agent tasks | Generic state; would still need Transovo booking rules |

**Could LiveKit-native primitives replace this without losing behavior?**

- **Preserve multi-field atomic patch + booking gates:** still need application schema + merge + `VoiceV3CallContext` (or equivalent).
- **Reduce Responses cycles:** **unlikely** by changing intake merge alone—cycles are tied to **tool use protocol**, not field count.
- **Reduce latency:** possible only by reducing **model** work (faster Sol continuation, fewer tools, shorter prompts)—not by moving merge to LiveKit userdata.
- **Correctness:** in-memory Node runtime is already authoritative; LiveKit userdata would duplicate state unless you eliminate Node (out of scope).

---

## 16. Lifecycle diagrams (§10–11)

### One field vs six fields (same utterance, one Sol decision)

Both scenarios:

| Step | Count |
|------|-------|
| Sol `update_intake` function_call | 1 |
| Python FunctionTool execution | 1 |
| Node `execute_voice_v3_livekit_tool` | 1 |
| `mergeIntakeUpdate` loops | 1× (1 or 6 iterations) |
| DB writes | 0 |
| `function_call_output` queued | 1 |
| `response.create` continuation | 1 |
| Backend Responses completions | **2** (tool-bearing + continuation) — **required** |

### Full chain (multi-field)

```
Caller speech ends
  → GPT-Live delegation (session.delegation.created)
  → Sol response #1 (response.created … function_call update_intake {N fields})
  → LiveKit FunctionTool → Node merge (ms) → JSON result
  → response.completed (response #1)
  → function_call_output queued
  → response.create
  → Sol response #2 (continuation; may produce Amy-facing content)
  → response.completed
  → GPT-Live/Amy audio
```

**Unnecessary extra cycle?** Only if Sol emits **another** tool or a **new delegation** without a new caller turn—not because N>1 in one `update_intake`.

---

## 17. Call A evidence (`dYDMLQvxF9xC`) (§12)

Sources: `docs/VOICE-V3-DUAL-PSTN-DELEGATION-EXPORT-2026-09-21.json`, `docs/VOICE-V3-TOOL-CHAIN-dYDMLQvxF9xC.md`.

| Event | UTC (approx) | Notes |
|-------|----------------|-------|
| Info-dump caller commit marker | 14:37:51.303Z | mono 30447 ms |
| `response.created` `resp_…b7` | 14:37:51.334Z | `delegation_id` `item_EQZRPUrf52qjtwDsUVZFn` |
| `update_intake` function_call emitted | 14:37:54.778Z | `call_hNd9X6VpgNvBZgYyG46Tmiz4` |
| Node `update_intake` | 14:37:54.607–.620Z | **13 ms** |
| `response.completed` `resp_…b7` | 14:37:55.041Z | |
| `function_call_output` queued | 14:37:57.284Z | |
| `response.create` | 14:37:57.284Z | |
| Continuation `response.created` `resp_…b552` | 14:37:57.564Z | same delegation |
| Continuation `response.completed` | 14:38:00.990Z | ~3.4 s continuation |
| **New** `delegation_id` `item_EQZRYR5ozB9RlojFGMEQ0` | ~14:38:04+ | **New turn / delegation**, not same batch merge |
| Amy scheduling question committed | 14:38:17.552Z | mono 56696 ms |

**Gap info-dump → scheduling question (26.2 s mono):** not explained by Node intake (13 ms). Dominated by time from caller commit to first backend `response.created` (~0.03 s after commit marker in telemetry), Sol tool decision (~3.4 s to function_call), FunctionTool (~27 ms), continuation Sol (~3.4 s), then **GPT-Live/conversation** until agent turn.

---

## 18. Performance categories (§13)

| Category | `update_intake` multi-field |
|----------|---------------------------|
| Deterministic | Python HTTP + Node execute + merge loop (µs–ms per field) |
| Model/orchestration | Delegation, Sol response #1, continuation response #2 |
| Conversation | User speech end, GPT-Live e2e_latency, Amy `started_speaking_at` |

---

## 19. Three conclusions (§14)

**A. CURRENT IMPLEMENTATION IS ALREADY APPROPRIATE** for batching multiple fields in one tool call: single merge, single runtime bump, no per-field orchestration.

**B. WORKS BUT OPTIMIZATION MAY EXIST ELSEWHERE:** continuation latency (~seconds) and GPT-Live turn timing—not `mergeIntakeUpdate`. Optional: enable sideband thinking on LiveKit only if product wants Sol to see `buildIntakeObjectiveContext` without another model call (would be a **behavior** change).

**C. LIVEKIT-NATIVE REPLACEMENT:** No framework intake primitive eliminates Transovo’s executor; swapping storage to LiveKit userdata would not remove the **two-response** tool protocol and would risk splitting booking authority from Node.

---

## 20. Checklist return (§15)

1. **Files:** see §1 table.  
2. **Tool schema:** §2.  
3. **Python FunctionTool:** §3.  
4. **ToolClient:** §4.  
5. **Node route:** §5.  
6. **Node executor:** §6.  
7. **State merge:** §7.  
8. **Persistence:** §8 (in-memory only).  
9. **Tool result JSON:** §9.  
10. **Six-field example:** §10.  
11. **One-field lifecycle:** §16 (1 field = same orchestration counts).  
12. **Six-field lifecycle:** §16.  
13. **Races:** §12.  
14. **Sequential awaits:** §11.  
15. **DB operations:** 0 per `update_intake`.  
16. **Node operations:** 1 per tool call.  
17. **FunctionTool operations:** 1 per tool call.  
18. **Required Sol Responses turns:** 2 per delegated tool (emit + continuation).  
19. **Extra non-required turns:** possible on **new caller speech** or **additional tools** (Call A: second `update_intake` after caller answers scheduling—separate invocation).  
20. **LiveKit continuation code:** §13 (`gpt_live_model.py`).  
21. **LiveKit-native alternative:** §15 (no built-in intake).  
22. **Advantages/disadvantages of change:** §15.  
23. **Latency impact of “more LiveKit-native”:** unlikely for intake merge; tool protocol dominates.  
24. **Conversational behavior:** changing merge or moving state without careful migration **would** risk booking/consent behavior; current path is proven on PSTN.

---

*End of extraction document. No code was modified for this artifact.*
