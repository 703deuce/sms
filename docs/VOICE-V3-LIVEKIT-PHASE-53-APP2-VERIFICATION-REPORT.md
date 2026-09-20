# Phase 53 — App 2 LiveKit worker verification (read-only)

**Date:** 2026-09-20  
**Scope:** Coolify App 2 restoration verification + Phase 53 LiveKit boundary (no App 1/2/3 reconfig, no Telnyx changes)  
**Branch reference:** `cursor/voice-v3-livekit-implementation-2304`  
**Authoritative deployment doc:** `docs/deployment-transovo-web-voice-split.md`

---

## Executive summary

- **App 2** is restored as the Python LiveKit worker (Dockerfile, port 8081, healthy, registered with LiveKit Cloud on project `sms-6w01zoya`).
- **SMS is not on App 2** (separate App 3 on port 8082).
- **V3 code is in the deployed image**, but **`transovo-voice-v3` is not registered** at runtime (single legacy process on 8081).
- **`+15717491060`** remains on **Transovo Voice V3 Basic OpenAI SIP** — Telnyx routing unchanged; LiveKit trunk does not own that DID yet (expected pre-cutover).

**Do not rebuild App 2** unless verification below shows a new failure.

---

## Coolify layout (confirmed)

| App | id | UUID | Role |
|-----|----|------|------|
| Web | 1 | `ds8s3hjin60qs6g7s0iqkixs` | Transovo web/backend (Nixpacks) |
| Voice | 2 | `tgjridm6vrmrgljkfrr0rpjn` | **transovo-voice** — Python LiveKit worker |
| SMS | 3 | `fd7b2fe8172414e3320776281a` | **transovo-sms-worker** — `Dockerfile.sms-worker`, port 8082 |

### App 2 configuration (target spec)

| Field | Value |
|--------|--------|
| Name | `transovo-voice` |
| Build pack | `dockerfile` |
| Dockerfile | `/voice-runtime-python/Dockerfile` (repo root `/`) |
| Start command | empty (image CMD) |
| CMD | `voice-runtime-python/scripts/start-transovo-voice-worker.sh` |
| `ports_exposes` | `8081` only |
| Health | enabled, port `8081`, path `/` |
| Public domain | none |
| `MEDIA_BACKEND_MODE` | `livekit_cloud` |

**Not on App 2:** Nixpacks, `npm run worker:sms`, ports 3000 / 5070 / 10000–10100.

---

## DEPLOYED WORKER

| Field | Result |
|--------|--------|
| **Git SHA (image)** | `65fbd3cdd326047b1b9c68b5067e5b8e1ca1fcbe` (Coolify deploy **2996**, **finished**) |
| **Branch ancestry** | Ancestor of `cursor/voice-v3-livekit-implementation-2304` HEAD (`6e5a4961` is docs-only after deploy) |
| **Image identity** | `tgjridm6vrmrgljkfrr0rpjn:65fbd3cdd326047b1b9c68b5067e5b8e1ca1fcbe` |
| **Build identity in logs** | `buildSha` / `buildShaFull`: branch label `cursor/voice-v3-livekit-implementation-2304` (not full git SHA in container env) |
| **livekit-agents** | **1.8.2** |
| **GPTLiveModel import** | **PASS** |
| **V3 implementation in image** | **YES** — `transovo_voice/voice_v3/` present; `main.py` has both `rtc_session` registrations; **only legacy profile started at runtime** |
| **Runtime** | `VOICE_ENABLE_V3_PROFILE` unset → **0**; `WORKER_PROFILE=legacy` |
| **VOICE_V3_LIVEKIT_AGENT_NAME** | **`transovo-voice-v3`** (App 2 env) |

This is **not** a pre-V3-only tree: V3 code ships in the image from the implementation branch. The **second worker process is not active**.

---

## REGISTRATION

| Profile | Status | Evidence |
|---------|--------|----------|
| **Primary (`LIVEKIT_AGENT_NAME`)** | **REGISTERED** | Log: `registered worker` with primary `agent_name`; `workerProfile: legacy`. With App 2 LiveKit creds, `verify-571-livekit-callable.ts` → **`WORKER_DISPATCH_PROBE` PASS**. |
| **`transovo-voice-v3`** | **NOT REGISTERED** | No `registered worker` for `transovo-voice-v3`. Dispatch probe with `LIVEKIT_AGENT_NAME=transovo-voice-v3` → **FAIL** (no participant in 45s). |

**LiveKit 1.8:** one `rtc_session` per process. Default start script = **one** legacy process on **8081**. V3 `rtc_session` exists in code but does not run unless `VOICE_ENABLE_V3_PROFILE=1` (not set on App 2).

---

## LIVEKIT PROJECT

### App 2 (voice worker — authoritative for running worker)

| Signal | Project slug |
|--------|----------------|
| `LIVEKIT_URL` | `sms-6w01zoya` |
| `LIVEKIT_SIP_URI` | `sms-6w01zoya` |
| Worker registration (logs) | Same Cloud project as App 2 `LIVEKIT_URL` |
| **API vs SIP env match** | **YES** (`check-livekit-sip-uri-alignment.ts` with App 2 creds) |

### App 1 (web — not modified; informational)

| Signal | Slug |
|--------|------|
| `LIVEKIT_URL` | `sms-6w01zoya` |
| `LIVEKIT_SIP_URI` | **`2tzwfcliuex`** (different from API project) |

