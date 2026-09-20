# Coolify — transovo-voice (Python LiveKit worker)

**Authoritative source:** `docs/deployment-transovo-web-voice-split.md` (Application 2).  
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
| **Start command** | *(empty in Coolify)* — image `CMD`: `voice-runtime-python/scripts/start-transovo-voice-worker.sh` (two processes: legacy + `transovo-voice-v3`; LiveKit 1.8 allows one `rtc_session` per process) |
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
- `LIVEKIT_AGENT_NAME` (primary dispatch agent)
- `VOICE_V3_LIVEKIT_AGENT_NAME=transovo-voice-v3` (second profile on same worker)

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
