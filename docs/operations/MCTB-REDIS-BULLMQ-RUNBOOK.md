# MCTB Redis + BullMQ operator runbook

Production queue backend for BullMQ (MCTB, automations, SMS dispatch, voice-calls). **Single authoritative Redis** — no dual-Redis fallback, no Upstash on the BullMQ path after cutover.

## Architecture

| Layer | Role |
|--------|------|
| **Postgres `jobQueue`** | Durable outbox before/at BullMQ dispatch; idempotency keys; authoritative job status |
| **Self-hosted Redis** | BullMQ queues (waiting, delayed, active, failed) |
| **Web container** | Producers (`REDIS_URL`) + embedded `worker:all` when `EMBEDDED_JOB_WORKER=1` |
| **Upstash (legacy)** | Rollback only — backup env on host, not used by current `REDIS_URL` |

**Connection model:** `QUEUE_DRIVER=bullmq`, `REDIS_URL=redis://transovo-bullmq-redis:6379` (password in Coolify secrets only). Redis has **no public port**; reachable on Docker network `coolify` only.

**Effective concurrency (current production):** 1 web replica × 1 embedded `worker:all` × per-queue BullMQ concurrency (see `src/lib/jobs/bullmq.ts`). Scaling web replicas without setting `EMBEDDED_JOB_WORKER=0` on extra replicas **multiplies** consumers.

## Coolify / host identifiers

| Item | Value |
|------|--------|
| Redis compose path | `/data/coolify/services/transovo-bullmq-redis/` |
| Container name | `transovo-bullmq-redis` |
| Image | `redis:7.2-alpine` |
| Internal DNS | `transovo-bullmq-redis` |
| Docker volume | `transovo-bullmq-redis_transovo-bullmq-redis-data` → `/data` in container |
| Web app (MCTB worker) | Coolify app `ds8s3hjin60qs6g7s0iqkixs` |
| Upstash rollback backup | `/data/coolify/applications/ds8s3hjin60qs6g7s0iqkixs/.env.redis-upstash-backup` |

Do **not** commit or paste passwords, full `REDIS_URL`, or API keys in tickets.

## Redis health

```bash
docker inspect transovo-bullmq-redis --format '{{.State.Health.Status}}'
docker logs transovo-bullmq-redis --tail 50
```

Healthy = Docker healthcheck passes (authenticated `PING`). `running` without `healthy` means investigate before relying on queue.

## Memory and eviction

- Container `mem_limit`: 896m
- `maxmemory`: 768mb
- `maxmemory-policy`: **noeviction** (queue keys must not be silently evicted)

On host:

```bash
free -h
docker stats transovo-bullmq-redis --no-stream
```

If Redis returns OOM/command errors, fix sizing or queue depth — do not switch to `allkeys-lru` without explicit approval.

## Disk and AOF

Persistence: **AOF** (`appendonly yes`, `appendfsync everysec`) plus **RDB snapshots** (`save` directives in compose). AOF rewrite thresholds: `auto-aof-rewrite-percentage 100`, `auto-aof-rewrite-min-size 64mb`.

```bash
df -h /
docker system df
docker exec transovo-bullmq-redis ls -lah /data
```

Watch AOF growth; run host cleanup only on **disposable** Docker build cache — **do not** remove Voice/LiveKit images or volumes.

## Queue depth and failed jobs

From web container (uses app env; no secrets in commands below):

```bash
docker exec <web-container> node -e "
  const { Queue } = require('bullmq');
  const IORedis = require('ioredis');
  const c = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  (async () => {
    for (const q of ['mctb','automations','sms-send','review-campaign','voice-calls','email-send']) {
      const queue = new Queue(q, { connection: c });
      const counts = await queue.getJobCounts('waiting','active','delayed','failed','completed');
      console.log(q, counts);
      await queue.close();
    }
    await c.quit();
  })();
"
```

Application logs (JSON):

