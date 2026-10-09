# Microsoft calendar sync — verification & maintenance status (copyable)

**Date:** 2026-10-09 (UTC)  
**Related:** `docs/AR-MICROSOFT-GRAPH-CALENDAR-SYNC-AUDIT.md`, PR #625 (delta fixes), PR for `cursor/ar-maintenance-queue-drain-f350`

---

## Priority order (agreed)

1. **Restore maintenance queue processing** (this document § Maintenance root cause)
2. **Merge/deploy PR #625** (delta persistence + chaser) on web + workers
3. **Run four production verification tests** (delta, no-webhook recovery, rapid updates, config concurrency)

---

## Deploy status (delta fix branch)

| Check | Result |
|--------|--------|
| Fix `52b313a86` on `master` | **No** (on `cursor/ar-microsoft-calendar-sync-fix-f350` / PR #625) |
| Production `commitSha` (probe) | **`90b938c1dfaf07841a7629161df1a334609c9a03`** |

---

## Maintenance queue root cause (production)

### Evidence table

| Signal | Finding |
|--------|---------|
| Pending `calendar_connections_reconcile` | **~542** on `maintenance`, `attempts = 0` |
| Pending `calendar_subscription_renew` | **6+**; **no completed** renew in sample |
| `calendar_connection_sync` (`default`) | **Completing** |
| Web env | `EMBEDDED_JOB_WORKER=1`, `QUEUE_DRIVER=bullmq`, `DISABLE_INPROCESS_WORKER=1` |
| BullMQ logs | `bullmq_worker_error` **`queueName: maintenance`**: `MISCONF Errors writing to the AOF file: No space left on device` |
| Coolify host disk | **`/` ~99% used** (~2.1G free on 150G at probe) |

### Failure boundary (not “old scheduler image”)

```
Cron /api/jobs/process → processDueJobs → job_queue rows (maintenance)
Embedded worker-all → syncDbOutboxToBullmq → BullMQ maintenance worker
Redis AOF write fails (disk full) → maintenance worker errors → DB rows never complete
```

Webhook → **default** queue can still work; **scheduled reconciliation and subscription renewal do not**.

### Code fix (`cursor/ar-maintenance-queue-drain-f350`)

- Reconcile + renew: **Postgres drain only** (skip BullMQ enqueue).
- `worker-all` (bullmq): each tick runs **`processDueJobs`** + **`drainCalendarMaintenanceFromDb(8)`**.
- Enqueue **priority 15** for those two job types.

### Ops required

- **Free disk** on Coolify host; restore Redis AOF.
- After deploy: logs `calendar maintenance db-drain claimed=…` and `job_queue.status = completed` for reconcile/renew.

---

## Test2 bulk miss (still open)

13:48 inline stale sync left `startsAt` on Oct 16; 13:51 targeted `/me/events/{id}` fixed. **Not fully explained** — delta/config overwrite fix (PR #625) may help; must prove after deploy.

---

## Post-deploy tests (PASS/FAIL template)

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | Delta persistence (2 incremental syncs) | | `microsoftDeltaLinks` non-empty after deploy |
| 2 | Outlook move, no manual sync, no webhook | | Path: webhook / delta / reconcile |
| 3 | Rapid edit + chaser | | Distinct `:chaser` idempotency key |
| 4 | Config merge under concurrency | | `mergeCalendarConnectionConfig` not serializable |
| 5 | Reconcile + renew **complete** | | DB + logs after maintenance fix |

Record: UTC time, Graph state, DB state, `job_queue.id`, `idempotencyKey`.

---

## 15-minute reconcile policy

Even with maintenance working, reconcile only enqueues stale connections (`lastSyncAt` > 15 min). No-webhook recovery may take **~15 min + drain latency** — acceptable for reminder horizons; do not shorten until measured.

---

## Governing sentence

**Microsoft Graph is not the primary blocker; maintenance execution was not completing. Fix disk/Redis and deploy DB-drain for calendar maintenance, then verify reconcile/renew complete before claiming calendar reliability.**
