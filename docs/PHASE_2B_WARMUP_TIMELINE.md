# Phase 2B — Caller-visible vs warmup timeline

Primary path: **`startAiOnInboundCall`** in `src/lib/voice/inbound.ts`. Fallback: **`call.answered`** in `src/lib/voice/telnyx/webhook-handlers.ts` (same ordering).

## Ordered timeline (inbound_initiated)

| Step | Label | Blocking? | Code |
|------|--------|-----------|------|
| T0 | **TELNYX ANSWER REQUEST** | await | `telnyxRequest(.../actions/answer)` + `media.answer_sent` |
| T1 | NS + optional disclosure / startup mask | await (mask may be concurrent) | `playStartupGreetingMask`, settle sleep |
| T2 | **TELNYX ASSISTANT START** | await | `startAiAssistantOnCall` → Telnyx `ai_assistant_start` |
| T3 | **GREETING RELEASED** | when T2 returns | Greeting owned by Telnyx |
| T3a | **`scheduleVoiceV2CallWarmup`** | **not awaited** | immediately after T2; races recording/transcription |
| T4 | `media.ai_assistant_start` telemetry | await (caller lane already released) | DB event with `ASSISTANT_START_RETURNED_AT` |
| T5 | Recording + transcription | **void** (non-blocking) | `void startCallRecording`, `void startCallTranscription` |
| T6 | `voiceCall.update` metadata | await | DB only |

**Invariant:** warmup is **not** behind awaited recording/transcription. Warmup is **not** before assistant/greeting release.

## Warmup internal order

1. `scheduleVoiceV2CallWarmup` → local `WARMUP_SCHEDULED_AT` + deferred `voice_v2.warmup_scheduled` (no await)
2. `runWarmup` → local `WARMUP_ACTUAL_STARTED_AT` + deferred `voice_v2.warmup_started` (no await)
3. **First await:** `resolveVoiceV2SessionKey` → `buildVoiceV2CallContextPayload` → `createVoiceV2CallContext` (Redis ~800ms background)
4. Deferred `voice_v2.warmup_l2_ready` with `WARMUP_DURATION_MS`

`WARMUP_BLOCKING_TELEMETRY = 0` — no awaited Prisma before substantive warmup.

## Hangup

`terminateVoiceV2CallSessionOnHangup` on Telnyx termination events (see `webhook-handlers.ts`).

## PSTN cert

`scripts/certify-voice-v2-phase-2b-pstn-startup.ts` with `CALL_ID` (+ optional `BASELINE_CALL_ID`).
