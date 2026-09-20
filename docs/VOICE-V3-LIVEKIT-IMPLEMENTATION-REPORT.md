# Voice V3 LiveKit Tool Architecture — Implementation Report (draft)

**Status:** STOP BEFORE DEPLOYMENT — partial implementation on `cursor/voice-v3-livekit-tool-architecture-2304`  
**LiveKit installed:** `livekit-agents==1.8.2` (verified in cloud agent environment)

## LIVEKIT VERSION / APIs verified

| API | Installed 1.8.2 | Used |
|-----|-----------------|------|
| `function_tool(..., raw_schema=...)` | Yes | Transovo business tools |
| `RunContext.disallow_interruptions()` | Yes | **Not used** on GPT-Live writes (see `VOICE-V3-LIVEKIT-GPT-LIVE-INTERRUPTION-POLICY.md`) |
| `ToolFlag.CANCELLABLE` | Yes | `find_availability`, `find_appointment` |
| `on_duplicate` / `duplicate_scope` | `"replace"` / `"reject"`, `"name_and_args"` | Per tool class |
| `EndCallTool(ignore_on_enter=True)` | `livekit.agents.beta.tools` | Session hangup |
| `JobContext.transfer_sip_participant` | `livekit.agents.job` | Cold transfer after Transovo auth |
| `GetEmailTask` etc. | `livekit.agents.beta.workflows` | Mapped in `intake_collection.py`; active Task invocation not yet wired in session |
| GPT-Live `delegation="responses"` | Yes | Unchanged in `session.py` |

## TOOL ARCHITECTURE (target vs current)

| Capability | Class | Current branch state |
|------------|-------|----------------------|
| Intake (passive) | Bulk `update_intake` FunctionTool → Transovo | **Done** (wizard schema via bridge) |
| Intake (active) | LiveKit Tasks + field resolver | **Resolver only** (`intake_collection.py`); session does not auto-run TaskGroup |
| Custom fields | Programmatic FunctionTools | **Future** — still via `update_intake` raw schema |
| `set_scheduling_preference` … `request_callback` | FunctionTool → Transovo | **Done** |
| `transfer_call` | Transovo auth → LiveKit SIP transfer | **Done** (Python after `transfer_requested`) |
| `end_call` | LiveKit `EndCallTool` | **Done** (excluded from Astra schemas) |

## INTAKE

- **Passive:** `update_intake` LiveKit FunctionTool with wizard-generated raw schema; continuous capture preserved in Transovo runtime.
- **Active collection:** `resolve_intake_collection_kind()` maps standard keys to LiveKit task families; **not** invoked automatically until GPT-Live + Task compatibility is certified per field.
- **Multi-field utterances:** Single `update_intake` invocation (Approach B); sequential per-field tools not generated yet.
- **Persistence:** `execute_voice_v3_livekit_tool` → existing TS executors (authoritative).

## TRANSFER

- Flow: Astra `transfer_call(destination_id)` → Transovo `transfer-call-tool.ts` (wizard `phoneE164` + env fallback) → Python `transfer_sip_participant(identity, tel:…)` → SIP REFER.
- **Warm:** `WarmTransferTask` — future only; wizard mode hook not implemented.

## END CALL

- `EndCallTool` on `AgentSession` with `ignore_on_enter=True`, `delete_room=True`.
- Transovo semantic `end_call` executor bypassed on LiveKit path (native tool name `end_call`).

## HTTP

- Still `TransovoBackend` httpx client with **job shutdown callback** close (`session.py`). `http_context.http_session()` not adopted yet — evaluate in follow-up.

## REMOVED / BYPASSED

- Four-tool cert filter in `resolveVoiceV3LiveKitSession` → wizard `listVoiceV3AstraToolNamesForConfig`.
- Physical hangup via Transovo `end_call` on LiveKit path (native EndCallTool).
- Telnyx-only transfer note; LiveKit executes transfer after authorization.

## PRESERVED

- `compileVoiceV3AgentConfig`, wizard manifest, Microsoft executors, generations, OfferSets, idempotency, Astra contracts, `executeVoiceTool` pipeline.

## TEST RESULTS (automated)

| Test | Result |
|------|--------|
| `scripts/test-voice-v3-livekit-bridge.ts` | PASS (wizard tool count + `update_intake`) |
| `scripts/test-voice-v3-livekit-concurrency-cert.ts` | Run on branch after push |
| PSTN / GPT-Live intake A–J | **Not run** (manual) |
| Transfer / end_call PSTN | **Not run** (manual) |

## EXACT DIFF (this pass)

- `voice-runtime-python/transovo_voice/voice_v3/tools.py` — RunContext, mutations, transfer, cancellable reads
- `voice-runtime-python/transovo_voice/voice_v3/session.py` — EndCallTool, telephony bridge
- `voice-runtime-python/transovo_voice/voice_v3/intake_collection.py` — field resolver (new)
- `src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts` — wizard tool gating
- `src/lib/voice-v3/tools/transfer-call-tool.ts` — wizard `phoneE164`
- `scripts/test-voice-v3-livekit-bridge.ts` — wizard-based expectations

## NEXT (before deploy)

1. Wire optional active intake Tasks behind explicit missing-field helper (GPT-Live cert).
2. Generate per-custom-field FunctionTools from wizard when bulk tool proves insufficient in PSTN tests.
3. Per-tool table (directive §39) + full switching matrix on PSTN.
4. Align Coolify voice image branch with this commit.
