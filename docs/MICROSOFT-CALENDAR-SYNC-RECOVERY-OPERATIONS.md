# Microsoft calendar sync — recovery operations (approved plan)

**Status:** Implementation phase — **no destructive production cleanup without explicit approval of scope.**  
**RCA:** [MICROSOFT-CALENDAR-SYNC-REDIS-OOM-RCA.md](./MICROSOFT-CALENDAR-SYNC-REDIS-OOM-RCA.md)

---

## Code changes (prevent recurrence) — deploy before cleanup

1. **Routine reconcile** skips Microsoft connections that cannot authenticate (`needs_reauth` without stored credentials); pauses rediscovery for 24h (`markMicrosoftConnectionPausedForReauth`).
2. **Per-connection coalescing** for routine sync: stable idempotency key `calendar-sync-routine-{connectionId}-inc`; skips enqueue when any outstanding `calendar-sync-{connectionId}-*` job exists; sets `config.microsoftRoutineSyncDeferred` when skipping.
3. **After successful sync**, deferred flag triggers **one** follow-up routine job if needed.
4. **Webhooks / manual full sync** unchanged (event-driven minute buckets + chaser).
5. **Scale tests** blocked on `NODE_ENV=production` unless `AR_SCALE_TEST_ALLOW_PRODUCTION=1` on an isolated database.

Deploy web (+ scheduler if it enqueues calendar jobs) **before** deleting backlog so enqueue stops growing.

---

## Phase A — Dry-run and scope approval (read-only)

Run on production web container:

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-production-rca-sequential.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-calendar-sync-cleanup-dry-run.ts
```

Export connection ID lists:

| Class | Rule | Action after approval |
|-------|------|------------------------|
| **Disposable** | `sim-ms-conn-*`, `mctb_p0pf_*` workspaces, `AR_SCALE_TEST_DO_NOT_USE` workspace, `Sim Microsoft *` names | Cancel pending `calendar_connection_sync` + BullMQ entries in batches |
| **Protected** | `ws_1` (and `CALENDAR_CLEANUP_PROTECT_WORKSPACE_IDS`), `connected` + `credentialsRef` | Keep jobs; consolidate to one routine sync per connection |
| **Manual review** | Everything else (e.g. `cmv1fjw…` scale workspace without prefix) | Human sign-off on workspace list |

**Do not delete:** `microsoft_calendar_webhook_process`, `ar_*`, `mctb_*`, `sms-send`, or non-`calendar_connection_sync` types.

Present **exact counts** and **first/last job id ranges** per batch in chat before execution.

---

## Phase B — Pause producers/consumers (coordinated)

1. **Deploy** recurrence-fix build (above).
2. Optionally set a maintenance flag / pause reconcile enqueue (if added) — *only if needed after deploy*.
3. Note **SMS worker + web worker:all** share Redis — plan for brief reduced throughput during cleanup batches.
4. **Do not** restore an old Redis snapshot while DB `job_queue` has moved forward (risk replay/loss of SMS). Snapshots are for **forensics**, not default rollback.

---

## Phase C — Redis headroom (ops)

1. On Coolify host: verify **actual RAM** available to `transovo-bullmq-redis` (not only `maxmemory` config).
2. If host has capacity: raise `maxmemory` (e.g. 768 MiB → **2 GiB**) **before** large BullMQ deletes so Lua scripts succeed.
3. Record `INFO memory` before/after each step.

---

## Phase D — Batched cleanup (after scope approval)

Per batch (e.g. 5k–10k jobs):

1. Delete/cancel **Postgres** `job_queue` rows for approved disposable `connectionId`s (status pending/deferred only).
2. Remove matching **BullMQ** jobs (job id = idempotency key or mapped job id — use existing admin tooling; keep Redis/Postgres consistent).
3. Log: batch id, connection ids, job count, Redis `used_memory`, pending sync total.
4. **Verify:** no growth in pending count for 15 minutes; spot-check protected `ws_1` jobs untouched.

Repeat until disposable scope exhausted, then **consolidate** protected connections (keep one routine sync each).

---

## Phase E — Resume and verify

- [ ] `calendar_connection_sync` processing > 0 sustained  
- [ ] Pending total decreasing  
- [ ] `ws_1` event → import → reminder  
- [ ] No Redis OOM in web/SMS logs for 30 minutes  
- [ ] SMS heartbeat `queuedCount` stable  

---

## Phase F — After recovery (separate work)

- Measure real sync throughput and Graph 429s.  
- Dedicated **calendar/AR worker** (existing handlers, bounded concurrency) — capacity isolation, not emergency fix.  
- Web must not double-consume calendar jobs.

---

## Rollback (careful)

- **Code:** redeploy previous image.  
- **Data:** PITR Postgres for `job_queue` if a batch targeted wrong ids.  
- **Redis:** avoid full snapshot restore unless all consumers stopped and DB aligned — prefer forward fix.
