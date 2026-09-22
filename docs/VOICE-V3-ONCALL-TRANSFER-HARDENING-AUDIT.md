# Voice V3 — On-call scheduling + transfer hardening — audit

**Production reference:** `4950c526` (transfer system baseline) + business auto-setup branch as deployed separately.

## Existing transfer backend (Node)

| Area | Location |
|------|----------|
| Tool | `src/lib/voice-v3/tools/transfer-call-tool.ts` → `authorizeVoiceV3Transfer` |
| Catalog | `src/lib/voice-v3/tools/voice-tool-catalog.ts` (`transfer_call`) |
| Authorization | `src/lib/voice-v3/transfer/authorize-transfer.ts` |
| Compiler | `src/lib/voice-v3/transfer/compile-transfer-config.ts` |
| Types | `src/lib/voice-v3/transfer/types.ts` |
| Handoff briefing | `src/lib/voice-v3/transfer/build-handoff-summary.ts` |
| Publish validation | `src/lib/voice-v3/transfer/validate-transfer-publish.ts` |
| Telemetry | `src/lib/voice-v3/transfer/telemetry.ts` |
| Outcome persistence | `src/lib/voice/python-runtime-bridge/record-voice-v3-transfer-outcome-for-python.ts` |
| Notifications | `src/lib/voice-v3/notifications/notify-transfer-outcome.ts` |
| Wizard UI | `src/components/solutions/appointment-receptionist/emergency-transfer-editor.tsx` |
| Wizard state | `src/lib/solutions/appointment-receptionist/transfer-wizard-state.ts` |
| Automated tests | `scripts/test-voice-v3-transfer-system.ts`, `scripts/test-voice-v3-transfer-wizard-state.ts` |

**Flow today:** Astra `transfer_call` once → Node authorizes route → `execution` plan with dial targets → Python `execute_authorized_transfer_plan` waterfall.

**Gap before this pass:** No per-destination on-call schedules, no eligibility skips, `detectVoicemailOnTransfer` compiles to agent config but **not** passed to Python warm-transfer instructions; warm transfer uses `extra_instructions` only (not `instructions`).

## Existing Python executor

| Piece | File |
|-------|------|
| Waterfall + warm/direct | `voice-runtime-python/transovo_voice/voice_v3/transfer_executor.py` |
| Tool hook | `voice-runtime-python/transovo_voice/voice_v3/tools.py` |
| Legacy warm samples | `transovo_voice/agent/transfer_tool.py`, `session/mctb_direct_dial_forward.py` |

Warm path: `WarmTransferTask(sip_call_to, sip_trunk_id, sip_number, ringing_timeout, extra_instructions=handoff, chat_ctx=...)`.

Outcomes mapped loosely (`TIMEOUT`, `DECLINED`, `VOICEMAIL` via ToolError message heuristics).

## `detectVoicemailOnTransfer` (pre-pass)

| Stage | Status |
|-------|--------|
| Wizard UI checkbox | Persists on `AppointmentReceptionistWizardState` |
| Save merge | `merge-wizard-state-on-save.ts` |
| V3 compile | `compile-voice-v3-agent-config.ts` → `detectVoicemailOnTransfer` on agent config |
| Python warm transfer | **Not wired** — no instruction to use `voicemail_detected` |
| Legacy Telnyx transfers | `src/lib/voice/transfers.ts` reads published `transfers.detectVoicemailOnTransfer` for AMD on transfer legs |

**Conclusion:** Field is real in wizard/publish for V3 config but **dead for LiveKit warm transfer** until handoff instructions include native `voicemail_detected` guidance.

## Installed LiveKit Agents 1.8.2 — `WarmTransferTask`

**Package:** `livekit-agents==1.8.2` (system + production pin).

**Constructor (installed):** `sip_call_to`, `sip_trunk_id`, `sip_connection`, `sip_number`, `sip_headers`, `dtmf`, `ringing_timeout`, `hold_audio`, `instructions`, `chat_ctx`, `turn_detection`, `tools`, `stt`, `vad`, `llm`, `tts`, `allow_interruptions`, deprecated `extra_instructions`, `target_phone_number`.

**Native tools on task:** `connect_to_caller`, `decline_transfer`, `voicemail_detected` (instance methods on `WarmTransferTask`).

**Hold:** `hold_audio` — defaults to built-in hold clip; disables caller I/O while on hold per SDK implementation (`livekit/agents/beta/workflows/warm_transfer.py`).

**Ringing timeout:** Returns `ToolError` → caller conversation resumes (maps to failed attempt, not CONNECTED).

**Do not:** custom hold rooms, duplicate SIP consult framework, or upgrade SDK in this pass.

## Reuse

- Weekly time evaluation patterns aligned with `src/lib/voice-receptionist-wizard/operating-maturity/on-call.ts` (overnight `end <= start` semantics).
- Business timezone default from wizard `timezone` / `VOICE_V3_DEFAULT_BUSINESS_TIMEZONE`.
