# Microsoft calendar sync — job consumption RCA (prelaunch)

**Date:** 2026-10-13  
**Scope:** Why ~700k `calendar_connection_sync` jobs accumulated; whether workers failed vs enqueue overwhelmed drain.  
**No new production calendar workloads** were created for this investigation.

**Related:** [MICROSOFT-CALENDAR-SYNC-REDIS-OOM-RCA.md](./MICROSOFT-CALENDAR-SYNC-REDIS-OOM-RCA.md), [MICROSOFT-CALENDAR-SYNC-WORKER-AUDIT.md](./MICROSOFT-CALENDAR-SYNC-WORKER-AUDIT.md)

---

## Executive answer

**The default-queue consumer was running and claiming jobs.** Production logs show `bullmq_job_received` for `calendar_connection_sync` on queue `default`, and the 2026-10-12 probe recorded **110 active** jobs on `bull:default:active` while Postgres showed **0** `processing` rows.

**Root cause (confirmed):** A **capacity and storage crisis**, not a missing worker or unregistered handler.

1. **Enqueue vastly exceeded drain** — ~23k invalid-token Microsoft connections + reconcile budget (~750 sync enqueues/minute) vs **4** concurrent `default` workers on a single web container.
2. **Minute-bucket idempotency** — new `job_queue` row per connection per minute (`calendar-sync-{id}-{inc|full}-{minuteBucket}`), so backlog **grew every minute** even when workers kept failing fast on `needs_reauth`.
3. **Redis OOM (`noeviction`, 768 MiB cap)** — dual-write stalled: many rows stayed **`pending` in Postgres** while Redis wait/active grew; new `enqueueBullmq` calls failed; `syncDbOutboxToBullmq` only republishes **50 rows per 5s** tick.
4. **Misleading probe metric** — In `QUEUE_DRIVER=bullmq`, calendar sync is **not** claimed via `claimDueJobs`; Postgres `status=processing` stays **0** while BullMQ holds `active` state.

**Not the cause (ruled out with evidence):** Wrong queue name, handler missing from `worker:all`, SMS worker expected to drain `default`, or scheduler container (Coolify app id 2) being the calendar consumer — that container is **Transovo Voice (LiveKit)**, not job dispatch.

**Fix boundary:** Prevention/coalescing on enqueue (merged `d399b5b66` on web) + infrastructure reset (completed). No second worker or queue redesign required to explain the incident.

---

## 1. Which process consumes which job type?

| Job type | Queue (logical) | BullMQ? | Consumer process |
|----------|-----------------|---------|------------------|
| `calendar_connection_sync` | `default` | **Yes** | **Web container** → `scripts/worker-all.ts` → `startBullmqWorkers()` → `Worker("default", …)` |
| `microsoft_calendar_webhook_process` | `default` | Yes | Same `default` worker |
| `calendar_connections_reconcile` | `maintenance` (DB row) | **No** — `isCalendarMaintenanceDbJob` skips BullMQ enqueue | **Web container** → `drainCalendarMaintenanceFromDb()` every **5s** (`worker-all.ts`) |
| `calendar_subscription_renew` | `maintenance` (DB) | No | Same DB drain |

**Producer for minute ticks:** `processDueJobs()` in `job-handlers.ts`, invoked from `worker-all` on a **5s** interval when `QUEUE_DRIVER=bullmq`. It enqueues `calendar_connections_reconcile` (and other maintenance ticks) and calls `syncDbOutboxToBullmq(50)`.

**SMS dispatch worker** (`worker:sms`) registers **only** `PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES` — **not** `default`. Calendar sync **must** run on the web embedded worker.

**Coolify “scheduler” app (`tgjridm6vrmrgljkfrr0rpjn`):** Runs `transovo-voice` LiveKit workers — **does not** drain `calendar_connection_sync`.

---

## 2. Job lifecycle (BullMQ mode)

```
enqueueJob() → job_queue row (pending)
            → enqueueBullmq(default, calendar_connection_sync)  [unless maintenance DB-only type]

Worker(default) receives job → handleJob → syncWorkspaceCalendarConnection()
            → syncDbJob(idempotencyKey, completed|failed) → completeJob/failJob in Postgres
```

**Where jobs could stall (mapped to evidence):**

| Stage | Stall mechanism | Observed? |
|-------|-----------------|-----------|
| PG create | Always succeeds | 693k rows created in 7d |
| BullMQ enqueue | `bullmq_enqueue_failed` / Redis OOM | Yes — Redis over `maxmemory`; PG > Redis depth |
| Worker claim | Redis OOM / worker down | **Partial** — 110 `active` at probe; logs show receive/fail |
| Handler | Fast fail `needs_reauth` | Yes — logs: `Calendar access token unavailable` |
| PG terminal | `syncDbJob` after BullMQ complete | Works when Redis healthy — jobs reach `failed` after retries |

**Postgres `processing=0` at probe:** Expected in BullMQ mode — `processDueJobs` **does not** call `claimDueJobs` for calendar sync (`job-handlers.ts` returns early with `mode: "bullmq"`). Active work appears in **Redis `active`**, not PG `processing`.

