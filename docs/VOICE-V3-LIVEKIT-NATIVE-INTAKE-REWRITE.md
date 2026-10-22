# Voice V3 — LiveKit-native intake rewrite (completion report)

## Installed LiveKit

- **Package:** `livekit-agents[openai]~=1.8` (verified **1.8.8** in Cloud Agent environment)
- **AgentTask:** `livekit.agents.voice.agent.AgentTask`
- **Prebuilt collectors:** `livekit.agents.beta.workflows` — `GetNameTask`, `GetEmailTask`, `GetPhoneNumberTask`, `GetAddressTask`, `GetDOBTask`
- **Chat context handoff:** `session.history.copy(exclude_instructions=True)` (see `intake_task.run_intake_task`)

## What changed

### New model entry point (single)

| Tool | Where it runs | Purpose |
|------|----------------|---------|
| **`collect_caller_intake`** | **Python worker only** | Awaits `IntakeTask` (LiveKit `AgentTask`) with conversation history |
| **`get_intake_state`** | Node (internal) | Read authoritative values + missing required fields |
| **`update_intake`** | Node (internal) | Batch persist + validate — **not** advertised to the model |

### Retired from model tool surface

- `update_intake` (OpenAI strict all-fields schema)
- `set_intake_<key>` (per-field passive tools)
- `collect_intake_field` (third entry point)

Session bootstrap (`resolve-livekit-session.ts`) no longer merges `buildLiveKitIntakeFunctionTools()`.

### Python modules

| File | Role |
|------|------|
| `voice_v3/intake_task.py` | `IntakeTask` + `record_intake_values` / `clarify_field_using_livekit` / `finish_intake_collection` |
| `voice_v3/intake_bridge.py` | `execute_collect_caller_intake` — load state, run task, refresh state |
| `voice_v3/intake_prebuilt.py` | Focused `Get*Task` invocations with `require_explicit_ask=False` |
| `voice_v3/intake_persist.py` | Node `update_intake` persistence callback |
| `voice_v3/tools.py` | Routes `collect_caller_intake`; drops retired tools from worker registration |

### Node (authoritative state preserved)

- `mergeIntakeUpdate`, `validateAndNormalizeIntakeValue`, `deriveIntakeObjective`, `buildSharedCallerFactsLiveSummary` unchanged in role
- Capture **confidence** default **0.85** (not 1.0) for caller-sourced merges
- Wizard metadata: `collectionKind` on `IntakeFieldDefinition`; richer `buildLiveKitIntakeFieldMetadata` for Python

## Flow

1. Luna (delegated Responses) calls **`collect_caller_intake`**.
2. Python tool handler calls **`get_intake_state`** on Node.
3. Python **`await IntakeTask(...)`** with `chat_ctx` from `context.session.history.copy(exclude_instructions=True)`.
4. Task tools call **`update_intake`** on Node for batch saves; prebuilt collectors only when task invokes `clarify_field_using_livekit`.
5. On completion, Python returns structured result; live context hydration unchanged.
6. Amy/Luna see updated **SHARED CALLER FACTS** via existing tool-result / live-context paths.

## Custom wizard fields

Handled inside **`IntakeTask`** via `record_intake_values` + conversational instructions — **no** per-field Python tool names, **no** LiveKit prebuilt task unless `collectionKind` maps to a `Get*Task`.

## Multi-field utterance

Task-local **`record_intake_values(values: dict[str, str])`** sends one Node **`update_intake`** batch per invocation (multiple keys in one call).

## Tests run

```bash
cd voice-runtime-python && pytest tests/test_voice_v3_intake_task.py -q
```

## PSTN / full dialogue

End-to-end PSTN acceptance of nested `GetPhoneNumberTask` inside `IntakeTask` requires **voice worker redeploy** and a live call — not run in CI here.

## Republish / deploy

1. Merge + deploy **web** (Node tool catalog + prompts).
2. **Redeploy `voice-runtime-python`** worker.
3. **Republish** receptionist agent (tool names + prompt fingerprint).
