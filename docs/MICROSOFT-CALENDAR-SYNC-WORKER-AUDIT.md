# Microsoft calendar sync — worker & Graph limits audit

Read-only audit of the **existing** Transovo implementation (no sync architecture redesign). Aligns with Microsoft guidance: change notifications first, bounded recovery second, honor throttling.

**Related:** PR #648 (per-calendar Graph subscriptions), `scripts/ar-microsoft-production-verification-probe.ts`, `MICROSOFT_CALENDAR_RECONCILE_MINUTES` / `MICROSOFT_CALENDAR_RECONCILE_BATCH`.

---

## Microsoft limits (context)

Outlook-relevant published limits that matter for this design:

- **10,000** API requests per **10 minutes** per **app + mailbox** combination.
- **4** concurrent requests per **app + mailbox** combination.

Broader tenant/app limits still apply. Different customers with different mailboxes do not share one mailbox bucket, but **multiple calendars on one mailbox share that mailbox’s limits**. Microsoft recommends **change notifications** and **change tracking** over continuous polling; on throttle, expect **HTTP 429** and **`Retry-After`** — workers must honor it.

---

## Target architecture (reference)

| Layer | Intent |
|--------|--------|
| Existing scheduler | Runs every minute; selects only due connections |
| Priority queue + deduplication | Webhook work first, recovery work second |
| Rate-limited worker pool | Global, tenant/mailbox limits |
| Incremental sync | Persist changes; advance checkpoint after success |

Controls already present or tunable via env in this repo (see below).

---

## Audit vs checklist

### 1. Is `nextSyncDueAt` staggered, or can thousands become due together?

**Partially staggered; herd risk remains at scale.**

| Mechanism | What it does |
|-----------|----------------|
| `staggerInitialMicrosoftSyncDueAt()` | On first schedule init, spreads due time across the reconcile interval using a hash of `connectionId` (`src/lib/calendar/microsoft-connection-schedule.ts`). |
| `nextMicrosoftSyncDueAfterSuccess()` | After a successful sync, next due = **now + interval** (phase preserved if connections started staggered). |
| `markMicrosoftSyncEnqueueLease()` | When reconcile enqueues syncs, bumps `nextSyncDueAt` by **2 minutes** so the same connections are not immediately re-selected. |
| `syncBackoffUntil` | Failed syncs push both backoff and `nextSyncDueAt` forward (exponential backoff + jitter). |

**Gaps / ops knobs:**

- Default interval is **`MICROSOFT_CALENDAR_RECONCILE_MINUTES` → 5** (not 15). A 15-minute baseline is a **config change**, not the current default.
- Discovery can enqueue up to **`MICROSOFT_CALENDAR_RECONCILE_BATCH` → 750** connections **per minute tick** (`src/lib/calendar/microsoft-reconcile-discovery.ts`). Bounded per tick, but many connections with `nextSyncDueAt = null` can still become due together after migrations or bulk connect.
- No dynamic shortening for “imminent appointments” or unhealthy subscriptions in schedule code—only fixed interval + backoff.

---

### 2. Hard limit on concurrent Microsoft API requests (including multiple workers)?

**Yes, but only inside a single Node process.**

`src/lib/microsoft/graph-mailbox-concurrency.ts`:

- **Global:** `MICROSOFT_GRAPH_GLOBAL_CONCURRENCY` (default **32**, max 128).
- **Per connection:** `MICROSOFT_GRAPH_MAILBOX_CONCURRENCY` (default **4**, max 8)—keyed by **`connectionId`**, not Microsoft user id (usually one connection ≈ one mailbox).

`microsoftGraphFetch()` in `src/lib/calendar/providers.ts` wraps Graph calls with those limits.

**Limits of this design:**

- Limits are **in-memory per process**. Multiple web replicas **do not share** one global cap (effective budget ≈ 32 × N unless env is tuned per instance).
- Delta sync uses `callMicrosoftGraph(..., ctx)` → goes through `microsoftGraphFetch` when `connectionId` is passed (`src/lib/calendar/microsoft-delta-sync.ts`).

Aligns with Microsoft’s **4 concurrent / app / mailbox** at a **single-worker** level; not a distributed fleet budget.

---

### 3. Can the same calendar be synchronized simultaneously by webhook and reconciliation?

**Coalesced at enqueue time; not fully mutexed at execution.**

