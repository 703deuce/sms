# Microsoft calendar sync — production throughput measurement

**Date probed:** 2026-10-12 (UTC)  
**Method:** Read-only `scripts/ar-calendar-sync-throughput-probe.ts` on production web container + log/infra inspection. **No production settings changed.**

**Related:** [MICROSOFT-CALENDAR-SYNC-WORKER-AUDIT.md](./MICROSOFT-CALENDAR-SYNC-WORKER-AUDIT.md)

---

## Executive summary

| Finding | Verified in production? |
|--------|-------------------------|
| **Primary bottleneck is processing/backpressure, not Graph API design** | **Yes** |
| **`calendar_connection_sync` backlog ~690k pending** | **Yes** |
| **Oldest pending sync ~108 hours** (includes `ws_1` connection) | **Yes** |
| **Near-zero calendar sync throughput in the last 24h** (aggregate queries) | **Yes** |
| **Redis BullMQ OOM** (`maxmemory`) blocking enqueue/workers | **Yes** (logs) |
| **SMS worker does not consume `default` queue** | **Yes** (code + heartbeats) |
| **Web runs embedded `worker:all`** (`EMBEDDED_JOB_WORKER=1`) | **Yes** (process list) |
| Avg/p95 sync execution time from DB | **Not available** (`lockedAt` often null on completions) |
| Graph requests/min, 429 rate | **Not available** (no centralized metrics) |

**Conclusion:** The system is **not production-reliable for fast calendar import today** because jobs are not draining. The audit’s “default queue concurrency ≈ 4” matters only after Redis can move jobs; **right now Redis OOM and backlog dominate**. Do **not** treat “change 5 min → 15 min reconcile” as the first fix—that would mask capacity failure.

---

## 1. Enqueue vs complete (24h)

**Verified (production DB, probe 2026-10-12T16:40Z):**

| Metric | Value |
|--------|------:|
| `calendar_connection_sync` **pending** | **690,054** |
| `calendar_connection_sync` **processing** | **0** |
| `calendar_connection_sync` **failed** (24h) | **0** |
| **Created** in last 24h (hourly SQL) | **0** |
| **Completed** in last 24h (hourly SQL) | **0** |
| `microsoft_calendar_webhook_process` created/completed (24h) | **0** |
| **Any** job type completed (24h) | **1,466** |

**Interpretation:** Maintenance and other queues still complete some work; **calendar sync is effectively stalled**. Aggregate 24h counts for calendar sync may under-report single completions (see below); spot-check found a recent completion.

**Last completed `calendar_connection_sync` (spot-check):**

- `completedAt`: **2026-10-12T14:50:00Z**
- `createdAt`: **2026-10-11T06:05:03Z**
- **End-to-end latency (create → complete): ~32.7 hours**
- `priority`: **25** (likely recovery/reconcile path)
- `lockedAt`: **null** → execution duration not measurable from this row

**Webhook vs recovery (24h):** Cannot reliably split enqueue sources at scale while backlog is stale and 24h create/complete counts are zero. Heuristic on last completion: **priority 25 → likely recovery**.

---

## 2. Duration (avg / p95 / max) and queue wait

| Metric | Status |
|--------|--------|
| Execution time (`lockedAt` → `completedAt`) | **No sample in 24h** (n=0; `lockedAt` often unset on completed rows) |
| Queue wait (`runAfter`/`createdAt` → `lockedAt`) | **No sample** |
| Oldest pending `runAfter` | **2026-10-08T04:47:02Z** (~**108 hours** behind) |

**Estimate (single verified job):** ~32h wait+process from enqueue to complete under load—not a healthy SLA.

---

## 3. Queue depth and failure state

| State | Count |
|-------|------:|
| Pending + deferred (`calendar_connection_sync`) | **690,054** |
| Processing | **0** |
| Failed (24h) | **0** |
| Pending non-`sim-` workspaces | **690,054** |
| Microsoft connections (`connected` / `needs_reauth`) | **23,583** |

**Worker heartbeat (`sms-dispatch`, 2026-10-12T16:41Z):**

- `queuedCount`: **731,411** (all job types)
- `processingCount`: **7**
- `oldestDueJobAgeMs`: **~1,609,276,118** (~**18.6 days**)

---

## 4. Default-queue contention (concurrency ≈ 4)

**Verified topology:**

| Component | Consumes `default` queue? | Notes |
|-----------|---------------------------|--------|
| Next.js web (`DISABLE_INPROCESS_WORKER=1`) | **No** (by design) | Avoids double drain |
| Embedded **`worker:all`** in web container (`EMBEDDED_JOB_WORKER=1`) | **Yes** | Runs `startBullmqWorkers()` → includes **`default`** + **`maintenance`** |
| **`transovo-sms-worker`** | **No** | `startSmsDispatchBullmqWorkers()` — campaign/MCTB/AR/voice only |
| Scheduler container | **No** `default` consumer observed |

**Env (web):** `QUEUE_DRIVER=bullmq`, `BULLMQ_DEFAULT_CONCURRENCY` unset → **default 4** for `default` queue.

**Pending on `default` (groupBy snapshot):** `calendar_connection_sync` dominates the sample (690k+ total pending; ORM groupBy showed 1000 in one bucket—treat total pending count as authoritative).

**Competition:** While Redis is healthy, **all `default` job types share those ~4 slots** with calendar sync. Under backlog, calendar sync competes with every other `default` job type.

---

