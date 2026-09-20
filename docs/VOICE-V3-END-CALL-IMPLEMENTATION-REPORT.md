# Voice V3 — Native End Call implementation report

**Status:** Implementation + automated tests complete. **PSTN certification on +15717491060 not run** (requires manual calls).

## Installed LiveKit findings (livekit-agents ~= 1.8, verified 1.8.x)

| Item | Value |
|------|--------|
| Import | `from livekit.agents.beta.tools import EndCallTool` |
| Constructor | `extra_description`, `delete_room=True`, `end_instructions`, `ignore_on_enter`, `on_tool_called`, `on_tool_completed` |
| Tool name | `end_call` (native `function_tool`) |
| `ignore_on_enter` | Sets `ToolFlag.IGNORE_ON_ENTER` — hidden during agent `on_enter` / greeting |
| Lifecycle | Tool invoked → returns `end_instructions` to model → speech done → `session.shutdown()` → optional `job_ctx.delete_room()` on close |
| Callbacks | `on_tool_called` / `on_tool_completed` fire around tool invocation (before final audio playout completes) |

## Existing Transovo state (audit)

| Finding | Status |
|---------|--------|
| Python V3 `session.py` already registered `EndCallTool` | **Extended** — moved to `end_call_tool.py` with full policy + telemetry |
| `end_call` in TypeScript `VOICE_TOOL_CATALOG` | **Legacy catalog** — executor logs `VOICE_END_CALL_REQUESTED` only; **not** in LiveKit Astra `toolSchemas` |
| `VOICE_V3_LIVEKIT_NATIVE_TOOL_NAMES` | `["end_call"]` — filters Astra delegation |
| Custom `session.say` + `delete_room` | **Not used** on V3 LiveKit path |
| Astra `end_call` FunctionTool on active PSTN path | **No** — excluded in `resolveVoiceV3LiveKitSession` |

## Final tool ownership

**Amy (GPT-Live / AgentSession):**

- Native `EndCallTool` (`delete_room=True`, `ignore_on_enter=True`)

**Astra (Responses delegation):**

- Business tools only; **`end_call` not in `toolSchemas`**

## Files changed

| File | Why |
|------|-----|
| `voice-runtime-python/transovo_voice/voice_v3/end_call_tool.py` | Canonical EndCallTool config + telemetry callbacks |
| `voice-runtime-python/transovo_voice/voice_v3/session.py` | Wire helper; caller disconnect log; certification tool surface log |
| `src/lib/voice-v3/prompts/amy-end-call-instructions.ts` | Amy end-call policy |
| `src/lib/voice-v3/prompts/live-frontend-instructions.ts` | Include end-call section in Amy prompt |
| `src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts` | Exclude native tools from Astra `toolNames` prompt metadata |
| `voice-runtime-python/tests/test_voice_v3_end_call_tool.py` | Python unit test |
| `scripts/test-voice-v3-end-call-native.ts` | TS invariants + source guards |

## EndCallTool configuration (production)

See `build_voice_v3_end_call_toolset()` in `end_call_tool.py`:

- `delete_room=True`
- `ignore_on_enter=True`
- `extra_description` — multi-objective / no hangup after single tool success
- `end_instructions` — brief natural closing, no new questions
- `on_tool_called` → `VOICE_V3_END_CALL_REQUESTED`
- `on_tool_completed` → `VOICE_V3_END_CALL_COMPLETED`

## Telemetry

| Event | When |
|-------|------|
| `VOICE_V3_END_CALL_REQUESTED` | Native tool invoked |
| `VOICE_V3_END_CALL_COMPLETED` | Native `on_tool_completed` |
| `VOICE_V3_CALLER_DISCONNECTED` | SIP participant left room |
| `voice_v3_session_starting` | Includes `amyNativeTools: ["end_call"]` |

## Automated tests

```bash
cd voice-runtime-python && python -m pytest tests/test_voice_v3_end_call_tool.py -q
npx tsx scripts/test-voice-v3-end-call-native.ts
```

## PSTN certification (+15717491060)

**Not certified in this pass.** Run CERT 1–6 from the implementation directive on production after deploy; capture LiveKit job ID, room name, and telemetry timestamps per call.

## Transfer interaction

No changes to `transfer_executor.py`. End call is for Amy-concluded conversations; successful transfer uses LiveKit transfer lifecycle separately.
