# Microsoft calendar sync — Redis OOM root-cause investigation (read-only)

**Probed:** 2026-10-12 UTC (production web container + BullMQ Redis)  
**Scripts:** `scripts/ar-production-redis-oom-rca.ts`, `scripts/ar-production-rca-sequential.ts`  
**No production mutations** were performed for this investigation.

**Related:** [MICROSOFT-CALENDAR-SYNC-PRODUCTION-THROUGHPUT.md](./MICROSOFT-CALENDAR-SYNC-PRODUCTION-THROUGHPUT.md), [MICROSOFT-CALENDAR-SYNC-WORKER-AUDIT.md](./MICROSOFT-CALENDAR-SYNC-WORKER-AUDIT.md)

---

## Executive summary

| Finding | Evidence |
|--------|----------|
| **Active failure: Redis at hard limit** | `used_memory` ~**873 MiB** vs `maxmemory` **768 MiB**; policy **`noeviction`** → BullMQ Lua scripts fail with OOM |
| **Calendar sync stalled** | **693,157** pending `calendar_connection_sync`; **0** processing; oldest `runAfter` **2026-10-08T04:47:02Z** (~**108 h**) |
| **Backlog is mostly load-test / perf data** | **22,580** of **23,584** Microsoft connections use workspace prefix `mctb_p0pf_*`; **663,360** pending sync jobs (~**96%**) on those workspaces |
| **Real customer surface is tiny** | **3** `connected` Microsoft connections; **`ws_1`** has **6** pending sync jobs |
| **23,580** connections are **`needs_reauth`** (invalid tokens) but still **`syncEnabled`** + import calendars → reconcile treats them as due |
| **Reconcile keeps feeding the queue** | **4,357** `calendar_connections_reconcile` jobs created in 7d; **693,212** `calendar_connection_sync` jobs created in 7d (~**750/tick × 5 min** discovery budget pattern) |
| **AR / MCTB / sms-send DB backlog** | **0** pending `ar_*`, **0** pending `mctb_*`, **0** pending `sms-send` in `job_queue` at probe time |
| **Redis still hosts huge `default` + `maintenance` waits** | `bull:default:wait` ~**426k**; `bull:maintenance:wait` ~**15.7k** — SMS worker errors on OOM affect **all** BullMQ consumers |

**Conclusion:** Production calendar sync is down because **Redis cannot allocate more memory**, while **scheduled reconcile discovery** continues to enqueue work for **~23k connections (mostly scale-test / invalid-token rows)**. Fixing Graph limits or reconcile interval **before** Redis + backlog control will not restore service. A **dedicated worker** is still the right **Phase 3** capacity/isolation step **after** Phase 1–2 recovery.

---

## 1. Redis memory and BullMQ queues

**Source:** `ar-production-redis-oom-rca.ts` (app Redis URL — `transovo-bullmq-redis`).

| Setting / metric | Value |
|------------------|--------|
| `maxmemory` | **805,306,368** bytes (**768 MiB** configured) |
| `maxmemory-policy` | **`noeviction`** |
| `used_memory` | **~872.7 MiB** (above limit — OOM on write-heavy BullMQ ops) |
| `mem_fragmentation_ratio` | **~0.17** (low — not a fragmentation false alarm) |
| `evicted_keys` | **0** (expected with `noeviction`) |
| Approx. keys | **~457,107**; **~2 KB/key** average |

**BullMQ list sizes (Redis, not Postgres):**

| Queue | `wait` | `active` | `delayed` | `failed` (zset) |
|-------|-------:|---------:|----------:|------------------:|
| `default` | **426,054** | **110** | **171** | **5,000** |
| `maintenance` | **15,757** | **42** | **0** | **245** |
| `appointment_reminders` | 0 | 0 | 0 | 0 |
| `mctb` | 0 | 0 | 0 | 2,040 |
| `sms-send` | 0 | 0 | 0 | 3 |

