# Voice V2 — AI Call Recovery

## Goal

When Amy answers an inbound Voice V2 call but the caller’s task is **not resolved** before the voice session ends, Transovo may send a **single** context-aware recovery SMS. If the caller replies, the **existing AI text agent** (`mctb/ai-booking` conversation runtime + orchestrator) continues the same interaction with:

1. Authoritative structured voice state (intake + booking + transfer/callback)
2. Complete ordered voice transcript
3. Normalized action/tool timeline
4. Supplemental call summary (never a substitute for transcript)

This is **not** Missed Call Text Back (MCTB). Triggers, analytics, and recovery reason codes are separate.

## Architecture

```
Voice Amy → CallContext + transcript + provider truth
     → hangup → settle window (3–8s) → evaluateAiCallRecovery (deterministic)
     → recovery SMS (idempotent) → caller SMS reply
     → existing AI text agent (hydrated continuation)
```

Post-call Deepgram reconciliation remains an independent QC layer and must not overwrite newer SMS corrections.

## Configuration

Published on the voice agent advanced config block `voiceV2AiCallRecovery` (wizard Call Handling → **AI Call Recovery**):

- `enabled`, `consentMode`, `sendingPhoneNumberId`, `continueOverSms`
- `triggers.*`, `sendWhenCallbackAlreadyCreated`, `delaySeconds`, `templates`

## Delivery classes (level 1)

- `SEND_RECOVERY_SMS` (+ recovery subtype)
- `SEND_CONFIRMATION_SMS` / `SEND_CALLBACK_ACK_SMS` (delegate to existing confirmation paths)
- `SEND_FAILURE_FALLBACK_SMS`
- `NO_SMS`

## Product contract

| Capability | Status |
|------------|--------|
| `AI_CALL_RECOVERY` | `IMPLEMENTED` (headless); `PSTN_CERTIFIED` pending manual Voice→SMS test |

## Tests

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-ai-call-recovery-headless.ts
```

## Key modules

- `src/lib/voice-v2/ai-call-recovery/evaluate.ts` — deterministic decision engine
- `src/lib/voice-v2/ai-call-recovery/settle-job.ts` — async settle + send pipeline
- `src/lib/voice-v2/ai-call-recovery/inbound-reply.ts` — SMS reply → text agent
- `src/lib/voice-v2/ai-call-recovery/continuation-hydration.ts` — transcript merge for semantic context
