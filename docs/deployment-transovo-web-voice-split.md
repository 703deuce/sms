# Transovo web ↔ voice split deployment

Production uses **two independent Coolify Applications** from the same GitHub repo/branch.

## Application 1 — `transovo-web`

| Setting | Value |
|---------|--------|
| Build | Nixpacks (`nixpacks.toml`) — no Python in image |
| Start | `node scripts/start-production.mjs` → `.next/standalone/server.js` |
| Domain | Your public app domain(s) |
| Health | `GET /api/health` |

**Must NOT log:** `[voice-python] spawning transovo-voice-runtime`

**Do not set** `ENABLE_INPROCESS_VOICE_RUNTIME=1` in production.

### Web env (minimum for voice API)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | App DB |
| `TRANSOVO_INTERNAL_API_KEY` | Validates voice → web internal API |
| `LIVEKIT_*` | Provisioning / dispatch rules (not worker) |
| `OPENAI_API_KEY` | Only if web features need it |
| All existing web/Telnyx/BullMQ vars | Unchanged |

Legacy fallbacks for internal auth: `VOICE_RUNTIME_INTERNAL_SECRET`, `INTEGRATION_SECRET_KEY`.

---

## Application 2 — `transovo-voice`

| Setting | Value |
|---------|--------|
| Dockerfile | `voice-runtime-python/Dockerfile` |
| Coolify | Set **Base Directory** repo root; **Dockerfile Location** `voice-runtime-python/Dockerfile` |
| Start | `python -m transovo_voice.main start` (Dockerfile CMD) |
| Public domain | **None** — outbound WebSocket to LiveKit only |
| Health | Internal port `8081` (LiveKit agent health server) |

### Voice env (copy only what voice needs)

| Variable | Required | Purpose |
|----------|----------|---------|
| `LIVEKIT_URL` | Yes | LiveKit Cloud WebSocket |
| `LIVEKIT_API_KEY` | Yes | Worker auth |
| `LIVEKIT_API_SECRET` | Yes | Worker auth |
| `OPENAI_API_KEY` | Yes | OpenAI Realtime |
| `TRANSOVO_BACKEND_URL` | Yes | e.g. `https://app.transovo.ai` |
| `TRANSOVO_INTERNAL_API_KEY` | Yes | Same value as web |
| `LIVEKIT_AGENT_NAME` | Default `transovo-voice-runtime` | Explicit dispatch target |
| `VOICE_REALTIME_MODEL` | Optional | Default `gpt-realtime-2` |
| `VOICE_REALTIME_VOICE` | Optional | Default `marin` |

**Do not copy** full web env (Stripe, Telnyx webhooks, session secrets, etc.).

Python does **not** need `DATABASE_URL` — all persistence goes through the web internal API.

---

## Internal API contract

| Endpoint | `POST /api/internal/voice-runtime` |
| Auth | `Authorization: Bearer $TRANSOVO_INTERNAL_API_KEY` |
| Bootstrap | action `bootstrap_inbound` returns `{ ok: true, apiVersion: 1, ... }` |

Voice rejects bootstrap responses where `apiVersion !== 1`.

---

## LiveKit explicit dispatch

SIP dispatch rule (`transovo-inbound-dispatch`) targets agent name **`transovo-voice-runtime`**.

Configured in `src/lib/telephony/provisioning/livekit/dispatch.ts`.

Job metadata (`workspaceId`, `agentId`, `publishedVersionId`) flows: job → SIP attrs → DID lookup.

---

## Local development

```bash
# Terminal 1 — web
npm run dev

# Terminal 2 — voice
export TRANSOVO_BACKEND_URL=http://127.0.0.1:3000
export TRANSOVO_INTERNAL_API_KEY=your-dev-secret
export LIVEKIT_URL=...
export LIVEKIT_API_KEY=...
export LIVEKIT_API_SECRET=...
export OPENAI_API_KEY=...
npm run voice-python:start
```

Optional single-process dev (legacy):

```bash
ENABLE_INPROCESS_VOICE_RUNTIME=1 npm run dev
```

---

## Pre-push validation

```bash
npm run build:voice-python   # compile + import + pytest
npx tsc --noEmit
```

---

## Failure isolation

| Scenario | Expected |
|----------|----------|
| Kill voice container | Web stays up; calls fail until voice re-registers |
| Restart web | Voice keeps running; bootstrap recovers when web healthy |
| Voice deploy | Only `transovo-voice` rebuilds |
| Web deploy | Only `transovo-web` rebuilds |

---

## Coolify setup steps

1. **transovo-web** — existing app; redeploy after merge; confirm no `[voice-python] spawning` in logs.
2. **New resource** → same repo/branch → name `transovo-voice`.
3. Build pack: **Dockerfile** → path `voice-runtime-python/Dockerfile`.
4. No public domain; disable “Generate Domain” if offered.
5. Paste voice env vars; set `TRANSOVO_BACKEND_URL` to public web URL (HTTPS).
6. Set `TRANSOVO_INTERNAL_API_KEY` on **both** apps (identical value).
7. Deploy voice; confirm logs: `python_voice_boot_started`, `registered worker`, agent_name `transovo-voice-runtime`.
8. Smoke inbound call → bootstrap → Amy speaks.
