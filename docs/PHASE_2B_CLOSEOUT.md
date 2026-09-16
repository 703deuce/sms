# Voice V2 Phase 2B — production closeout

**Do not start Phase 3 until `PHASE_2B_PRODUCTION_GATE = PASS`.**

## Narrow corrections (pre-PSTN)

1. **Warmup immediately after assistant release** — `scheduleVoiceV2CallWarmup` runs before recording/transcription/metadata; recording/transcription are `void` (non-blocking).
2. **Non-blocking warmup telemetry** — `voice_v2.warmup_*` events are deferred; first await in `runWarmup` is `resolveVoiceV2SessionKey`. `WARMUP_BLOCKING_TELEMETRY = 0`.

## Real Redis (unchanged — background-only)

| Metric | Value |
|--------|--------|
| L2_CREATE_P50 | 805.7 ms |
| L2_CREATE_P95 | 879.8 ms |
| L2_GET_P50 | 121.4 ms |
| L2_GET_P95 | 121.7 ms |
| ALIAS_RESOLVE_P50 | 60.7 ms |
| ALIAS_RESOLVE_P95 | 60.9 ms |

Re-run: `npx tsx scripts/benchmark-voice-v2-redis-phase-2b.ts` (reports `NORMAL_WARMED_*` vs `L1_MISS_RECOVERY_*` separately).

## PSTN (required for gate)

Deploy branch → one certification call →:

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  CALL_ID=<uuid> BASELINE_CALL_ID=<optional> \
  npx tsx scripts/certify-voice-v2-phase-2b-pstn-startup.ts
```

## Gate status

| Label | Value |
|-------|--------|
| PHASE_2A_GATE | PASS |
| PHASE_2B_HEADLESS | PASS |
| PHASE_2B_PRODUCTION_GATE | **PENDING** (PSTN cert) |