---

## 3. Evidence workers were consuming

**Production web logs (pre-reset container, sim-ms connections):**

```json
{"event":"bullmq_job_received","queueName":"default","jobType":"calendar_connection_sync",...}
{"event":"bullmq_job_failed",...,"error":"Calendar access token unavailable — reconnect required"}
```

**Redis OOM RCA probe (2026-10-12):** `bull:default:active` = **110** (not zero).

**Web container today:** `[worker] starting (QUEUE_DRIVER=bullmq)` + `startBullmqWorkers()` registers `default` with concurrency **4** (`BULLMQ_DEFAULT_CONCURRENCY`).

---

## 4. Why backlog grew anyway

**Math (order of magnitude):**

- Reconcile discovery: up to **750** `calendar_connection_sync` enqueues **per minute** (`MICROSOFT_CALENDAR_RECONCILE_BATCH`).
- Drain: **4** concurrent syncs on one web instance; each job retries up to **8** times with backoff if failing.
- **23,580** `needs_reauth` connections still eligible for discovery (`syncEnabled` + import calendars).

**Enqueue wins:** Even at ~1s per failed sync, theoretical max ~240 completions/minute ≪ 750+ new jobs/minute × duplicate minute buckets over days.

**Redis OOM accelerates divergence:**

- `used_memory` ~**873 MiB** vs **768 MiB** `maxmemory`, `noeviction` → writes fail.
- ~**693k** PG pending vs ~**426k** `bull:default:wait` → hundreds of thousands of rows **never mirrored or orphaned** in Redis; outbox repair **50 / 5s** cannot catch up.

---

## 5. Prevention fixes (deployment)

| Component | Commit | Calendar reconcile consumer? |
|-----------|--------|------------------------------|
| **Web** (`ds8s3hjin60qs6g7s0iqkixs`) | **`d399b5b66419ed1faf76454b380acd14bf9ea80c`** | **Yes** — `worker-all` + prevention libs |
| **Voice “scheduler” container** | **`d399b5b66419ed1faf76454b380acd14bf9ea80c`** (redeployed 2026-10-13) | **No** — voice runtime only |

Prevention (in web image): `needs_reauth` eligibility, routine coalesce idempotency, reconcile caps, deferred follow-up guards — see `microsoft-routine-sync-eligibility.ts`, `microsoft-reconcile-discovery.ts`, `microsoft-routine-sync-coalesce.ts`.

---

## 6. Current health (post nuclear reset, read-only)

| Metric | Value |
|--------|------:|
| `calendar_connection_sync` pending (PG) | **0** |
| Microsoft connections | **0** |
| `bull:default:wait` | **0** |
| `bull:maintenance:wait` | **~31** (normal minute ticks) |
| Redis `used_memory` | **~5.7 MiB** / 768 MiB cap |

Workers are processing non-calendar maintenance jobs (logs show maintenance/CRM activity).

---

## 7. Code changes required for consumption incident

**None beyond enqueue prevention already merged** — the consumer path was correct but **mathematically unable** to drain a load-test-scale enqueue rate on 4-wide concurrency with a full Redis instance.

Optional future **capacity** work (out of scope for this RCA): dedicated calendar worker or higher `BULLMQ_DEFAULT_CONCURRENCY` — **not** a substitute for prevention on prelaunch.

---

## 8. Ready for one controlled Microsoft OAuth E2E?

| Gate | Status |
|------|--------|
| Backlog cleared | **Yes** |
| Redis healthy | **Yes** |
| Web on prevention commit | **Yes** (`d399b5b66`) |
| Proof single job lifecycle in prod | **Deferred** — do **not** enqueue calendar sync until intentional OAuth test |
| Isolated automated tests | Coalesce/eligibility tests exist; run in CI with server preload |

**Recommendation:** Run **one** manual OAuth connect test; watch `bull:default:wait`, PG `job_queue` count, and logs for `bullmq_job_received` / terminal `completed` or actionable `failed` — not unbounded `pending` growth.

---

## 9. Answers to the eight investigation questions

1. **Which process should have consumed calendar jobs?** Web embedded `worker-all` → BullMQ `default` worker.  
2. **Was it running?** **Yes** — logs + Redis `active` > 0 at probe.  
3. **If running, why weren’t jobs completing?** Fast-fail on invalid tokens + retry/backoff + queue depth; then Redis OOM impeded Redis-side progress and dual-write.  
4. **Jobs in BullMQ, PG, or both?** **Both**; PG count **exceeded** Redis wait when OOM blocked enqueue/outbox.  
5. **Why did backlog keep growing?** Reconcile + minute buckets + scale-test connections >> worker throughput.  
6. **Specific cause?** Scale-test enqueue storm + `noeviction` Redis OOM — **not** missing registration.  
7. **Protections that failed?** Scale-test guard on production DB, reconcile eligibility for `needs_reauth`, coalescing — **fixed in `d399b5b66`**, not deployed during incident peak.

---

*Dedicated Appointment Reminders worker: defer until one controlled Microsoft sync E2E passes after this report.*
