# Phase 53 — Boundary B fix report (V3 worker registration)

**Date:** 2026-09-20  
**Scope:** Register `transovo-voice-v3` on existing Coolify App 2 — no Telnyx/SIP/App1/App3 changes.

---

## ROOT CAUSE

V3 code (`voice_v3/`, `GPTLiveModel`, second `@server.rtc_session`) was already in the deployed image, but **only one worker process** ran:

- `VOICE_ENABLE_V3_PROFILE` was effectively off (default single-process deploy).
- `WORKER_PROFILE=legacy` only registered the primary `LIVEKIT_AGENT_NAME`.
- LiveKit **1.8.2** allows **one `rtc_session` per process**; enabling dual profiles in one process caused **8081 bind collision** on earlier deploy attempts.

The implementation directive’s “one AgentServer, two profiles” does **not** mean one OS process — it means one codebase/image with **two worker processes** under LiveKit 1.8.

---

## PROCESS MODEL (App 2, final)

| Process | Env | Health HTTP | LiveKit agent name |
|---------|-----|-------------|-------------------|
| A | `VOICE_WORKER_PROFILE=legacy`, `VOICE_WORKER_HTTP_PORT=8081` | `:8081` | `LIVEKIT_AGENT_NAME` (primary) |
| B | `VOICE_WORKER_PROFILE=v3`, `VOICE_WORKER_HTTP_PORT=8083` | `:8083` | `transovo-voice-v3` |

Supervisor: `voice-runtime-python/scripts/start-transovo-voice-worker.sh` (both children, SIGTERM propagates, fail-fast on startup death).

Coolify health check: **8081 only** (legacy). Port **8083** is in-container only. **8082** remains SMS App 3.

Escape hatch: `VOICE_ENABLE_V3_PROFILE=0` → legacy-only.

---

## CHANGES

| File | Change |
|------|--------|
| `voice-runtime-python/transovo_voice/main.py` | `AgentServer(port=…)` from `VOICE_WORKER_HTTP_PORT` / `LIVEKIT_WORKER_HTTP_PORT` (default 8081) |
| `voice-runtime-python/scripts/start-transovo-voice-worker.sh` | Dual-process supervisor; legacy 8081 + V3 8083 |
| `voice-runtime-python/Dockerfile` | `EXPOSE 8081 8083` |
| `docs/COOLIFY-TRANSOVO-VOICE-WORKER.md` | Document dual-process default |
| `scripts/coolify-restore-transovo-voice-worker.sh` | Remove raw-SQL update of encrypted `MEDIA_BACKEND_MODE` |

**Ops (Coolify host):** Fixed corrupted encrypted `MEDIA_BACKEND_MODE` row (id 443) via Laravel model after failed deploy 2998.

---

## DEPLOYMENT

| Field | Value |
|--------|--------|
| Branch | `cursor/voice-v3-livekit-implementation-2304` |
| Commits | `d87d265a` (dual process), `00798e40` (Dockerfile doc), restore script fix pending push |
| Coolify deployment | **2999** — **finished** |
| Image | `tgjridm6vrmrgljkfrr0rpjn:00798e40bbcb337a0ad4707368699e2fd4acf2c3` |
| Container health | **healthy** |

---

## LEGACY WORKER (`LIVEKIT_AGENT_NAME` / primary)

| Check | Result |
|--------|--------|
| REGISTERED | **YES** — log `registered worker` + `/worker` on `:8081` |
| Dispatch probe | **PASS** (`verify-571-livekit-callable.ts` `WORKER_DISPATCH_PROBE`) |

---

## V3 WORKER (`transovo-voice-v3`)

| Check | Result |
|--------|--------|
| REGISTERED | **YES** — log `agent_name": "transovo-voice-v3"` + `/worker` on `:8083` |
| Dispatch probe | **PASS** (`WORKER_DISPATCH_PROBE` with agent `transovo-voice-v3`) |

---

## V3 SESSION (non-PSTN)

Synthetic agent dispatch (verify-style probe rooms) shows:

| Step | Result |
|------|--------|
| LiveKit dispatch → V3 worker | **YES** — job accepted, `profile: voice_v3_gpt_live` |
| V3 entrypoint | **YES** — `run_voice_v3_livekit_session` entered |
| Wait for SIP participant | **FAIL (expected)** — `RuntimeError: room disconnected while waiting for participant` (no SIP leg / probe room teardown) |
| Backend resolution / `GPTLiveModel` session | **NOT PROVEN** in probe (blocked before SIP participant — by design; do not fake ANI/DID) |

**First unproven step after registration:** authoritative **SIP participant** (or approved test harness with real participant attributes) before `AgentSession` + `GPTLiveModel` init.

---

## PORTS

| Port | Owner |
|------|--------|
| 8081 | Legacy LiveKit worker health |
| 8083 | V3 LiveKit worker health |
| 8082 | SMS App 3 (unchanged) |

No collision observed in deploy 2999 logs (`HTTP server listening on :8081` and `:8083`).

---

## LIVEKIT PROJECT

Both processes register to **`sms-6w01zoya`** (same `LIVEKIT_URL` / credentials on App 2).

---

## TELNYX

**`+15717491060` ROUTING UNCHANGED = YES** (still `Transovo Voice V3 Basic OpenAI SIP`).

No trunk change for 571. No Phase 54.

---

## FIRST REMAINING BOUNDARY (A–L, post–Boundary B)

| Boundary | Status |
|----------|--------|
| **B** — V3 worker registration | **ADDRESSED** (both agents registered + dispatch probes pass) |
| **A** — SIP / participant | **NEXT** for end-to-end V3 session without weakening validation (SIP participant + attributes, trunk/dispatch cutover when approved) |

---

## EXACT NEXT CHANGE (before Phase 54 — not performed)

1. Plan **dispatch rule** target for cert cutover (`transovo-voice-v3` vs primary) on existing trunk `ST_MqBTBjwPieAv` / rule `SDR_VjjkrrgEjiR3`.
2. When approved: add **571** to LiveKit trunk + Telnyx FQDN cutover — **separate** change set.
3. Optional: App 1 `LIVEKIT_SIP_URI` vs `LIVEKIT_URL` project mismatch (`2tzwfcliuex` vs `sms-6w01zoya`) — **separate** from Boundary B.

**STOP** — awaiting approval for SIP/trunk/Telnyx sequence.