## 5. Graph API volume and 429

| Metric | Available? |
|--------|------------|
| Graph requests/minute | **No** |
| 429 count | **No** (not in DB) |
| Per-sync Graph request count | **No** |

**Logs (verified snippets):**

- Web: `bullmq_enqueue_failed` for `calendar_connection_sync` — **Redis OOM** on BullMQ scripts (not Graph 429).
- SMS worker: repeated `bullmq_worker_error` — **OOM command not allowed when used memory > 'maxmemory'**.

**429 handling exists in code** (`microsoftGraphFetch` + `Retry-After`) but **cannot assess production throttle pressure** from current telemetry.

---

## 6. BullMQ deployment topology (smallest safe capacity fix)

**Current (verified):**

```
Coolify web container
  ├─ Next.js (DISABLE_INPROCESS_WORKER=1)
  └─ embedded worker:all → startBullmqWorkers()
        ├─ default  (calendar_connection_sync, microsoft_calendar_webhook_process, …)  concurrency ~4
        └─ maintenance (calendar_connections_reconcile, calendar_subscription_renew, …) concurrency ~3

Coolify transovo-sms-worker
  └─ worker:sms → dispatch queues only (NOT default)
```

**Smallest safe change (recommendation — not implemented):**

1. **Restore Redis headroom** (increase `maxmemory`, eviction policy, prune stale BullMQ keys / terminal `job_queue` rows). **Without this, no worker topology change will drain calendar sync.**
2. **After Redis is healthy, measure** `lockedAt`→`completedAt` for 24h to size concurrency.
3. **Then** choose one (incremental):
   - **Option A (minimal):** Raise `BULLMQ_DEFAULT_CONCURRENCY` on embedded `worker:all` only (e.g. 8–16) and watch Graph 429 + CPU.
   - **Option B (cleaner ownership):** Add **`calendar` BullMQ queue** (or route `calendar_connection_sync` to a dedicated queue) consumed by **same host, separate process** with `BULLMQ_CALENDAR_SYNC_CONCURRENCY`—reuse existing handlers, no sync rewrite.
   - **Option C:** Second web replica **without** doubling enqueue—only if Redis and DB can take it.

**Do not** start with 15-minute reconcile interval.

**Resource impact (estimate):** Each active sync holds Graph + CPU; at concurrency 10 and ~3s/sync, theoretical **~200 syncs/min** if slots are calendar-only—**must be measured** after Redis fix.

---

## 7. Sustainable throughput vs recovery interval (estimates)

**Assumptions (illustrative — not measured):** 3s average sync, 4 concurrent slots, **all slots calendar-only**.

| | Value |
|--|------:|
| Theoretical max throughput | **~80 syncs/min** |
| Recovery demand @ **1,000** calendars, **5 min** interval | **200/min** |
| Recovery demand @ **10,000** calendars, **5 min** interval | **2,000/min** |
| Reconcile enqueue cap | **750/min** (default batch) |

**Verified scale signal:** **23,583** Microsoft connections in DB. If a large fraction were due on a 5-minute interval, demand would exceed both **750 enqueue/tick** and **~80/min processing** by orders of magnitude—even before webhooks.

**At 15 min interval (estimate only):** demand ÷ 3 (e.g. 1k calendars → ~67/min)—still above **80/min** only if concurrency and avg duration are favorable; **at 10k calendars → ~667/min**—still far above 80/min.

---

## 8. Priority-ordered actions (aligned with product review)

| Priority | Action | Rationale |
|----------|--------|-----------|
| **1 — Critical** | Fix **Redis OOM** + drain/prune backlog safely | Jobs cannot enqueue or complete |
| **2 — High** | Instrument **sync duration + queue age** (`lockedAt`, histogram metrics) | Size concurrency with data |
| **3 — High** | **Coalesce full vs incremental** per connection (existing minute idempotency helps; tighten mutex) | Avoid duplicate work / checkpoint races |
| **4 — Medium** | Tune reconcile interval **after** sustained drain | Avoid hiding capacity gap |
| **5 — Later** | Distributed Graph limits (Redis semaphores per mailbox) | Multi-replica scale |

---

## 9. Reliability risks (remaining)

- **Redis memory** — active production failure mode.
- **690k+ pending syncs** — replay may take days at low concurrency; may need controlled prune or prioritization (e.g. real workspaces before load-test data).
- **`ws_1` oldest pending** — customer-visible path can sit behind global backlog.
- **23k connections** — recovery math exceeds worker capacity unless stagger + interval + batch tuned together.
- **No Graph 429 telemetry** — risk of throttling once drain accelerates.
- **`lockedAt` not persisted** on many completions — blinds duration SLO monitoring.

---

## Re-run probe

```bash
# On production web container (read-only)
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-calendar-sync-throughput-probe.ts
```

Optional: `PROBE_HOURS=48` for a longer window.

---

## Distinction: verified vs estimated

| Verified in production (2026-10-12) | Estimate / code-only |
|-------------------------------------|----------------------|
| Backlog ~690k, oldest ~108h | 80 syncs/min at 3s × 4 workers |
| Redis OOM in BullMQ logs | Graph 429 rate |
| Embedded `worker:all` present | Optimal concurrency after fix |
| SMS worker excludes `default` | 15 min interval “fixing” capacity |
| Last calendar completion ~32h latency (one row) | Full webhook vs recovery split at scale |
| 23,583 Microsoft connections | Per-sync Graph request count |