`enqueueCalendarConnectionSync()` (`src/lib/calendar/import-sync.ts`):

- **One job per connection per minute** per mode: idempotency `calendar-sync-{connectionId}-{inc|full}-{minuteBucket}`.
- If a sync is **`processing`**, a single **chaser** job may be queued (`:chaser`, +5s).
- Webhook path: priority **15**; reconcile enqueue uses **25** (lower number = sooner in `enqueue-advance.ts`)—webhook-queued work is preferred.

**Still possible in parallel:**

- `microsoft_calendar_webhook_process` runs **`syncCalendarProviderEventById`** then enqueues a connection sync—targeted Graph reads can overlap a running `calendar_connection_sync`.
- **Full vs incremental** use different idempotency keys in the same minute → two jobs for one connection if both paths fire.

**Summary:** Good minute-level coalescing; not a strict “one active sync per calendar” lock.

---

### 4. Are 429 responses handled using `Retry-After`?

**At HTTP layer: yes. At sync scheduling: partial.**

- `sleepForGraphRetryAfter()` reads **`Retry-After`** (seconds or HTTP-date), caps wait at 120s, adds jitter.
- `microsoftGraphFetchInner()` retries up to **4 attempts** on **429** or **5xx**.
- Failed **sync jobs** call `markMicrosoftSyncFailure()` → `syncBackoffUntil` + delayed `nextSyncDueAt` (exponential backoff). Not always tied to a specific 429 body unless the sync throws after retries are exhausted.

---

### 5. Does maintenance enqueue work in bounded batches, with backpressure?

**Yes for reconcile/renew enqueue; consumer throughput is the bottleneck.**

| Layer | Bound |
|--------|--------|
| Scheduler | Minute tick enqueues `calendar_connections_reconcile` (idempotent per minute). |
| Discovery | Keyset pagination; stops at **budget** (default 750 enqueues/tick). |
| Subscription renew | **400**/tick batch (`microsoft-subscription-renewal-scheduler.ts`). |
| Maintenance DB drain (BullMQ mode) | `drainCalendarMaintenanceFromDb(5)` every **5s** on web—calendar maintenance job types only, not all `calendar_connection_sync`. |
| BullMQ | `maintenance` queue concurrency default **3**; `default` queue default **4** (`BULLMQ_*_CONCURRENCY` in `src/lib/jobs/bullmq.ts`). |

Reconcile **does not** call Graph in the scheduler—it only enqueues `calendar_connection_sync` jobs.

**Production note (2026-10-12):** `calendar_connection_sync` backlog was very large while `calendar_connections_reconcile` completed often—enqueue + default-queue drain exceeded worker capacity until SMS/web worker images caught up. Operational backpressure, not missing reconcile design.

---

### 6. Measured: requests/min, queue depth, oldest overdue calendar?

**Generic job metrics only; no dedicated Graph RPM dashboard.**

- `collectDispatchMetrics()` / `workerHeartbeat`: total `jobQueue` pending/processing, oldest due job age—not Microsoft-specific.
- `scripts/ar-microsoft-production-verification-probe.ts`: per–job-type backlog and 24h completed counts.
- Per-connection: `nextSyncDueAt`, `syncBackoffUntil`, `lastSyncAt`, `microsoftCalendarSyncState` on connection config.

**Missing:** Graph requests/minute, per-mailbox throttle hits, aggregate “oldest overdue `nextSyncDueAt`”—columns exist in DB but are not first-class metrics.

---

## Alignment with recommended architecture

| Principle | Repo today |
|-----------|------------|
| Webhooks primary | Graph subscriptions + `microsoft_calendar_webhook_process` + higher enqueue priority. |
| Recovery secondary, staggered | `nextSyncDueAt` + initial hash stagger + enqueue lease; default **5 min** interval. |
| Priority + dedup | Minute buckets + chaser; webhook priority 15. |
| Rate-limited pool | Global + per-connection in `microsoftGraphFetch`; **not cross-replica**. |
| Incremental + checkpoint | `syncMicrosoftCalendarDelta` + `microsoftDeltaLinks` committed after successful calendar loop. |
| Don’t sync everything every 5 min by default | Interval env-tunable; product default still **5 minutes**, not adaptive 15+ / health-based. |
| Don’t run thousands of Graph calls in Next scheduler | Scheduler only enqueues; sync runs in **`calendar_connection_sync`** on **`default` BullMQ queue** on the **web process** when `QUEUE_DRIVER=bullmq`. SMS worker does **not** drain `default`. |

