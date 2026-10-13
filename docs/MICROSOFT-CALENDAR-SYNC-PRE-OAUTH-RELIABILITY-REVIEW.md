# Microsoft calendar sync — pre-OAuth reliability review

**Date:** 2026-10-13  
**Context:** Post–consumption RCA; production queue reset complete; prevention guards deployed on `master`.  
**Goal:** Verify retry/outbox/coalescing/monitoring before **one** controlled Microsoft OAuth E2E sync.  
**Scope:** Code inspection + isolated tests only — no bulk calendar workloads.

---

## 1. Permanent Microsoft auth failures → non-retryable in BullMQ

| Layer | Status | Notes |
|--------|--------|--------|
| Reconcile eligibility | **Present** | `isEligibleForRoutineMicrosoftCalendarSync` skips `needs_reauth` without credentials; `markMicrosoftConnectionPausedForReauth` pushes `nextSyncDueAt` out. |
| Sync handler | **Fixed (this review)** | `syncWorkspaceCalendarConnection` / `syncCalendarProviderEventById` now throw `JobFailedError` when access token is unavailable or connection is missing. |
| BullMQ worker | **Present** | `src/lib/jobs/bullmq.ts` maps `JobFailedError` → `UnrecoverableError` (no further BullMQ attempts), syncs PG row to `failed`, runs `notifyCalendarConnectionSyncJobTerminal`. |
| Token refresh | **Present** | `getValidAccessToken` marks `needs_reauth` on `invalid_grant` / interaction_required / missing refresh; returns `null` (sync then fails with `JobFailedError`). |

**Prior gap:** Plain `Error` on missing token caused up to **8** BullMQ attempts with exponential backoff — visible in production logs during the incident.

---

## 2. Transient Microsoft failures → bounded retry / backoff

| Mechanism | Status | Notes |
|-----------|--------|--------|
| Graph HTTP 429 / 5xx | **Present** | `microsoftGraphFetchInner` retries up to 3 throttle waits via `sleepForGraphRetryAfter`. |
| Per-calendar import errors | **Present** | `syncWorkspaceCalendarConnection` catches per-calendar failures, increments `stats.errors`, applies `markMicrosoftSyncFailure` / backoff on connection schedule — job **completes** (partial sync), not infinite BullMQ retry. |
| Job-level deferral | **Present** | `JobDeferredError` → `moveToDelayed` + PG defer in BullMQ processor (used elsewhere; calendar sync relies on Graph inline retry + schedule backoff). |
| BullMQ defaults | **Present** | 8 attempts, 15s exponential backoff for unclassified thrown errors (non–`JobFailedError`). |

---

## 3. PostgreSQL ↔ BullMQ outbox (dual-write recovery)

| Check | Status | Notes |
|-------|--------|--------|
| PG row on enqueue | **Present** | `enqueueJob` always creates/updates `job_queue` first. |
| BullMQ enqueue failure | **Recoverable** | Logs `bullmq_enqueue_failed`; row stays `pending`/`deferred`. |
| Outbox drain | **Present** | `syncDbOutboxToBullmq(50)` every ~5s in `processDueJobs` (web `worker-all`). |
| Duplicate executable jobs | **Mitigated** | `enqueueBullmq` uses stable `jobId` from idempotency key; skips if job is `waiting` / `active` / `delayed` (promote/wake). |
| Outbox throughput ceiling | **Known limit** | ~600 rows/min best case (50 per 5s) — can lag during large incidents; acceptable for steady state, not a substitute for enqueue prevention. |
| Completed Redis + pending PG | **Edge case** | If Redis job completed but PG not synced, outbox may re-add; worker `syncDbJob` normally aligns PG on terminal BullMQ outcome. |

---

## 4. Reconcile coalescing (no duplicate routine enqueue)

| Guard | Status | Notes |
|-------|--------|--------|
| Stable routine idempotency key | **Present** | `calendar-sync-routine-{connectionId}-inc` (not minute bucket). |
| Block on outstanding PG job | **Present** | `findBlockingOutstandingCalendarConnectionSync` — `pending`, `deferred`, `processing` (stale processing ignored after `CALENDAR_SYNC_STUCK_PROCESSING_MS`, default 45m). |
| Deferred follow-up | **Present** | When blocked, sets `microsoftRoutineSyncDeferred`; `processDeferredRoutineCalendarSyncAfterJobTerminal` enqueues one follow-up after terminal sync. |
| Failed PG row | **Intentional** | `failed` is **not** blocking — reconcile may reset same idempotency key to `pending` on next due cycle (after user fixes auth). |
| Reconcile budget | **Present** | `microsoftReconcileDiscoveryBudgetPerTick()` caps enqueues per tick. |

---

## 5. Monitoring and safeguards

| Signal | Status | Notes |
|--------|--------|--------|
| PG actionable backlog | **Present** | `getJobQueueHealthSnapshot()` — totals, `oldestActionable.ageMinutes`. |
| BullMQ depths | **Present** | `getBullmqQueueDepths()` on default + dispatch queues. |
| Redis memory | **Extended (this review)** | `getBullmqRedisMemorySummary()` attached to health snapshot when `REDIS_URL` set. |
| Automated paging on Redis OOM | **Gap** | No dedicated alert rule in-repo; ops should watch health snapshot / Redis provider metrics. |
| Daily terminal prune | **Present** | `runJobQueueTerminalPruneMaintenance` logs health after prune. |

**Operational probes (read-only):** `scripts/diag-production-job-queue.ts`, `scripts/operations/analyze-job-queue.ts`, `scripts/ar-calendar-sync-throughput-probe.ts`.

---

## Changes made in this review

1. **`import-sync.ts`** — `JobFailedError` for missing connection, missing token, and webhook path token failures.  
2. **`bullmq-queue-health.ts` + `job-queue-lifecycle.ts`** — Redis memory summary on job-queue health snapshot.

---

## Readiness for one controlled Microsoft OAuth E2E

| Criterion | Ready? |
|-----------|--------|
| Runaway reconcile / invalid-token enqueue prevention on production | **Yes** (deployed prevention + empty queue) |
| Workers consuming `calendar_connection_sync` on `default` | **Yes** (RCA confirmed) |
| Permanent auth does not consume 8× BullMQ retries per attempt | **Yes** after deploying this review’s `JobFailedError` change |
| Outbox + coalescing behavior understood | **Yes** |
| Redis / backlog monitoring improved | **Partial** (memory on health snapshot; no pager) |

**Recommendation:** Deploy the small handler + health changes, then run **one** real Microsoft OAuth connection through connect → initial sync → verify PG/BullMQ depths return to ~0 and connection status `connected`.

Do **not** re-run scale tests or mass connection discovery until that E2E passes.
