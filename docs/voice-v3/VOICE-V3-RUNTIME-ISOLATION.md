# Voice V3 runtime isolation

Appointment receptionist PSTN uses **one** booking pipeline:

```
Caller → Telnyx Call Control → SIP forward → OpenAI Live
  → Astra `emit_caller_meaning` → VoiceV3CallContext
  → evaluateVoiceV3Rules → FIND / BOOK / RESCHEDULE / CANCEL dispatch
  → Microsoft Graph (certified executors under `src/lib/voice-v3/calendar/microsoft/`)
  → authoritative Live context → Amy may confirm only after provider success
```

## Hard blocks (no legacy path, no feature flag)

Receptionist agents are identified only by `advanced.capabilityPack === "appointment_receptionist"`. There is no `voiceV3PstnBooking` toggle.

| Layer | Behavior |
|-------|----------|
| Inbound | **First** path after agent load: `startAppointmentReceptionistVoiceV3OnCall` (before GPT-Live lean or Telnyx Amy) |
| `call.answered` | Same helper — SIP forward only |
| Safety net | `startAiAssistantOnCall` throws if client state includes a receptionist agent |
| Tool webhooks | `/api/telnyx/voice/tools` and workflow fast-path reject **any** Telnyx tool for receptionist agents (`VOICE_V3_ONLY_NO_LEGACY_PIPELINE`) |
| Telnyx publish | `ensureVoiceV2SharedToolsForAgent` returns null tool IDs (no voice-v2 webhooks) |
| Workflow graph | `VOICE_V3_PSTN_GENERAL_APPEND` — no voice_v2 / voice_ai_booking_turn scheduling tools |
| HTTP | `/api/telnyx/voice-v2/*` routes removed |

Wizard config compiles in `src/lib/voice-receptionist-wizard/`; runtime resolves via `resolveVoiceV3AgentConfigForAgent()`.

## Booking scene (deterministic only)

FIND → OfferSet → SELECT → **revalidate** → BOOK → `BOOKING_CONFIRMED` → Live context. Reschedule/cancel reuse the same FIND/SELECT/revalidate machinery.

Static checks: `scripts/test-voice-v3-booking-scene-invariant.ts` (runs inside `npm run test:voice-v3-booking`).

## Regression

- `tsx scripts/test-voice-v3-runtime-isolation.ts`
- `npm run test:voice-v3-intake` (includes pipeline boundary + isolation)
- `npm run test:voice-v3-booking` / `test:voice-v3-reschedule` / `test:voice-v3-cancellation`

## PSTN + Microsoft certification

After automated suites pass: BOOK → verify in Microsoft → RESCHEDULE → verify → CANCEL → verify, plus one PSTN call. Cloud agents cannot complete PSTN; run manually per `docs/V1-PRODUCTION-CERTIFICATION.md`.
