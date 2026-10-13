# Microsoft calendar sync recovery — status & execution plan

**Last updated:** 2026-10-13 UTC  
**Production cleanup:** Not executed (no deletions, Redis flush, or `maxmemory` changes).

**Related docs:**

- [MICROSOFT-CALENDAR-SYNC-REDIS-OOM-RCA.md](./MICROSOFT-CALENDAR-SYNC-REDIS-OOM-RCA.md)
- [MICROSOFT-CALENDAR-SYNC-RECOVERY-OPERATIONS.md](./MICROSOFT-CALENDAR-SYNC-RECOVERY-OPERATIONS.md)

**Code:** Merged to `master` — prevention `756095f1e`, export fix `0894268ad` (verify via `GET https://transovo.ai/api/health` → `commitSha`).

**PRs:** RCA #649 · prevention/cleanup prep #650

---

## Executive summary

Root cause: **load-test / invalid-token Microsoft connections** + **reconcile enqueue** + **minute-bucket job accumulation** → **Redis OOM** (~693k pending `calendar_connection_sync`). **Not** fundamental calendar architecture failure.

Prevention code is on `master`. **Dedicated AR worker** waits until backlog is removed and real sync is verified.

---

## 1. Stranding / deferred sync (coalescing safety)

Routine reconcile must not strand connections when jobs fail, are canceled, or stick in `processing`.

| Mechanism | Behavior |
|-----------|----------|
| **Stale `processing` locks** | Locks older than **45 minutes** (`CALENDAR_SYNC_STUCK_PROCESSING_MS`) do **not** block new routine enqueue |
| **After terminal BullMQ job** | On `calendar_connection_sync` **completed** or **`JobFailedError`**, `notifyCalendarConnectionSyncJobTerminal` runs deferred follow-up |
| **After partial/failed Microsoft sync** | `processDeferredRoutineCalendarSyncAfterJobTerminal` runs on the **failure** branch as well as success |
| **Reconcile tick** | Flushes deferred work **before** skip-if-queued: `deferred=true` + no blocking job → **one** follow-up enqueue |

Deferred recovery is **not** tied to success only.

---

## 2. Prevention code (deployed via `master`)

- **Reauth without credentials:** no routine enqueue; **24h** rediscovery pause (`markMicrosoftConnectionPausedForReauth`).
- **Routine coalescing:** stable key `calendar-sync-routine-{connectionId}-inc`; skip if any outstanding `calendar-sync-{connectionId}-*` job (unless stale lock).
- **`microsoftRoutineSyncDeferred`** on connection config when reconcile skips due to existing queue work.
- **Webhooks / manual sync:** unchanged (event-driven minute buckets + chaser).
- **Scale tests:** require **`AR_SCALE_TEST_DATABASE_URL`** and **`AR_SCALE_TEST_REDIS_URL`** to match live `DATABASE_URL` / `REDIS_URL` (isolated sandbox). `AR_SCALE_TEST_ALLOW_PRODUCTION=1` is last resort for non-production DB only.

**Tests (local):** `microsoft-routine-sync-eligibility.test.ts`, `microsoft-routine-sync-coalesce.test.ts` — PASS.

**Deploy verification:**

1. `GET https://transovo.ai/api/health` → `commitSha` ≥ `0894268ad`.
2. Coolify **web** auto-deploys on `master` push; **scheduler** (`trransovo-smscheduler`) does **not** — redeploy only if that service runs its own maintenance workers with stale calendar code. Reconcile **logic** runs when `calendar_connections_reconcile` is handled on the **maintenance** consumer (typically web `worker:all`).

---

## 3. Production RCA numbers (read-only probes)

### Redis / BullMQ (approx. 2026-10-12)

| Item | Value |
|------|--------|
| `maxmemory` | **768 MiB** |
| `used_memory` | **~872–873 MiB** (above limit) |
| Policy | **`noeviction`** |
| `bull:default:wait` | **~426k** |
| `bull:maintenance:wait` | **~15.7k** |
| AR / MCTB / `sms-send` wait (Redis) | **0** at probe |

### Microsoft connections

| Segment | Count |
|---------|------:|
| Total Microsoft | **23,584** |
| `connected` | **3** |
| `needs_reauth` | **23,580** |
| Workspace `mctb_p0pf_*` | **22,580** |
| `ws_1` connections | **2** |

### Pending `calendar_connection_sync` jobs

| Bucket | Jobs |
|--------|-----:|
| Total pending | **~693,157** |
| `mctb_p0pf_*` workspaces | **~663,360** (~96%) |
| Other (needs classification) | **~29,797** |
| `ws_1` | **6** |
| Processing | **0** |
| Oldest `runAfter` | **~2026-10-08** (~108 h) |

### Reconcile vs enqueue (7 days)

| Metric | Count |
|--------|------:|
| `calendar_connections_reconcile` created | **4,357** |
| `calendar_connection_sync` created | **693,212** |

### Cross-product (`job_queue` at probe)

| Type | Pending |
|------|--------:|
| `ar_*` | **0** |
| `mctb_*` | **0** |
| `sms-send` | **0** |
| `microsoft_calendar_webhook_process` | **2** (preserve) |

---

## 4. Dry-run export (connection inventory, 2026-10-12)

Full connection pagination on production:

| Class | Count | Notes |
|--------|------:|--------|
| **Disposable** | **23,580** | `mctb_p0pf_*`, `sim-ms-conn-*`, workspace **`cmv1fjwpl5d1d4a4c57572822`** (`AR_SCALE_TEST_DO_NOT_USE`) |
| **Protected** | **2** | `ws_1` / `connected` + `credentialsRef` rules |
| **Manual review** | **2** connections | Workspaces **`cmut0q7nc6o3w1n0o3o1i0w41`**, **`cmv1cl1nd4s5h271j1e2j7028`** |

**Review bucket:** Most “other” jobs still sit on **`mctb_p0pf_*` workspace IDs** (e.g. `mctb_p0pf_aed17cd5`). Export classifies by **workspace prefix** and connection ID. The two non–`mctb_p0pf` **connection** workspaces above need explicit sign-off before delete.

**Scripts (read-only export):**

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  EXPORT_DIR=/tmp/calendar-cleanup-export \
  npx tsx scripts/ar-calendar-sync-cleanup-export.ts
```

Outputs: `disposable-connection-ids.json`, `protected-connection-ids.json`, `review-connection-ids.json`, `cleanup-scope-summary.json`.

**Excluded from calendar-sync cleanup:** webhook jobs, `ar_*`, `mctb_*`, `sms-send`, unrelated queues.

---

## 5. Coolify host / Redis memory (read-only)

| | |
|--|--|
| **Host** | **7.6 GiB** RAM, **~4.5 GiB available** (swap in use) |
| **Redis container** (`transovo-bullmq-redis`) | **~886.6 MiB / 896 MiB** limit (**~99%**) |
| **Docker memory limit** | **~896 MiB** |
| **Redis `maxmemory`** | **768 MiB**, **`noeviction`** |

Raising headroom is **feasible on the host** but must include **container memory limit** + backlog reduction — not `maxmemory` alone. **Do not** restore an old Redis snapshot after SMS/DB have moved forward without coordinating all consumers.

---

## 6. Cleanup scripts (prepared, not executed)

| Script | Role |
|--------|------|
| `scripts/ar-calendar-sync-cleanup-export.ts` | Full ID lists + summary JSON |
| `scripts/ar-calendar-sync-cleanup-batch.ts` | **`DRY_RUN=1` default**, checkpoint, Postgres + optional BullMQ remove |

**Batch script (dry-run example):**

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  DRY_RUN=1 \
  DISPOSABLE_CONNECTION_IDS_FILE=/path/disposable-connection-ids.json \
  BATCH_SIZE=500 \
  npx tsx scripts/ar-calendar-sync-cleanup-batch.ts
```

Set `DRY_RUN=0` only after explicit approval.

---

## 7. Proposed execution sequence (approval required)

1. **Deploy** `0894268ad` → confirm `/api/health` → optional scheduler redeploy if needed.
2. **Re-run full export** on production (paginated job counts on latest script).
3. **Confirm** pending `calendar_connection_sync` stops growing (prevention guards live).
4. **Redis:** increase container limit + `maxmemory` only after host RAM check (e.g. 2 GiB container target — operator choice).
5. **Batch cleanup** disposable only: `DISPOSABLE_CONNECTION_IDS_FILE`, batches ~5k, log `CLEANUP_BATCH_LOG`, verify pending ↓ + SMS heartbeat after each batch.
6. **Classify** ~29,797 review jobs using exported workspace/connection IDs — **no** blind delete.
7. **Verify:** `ws_1` sync/reminders, no OOM 30+ min, MCTB/SMS paths healthy.

**Do not:** `FLUSHALL`, blind delete 693k rows, or fix calendar by adding a worker before Redis + backlog are addressed.

---

## 8. Cleanup approval matrix

| Category | Proposed treatment | Approx. scale | Approved? |
|----------|-------------------|---------------|-----------|
| `mctb_p0pf_*` + sim scale-test connections/jobs | Controlled batch remove | **~663,360** jobs, **23,580** connections | **Pending** |
| Review bucket (non-prefix sim workspaces) | Classify by workspace ID | **~29,797** jobs, **2** connection workspaces listed | **Pending** |
| `ws_1` + legitimate `connected` + credentials | **Protected** | **6** jobs on `ws_1`, **3** connected MS rows | **Never delete without review** |
| Webhooks, AR, MCTB, SMS, other queues | **Excluded** | — | — |

---

## 9. Dedicated AR / calendar worker

**After:** artificial backlog removed + real Microsoft sync verified.  
**Purpose:** capacity isolation, not emergency OOM fix.  
**Do not:** rewrite Microsoft sync, change reconcile interval instead of fixing enqueue, or create a second SMS delivery system.

---

## 10. Investigation scripts (read-only)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-production-rca-sequential.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-production-redis-oom-rca.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-calendar-sync-cleanup-dry-run.ts
```

**Note:** Supabase Prisma compat does not run arbitrary `$queryRaw` SQL — use sequential `count()` / paginated `findMany` for production.

---

## 11. Decisions pending from operator

1. Approve **disposable-only** cleanup (~663k jobs + matching connections).
2. Approve **review bucket** classification for ~29,797 jobs (workspace IDs above + full export).
3. Approve **Redis container limit** increase (suggested discussion: 2 GiB container + proportional `maxmemory`).

**No destructive production action until explicit approval.**
