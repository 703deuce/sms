# SMS WORKER CONTAINER SETUP

Production-grade scheduled SMS/campaign dispatch runs in a **dedicated worker container**, independent of the Next.js web app and browser sessions. The database (`job_queue`, `campaign_messages`, `campaigns`) is the source of truth.

Repurpose your existing Coolify **voice worker** application (previously Python/LiveKit) as the Transovo SMS worker. Do **not** delete the container — change its build/start configuration as below.

---

## Architecture summary

| Component | Role |
|-----------|------|
| **Web container** | Next.js UI + API. Set `EMBEDDED_JOB_WORKER=0` and `DISABLE_INPROCESS_WORKER=1` so it does **not** drain the job queue. |
| **SMS worker container** | `npm run worker:sms` — activates due campaigns, fair-enqueues recipient jobs, sends via existing Telnyx/Twilio paths, records heartbeat. |
| **Postgres** | Scheduled campaigns, recipient messages, job queue, worker heartbeat. Required. |
| **Redis** | Optional. Only if `QUEUE_DRIVER=bullmq` (default is Postgres-only `db` mode). |

Flow:

```
Campaign scheduled_at reached
  → worker activates campaign (SCHEDULED → SENDING)
  → recipient campaign_messages enqueued fairly (per-tenant round-robin)
  → job_queue send_campaign_sms jobs
  → rate limiter + kill switches + compliance/credits re-check at send
  → Telnyx/Twilio
  → delivery webhooks reconcile final status
```

---

## Coolify: SMS worker application

### Build source

**Option A — Same repo as web (recommended, matches Nixpacks web build)**

| Field | Value |
|-------|-------|
| Repository | Same Git repo as `transovo-web` |
| Build pack | Nixpacks (`nixpacks.toml` at repo root) |
| Dockerfile | Leave empty (Nixpacks handles install + `prisma generate` + `next build`) |

The worker does not need the Next.js server at runtime, but using the same Nixpacks build keeps dependencies identical to web.

**Option B — Docker image only (lighter, no Next build)**

| Field | Value |
|-------|-------|
| Dockerfile | `Dockerfile.sms-worker` (repo root) |
| Build context | Repository root |

---

### Start command

```bash
npm run worker:sms
```