**Scale caveat:** Recovery is bounded at enqueue time, but **execution** shares the web container’s `default` queue concurrency (~4).

---

## Microsoft subscription resource (`/me/events` vs per-calendar)

- **Read/sync** uses `me/calendars/{id}/events` delta when a specific calendar is imported.
- **PR #648** registers subscriptions on the same per-calendar resource pattern.
- **Production (`ws_1`):** Graph accepted `POST /subscriptions` with `me/calendars/{importedId}/events` (verified after manual ensure—not assumed from read paths alone).
- Legacy **`me/events`** subs can look “fresh” until migrated; `microsoftCalendarSubscriptionConfigIsCurrent()` (`7d35abd7f`) prevents ensure from skipping migration when import uses non-default calendar IDs.

---

## Recovery traffic (illustrative)

Example: **1,000** calendars, **15 min** interval, **2** Graph requests per sync, evenly staggered:

- ~67 syncs/min → ~134 requests/min (~2.2/s) recovery-only (excludes webhooks, renewals, retries, other Graph).

At **10,000** calendars / 15 min with 2 req/sync: ~667 syncs/min → ~22 req/s recovery-only—manageable with worker controls if drain keeps up.

---

## Practical ops tuning (no architecture rebuild)

1. Set **`MICROSOFT_CALENDAR_RECONCILE_MINUTES=15`** (or 30) if 5 min is too aggressive at 1k+ calendars.
2. Tune **`MICROSOFT_GRAPH_GLOBAL_CONCURRENCY`** / **`MICROSOFT_GRAPH_MAILBOX_CONCURRENCY`** (e.g. global 16–20, mailbox 2–4) and watch 429 rate.
3. Lower **`MICROSOFT_CALENDAR_RECONCILE_BATCH`** if enqueue outruns `default` queue drain.
4. Monitor: `jobQueue` backlog for `calendar_connection_sync` and `microsoft_calendar_webhook_process`; `workerHeartbeat.metricsJson`; oldest pending `runAfter` for those types.

**Scripts:**

```bash
# Production job activity (run in web container)
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-microsoft-production-verification-probe.ts

# Workspace snapshot (copy script to container or run after deploy)
WORKSPACE_ID=ws_1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-production-ws1-snapshot.ts

# Force per-calendar sub registration (ops)
WORKSPACE_ID=ws_1 CONNECTION_ID=<connectionId> NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-ensure-microsoft-subs.ts
```

---

## Bottom line

The codebase **already implements** staggered due times, bounded reconcile discovery, webhook-first priority, minute dedup, Graph 429 retries, and delta checkpoints, with in-process concurrency caps. It **does not** fully guarantee at very large scale: **fleet-wide** Graph budgeting, **strict one-sync-per-mailbox** execution, **adaptive** recovery intervals, or **dedicated** calendar sync workers off the web process—those are the main levers for predictable Graph usage without replacing the sync pipeline.

**Goal:** Not zero periodic API calls (missed notifications require recovery), but **predictable, bounded, proportional** request volume to active calendars.

---

## Key source files

| Area | Path |
|------|------|
| Reconcile interval / batch | `src/lib/calendar/microsoft-schedule-config.ts` |
| Stagger / success / failure schedule | `src/lib/calendar/microsoft-connection-schedule.ts` |
| Due discovery + enqueue lease | `src/lib/calendar/microsoft-reconcile-discovery.ts` |
| Sync enqueue dedup / chaser | `src/lib/calendar/import-sync.ts` |
| Delta incremental | `src/lib/calendar/microsoft-delta-sync.ts` |
| Graph fetch + 429 | `src/lib/calendar/providers.ts`, `src/lib/microsoft/graph-mailbox-concurrency.ts` |
| Webhooks / subscriptions | `src/lib/calendar/webhooks.ts` |
| Maintenance jobs | `src/lib/jobs/job-handlers.ts`, `src/lib/jobs/calendar-maintenance-db-drain.ts` |
| BullMQ concurrency | `src/lib/jobs/bullmq.ts` |
| In-process web worker | `src/lib/jobs/inprocess-worker.ts` |