- `bullmq_dispatch_workers_ready` — consumers attached
- `bullmq_job_received` / `bullmq_job_completed` / `bullmq_job_failed`
- `bullmq_redis_reconnecting` — transient Redis outage
- `bullmq_enqueue_failed` — producer could not reach Redis (DB row remains; outbox sync recovers)

## Workers connected

```bash
docker logs <web-container> 2>&1 | grep bullmq_dispatch_workers_ready | tail -3
docker exec <web-container> printenv EMBEDDED_JOB_WORKER DISABLE_INPROCESS_WORKER QUEUE_DRIVER
```

Expect: `EMBEDDED_JOB_WORKER=1`, `DISABLE_INPROCESS_WORKER=1`, `QUEUE_DRIVER=bullmq`.

Non-destructive MCTB transport smoke (uses disposable `mctb_worker_smoke` job):

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-worker-production-smoke.ts
```

## Restart Redis safely

1. Confirm no active deploy on web (optional).
2. `cd /data/coolify/services/transovo-bullmq-redis && docker compose restart transovo-bullmq-redis`
3. Wait for `healthy`.
4. Confirm web logs show `bullmq_redis_ready` / workers still processing without manual web restart.

**Do not** delete volume `transovo-bullmq-redis_transovo-bullmq-redis-data`.

## Restart workers safely

Coolify redeploy recreates web container; embedded worker receives **SIGTERM** → `closeBullmqWorkers()` (graceful close). For manual recycle:

```bash
docker restart <web-container>
```

Queued/delayed jobs remain in Redis; DB outbox sync (`syncDbOutboxToBullmq` on worker interval) covers any enqueue gap.

## Reconnect loop symptoms

- Rapid `bullmq_redis_reconnecting` every few seconds for minutes
- `bullmq_enqueue_failed` storm on web
- Healthcheck failing on Redis

Check: wrong password in app env vs Redis, Redis OOM, disk full, network isolation from `coolify`.

## Backup and restore

**On-host volume backup** (operator script in compose directory):

```bash
/data/coolify/services/transovo-bullmq-redis/backup-redis-volume.sh
```

Default output: `/data/backups/transovo-redis/redis-aof-snapshot-<UTC>.tar.gz` (7-day local retention).

**Off-host:** required for server/disk loss. If no destination is configured, status is **`OFF_HOST_BACKUP_DESTINATION_REQUIRED`** — provide one of: S3-compatible bucket + credentials, SFTP, or restic/rclone remote (see hardening acceptance doc).

**Restore test rule:** never unpack a backup over the live production volume. Test on a temporary directory or throwaway `redis:7.2-alpine` container with a **new** empty volume.

Postgres remains the system of record for business idempotency; Redis backup protects **queued/delayed** BullMQ state.

## Rollback to Upstash

1. Stop enqueueing new work if possible (pause MCTB recovery).
2. Restore `REDIS_URL` from `.env.redis-upstash-backup` into Coolify `environment_variables` for app id `1`, sync `.env`, redeploy web.
3. Do **not** run two active BullMQ backends. Self-hosted Redis can stay stopped after cutback.
4. Accept possible stranded jobs on self-hosted Redis (no blind replay).

## What NOT to delete

- Voice / LiveKit scheduler container and images
- `transovo-bullmq-redis` volume
- Coolify DB application env rows for `REDIS_URL` / `EMBEDDED_JOB_WORKER`
- Upstash rollback backup file until self-hosted path is proven

## Monitoring gaps

Use Coolify container health and host `df`/`free`. If no pager/email exists for Redis down or disk >85%, treat that as an operational gap — wire existing notification channel when available.

## Repo references

- BullMQ: `src/lib/jobs/bullmq.ts`
- Enqueue + DB outbox: `src/lib/messaging/enqueue-advance.ts`
- Embedded worker: `scripts/worker-all.ts`, `scripts/start-production.mjs`
- Infra compose: `infra/coolify/transovo-bullmq-redis/`
- Hardening acceptance: `docs/TRANSOVO-BULLMQ-REDIS-HARDENING-ACCEPTANCE.md`
