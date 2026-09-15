# Voice V2 Phase 2B — Call-start warmup report

## 1. Warmup hook

**File:** `src/lib/voice/inbound.ts` — `startAiOnInboundCall`

**Ordering (caller-visible lane first):**

1. `answer` (Call Control)
2. Optional startup greeting mask / disclosure (may be concurrent with mask)
3. `startAiAssistantOnCall` (Amy greeting / assistant live) — **await completes**
4. Recording + transcription starts
5. **`scheduleVoiceV2CallWarmup(...)`** — **void, not awaited**
6. `voiceCall.update` (metadata)

Warmup begins **after** the assistant handoff that releases greeting, **before** DB metadata update (both non-blocking for audio).

## 2. Concurrency vs answer/greeting

Warmup is **never awaited** before `answer`, mask, or `startAiAssistantOnCall`.

## 3. Warmup tasks

| Task | Future |
|------|--------|
| Canonical session key + aliases | inline in `runWarmup` |
| Enrollment snapshot | `buildVoiceV2CallContextPayload` |
| L2 create + L1 hydrate | `createVoiceV2CallContext` (`l2Persist: await` at call start) |
| Intake schema compile | part of build |
| Booking config / timezone | part of build |
| Provider connection id | `resolveMctbMicrosoftConnectionId` (background void) |
| Token inspect/refresh | `warmMicrosoftTokenIfNeeded` (void, distributed lock) |

Independent failures do not block greeting; `ensure` joins in-flight warmup via `joinVoiceV2CallWarmup`.

## 4. Cancellation

`abortVoiceV2CallWarmup({ callControlId, callId })` — aborts `AbortController`, marks context `ENDED`.

## 5–8. Metrics

Run:

- `scripts/benchmark-voice-v2-redis-phase-2b.ts` (requires `REDIS_URL`)
- `scripts/benchmark-voice-v2-context-init-phase-2a.ts` (compare paths)
- `scripts/test-voice-v2-call-warmup-phase-2b.ts`

PSTN ingress/greeting metrics require Telnyx timestamps (not run in this pass unless deployed).

## 9. Frozen files

FIND/BOOK/Microsoft/workflow unchanged.

## 10. Tests

- `test-voice-v2-call-warmup-phase-2b.ts`
- `test-voice-v2-call-context-2a.ts`
- `test-voice-v2-book-offered-slot-mock-headless.ts` (mandatory BOOK mock)
- Live book: `SKIP_ENVIRONMENT_UNAVAILABLE` when Microsoft absent
