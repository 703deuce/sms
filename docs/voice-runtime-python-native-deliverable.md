# Native LiveKit Python Voice Runtime — Final Deliverable

**Branch:** `cursor/fix-python-booking-native-7c56`  
**Status:** Phases 1–4 implemented (do not deploy until automated tests + PSTN smoke pass)

---

## Pipeline table (Telnyx SIP → hangup)

| Step | Component | Classification |
|------|-----------|----------------|
| PSTN ingress | Telnyx SIP trunk | **BACKEND / TELEPHONY** |
| SIP → room | LiveKit Cloud SIP | **LIVEKIT NATIVE** |
| Dispatch | `transovo-voice-runtime` agent name | **LIVEKIT NATIVE** |
| Worker | `AgentServer` + `cli.run_app` | **LIVEKIT NATIVE** |
| Job entry | `JobContext`, `wait_for_participant` | **LIVEKIT NATIVE** |
| Bootstrap | HTTP `bootstrap_inbound` | **BACKEND BUSINESS LOGIC** |
| Config / manifest | `SessionUserData`, compiled prompt | **TRANSOVO CUSTOM** (typed userdata) |
| Connect | `ctx.connect()` | **LIVEKIT NATIVE** |
| Session | `AgentSession` + OpenAI Realtime plugin | **LIVEKIT NATIVE** |
| Turn / VAD | `SemanticVad`, plugin defaults | **LIVEKIT NATIVE** (no custom mutex) |
| Greeting | `AmyAgent.on_enter` + `generate_reply` | **LIVEKIT NATIVE** |
| Intent: booking | `start_booking` tool | **TRANSOVO CUSTOM** (thin) |
| Intake | `BookingIntakeTask` → `TaskGroup` | **LIVEKIT NATIVE** |
| Name / phone / email / address | `GetNameTask`, `GetPhoneNumberTask`, etc. | **LIVEKIT NATIVE** |
| Custom manifest fields | `DynamicFieldTask` | **TRANSOVO CUSTOM** |
| Field persist | HTTP `persist_intake_fields` | **BACKEND BUSINESS LOGIC** |
| Tool phases | `update_tools()` idle → availability → slot → confirm | **LIVEKIT NATIVE** |
| Availability | `check_availability` → HTTP Calendly | **BACKEND BUSINESS LOGIC** |
| Slot offer | Model speaks `linesForModel` | **LIVEKIT NATIVE** (no custom TTS) |
| Slot select | `select_slot` validates offered IDs | **TRANSOVO CUSTOM** (deterministic) |
| Confirm | `confirm_booking` tool | **TRANSOVO CUSTOM** (thin) |
| Commit | HTTP `commit_booking` idempotent | **BACKEND BUSINESS LOGIC** |
| Commit resilience | `commit_booking_resilient` + shutdown drain | **TRANSOVO CUSTOM** (session boundary) |
| Confirmation speech | `session.say` + `disallow_interruptions` | **LIVEKIT NATIVE** |
| Message | `BookingIntakeTask` + `persist_message` | **LIVEKIT NATIVE** + **BACKEND** |
| FAQ | `get_business_answer` HTTP | **BACKEND BUSINESS LOGIC** |
| Transfer policy | HTTP `resolve_transfer` | **BACKEND BUSINESS LOGIC** |
| Transfer execution | `WarmTransferTask` | **LIVEKIT NATIVE** |
| End call | `EndCallTool` | **LIVEKIT NATIVE** |
| Shutdown | `ctx.add_shutdown_callback`, drain commits | **LIVEKIT NATIVE** + **TRANSOVO CUSTOM** |
| Durable record | `voiceCall` metadata / appointments | **BACKEND BUSINESS LOGIC** |

---

## Legacy workarounds removed