Equivalent direct invocation:

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/worker-sms.ts
```

**Working directory:** repository root (`/app` in Docker).

---

### Web container changes (same Coolify project, web app)

On the **web** application, set:

```bash
EMBEDDED_JOB_WORKER=0
DISABLE_INPROCESS_WORKER=1
```

Keep the web start command as:

```bash
node scripts/start-production.mjs
```

This prevents double-draining the queue (embedded `worker:all` + separate SMS worker).

---

### Required environment variables (SMS worker)

Copy from your **web** application unless noted.

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | **Yes** | Same Session pooler URI as web (Supabase port 5432). Worker exits on boot if missing. |
| `NODE_ENV` | **Yes** | `production` |
| `MESSAGING_PROVIDER` | **Yes** (live) | `telnyx` or `twilio` |
| `TELNYX_API_KEY` | Yes (Telnyx) | Outbound SMS |
| `TELNYX_PUBLIC_KEY` | Yes (Telnyx) | Webhook verification (web handles webhooks; worker sends) |
| `TELNYX_MODE` | Recommended | `live` |
| `TWILIO_ACCOUNT_SID` | Yes (Twilio) | If using Twilio path |
| `TWILIO_AUTH_TOKEN` or `TWILIO_ACCOUNT_AUTH_TOKEN` | Yes (Twilio) | |
| `MESSAGING_ADAPTER` | If Twilio | `twilio` |
| `INTEGRATION_SECRET_KEY` | Recommended | Encrypts stored provider tokens |
| `APP_URL` | Recommended | Used by some send-side URL generation |

**Not required on worker** (web only): `NEXT_PUBLIC_*`, Stripe publishable keys, OAuth client secrets for UI login.

---

### Worker-specific environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `WORKER_POLL_MS` | `3000` | Scheduler + job drain interval (ms) |
| `SMS_WORKER_JOB_BATCH` | `40` | Max jobs claimed per cycle |
| `SMS_WORKER_HEALTH_PORT` | `8082` | HTTP `/health` endpoint |
| `SMS_WORKER_MAX_STALE_MS` | `WORKER_POLL_MS * 10` | Health fails if no successful cycle within this window |
| `WORKER_ID` | random UUID | Instance id in logs/heartbeat |
| `DISPATCH_PLATFORM_MPS` | `50` | Platform-wide messages/sec token bucket |
| `DISPATCH_TENANT_MPS` | `10` | Per-workspace default messages/sec |
| `DISPATCH_CAMPAIGN_MPS` | `5` | Per-campaign messages/sec |
| `DISPATCH_SENDER_MPS` | `1` | Per sending number messages/sec |
| `SMS_DELIVERY_RECONCILE_MS` | `60000` | How often worker polls stale delivery statuses |
| `SMS_DISPATCH_PAUSED` | unset | `1` = emergency platform-wide SMS dispatch pause |
| `MESSAGING_OUTBOUND_PAUSED` | unset | `1` = same as above (alias) |
| `SMS_DISPATCH_PAUSED_TELNYX` | unset | `1` = pause Telnyx sends only |
| `SMS_DISPATCH_PAUSED_TWILIO` | unset | `1` = pause Twilio sends only |

Optional BullMQ (not default):

| Variable | Notes |
|----------|-------|
| `QUEUE_DRIVER` | `bullmq` to enable Redis queue |
| `REDIS_URL` | Required when `QUEUE_DRIVER=bullmq` |

---

### Ports

| Port | Exposure |
|------|----------|
| `8082` | Internal health only (`SMS_WORKER_HEALTH_PORT`). No public domain required. |

---

### Health check

**Docker / Coolify healthcheck:**

```bash
curl -fsS http://127.0.0.1:8082/health
```

Returns `200` when the worker completed a cycle within `SMS_WORKER_MAX_STALE_MS`. Returns `503` if the worker is stale, shutting down, or last cycle errored.

**Database heartbeat:** table `worker_heartbeats`, key `sms-dispatch`. Admin/monitoring can query `lastBeatAt` and `metricsJson` (scheduled/due/queued/processing counts).

---

### Restart policy

`unless-stopped` (or Coolify default **always restart**).

---

### Replica count (V1)

**Start with `1` replica.**

The implementation uses **CAS `updateMany` claiming** on `job_queue` (compatible with the Supabase PostgREST data layer). Safe to scale to `3` replicas without duplicate sends when combined with per-message idempotency keys.

**Do not** run `worker:all` embedded in web **and** `worker:sms` in the worker container simultaneously.

---

### Database / Redis requirements

| Service | Required |
|---------|----------|
| PostgreSQL (`DATABASE_URL`) | **Yes** |
| Redis (`REDIS_URL`) | No (unless `QUEUE_DRIVER=bullmq`) |

---

### Migration command

After deploying code with the `WorkerHeartbeat` model, run **once** on your database (from web container or CI):

```bash
npm run db:deploy
```

Or if you use `db push` in dev/staging:

```bash
npm run db:push
```

This creates `worker_heartbeats`. No other schema changes are required for the worker beyond what campaigns already use.

---

## Logs to expect

Boot:

```json
{"event":"worker_started","workerKey":"sms-dispatch","workerId":"…","pollMs":3000,"queueDriver":"db"}
{"event":"worker_health_listen","port":8082,"workerId":"…"}
```

When work runs:

```json
{"event":"campaign_dispatch_started","campaignId":"…","workspaceId":"…","scheduledAt":"…"}
{"event":"worker_cycle","campaignsActivated":1,"messagesEnqueued":42,"jobsProcessed":42,"cycleMs":890}
```

Kill switch active:

```json
{"event":"worker_cycle","messagesEnqueued":0,"jobsProcessed":0}
```

(campaign messages deferred with `platform_dispatch_paused` in `error` column)

---

## Certification (before go-live)

From repo root on a machine with `DATABASE_URL`:

```bash
npm run test:sms-worker
```

Also run existing campaign safety tests:

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mass-texting-send-safety.ts
```

Verify in DB after scheduling a test campaign:

1. `campaigns.status` transitions `SCHEDULED` → `SENDING` at `scheduled_at`
2. `campaign_messages` move `queued` → `sending` → `sent`
3. `job_queue` rows for `send_campaign_sms` complete
4. `worker_heartbeats.lastBeatAt` updates every ~3s

---

## WHAT I MUST MANUALLY DO

Actions **outside** the repository that you must perform in Coolify/providers:

1. **Repoint the voice worker Coolify application** from Python/LiveKit start command to `npm run worker:sms` (same repo, Nixpacks or `Dockerfile.sms-worker`).
2. **Set `EMBEDDED_JOB_WORKER=0` and `DISABLE_INPROCESS_WORKER=1` on the web app** so only the SMS worker drains campaign jobs.
3. **Copy `DATABASE_URL` and live messaging env vars** (`TELNYX_*` or `TWILIO_*`) from web to the worker container.
4. **Run `npm run db:deploy`** (or `db:push`) once to create `worker_heartbeats`.
5. **Configure Coolify healthcheck** to `curl -fsS http://127.0.0.1:8082/health` on the worker container (port 8082 internal).
6. **Set replica count to 1** initially; increase later when volume requires it.
7. **Telnyx/Twilio webhooks** stay on the **web** app URL (`APP_URL/api/telnyx/messaging`, etc.) — no webhook changes needed on the worker.
8. **Monitor `worker_heartbeats`** — alert if `lastBeatAt` is older than 2 minutes in production.
9. **Emergency stop:** set `SMS_DISPATCH_PAUSED=1` on the worker (and optionally web) env, redeploy/restart worker — stops new sends without corrupting completed records.
10. **Voice/LiveKit:** if you still need AI voice, keep a separate Python container or disable voice features until re-homed; this worker slot is now SMS dispatch only.

---

## Voice container note

The file `voice-runtime-python/Dockerfile` is **unchanged** in the repo (voice code preserved). Your Coolify voice app should no longer use that Dockerfile for SMS scheduling — repoint it to this Node worker. You may spin up a new Coolify service later for Python voice if needed.
