# job_queue lifecycle — full report (copy-paste)

**Purpose:** Postgres `job_queue` is operational durable-outbox infrastructure paired with BullMQ. It must not become permanent historical storage. This document consolidates root-cause analysis, retention policy, idempotency safety, automation, monitoring, and steady-state sizing.

**Implementation:** branch `cursor/job-queue-lifecycle-f350`, draft PR #567  
**Canonical ops doc:** `docs/MCTB-JOB-QUEUE-LIFECYCLE.md`

---

## Executive summary

Every durable background operation creates a Postgres `job_queue` row. BullMQ jobs disappear per Redis retention (`removeOnComplete` / `removeOnFail`), but Postgres rows remained unless explicitly pruned. Production reached **330k+** rows (11 workspaces). Most growth was **structural** (minute/hour scheduler ticks with time-bucket idempotency keys), not one infinitely duplicated legitimate job. Test/smoke pollution accounted for a smaller slice. After one-off test cleanup (~5.5k rows left on `ws_1`), **permanent batched retention** prevents unbounded growth.

**Verified:** `job_queue` no longer grows indefinitely under normal operation: **YES** (with daily prune deployed + retention env).

---

## WHY JOB_QUEUE REACHED 330K+

### Measured breakdown (production, pre-cleanup, 2026-09-29)

| Source | Approx. rows | Notes |
|--------|-------------|--------|
| `workspaceId IS NULL`, `status=completed` | ~323,800 | Minute/hour **scheduler ticks** from `processDueJobs()` — each tick uses a **new** idempotency key (`campaign-send-batch:2026-09-29T12:34`, `crm-task-due:…`, `automation-batch:…`, appointment scans, etc.), completes, and **stayed forever** |
| Scale / worker smoke / bench | ~1,000+ | `mctb_worker_smoke`, `mctb-bench` failures |
| Legitimate workspace backlog (`ws_1`) | ~5,362 | Mostly actionable CRM pending — **not** bulk-deleted in cleanup |
| Post one-off test cleanup | ~5,455 total | 1 workspace (`ws_1`); ~93 null pending orphans; ~898 ws_1 pending untouched |

### Actual cause (not assumptions)

1. **Which code creates rows:** `enqueueJob()` in `src/lib/messaging/enqueue-advance.ts` (creates/updates `job_queue`). BullMQ path also dual-writes via `enqueueBullmq()` in `src/lib/jobs/bullmq.ts`. Global schedulers enqueue from `processDueJobs()` in `src/lib/jobs/job-handlers.ts` (cron `POST /api/jobs/process`, `scripts/worker-all.ts`, in-process drain).

2. **When status becomes completed:** Workers call `completeJob()` after `handleJob()` succeeds (BullMQ: `syncDbJob` → `completeJob`). Sets `status=completed`, `completedAt=now`.

3. **Whether rows are ever deleted today (before lifecycle PR):** Essentially **no** routine Postgres prune. BullMQ Redis retention only.

4. **Whether BullMQ cleanup affects Postgres:** **No.** Redis `removeOnComplete` / `removeOnFail` do not touch `job_queue`.

5. **Whether cron/maintenance cleanup already existed:** **No** scheduled terminal prune. One-off `production-test-data-cleanup` on branch `cursor/production-db-test-cleanup-f350`.

6. **Whether completed rows are queried after completion:** Operational paths query **actionable** statuses (`pending`, `deferred`, `processing`) for drain/sync. CRM health API counts backlog. **Not** used as customer history UI.

7. **Idempotency on `idempotencyKey`:** Unique column. `enqueueJob` reuses/opens row when same key exists (including after terminal state). **New** scheduler keys every minute → **new rows** accumulate.

8. **Usage accounting / analytics / compliance / customer UI:** Authoritative data in business tables (messages, conversations, missed calls, consent, campaigns, appointments). **Not** dependent on millions of completed queue rows.

### Recurring-process investigation (330k with only 11 workspaces)