| Removed | Replaced by |
|---------|-------------|
| `opportunistic_prefill` + `extract_fields` hot path | TaskGroup + conversation scan instructions |
| `tasks/adapters.py` wrappers | Direct SDK beta tasks |
| Intake + availability in one `start_booking` call | `BookingIntakeTask` + `check_availability` |
| Static 5-tool surface | Phased `update_tools()` |
| `intake_active` flag | AgentTask owns intake session |
| TS `awaitingFieldAnswer`, `force_record`, etc. | Never ported to Python |

---

## LiveKit primitives adopted

- `Agent`, `AgentSession`, `AgentTask`, `TaskGroup`
- `GetNameTask` (with `verify_spelling`), `GetPhoneNumberTask`, `GetEmailTask`, `GetAddressTask`
- `DynamicFieldTask` only for arbitrary manifest fields
- `function_tool`, `RunContext`, `update_tools`
- `EndCallTool`, `WarmTransferTask`
- `session.history` / `chat_ctx` preservation
- `context.disallow_interruptions()` on confirmation
- `SemanticVad` via OpenAI Realtime plugin (no `create_response` toggling)

---

## Custom components kept (and why)

| Component | Why LiveKit cannot replace |
|-----------|---------------------------|
| `TransovoBackend` HTTP client | Calendly, Prisma, tenant isolation |
| `DynamicFieldTask` | No prebuilt task for arbitrary manifest fields |
| `WorkflowState` enum | Business legality gates (not utterance control) |
| `commit_booking_resilient` + drain | Session/process boundary; write runs in backend |
| ANI phone prefill | Transovo business rule |
| `select_slot` ID validation | Authoritative slot set from backend |
| `resolve_transfer` backend action | Tenant routing policy |
| `persist_message` | CRM / call record persistence |
| Structured `log_event` telemetry | Cross-service observability |

---

## Tests added

| File | Coverage |
|------|----------|
| `test_field_mapping.py` | Field types, ANI prefill, missing fields |
| `test_booking_flow.py` | Availability staging |
| `test_tool_phases.py` | Phased tool surfaces, transfer gating |
| `test_commit_resilient.py` | Pending commit drain, shutdown survival |

Run: `npm run build:voice-python`

---

## Migration risks

| Risk | Mitigation |
|------|------------|
| Model must call `check_availability` after intake | Tool result instructs; phased tools hide confirm until ready |
| `LIVEKIT_SIP_OUTBOUND_TRUNK` required for transfer | Graceful error + take message fallback |
| `handlers.ts` still imports voice-runtime for Calendly | Isolated to commit path; persist/transfer/message are lightweight |
| TS runtime still present | `VOICE_RUNTIME_IMPL=typescript` rollback until 5–10 PSTN smokes |

---

## Files changed (Python voice runtime)

- `transovo_voice/agent/amy.py` — phased `update_tools`
- `transovo_voice/agent/tools.py` — idle / availability / slot / confirm builders
- `transovo_voice/agent/transfer_tool.py` — `WarmTransferTask`
- `transovo_voice/workflows/booking_intake_task.py` — `BookingIntakeTask`
- `transovo_voice/workflows/booking_flow.py` — availability helper
- `transovo_voice/workflows/booking_intake.py` — TaskGroup core
- `transovo_voice/integrations/commit_client.py` — resilient commit
- `transovo_voice/userdata.py` — transfer policy, capabilities, pending tasks
- `transovo_voice/session/inbound.py` — bootstrap parse, room options, drain
- `tests/*` — expanded suite

## Files changed (backend bridge)

- `src/lib/voice/python-runtime-bridge/resolve-transfer.ts`
- `src/lib/voice/python-runtime-bridge/persist-message.ts`
- `src/lib/voice/python-runtime-bridge/handlers.ts` — idempotent commit
- `src/app/api/internal/voice-runtime/route.ts` — new actions

---

## Before deleting TypeScript collection path

1. All `npm run build:voice-python` tests pass
2. Integration tests against staging internal API (optional)
3. **5–10 clean production PSTN smoke calls** through Python worker
4. Five-gate booking verification on real calls

**Do not deploy automatically.**
