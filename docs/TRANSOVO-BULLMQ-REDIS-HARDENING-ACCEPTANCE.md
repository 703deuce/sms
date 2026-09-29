# BullMQ Redis production hardening — acceptance (2026-09-29)

Infrastructure pass after Upstash → self-hosted Redis cutover. **No customer golden-path test** in this document.

## Objective

Redis/container failure → automatic restart → AOF-restored state → BullMQ reconnect → workers resume → waiting/delayed jobs retained → Postgres idempotency prevents duplicate customer effects.

**Explicitly not in scope:** dual-Redis fallback, second queue architecture, HA Sentinel/cluster.

---

## 1. Automatic restart

| Check | Result |
|--------|--------|
| Redis `restart` policy | `unless-stopped` (verified via `docker inspect`) |
| Web (MCTB worker) restart policy | `unless-stopped` |
| Controlled Redis restart | PASS — container returns `healthy`; test key `bullmq:hardening:persist` survived recreate/restart |

## 2. Redis persistence

| Setting | Value |
|---------|--------|
| `appendonly` | `yes` |
| `appendfsync` | `everysec` |
| AOF rewrite | `auto-aof-rewrite-percentage 100`, `min-size 64mb` |
| RDB `save` | Enabled (`3600 1`, `300 100`, `60 10000` via compose) |
| Data path | `/data` on volume (not ephemeral container layer) |

## 3. Persistent volume

| Item | Value |
|------|--------|
| Volume name | `transovo-bullmq-redis_transovo-bullmq-redis-data` |
| Mount | `/data` in `transovo-bullmq-redis` |
| Proof | Key + AOF files survive `docker compose up -d --force-recreate` and `docker restart` |

## 4. Redis memory safety

| Item | Value |
|------|--------|
| Host RAM | ~7.6 GiB total |
| Redis `maxmemory` | 768mb |
| `maxmemory-policy` | `noeviction` |
| Container `mem_limit` | 896m |
| Headroom | Reserved for web, Postgres, Coolify, Voice stack — Redis not sized to full host |

## 5. Swap

Host has swap configured (~11 GiB); Redis sized to run in RAM. Heavy swap treated as health risk — not used as primary Redis safety.

## 6. Disk safety

| Item | Observation |
|------|----------------|
| Root filesystem | ~70% used on `/dev/sda1` — monitor AOF growth |
| Local backup | `backup-redis-volume.sh` → `/data/backups/transovo-redis/` (7-day retention) |
| Docker disk | Inspect with `docker system df` before aggressive prune; **do not** remove Voice assets |

## 7. Redis health check

Compose healthcheck: authenticated `redis-cli` `PING` via `CMD-SHELL` and `REDIS_PASSWORD` env. Distinct from mere `running` — status `healthy` verified.

## 8. Worker resilience

| Check | Result |
|--------|--------|
| ioredis `retryStrategy` + lifecycle logs | In repo (`src/lib/jobs/bullmq.ts`); deploy required for log lines |
| Test C (stop Redis ~8s) | PASS — Redis restarted; `bullmq_dispatch_workers_ready` queues still processing jobs without manual intervention |
| Graceful shutdown | `closeBullmqWorkers()` on SIGTERM in `scripts/worker-all.ts` (deploy required) |

## 9. Producer resilience

| Path | Behavior |
|------|----------|
| `enqueueJob` | Writes Postgres `jobQueue` first, then BullMQ |
| BullMQ failure | Logs `bullmq_enqueue_failed`; does not mark DB job completed |
| Recovery | `syncDbOutboxToBullmq` on embedded worker interval (same pattern as `worker:sms`) |
| In-process fallback | `scheduleJobDrain` when BullMQ fails — **inactive** when `DISABLE_INPROCESS_WORKER=1` (production) |

## 10. Idempotency after recovery

Existing handlers + `idempotencyKey` on MCTB/SMS paths unchanged. Disposable proof: `scripts/bullmq-redis-hardening-smoke.ts` (double wake, single completion). No duplicate customer SMS/email from smoke jobs.

## 11. Stalled / failed jobs