**What consumes memory:** Almost all sampled keys are under the `bull:` prefix. The dataset is dominated by **job payloads + wait/delayed/active structures** for **`default`** (calendar sync and co-located job types) and **`maintenance`**. Postgres `job_queue` row count and Redis wait depth are **both** large — dual materialization is expected in BullMQ mode.

**Operational implication:** With **`noeviction`**, there is **no safe pressure relief** — the instance must **grow memory** and/or **reduce stored job count** (completed job retention, backlog collapse, queue hygiene). Increasing concurrency **before** headroom worsens OOM churn.

---

## 2. Why 23,584 Microsoft connections?

**Source:** `ar-production-rca-sequential.ts` (sequential `count()` — reliable via Supabase compat).

| Bucket | Count |
|--------|------:|
| Microsoft connections **total** | **23,584** |
| Status **`connected`** | **3** |
| Status **`needs_reauth`** | **23,580** |
| Status **`disconnected`** | **1** |
| Workspace `sim-*` | **0** |
| Workspace **`mctb_p0pf_*`** | **22,580** |
| Workspace **`ws_1`** | **2** connections |

**Recent rows (sample):** IDs like `sim-ms-conn-999-…`, names `Sim Microsoft N`, workspace `cmv1fjwpl5d1d4a4c57572822`, **`needs_reauth`**, `credentialsRef: null`, `lastSyncAt: null`, `syncEnabled: true`, `importCalendarIds: ["primary"]`.

**Interpretation (high confidence):**

- The **~23k figure is not active customer mailboxes**. It matches **AR/Microsoft scale / reconcile perf tests** (`scripts/test-microsoft-reconcile-scale.ts`, `scripts/lib/ar-scale-test-workspace.ts`, MCTB perf workspaces `mctb_p0pf_*` per `scripts/test-mctb-onboarding-lifecycle-p0-proof.ts`).
- **`needs_reauth` without credentials** still passes `shouldImportFromConnection()` (`syncEnabled` + `importCalendarIds`) and is included in reconcile discovery (`status in connected, needs_reauth`).
- **Only 3 connected** Microsoft rows are plausible “real” OAuth mailboxes; **`ws_1`** is the known production test tenant.

**Gap:** Without direct SQL (Supabase compat **`$queryRaw` returns empty**), we could not run percentile age/priority histograms on the full 693k rows in one query. Counts and sampling above are authoritative.

---

## 3. The ~693k `calendar_connection_sync` backlog

| Metric | Value |
|--------|------:|
| Pending + deferred | **693,157** |
| Processing | **0** |
| Created in last **7 days** | **693,212** |
| Pending on **`mctb_p0pf_*`** workspaces | **663,360** (~**95.7%**) |
| Pending on **`ws_1`** | **6** |
| Pending `microsoft_calendar_webhook_process` | **2** |

**Oldest pending (spot-check):** `ws_1`, connection `cmu1uq7f15s1o5s4f6c5b6a57`, **full** sync (`incremental: false`), `runAfter` **2026-10-08T04:47:02Z**, priority **50**.

**Sample of 1,000 pending rows (PostgREST `findMany` cap):** **842** distinct `connectionId`s; **≤2** jobs per connection in sample; **priority 25** dominates (reconcile path). Chaser keys **0** in sample.

**Duplicate semantics (code):**

- Idempotency: `calendar-sync-{connectionId}-{inc|full}-{minuteBucket}` (`import-sync.ts`).
- **A new pending row can be created every minute** per connection while older rows remain pending → **depth grows without bound** if workers do not complete.
- Reconcile enqueues **incremental** at **priority 25** up to **750 connections per tick** (default budget), every **`calendar_connections_reconcile`** cycle (~1 min scheduler, **5 min** sync interval per connection after lease).

