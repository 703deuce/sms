# Coolify — transovo-voice (Python LiveKit worker)

**Authoritative source:** `docs/deployment-transovo-web-voice-split.md` (Application 2).

## Three Coolify apps — do not mix logs

| App ID | Name | Container runs | Realtime logs show |
|--------|------|----------------|-------------------|
| **1** | `sms:master-ds8s3hjin60qs6g7s0iqkixs` | Next.js `transovo-web` | HTTP, internal voice API, provisioning |
| **2** | `transovo-voice` | Python `./scripts/start-transovo-voice-worker.sh` | `livekit.agents`, `transovo-voice-v3`, `voice_v3_*` only — **no BullMQ** |
| **3** | `transovo-sms-worker` | `npm run worker:sms` | **BullMQ**: calendar, reminders, `crm_push_event`, Zoho/Salesforce, missed-call side effects |

CRM / Zoho / “call.missed” queue lines in Coolify **always** come from **Application 3** (`transovo-sms-worker`), not from the voice worker. That is expected when a workspace has CRM integrations enabled — it is unrelated to LiveKit PSTN pickup.

MCTB SIP is a **fourth** app (`transovo-mctb-sip`) when deployed — see `docs/deployment-mctb-sip-adapter.md`.  
**Repo implementation:** `voice-runtime-python/` + `voice-runtime-python/Dockerfile`.  
**SMS worker moved off this slot:** `docs/SMS_WORKER_CONTAINER_SETUP.md` → separate Coolify app (`Dockerfile.sms-worker`, port `8082`).

## Historical slot (Coolify application id `2`)

| Field | Value |
|-------|--------|
| Coolify name | `transovo-voice` (was repurposed as `trransovo-smscheduler` / Nixpacks + `npm run worker:sms`) |
| UUID | `tgjridm6vrmrgljkfrr0rpjn` |
| Repository | `703deuce/sms` |
| Base directory | `/` (repo root) |
| **Build pack** | **`dockerfile`** — not Nixpacks |
| **Dockerfile location** | `voice-runtime-python/Dockerfile` (Coolify DB: `/voice-runtime-python/Dockerfile`) |
| **Start command** | *(empty in Coolify)* — image `CMD`: `start-transovo-voice-worker.sh` (**Voice V3 only** on `8081`; legacy `transovo-voice-runtime` not started) |
| Public domain | **None** (worker connects outbound to LiveKit WebSocket only) |
| **Ports exposes** | **`8081`** only (LiveKit agent health HTTP server) |
| **Health check** | Enabled, port `8081`, path `/` |
| Do **not** expose | `3000`, `5070`, `10000-10100` — those belonged to the SMS/Nixpacks repurposed config |

## Required environment (voice only)

See `voice-runtime-python/.env.example` and `docs/deployment-transovo-web-voice-split.md`.

Minimum:

- `MEDIA_BACKEND_MODE=livekit_cloud` (production PSTN)
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `OPENAI_API_KEY`
- `TRANSOVO_BACKEND_URL` (public web URL where `GET /api/health` returns 200)
- `TRANSOVO_INTERNAL_API_KEY` (same as web)
- `VOICE_V3_LIVEKIT_AGENT_NAME=transovo-voice-v3` (must match LiveKit dispatch `agentName`)
- `LIVEKIT_AGENT_NAME` — ignored for inbound if set to removed `transovo-voice-runtime`; use `transovo-voice-v3`

Do **not** rely on copying encrypted Coolify env rows via raw SQL — use Coolify UI or Laravel replicate (see `scripts/coolify-restore-transovo-voice-worker.sh`).

## Local / CI parity

```bash
npm run build:voice-python
npm run voice-python:start   # same entrypoint as production CMD
```

## Restore script (host)

```bash
bash scripts/coolify-restore-transovo-voice-worker.sh --discover-only
bash scripts/coolify-restore-transovo-voice-worker.sh --configure-only
# After SMS app is healthy:
VOICE_GIT_BRANCH=cursor/voice-v3-livekit-implementation-2304 VOICE_GIT_COMMIT=<sha> \
  bash scripts/coolify-restore-transovo-voice-worker.sh --deploy-voice
```

Deploy jobs must be dispatched on the Coolify host:

```bash
docker exec coolify php artisan tinker --execute="App\\Jobs\\ApplicationDeploymentJob::dispatch(<queue_id>);"
```