Verify run **without** App 2 creds overlay on the web container can still **FAIL** `LIVEKIT_SIP_PROJECT_ALIGN` due to App 1 env. That does not invalidate App 2.

---

## SIP INFRASTRUCTURE (read-only, `+15717491060`, App 2 LiveKit creds)

| Item | State |
|------|--------|
| SIP host | `sms-6w01zoya.sip.livekit.cloud` |
| Inbound trunk | `ST_MqBTBjwPieAv` — `transovo-telnyx-inbound` — **`+18663464256` only** |
| Trunk owning `+15717491060` | **None** → verify **FAIL** `LIVEKIT_SIP_TRUNK` (expected until DID on LiveKit ingress) |
| Dispatch rule | `SDR_VjjkrrgEjiR3` — `transovo-inbound-dispatch` — trunk `ST_MqBTBjwPieAv` — agent = **primary `LIVEKIT_AGENT_NAME`** |
| V3-specific dispatch rule | **None** — single rule, primary agent only |

---

## TELNYX (`+15717491060`)

| Check | Result |
|--------|--------|
| Number active | PASS |
| Connection | **Transovo Voice V3 Basic OpenAI SIP** (direct OpenAI — intentional) |
| LiveKit FQDN connection | FAIL in verify (not on Transovo LiveKit Inbound) |
| **TELNYX ROUTING UNCHANGED** | **YES** |

---

## VERIFY SCRIPT (read-only)

Command pattern (App 2 LiveKit env overlaid on web container for API access only):

```bash
PHONE_E164=+15717491060 \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
npx tsx scripts/verify-571-livekit-callable.ts
```

(Use App 2 `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SIP_URI`, `LIVEKIT_AGENT_NAME`, `MEDIA_BACKEND_MODE` from Coolify App 2 — do not copy encrypted DB rows via raw SQL.)

**With App 2 creds:**

- **PASS:** `LIVEKIT_API`, `LIVEKIT_SIP_PROJECT_ALIGN`, `TELNYX_NUMBER`, `WEB_HEALTH`, `VOICE_RUNTIME_API`, `WORKER_DISPATCH_PROBE` (primary agent)
- **FAIL (expected pre-cutover):** `LIVEKIT_SIP_TRUNK`, `LIVEKIT_DISPATCH`, `TELNYX_FQDN`, `DB_AGENT_ROUTE`, `VERIFY_ROUTING`
- **WARN:** `TELNYX_RECENT_SIP`

**Chain for 571 → LiveKit today:** stops at **no trunk for DID** + **Telnyx on OpenAI SIP**. Primary worker dispatch to LiveKit **works** when probed with correct creds.

---

## FIRST FAILING BOUNDARY (directive phases A–L)

For **V3 PSTN** (GPT-Live / `transovo-voice-v3`):

**B — LiveKit AgentSession / worker registration** — `transovo-voice-v3` **not registered** and **not dispatchable**.

Later (after cutover): **A — SIP/participant** (trunk/DID/Telnyx) for `+15717491060`.

---

## EXACT NEXT CHANGE (minimum — not performed; STOP for approval)

1. **Register `transovo-voice-v3`** using existing implementation (second process or second app) with **distinct health port / process model** — do **not** set `VOICE_ENABLE_V3_PROFILE=1` on single-8081 container without fixing dual bind.
2. **Prove** dispatch/join for agent **`transovo-voice-v3`** (e.g. `WORKER_DISPATCH_PROBE` PASS with that agent name).
3. **Dispatch rule:** update or add rule on **existing** trunk `ST_MqBTBjwPieAv` to target **`transovo-voice-v3`** when ready — **no duplicate trunks**, **no Telnyx change** until proven.
4. **Optional:** align App 1 `LIVEKIT_SIP_URI` with `sms-6w01zoya`; dedupe duplicate `VOICE_V3_LIVEKIT_AGENT_NAME` rows on App 2 in Coolify UI.

**No Phase 54. No `+15717491060` Telnyx cutover. No App 2 rebuild** unless a new failure appears.

---

## Deployment proof checklist (App 2)

| # | Requirement | Result |
|---|-------------|--------|
| 1 | Image from `voice-runtime-python/Dockerfile` | PASS (2996) |
| 2 | Starts via `start-transovo-voice-worker.sh` | PASS |
| 3 | Health on 8081 | PASS (HTTP 200) |
| 4 | Container healthy | PASS |
| 5 | Outbound LiveKit Cloud | PASS |
| 6 | Primary agent registration | PASS |
| 7 | `transovo-voice-v3` registered | **NO** (by design of single-process deploy) |
| 8 | `TRANSOVO_BACKEND_URL` reachable | PASS (boot probe) |
| 9 | Internal API auth | PASS (probe) |
| 10 | SMS on separate app | PASS (App 3 :8082 healthy) |

---

## Related repo paths

- `docs/deployment-transovo-web-voice-split.md`
- `docs/COOLIFY-TRANSOVO-VOICE-WORKER.md`
- `voice-runtime-python/Dockerfile`
- `voice-runtime-python/scripts/start-transovo-voice-worker.sh`
- `scripts/coolify-restore-transovo-voice-worker.sh`
- `scripts/verify-571-livekit-callable.ts`
- `docs/VOICE-V3-LIVEKIT-IMPLEMENTATION-DIRECTIVE.md`
- `docs/VOICE-V3-LIVEKIT-PHASE-53-PRE-PSTN-REPORT.md`