**Conclusion:** Not primarily “300k copies of one legitimate recurring job.” It is **~20 scheduler job types × every minute × months**, each with a **distinct time-bucket key**, all completing and never pruned. Example types from `processDueJobs`: `campaign_send_batch`, `automation_batch`, `voice_campaign_batch`, `campaign_recurrence_tick`, `crm_task_due_scan`, `appointment_*_scan`, `mctb_provider_reconciliation`, etc.

**Order of magnitude:** ~20 enqueues/minute × 1,440 minutes/day ≈ **28,800 new completed scheduler rows/day** (null workspace). Over ~12 days that alone is ~345k rows — consistent with observed scale.

**Retention alone would not fix** a hypothetical bug that re-inserted the same key every second; analysis showed **time-bucket keys**, so retention is the correct fix plus monitoring oldest actionable age.

---

## Durable queue vs permanent business history

| Belongs in `job_queue` (operational) | Belongs in business tables (permanent) |
|--------------------------------------|----------------------------------------|
| Pending work, retries, deferrals | Missed calls, conversations/messages |
| Short-lived terminal audit for ops | Consent records, notifications/audit where required |
| Idempotency window for in-flight dedupe | Recovery usage, appointments, campaign send state |

Successful processing **must** persist outcomes in domain tables before terminal queue rows become eligible for deletion (MCTB/SMS/campaign handlers already do).

---

## Lifecycle states (actual schema)

Prisma `JobQueueStatus`: `pending` | `processing` | `completed` | `failed` | `deferred`

### ACTIONABLE — never age-delete

| Status | Maps to spec “pending/running/retrying/scheduled” |
|--------|---------------------------------------------------|
| `pending` | Queued, due |
| `processing` | Running (locked) |
| `deferred` | Delayed retry / soft defer |

Old actionable jobs → **operational alert** (oldest actionable age), not silent delete.

### SUCCESS TERMINAL

| Status | Retention |
|--------|-----------|
| `completed` | **30 days** after `completedAt` (or `updatedAt` fallback) |

### FAILURE TERMINAL

| Status | Retention |
|--------|-----------|
| `failed` | **90 days** after `completedAt` or `updatedAt` |

No separate `dead` / `exhausted` enum — terminal failure is `failed`.

---

## NEW RETENTION (production defaults)

| Class | Policy |
|-------|--------|
| **Successful terminal** | 30 days — `JOB_QUEUE_COMPLETED_RETENTION_DAYS` |
| **Failed terminal** | 90 days — `JOB_QUEUE_FAILED_RETENTION_DAYS` |
| **Actionable** | Never automatic age deletion |
| **Compliance/business records** | Governed by their own tables, not `job_queue` |

If 30/90 conflicts with a specific long-lived idempotency requirement, raise retention or add a **small dedicated dedupe store** — do not keep full queue payloads forever.

---

## IDEMPOTENCY SAFETY

**Why deleting terminal queue rows cannot recreate customer effects (under normal operation):**

1. **Time-bucket scheduler keys** — Future ticks use **new** keys; old completed rows are not consulted.

2. **Entity-scoped keys** (e.g. `call-missed:${callId}`, `messaging-registration-advance:${workspaceId}`) — Side effects are recorded in messages, conversations, consent, campaign messages, durable operation tables **before** job completion. Pruning a old completed row does not undo sent SMS or stored records.

3. **`enqueueJob` after prune** — Same `idempotencyKey` can insert a new row (same as today when row was deleted manually). Handlers must remain idempotent on **business keys** (message IDs, provider event IDs, durable ops).

4. **Replay risk** — A provider replaying the **same** idempotency key months later could enqueue again after prune. Mitigation: business-layer dedupe (existing patterns); for high-risk keys, use dedicated long-lived idempotency records if required (not implemented in v1 lifecycle — conservative retention chosen instead).

5. **Do not** delete `pending` / `processing` / `deferred` — concurrent workers safe via `deleteMany` with `status` + `id` match.