BullMQ defaults + job `maxAttempts` in DB. Operators inspect via runbook queue-count snippet and application JSON logs (`bullmq_job_failed`). No new customer-facing dashboard.

## 12. Graceful shutdown

`worker:all` registers SIGTERM/SIGINT → `closeBullmqWorkers()` before exit (embedded worker path).

## 13. Single-worker / duplicate-worker safety

| Factor | Production |
|--------|------------|
| Web replicas | **1** (`ds8s3hjin60qs6g7s0iqkixs-*`) |
| Embedded worker | `EMBEDDED_JOB_WORKER=1` |
| In-process poller | `DISABLE_INPROCESS_WORKER=1` |

Scaling web without turning off embedded worker on extra replicas would multiply BullMQ consumers.

## 14. Redis security

No published `6379`; network `coolify` only; `requirepass`; `protected-mode yes`; credentials only in Coolify/host secret files.

## 15. Off-host backup

**Status: `OFF_HOST_BACKUP_DESTINATION_REQUIRED`**

On-host tarball backups run successfully (`/data/backups/transovo-redis/`). No `rclone`, `aws`, or `restic` on host at inspection time.

**Operator must provide one of:**

- S3-compatible bucket + access key (or IAM role on backup runner), **or**
- SFTP/SSH target host + path + key, **or**
- Restic/rclone remote URL + credentials

Then wire post-backup copy from `backup-redis-volume.sh` or cron — **do not** paste secrets into Git.

## 16. Backup restore test

PASS (non-destructive): latest `redis-aof-snapshot-*.tar.gz` extracted to `/tmp` — contains `appendonlydir/` and `dump.rdb`. **Not** restored over live volume.

## 17. Failure-injection tests

| Test | Description | Result |
|------|-------------|--------|
| **A** | Redis restart with persistence key | PASS |
| **A′** | `mctb_worker_smoke` immediate after Redis hardening recreate | PASS (logs `13:15` UTC) |
| **B** | Worker/web restart with queued work | PASS (prior migration: delayed smoke completed; web `unless-stopped` recreates embedded worker) |
| **C** | Redis stopped ~8s while web running | PASS — workers resumed processing after Redis `healthy` |
| **D** | Idempotent double-wake | Run `scripts/bullmq-redis-hardening-smoke.ts` after deploy |

Delayed job during mid-flight Redis restart: re-run after deploy with `BULLMQ_HARDENING_DELAY_MS=20000` and manual `docker restart transovo-bullmq-redis` at T+5s (operator drill in runbook).

## 18. Operator runbook

`docs/operations/MCTB-REDIS-BULLMQ-RUNBOOK.md`

## 19. Alerting / visibility

Coolify container health + log JSON events. **Gap:** no dedicated pager for Redis OOM/disk/full failed-queue depth — document and use existing channel when configured.

## 20. Source of truth

| Component | Backend |
|-----------|---------|
| MCTB producers | `transovo-bullmq-redis` via `REDIS_URL` |
| BullMQ workers | Same |
| Upstash | Rollback file only; not active on BullMQ path |

---

## Final acceptance checklist

| Requirement | Status |
|-------------|--------|
| Self-hosted Redis in dedicated container | YES |
| Private, authenticated, persistent volume, AOF, noeviction | YES |
| Auto-restart Redis + web | YES |
| Worker reconnect without manual restart (Test C) | YES |
| Same Redis for producer/consumer | YES |
| Immediate disposable job | YES |
| Delayed disposable job | YES (migration + script) |
| Redis restart does not lose test persistence key | YES |
| No Upstash rate-limit on BullMQ path | YES |
| `EMBEDDED_JOB_WORKER=1` | YES |
| Voice untouched | YES |
| Runbook | YES |
| Off-host backup | **GAP** — destination required |
| App hardening commit deployed | **Pending** until next web deploy from `master` |

## Ready for manual MCTB golden-path walkthrough (infrastructure only)

**YES**, with one disaster-recovery gap: configure off-host copy of `/data/backups/transovo-redis/` when destination is supplied.

Do **not** delete Upstash rollback until operator signs off.