**Rough capacity check:** 22,580 due connections ÷ 750 per tick ≈ **31 ticks** to touch all once ≈ **~31 minutes** of discovery if nothing completes. Over **~4.5 days** of stall, repeated discovery with minute idempotency easily produces **tens of jobs per connection** and **hundreds of thousands** aggregate — consistent with **~29 jobs/connection** (693k ÷ 23.5k).

**Are jobs “duplicate or obsolete”?**

- **For a given connection, almost all pending incremental syncs are redundant** once checkpoints (`microsoftDeltaLinks`) are intact — **one** successful incremental supersedes prior queued recovery work **for that connection**.
- **Exception:** do not bulk-delete without per-connection checkpoint verification and without preserving **non-sync** work (below).

---

## 4. Reconcile vs backlog growth

| Metric (7d) | Count |
|-------------|------:|
| `calendar_connections_reconcile` **created** | **4,357** |
| `calendar_connection_sync` **created** | **693,212** |

Reconcile **orchestrator** jobs are low volume; **child sync enqueues** are the mass. Discovery **continues** while:

- Connections remain `connected` / `needs_reauth` with import enabled.
- `nextSyncDueAt` advances via `markMicrosoftSyncEnqueueLease` even when sync never runs.
- Workers cannot drain → minute buckets keep adding **new** `job_queue` rows.

**Two-minute enqueue lease** reduces duplicate enqueue **within the same minute bucket** but does **not** stop growth when **months of pending jobs** already exist and **throughput ≈ 0**.

---

## 5. Supersession and job types to preserve

| Job type | Replaceable by one incremental sync? | Notes |
|----------|--------------------------------------|--------|
| `calendar_connection_sync` (recovery/reconcile, priority 25, old `runAfter`) | **Usually yes** per connection | Verify `microsoftDeltaLinks` + token state; **full** sync may still be needed after checkpoint loss |
| `calendar_connection_sync` (priority 15, recent webhook) | **Case-by-case** | Often redundant after incremental; webhook job may carry targeted event hints |
| `microsoft_calendar_webhook_process` | **No** — separate pipeline | Only **2** pending at probe — keep |
| `ar_*` reminder delivery / scheduling | **No** | **0** pending at probe — preserve in any cleanup logic |
| `sms-send`, `mctb_*` | **No** | **0** pending in DB; Redis `sms-send` wait **0** |

**Reminder delivery** must never be bulk-deleted as part of calendar backlog collapse.

---

## 6. Cross-product impact (OOM)

| Surface | Impact at probe |
|---------|------------------|
| **Calendar import / AR webhook path** | **Stalled** (no sync processing) |
| **`job_queue` AR/MCTB/sms** | **No large pending counts** |
| **Redis `default` / `maintenance`** | **Very large waits** — embedded web `worker:all` and SMS worker **share Redis**; logs show **OOM on worker errors** and **enqueue failures** for calendar sync |
| **MCTB voice/SMS** | Not proven broken by this probe alone, but **shared Redis OOM is a fleet risk** |

Any remediation must **verify SMS dispatch heartbeats** and a **test send** after Redis headroom is restored.

---

## 7. Proposed recovery sequence (for approval — not executed)

### Phase 0 — Backup and freeze (read-only until approved)

1. **Redis:** `BGSAVE` or host snapshot of `transovo-bullmq-redis` volume; record `INFO memory`, `DBSIZE`, and queue depths.
2. **Postgres:** snapshot / PITR note for `job_queue`, `voice_calendar_connections`, `microsoft_delta_links`.
3. **Temporarily pause reconcile enqueue** (feature flag or scheduler flag) **only after** backup — *requires explicit approval*; stops bleeding.

### Phase 1 — Stop generating unnecessary work (data hygiene, not Redis flush)

1. **Mark scale-test connections inactive** for sync: set `syncEnabled: false` or move to `disconnected` for:
   - All `mctb_p0pf_*` workspaces’ Microsoft connections, and
   - Scale workspace `cmv1fjw…` / `sim-ms-conn-*` rows (after ID list export).
