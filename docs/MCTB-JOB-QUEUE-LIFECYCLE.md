# job_queue lifecycle (operational window, not archive)

Postgres `job_queue` is the **durable outbox** paired with BullMQ transport. BullMQ jobs expire per Redis retention; **Postgres rows were not pruned** before this work, which allowed unbounded growth.

## WHY JOB_QUEUE REACHED 330K+

**Measured breakdown (production, pre-cleanup, 2026-09-29):**

| Source | Approx. rows | Notes |
|--------|-------------|--------|
| `workspaceId IS NULL`, `status=completed` | ~323,800 | Minute/hour **scheduler ticks** from `processDueJobs()` — each tick uses a **new** idempotency key (`campaign-send-batch:2026-09-29T12:34`, `crm-task-due:…`, etc.), completes, and **stays forever** |
| Scale / worker smoke / bench | ~1,000+ | `mctb_worker_smoke`, `mctb-bench` failures |
| Legitimate workspace backlog | ~5,362 on `ws_1` | Mostly actionable CRM (`crm_task_due_scan` children), not deleted in cleanup |

**Not a single runaway duplicate job type:** growth is **structural** — ~20 global scheduler enqueues **per minute** × uptime, plus workspace-scoped sends, with **zero terminal pruning**. At ~28,800 completed scheduler rows/day, months of production explain hundreds of thousands of rows without abnormal per-minute duplication of one key.

**Recurring process audit:** `processDueJobs` (cron `/api/jobs/process` + `worker-all` BullMQ sync) enqueues one row per scheduler type per minute with **time-bucketed** idempotency keys. That is expected traffic; the bug was **retention**, not misconfigured infinite re-insert of the same key.

## CURRENT CLEANUP BEHAVIOR (before lifecycle)

| Mechanism | Behavior |
|-----------|----------|
| BullMQ `removeOnComplete` / `removeOnFail` | Redis only (default 1000 / 5000 jobs per queue) — **does not delete Postgres** |
| `completeJob` / `failJob` | Sets terminal status + `completedAt`; **no delete** |
| `enqueueJob` idempotency | Reuses row when same key is re-enqueued after terminal state; **new minute keys → new rows** |
| Prior maintenance | One-off production test cleanup (`scripts/operations/production-test-data-cleanup.ts` on branch `cursor/production-db-test-cleanup-f350`); **no scheduled prune** |

## NEW RETENTION

| Class | Statuses (schema) | Policy |
|-------|-------------------|--------|
| **Actionable** | `pending`, `processing`, `deferred` | **Never** age-deleted; old actionable → ops alert (`oldestActionable` in health snapshot) |
| **Successful terminal** | `completed` | Delete after **30 days** (`JOB_QUEUE_COMPLETED_RETENTION_DAYS`) |
| **Failure terminal** | `failed` | Delete after **90 days** (`JOB_QUEUE_FAILED_RETENTION_DAYS`) |

Compliance, billing, MCTB history, messages, and consent live in **business tables** — not in completed queue rows.

## IDEMPOTENCY SAFETY

- **Time-bucket scheduler keys** only dedupe within the same minute/hour/day window. Older completed rows are not required for future ticks (new keys).
- **Entity-scoped keys** (e.g. `call-missed:${callId}`): effects are persisted in domain tables before the job completes; re-enqueue after prune creates a **new** row only if business logic enqueues again (rare). MCTB/SMS pipelines use message/conversation/consent records for delivery truth.
- **`enqueueJob`**: if a completed row still exists, same key **reopens** the row; after prune, same key can insert again — equivalent to intentional retry. Pruning does not bypass handler idempotency inside workers (campaign message IDs, durable operations, etc.).
- **No requirement** to keep full queue payloads forever for deduplication; long-lived provider dedupe belongs in dedicated stores if needed later.

## AUTOMATED MAINTENANCE

| Item | Value |
|------|--------|
| **Schedule** | Daily enqueue at **04:15 UTC** via `job_queue_terminal_prune` in `processDueJobs`; manual `scripts/operations/prune-completed-job-queue.ts` with `EXECUTE=1` |
| **Batch size** | 500 (`JOB_QUEUE_PRUNE_BATCH_SIZE`), max 40 batches/run (`JOB_QUEUE_PRUNE_MAX_BATCHES`) → up to ~20k rows/day per run |
| **Query** | `status=completed` + `completedAt < cutoff` (or `updatedAt` fallback); same for `failed` |
| **Index** | Partial indexes migration `20260929200000_job_queue_terminal_prune_idx` |
| **Monitoring** | `getJobQueueHealthSnapshot()` — actionable count, oldest actionable age, terminal prunable counts, optional BullMQ depths via `scripts/diag-production-job-queue.ts` |

Failures in prune are logged; they do not block MCTB or other job handlers.

## BULLMQ RETENTION

| Setting | Default | Env override |
|---------|---------|----------------|
| Completed | 1000 per queue | `BULLMQ_REMOVE_ON_COMPLETE` |
| Failed | 5000 per queue | `BULLMQ_REMOVE_ON_FAIL` |

Postgres outbox remains authoritative for recovery; BullMQ retention is for Redis memory only.

## STEADY-STATE PROJECTION

**Measured scheduler load (code):** ~20 global maintenance/batch job types enqueued per `processDueJobs` call, once per minute ≈ **28,800 completed rows/day** for null-workspace ticks alone (if all complete).

With **30-day** completed retention:

| Scale | Scheduler completed cap (order of magnitude) | Notes |
|-------|-----------------------------------------------|--------|
| Current (1 prod workspace) | ~864k scheduler + workspace sends | Bounded rolling window vs unbounded |
| 100 customers | Same scheduler cap + **per-customer send/automation rows** (usage-dependent) | Label: **projection** from measured tick rate + assumed send volume |
| 1,000 / 5,000 / 10,000 | Scheduler cap unchanged; workspace-scoped rows grow with **actual** SMS/automation/MCTB enqueue rate | Use `scripts/operations/analyze-job-queue.ts` on production for jobs/customer after cleanup |

**Post-cleanup production (~5.5k rows):** steady state after retention stabilizes is dominated by **30 days × (daily scheduler completions + daily workspace jobs)** — not cumulative forever.

## VERIFIED

| Check | Status |
|-------|--------|
| `job_queue` no longer grows indefinitely under normal operation | **YES** (with daily prune + retention env) |
| Regression | `npm run test:job-queue-lifecycle` |

## Operations

```bash
# Analysis
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/analyze-job-queue.ts

# Dry-run prune
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/prune-completed-job-queue.ts

# Execute prune
EXECUTE=1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/prune-completed-job-queue.ts

# Health probe
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/diag-production-job-queue.ts
```
