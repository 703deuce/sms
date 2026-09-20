# Transovo web ↔ voice split deployment

Production uses **three independent Coolify Applications** from the same GitHub repo/branch (web, voice, MCTB SIP).

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
| `HOSTNAME` | `0.0.0.0` in Docker (Traefik must reach the container — set in `nixpacks.toml`) |
| `PORT` | `3000` — must match Coolify **Ports Exposes** / proxy target |
| `DATABASE_URL` | App DB |
| `TRANSOVO_INTERNAL_API_KEY` | Validates voice → web internal API |
| `LIVEKIT_DEFAULT_OUTBOUND_TRUNK_ID` | Transfer + bootstrap | **Preferred** shared outbound trunk id (platform-wide) |
| `LIVEKIT_OUTBOUND_TRUNK_ID` | Transfer + bootstrap | Legacy alias; passed to voice as `sipOutboundTrunkId` when set |
| `LIVEKIT_SIP_OUTBOUND_TRUNK` | Transfer fallback | Legacy alias for same trunk id |
| `TELNYX_SIP_OUTBOUND_USERNAME` / `PASSWORD` | Provisioning | Create/register shared outbound trunk via LiveKit API |
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
| Start | `voice-runtime-python/scripts/start-transovo-voice-worker.sh` (Dockerfile CMD — legacy + V3 profiles, one `rtc_session` per process) |
| Public domain | **None** — outbound WebSocket to LiveKit only |
| Health | Internal port `8081` (LiveKit agent health server) |

### Voice env (copy only what voice needs)

| Variable | Required | Purpose |
|----------|----------|---------|
| `MEDIA_BACKEND_MODE` | Yes | **`livekit_cloud`** for production PSTN. Do not leave unset — Python used to default to `self_hosted` and connect to `wss://voice.transovo.ai/agent`. |
| `LIVEKIT_URL` | Yes | LiveKit Cloud WebSocket (e.g. `wss://sms-6w01zoya.livekit.cloud`) — **same project** as web app |
| `LIVEKIT_API_KEY` | Yes | Worker auth |
| `LIVEKIT_API_SECRET` | Yes | Worker auth |
| `OPENAI_API_KEY` | Yes | OpenAI Realtime |
| `TRANSOVO_BACKEND_URL` | Yes | e.g. `https://app.transovo.ai` |
| `TRANSOVO_INTERNAL_API_KEY` | Yes | Same value as web |
| `LIVEKIT_AGENT_NAME` | Default `transovo-voice-runtime` | Explicit dispatch target |
| `VOICE_REALTIME_MODEL` | Optional | Default `gpt-realtime-2` |
| `VOICE_REALTIME_VOICE` | Optional | Default `marin` |
| `LIVEKIT_SIP_OUTBOUND_TRUNK` | Optional | Fallback if bootstrap omits `sipOutboundTrunkId` (prefer web bootstrap) |
| `LIVEKIT_SIP_NUMBER` | Optional | Caller ID E164 for outbound transfer (or bootstrap `sipCallerIdE164`) |

**Do not copy** full web env (Stripe, Telnyx webhooks, session secrets, etc.).

MCTB press-1 SIP runs in a **separate** Coolify app (`transovo-mctb-sip`) — see `docs/deployment-mctb-sip-adapter.md`.

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

## Troubleshooting 502 from voice worker

If voice logs show:

```text
backend_response_received status=502 body="Bad Gateway"
```

**This is almost always transovo-web unreachable at `TRANSOVO_BACKEND_URL`, not a Python bug.**

Verify from any machine:

```bash
curl -sS -o /dev/null -w "%{http_code}" https://YOUR-BACKEND-URL/api/health
```

Must return `200` with JSON `service=transovo-web`. If you get `502`, fix **transovo-web** first:

1. Open transovo-web Coolify logs — is Next.js running?
2. Confirm the Coolify **domain** on transovo-web matches `TRANSOVO_BACKEND_URL` on voice.
3. Your public web domain must route to transovo-web — if health is 502 there, fix the domain or web container.
4. Run: `TRANSOVO_BACKEND_URL=https://your-domain node scripts/probe-transovo-backend-url.mjs`

Voice boot now logs `backend_health_probe_ok` or `backend_health_probe_failed` before registering with LiveKit.

### If `/api/health` and `/api/internal/voice-runtime` return **502 Bad Gateway**

Plain `Bad Gateway` (11 bytes) is almost always **Traefik/Caddy cannot connect to the Node process**, not a missing Next route.

Checklist:

1. **Domain on the right app** — `transovo.ai` must be on **transovo-web**, not **transovo-voice**. Voice has no HTTP on port 3000; attaching the public domain to voice causes 502 for every path.
2. **Redeploy transovo-web** from latest `master` (needs `/api/health` route from commit `368e794+`).
3. **Coolify port** — container exposes **3000**; proxy forwards to **3000** (not 80 inside the container).
4. **`HOSTNAME=0.0.0.0`** — set on transovo-web (included in `nixpacks.toml` and `start-production.mjs`).
5. **Web logs on boot** — should show `[start] using Next standalone server ... HOSTNAME=0.0.0.0 PORT=3000` and `service=transovo-web`.
6. If homepage loads but `/api/*` is 502, you may be hitting a **cached** landing page or a **different** origin — retest `/api/health` in a private Safari tab.

After fix, Safari should show JSON on both probe URLs before redeploying voice.

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
9. **transovo-mctb-sip** — see `docs/deployment-mctb-sip-adapter.md` (host network, UDP 5070).