# Voice V3 — complete PSTN forensics (latest call)

**Generated:** 2026-09-21T15:44:31.231Z
**Room suffix:** `MoSPbJXesc6M`

## 1. Call identity

| Field | Value |
|-------|-------|
| VoiceCall ID | `lk_transovo-call-{caller-redacted}_MoSPbJXesc6M` |
| Room name | `transovo-call-{caller-redacted}_MoSPbJXesc6M` |
| LiveKit job ID | `AJ_ZraAQEjVM9Ci` |
| liveSessionId | `lk_transovo-call-{caller-redacted}_MoSPbJXesc6M` |
| GPT-Live session ID | `live_u0_EQaLmp3oMROPlzX1dC7HcxEdvf9t7vsJ` |
| Room suffix | `MoSPbJXesc6M` |
| Caller (redacted) | `N/A` |
| Called DID | `N/A` |
| Call start UTC | 2026-09-21T15:36:05.238Z |
| Call end UTC | 2026-09-21T15:38:02.400Z |
| Duration | 117.162 s |
| appointmentBooked | false |
| Voice worker commit (expected) | `c91c4f4c425af22aaceb3437a60d381db5744417` |
| Worker container image tag | `c91c4f4c425af22aaceb3437a60d381db5744417` (deploy finished 15:20:31 UTC) |
| Call after observability deploy | **YES** (call started 15:36:05 UTC) |
| GPT-Live model | gpt-live-1 |
| Delegation | responses |
| Backend model | gpt-5.6-sol |
| Reasoning effort | none |
| Web/runtime commit (repo HEAD at export) | see git branch / package version |
| Deployment build | Coolify voice worker queue 3054 @ 2026-09-21T15:20:31Z |

**Observability verification:** Call started **after** worker image `c91c4f4c…` (not calls `dYDMLQvxF9xC` / `BRMzndUiiSem`).

## 2. Telemetry inventory

- RAW forensic events: **333**
- DEDUPED events: **167**
- Dedupe key: kind | occurred_at_utc | monotonic_ms | source | response_id | delegation_id | call_id | client_event_id | function_call_id | tool | message_id | inner_type
- VOICE_V3_CHAT_MESSAGE_METRICS: **42**
- GPT_LIVE_BACKEND_RESPONSE_CREATED: **14**
- GPT_LIVE_DELEGATION_RESPONSE_CREATED (legacy): **0**
- SESSION_USAGE_UPDATED: **28**
- sessionUsage on flush package: **missing**