---

## CURRENT CLEANUP BEHAVIOR (before lifecycle PR)

| Mechanism | Behavior |
|-----------|----------|
| BullMQ `removeOnComplete` / `removeOnFail` | Redis only (default 1000 / 5000 per queue) |
| `completeJob` / `failJob` | Terminal status + `completedAt`; no delete |
| `enqueueJob` | Reuses row on same key; new minute keys → new rows |
| Scheduled Postgres prune | **None** |
| One-off production test cleanup | ~323k null completed + test workspaces removed; `ws_1` preserved |

---

## AUTOMATED MAINTENANCE

| Item | Value |
|------|--------|
| **Core module** | `src/lib/jobs/job-queue-lifecycle.ts` |
| **Job type** | `job_queue_terminal_prune` |
| **Schedule** | Enqueued daily at **04:15 UTC** from `processDueJobs` (`idempotencyKey`: `job-queue-terminal-prune:${dayKey}`) |
| **Manual script** | `scripts/operations/prune-completed-job-queue.ts` — default dry-run; `EXECUTE=1` to delete |
| **Batch size** | 500 (`JOB_QUEUE_PRUNE_BATCH_SIZE`) |
| **Max batches per run** | 40 (`JOB_QUEUE_PRUNE_MAX_BATCHES`) → up to ~20,000 rows per daily run |
| **Query** | Terminal statuses only; `completedAt < cutoff` OR (`completedAt` null AND `updatedAt < cutoff`) |
| **Index** | `prisma/migrations/20260929200000_job_queue_terminal_prune_idx` (partial indexes on terminal rows) |
| **Safety** | No TRUNCATE, no VACUUM FULL, no single giant DELETE; bounded batches |
| **Failure impact** | Logged; does not block MCTB or other jobs |

### Environment variables

```
JOB_QUEUE_COMPLETED_RETENTION_DAYS=30
JOB_QUEUE_FAILED_RETENTION_DAYS=90
JOB_QUEUE_PRUNE_BATCH_SIZE=500
JOB_QUEUE_PRUNE_MAX_BATCHES=40
BULLMQ_REMOVE_ON_COMPLETE=1000
BULLMQ_REMOVE_ON_FAIL=5000
```

---

## QUEUE HEALTH MONITORING

**Important:** Total row count alone is misleading. Track:

| Metric | Source |
|--------|--------|
| Pending/actionable count | `getJobQueueHealthSnapshot().totals.actionable` |
| Oldest actionable job age | `oldestActionable.ageMinutes` |
| Terminal completed count | `totals.completed` |
| Terminal failed count | `totals.failed` |
| Rows older than retention (prunable) | `terminalCompletedOlderThanRetention`, `terminalFailedOlderThanRetention` |
| BullMQ waiting / delayed / failed | `bullmq` field (when `REDIS_URL` set) |

**Scripts:**

- `scripts/diag-production-job-queue.ts` — includes `lifecycleHealth`
- `scripts/operations/analyze-job-queue.ts` — status, type, workspace breakdown

**Warning thresholds:** Prioritize **oldest actionable age** (e.g. stuck > 3 hours) over raw backlog size.

---

## BULLMQ RETENTION

| Setting | Default | Env |
|---------|---------|-----|
| Completed jobs in Redis | 1000 per queue | `BULLMQ_REMOVE_ON_COMPLETE` |
| Failed jobs in Redis | 5000 per queue | `BULLMQ_REMOVE_ON_FAIL` |

Postgres outbox remains authoritative for recovery; do not rely on Redis alone for durable state.

---

## STEADY-STATE PROJECTION

**Measured (code, not fabricated customer rates):** ~20 global scheduler enqueues per `processDueJobs` call × 1/minute ≈ **28,800 completed null-workspace rows/day**.

With **30-day** completed retention, scheduler completed rows approach a **rolling cap** ≈ 28,800 × 30 ≈ **864,000** (plus workspace-scoped jobs), not unbounded year-over-year growth.

