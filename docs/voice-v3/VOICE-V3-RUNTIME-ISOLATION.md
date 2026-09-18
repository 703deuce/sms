# Voice V3 runtime isolation

Appointment receptionist PSTN uses **one** booking pipeline:

```
Caller → Telnyx Call Control → SIP forward → OpenAI Live
  → Astra `emit_caller_meaning` → VoiceV3CallContext
  → evaluateVoiceV3Rules → FIND / BOOK / RESCHEDULE / CANCEL dispatch
  → Microsoft Graph (certified executors under `src/lib/voice-v3/calendar/microsoft/`)
  → authoritative Live context → Amy may confirm only after provider success
```

## Hard blocks (no legacy path)

| Layer | Behavior |
|-------|----------|
| Inbound / `call.answered` | `appointmentReceptionistUsesVoiceV3Runtime` → `forwardInboundCallToOpenAiLiveSip` |
| Fallback | `startAiAssistantOnCall` throws `VOICE_V3_ONLY_NO_LEGACY_TELNYX_AMY` when clientState has workspace + agent |
| Telnyx publish | `ensureVoiceV2SharedToolsForAgent` returns null tool IDs (no voice-v2 webhooks) |
| Workflow graph | `VOICE_V3_PSTN_GENERAL_APPEND` — no voice_v2 / voice_ai_booking_turn scheduling tools |
| HTTP | `/api/telnyx/voice-v2/*` routes removed |

Wizard config compiles in `src/lib/voice-receptionist-wizard/`; runtime resolves via `resolveVoiceV3AgentConfigForAgent()`.

## Regression

- `tsx scripts/test-voice-v3-runtime-isolation.ts`
- `npm run test:voice-v3-intake` (includes pipeline boundary + isolation)
- `npm run test:voice-v3-booking` / `test:voice-v3-reschedule` / `test:voice-v3-cancellation`

## PSTN certification

After automated suites pass, one real call: book → verify in Microsoft → reschedule → cancel → verify. Cloud agents cannot complete PSTN; run manually per `docs/V1-PRODUCTION-CERTIFICATION.md`.
