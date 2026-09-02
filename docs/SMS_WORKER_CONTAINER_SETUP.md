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

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (worker DB access) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (same as web) |
| `NODE_ENV` | Set `production` |
| `MESSAGING_PROVIDER` | `telnyx` or `twilio` (see `src/lib/messaging/provider-config.ts`) |

**Telnyx live sends** (when `MESSAGING_PROVIDER=telnyx`):

| Variable | Notes |
|----------|-------|
| `TELNYX_API_KEY` | Outbound SMS API key |
| `TELNYX_MODE` | Set `live` in production |

**Twilio live sends** (when `MESSAGING_PROVIDER=twilio` or `MESSAGING_ADAPTER=twilio`):

| Variable | Notes |
|----------|-------|
| `TWILIO_ACCOUNT_SID` | Parent/subaccount SID |
| `TWILIO_AUTH_TOKEN` | Primary auth token (aliases accepted: `TWILIO_ACCOUNT_AUTH_TOKEN`, `TWILIO_PARENT_AUTH_TOKEN`) |
| `TWILIO_MODE` | Set `live` in production |

**Strongly recommended** (token decryption + URL helpers):

| Variable | Notes |
|----------|-------|
| `INTEGRATION_SECRET_KEY` | Decrypts stored provider credentials at rest |
| `APP_URL` | Canonical app URL (fallback: `NEXT_PUBLIC_APP_URL`) |

---

### Optional environment variables (SMS worker)

**Worker runtime**

| Variable | Default | Purpose |
|----------|---------|---------|
| `WORKER_POLL_MS` | `3000` | Scheduler + job drain interval (ms) |
| `SMS_WORKER_JOB_BATCH` | `40` | Max jobs claimed per cycle |
| `SMS_WORKER_HEALTH_PORT` | `8082` | HTTP `/health` endpoint |
| `SMS_WORKER_MAX_STALE_MS` | `WORKER_POLL_MS * 10` | Health fails if no successful cycle within this window |
| `WORKER_ID` | random UUID | Instance id in logs/heartbeat |
| `NODE_OPTIONS` | — | Must include `--import ./scripts/preload-server-only.mjs` (set by `npm run worker:sms`) |

**Dispatch rate limits** (change without code deploy — restart worker to pick up)

| Variable | Default | Purpose |
|----------|---------|---------|
| `DISPATCH_PLATFORM_MPS` | `50` | Platform-wide messages/sec |
| `DISPATCH_TENANT_MPS` | `10` | Per-workspace default messages/sec |
| `DISPATCH_CAMPAIGN_MPS` | `5` | Per-campaign messages/sec |
| `DISPATCH_SENDER_MPS` | `1` | Per sending-number messages/sec |

Example: `DISPATCH_SENDER_MPS=25` → ~25 segments/sec per number (~3.3 min for 5,000 recipients). Tune per your Telnyx/Twilio approved throughput.

**Kill switches**

| Variable | Purpose |
|----------|---------|
| `SMS_DISPATCH_PAUSED` | `1` or `true` = stop all new SMS dispatch |
| `MESSAGING_OUTBOUND_PAUSED` | Alias for platform pause |
| `SMS_DISPATCH_PAUSED_TELNYX` | `1` = pause Telnyx sends only |
| `SMS_DISPATCH_PAUSED_TWILIO` | `1` = pause Twilio sends only |

**Delivery reconciliation**

| Variable | Default | Purpose |
|----------|---------|---------|
| `SMS_DELIVERY_RECONCILE_MS` | `60000` | Poll interval for stale delivery statuses |

**Optional BullMQ** (not default)

| Variable | Notes |
|----------|-------|
| `QUEUE_DRIVER` | Set `bullmq` to enable Redis queue |
| `REDIS_URL` | Required when `QUEUE_DRIVER=bullmq` |

**Telnyx optional**

| Variable | Purpose |
|----------|---------|
| `TELNYX_API_BASE_URL` | Override API base (default `https://api.telnyx.com/v2`) |
| `TELNYX_ORG_ID` | Org scoping when needed |
| `TELNYX_USE_TWEXIT` | `true`/`false` Twexit routing |
| `TELNYX_DEFAULT_MESSAGING_PROFILE_ID` | Platform admin profile only |
| `TELNYX_HTTP_LOG` | `1` = verbose HTTP logging |

**Twilio optional**

| Variable | Purpose |
|----------|---------|
| `TWILIO_API_KEY_SID` | API key auth (optional) |
| `TWILIO_API_KEY_SECRET` | API key secret (alias: `TWILIO_API_SECRET`) |
| `TWILIO_PRIMARY_PROFILE_SID` | ISV primary profile |
| `MESSAGING_ADAPTER` | Set `twilio` when using Twilio adapter path |

**Not required on worker** (web only): `NEXT_PUBLIC_*` analytics keys, Stripe publishable keys, OAuth client secrets for UI login, `TELNYX_PUBLIC_KEY` (webhook verification stays on web).

---

### Deprecated / do not use

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | **Not used by the worker runtime** (Supabase compat uses `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) |

---

### Ports

| Port | Exposure |
|------|----------|
| `8082` | Internal health only (`SMS_WORKER_HEALTH_PORT`). No public domain required. |

---

### Health check

**Docker / Coolify healthcheck** (`Dockerfile.sms-worker` includes `curl`):

```bash
curl -fsS http://127.0.0.1:8082/health
```

**Nixpacks build** (no `curl` guaranteed) — use Node instead:

```bash
node -e "fetch('http://127.0.0.1:8082/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
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

The `worker_heartbeats` table is in the normal schema path:

```bash
npm run db:deploy
```

This applies `prisma/migrations/20260902180000_worker_heartbeats/migration.sql`.

Fresh installs also include the table via `supabase/schema.sql` → `npm run db:bootstrap`.

One-time SQL fallback (if you cannot run migrate deploy): `supabase/sms-worker-heartbeat.sql`

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

From repo root on a machine with Supabase configured:

```bash
npm run test:sms-worker
```

This runs `scripts/test-sms-worker.ts` (13 scenarios) **and** `scripts/test-sms-worker-cert.ts` (concurrent claiming, crash recovery, rate-limit independence, large-vs-small tenant fairness).

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
3. **Copy Supabase + messaging env vars** from web to worker (see exact list above — not `DATABASE_URL`).
4. **Run `npm run db:deploy`** once to create `worker_heartbeats` (or apply `supabase/sms-worker-heartbeat.sql`).
5. **Configure Coolify healthcheck** — `curl -fsS http://127.0.0.1:8082/health` with `Dockerfile.sms-worker`, or Node `fetch` one-liner for Nixpacks (see Health check section).
6. **Set replica count to 1** initially; increase later when volume requires it.
7. **Telnyx/Twilio webhooks** stay on the **web** app URL (`APP_URL/api/telnyx/messaging`, etc.) — no webhook changes needed on the worker.
8. **Monitor worker health** at `/admin/monitoring` (SMS dispatch worker card) or `worker_heartbeats` table — alert if heartbeat age > 2 minutes.
9. **Emergency stop:** set `SMS_DISPATCH_PAUSED=1` on the worker (and optionally web) env, redeploy/restart worker — stops new sends without corrupting completed records.
10. **Voice/LiveKit:** if you still need AI voice, keep a separate Python container or disable voice features until re-homed; this worker slot is now SMS dispatch only.

---

## Voice container note

The file `voice-runtime-python/Dockerfile` is **unchanged** in the repo (voice code preserved). Your Coolify voice app should no longer use that Dockerfile for SMS scheduling — repoint it to this Node worker. You may spin up a new Coolify service later for Python voice if needed.