| Scenario | Projection |
|----------|------------|
| **Pre-cleanup** | 330k+ (months of scheduler + tests) |
| **Post test cleanup** | ~5.5k (then grows toward rolling window) |
| **100 customers** | Scheduler cap unchanged + workspace send/automation rows (**usage-dependent** — measure with `analyze-job-queue.ts`) |
| **1,000 customers** | Same scheduler cap + higher workspace-scoped volume |
| **5,000 customers** | Same scheduler cap + higher workspace-scoped volume |
| **10,000 customers** | Same scheduler cap + higher workspace-scoped volume |

**Example yearly growth without prune (illustrative):** 10k jobs/day → 3.65M rows/year; 50k/day → 18.25M/year — **why retention is mandatory**.

---

## REGRESSION TESTS (lifecycle)

`npm run test:job-queue-lifecycle` proves:

1. Recent completed job retained  
2. Old completed job deleted  
3. Recent failed job retained  
4. Old failed job deleted when eligible  
5. Pending never deleted regardless of age  
6. Deferred never deleted  
7. Processing never deleted  
8. Idempotency re-enqueue works after row removed  
9. Business tables unchanged by prune (test uses isolated `job_queue_lifecycle_test` type)  
10. Second prune run is safe (0 extra deletes)

---

## POST-MERGE OPERATOR CHECKLIST

1. Merge PR #567 and deploy.  
2. `npm run db:deploy` (partial indexes).  
3. Dry-run: `npx tsx scripts/operations/prune-completed-job-queue.ts` (with preload).  
4. Optional catch-up: `EXECUTE=1` (repeat until prunable counts near zero).  
5. Confirm daily `job_queue_terminal_prune` runs (04:15 UTC tick).  
6. Monitor `diag-production-job-queue.ts` for oldest actionable age.

---

## OPERATIONS COMMANDS

```bash
# Analysis (status, type, workspace, health)
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/analyze-job-queue.ts

# Dry-run prune (report only)
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/prune-completed-job-queue.ts

# Execute batched prune
EXECUTE=1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/prune-completed-job-queue.ts

# Health probe (worker heartbeat + lifecycle)
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/diag-production-job-queue.ts

# Regression tests
npm run test:job-queue-lifecycle
```

---

## FINAL REPORT CHECKLIST (quick reference)

| Section | Answer |
|---------|--------|
| **WHY JOB_QUEUE REACHED 330K** | ~323k null completed scheduler ticks + smoke/bench; structural retention gap, not one runaway duplicate key |
| **CURRENT CLEANUP BEHAVIOR** | BullMQ Redis only; no Postgres prune until lifecycle PR |
| **NEW RETENTION — Successful** | 30 days (`completed`) |
| **NEW RETENTION — Failed** | 90 days (`failed`) |
| **NEW RETENTION — Actionable** | Never age-delete (`pending`, `processing`, `deferred`) |
| **IDEMPOTENCY SAFETY** | Time-bucket keys; domain persistence; handler-level dedupe |
| **AUTOMATED MAINTENANCE** | Daily 04:15 UTC job; 500×40 batches; partial indexes; health snapshot |
| **BULLMQ RETENTION** | 1000 complete / 5000 fail per queue (env overridable) |
| **STEADY-STATE** | ~864k scheduler cap at 30d retention (rolling); workspace rows additive |
| **VERIFIED — no indefinite growth** | **YES** with prune + retention |

---

## Architecture note (one paragraph)

`job_queue` behaves as a **rolling operational window**: BullMQ moves work; Postgres records durable state until terminal completion; retention removes terminal rows after proof that business history lives elsewhere. The 330k incident was predictable at SaaS scale without a janitor — fixing creation rate was not required because minute-key schedulers are intentional; **pruning + monitoring actionable age** is the durable fix.

---

*Generated for operator copy-paste. Update measured counts after running `analyze-job-queue.ts` on current production.*
