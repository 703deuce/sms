# Voice V3 runtime isolation

The **only** supported PSTN voice product runtime is the wizard **appointment receptionist** (`advanced.capabilityPack === "appointment_receptionist"`).

Legacy Telnyx Amy, GPT-Live lean inbound, OpenAI realtime media bridge, Voice V2 HTTP tools, and generic AI receptionist agents are **removed from the call path** — not feature-flagged.

```
Caller → Telnyx Call Control → SIP forward → OpenAI Live
  → Astra emit_caller_meaning → VoiceV3CallContext
  → evaluateVoiceV3Rules → FIND / BOOK / RESCHEDULE / CANCEL
  → Microsoft Graph (certified executors)
  → authoritative Live context → Amy confirms only after provider success
```

## Supported vs unsupported agents

| Agent | PSTN |
|-------|------|
| Appointment receptionist (Voice V3) | `startAppointmentReceptionistVoiceV3OnCall` |
| Any other voice agent / AI receptionist | `handleUnsupportedVoiceAgentRuntime` — spoken decline, no legacy fallback |

## Entry points (single path)

| Layer | Behavior |
|-------|----------|
| `inbound.ts` `startAiOnInboundCall` | Receptionist → V3 SIP forward; else unsupported handler |
| `webhook-handlers` `call.answered` | Same |
| `startAiAssistantOnCall` | Always throws `LEGACY_TELNYX_AI_REMOVED_USE_VOICE_V3` |
| `/api/telnyx/voice/tools` | Receptionist only; Telnyx mid-call tools disabled (scheduling is OpenAI Live + rules) |
| Transfer return-to-AI | SIP forward when agent is supported receptionist |
| Queue overflow to AI | SIP forward when supported; no Telnyx Amy |

## Booking scene

FIND → OfferSet → SELECT → **revalidate** → BOOK → `BOOKING_CONFIRMED`. Reschedule/cancel reuse the same machinery.

## Regression

- `tsx scripts/test-voice-v3-runtime-isolation.ts` (in `test:voice-v3-intake`)
- `npm run test:voice-v3-booking` / `reschedule` / `cancellation`

## Manual certification

Microsoft lifecycle + PSTN on staging/production — see `docs/V1-PRODUCTION-CERTIFICATION.md`.