2. **Exclude `needs_reauth` without `credentialsRef`** from reconcile discovery (product code change) — prevents re-enqueue of token-dead rows.
3. **Document** retained **3 connected** + **`ws_1`** for continued AR certification.

**Expected effect:** Reconcile **stops adding** ~663k-class enqueue pressure; does **not** alone shrink Redis.

### Phase 2 — Controlled backlog reduction

1. **Raise Redis `maxmemory`** (e.g. 768 MiB → **2 GiB** minimum for breathing room) **or** add memory before deleting — *ops approval*.
2. **Collapse redundant `calendar_connection_sync` rows** (Postgres + BullMQ):
   - Per **production** connection (`ws_1` + verified customer connections): keep **one** pending incremental (newest `runAfter` or single fresh enqueue).
   - For **approved test partitions**: cancel pending sync jobs in batches with audit log (job id ranges, counts).
   - Use existing job cancel/completed APIs or migration script — **never** `FLUSHALL`.
3. **Trim BullMQ completed/failed retention** if configured to retain large failed sets (`default` failed zset **5,000** observed).

**Expected memory reduction:** Proportional to removed wait entries — rough order **hundreds of MB** if ~400k+ Redis wait jobs removed (validate with `INFO` after each batch).

### Phase 3 — Restore processing + verify

1. Confirm **web embedded `worker:all`** drains `default` (or temporarily raise `BULLMQ_DEFAULT_CONCURRENCY` **only after** Redis headroom).
2. Watch **oldest pending `runAfter`**, **completed/hour** for `calendar_connection_sync`, **`ws_1`** manual event + reminder path.
3. **SMS worker** `/health` + heartbeat `queuedCount` trending down; spot-check MCTB dispatch.

### Phase 4 — Prevent recurrence (code / ops)

1. **Reconcile guardrails:** do not enqueue for `needs_reauth` / missing credentials; cap pending sync depth per connection (e.g. skip if >N pending).
2. **Scale tests:** hard-require `dryRun` or isolated Redis/DB; **mandatory cleanup** in `test-microsoft-reconcile-scale.ts` (already deletes connections — ensure **jobs** and **workspaces** are not left on prod).
3. **Monitoring:** alert on `calendar_connection_sync` pending count, Redis `used_memory` > 85%, oldest pending age.
4. **Then** implement **dedicated calendar/AR worker** (existing handlers, bounded concurrency, separate queue) — **not** before Phase 1–2.

### Rollback

- Restore Redis snapshot; restore `job_queue` from DB PITR if batch cancel went wrong.
- Re-enable reconcile only after queue depth and memory are stable.

### Verification checklist

- [ ] Redis `used_memory` < `maxmemory` with **≥15%** headroom  
- [ ] `calendar_connection_sync` **processing** > 0 sustained  
- [ ] Pending count **decreasing** hour-over-hour  
- [ ] `ws_1` calendar event → import → reminder path within SLA  
- [ ] No `OOM command not allowed` in web/SMS worker logs for **30 min**  
- [ ] MCTB SMS heartbeat healthy  

---

## 8. Investigation limitations

- **Supabase Prisma compat:** `$queryRaw` does not execute SQL — age histograms and global percentiles in `ar-production-redis-oom-rca.ts` return **empty** in production. Use **direct Postgres** (service role) or extend **sequential `count()` / batched `findMany`** for future probes.
- **PostgREST row caps:** `groupBy` / `findMany` may return **≤1000** rows — always use **`count()` with filters** for totals.

---

## 9. Answer to “dedicated worker first?”

**No.** A dedicated worker **increases dequeue attempts** against the same Redis and the same **693k** rows. **First:** Redis headroom + stop enqueueing for dead/test connections + controlled backlog collapse. **Then:** dedicated worker and reconcile interval tuning based on **measured** sync throughput.
