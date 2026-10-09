# Microsoft calendar sync — verification status (copyable)

**Date:** 2026-10-09 (UTC)  
**Scope:** Post-audit verification for PR #625 / branch `cursor/ar-microsoft-calendar-sync-fix-f350`  
**Related:** `docs/AR-MICROSOFT-GRAPH-CALENDAR-SYNC-AUDIT.md`

---

## Deploy status (do not treat the branch as production)

| Check | Result |
|--------|--------|
| Fix on `master` | **No** — commit `52b313a86` is only on `cursor/ar-microsoft-calendar-sync-fix-f350` |
| Production `/api/health` `commitSha` | **`90b938c1dfaf07841a7629161df1a334609c9a03`** (web container image matches) |
| PR | **#625** (draft); CI had unrelated failures (voice-agent-runtime, number-marketplace) at time of check |

**Conclusion:** Delta merge, delta-link failure handling, and chaser jobs are **not in production**. Post-deploy tests 1–4 are **blocked** until merge + Coolify web deploy (and worker/scheduler if those paths matter).

---

## Problem / finding summary

| Problem | Finding | Status |
|---------|---------|--------|
| Delta tokens disappearing | Final sync writes an older configuration snapshot over newer delta state | Fix written (branch), **not deployed** |
| Incomplete delta rounds | Sync could proceed without a completed delta checkpoint | Fix written (branch), **not deployed** |
| Rapid webhook updates | Same-minute deduplication could suppress a follow-up sync | Chaser job added (branch), **not deployed** |
| Test2 time change missed | Bulk sync did not reflect latest Graph event at 13:48 UTC | **Root cause partly unresolved** |
| Subscription renewal | Maintenance exists in code | **Production execution not verified** (jobs stuck pending) |
| Periodic reconciliation | Maintenance exists in code | **Production execution not verified** (jobs stuck pending) |
| **Scheduler tick (Oct 9)** | `worker-all` BullMQ path only enqueued `campaign_send_batch` | **Fixed on master merge** — full `processDueJobs` + `drainCalendarMaintenanceFromDb` |

### Scheduler root cause (production `90b938c1`, fixed in merged release)

With `DISABLE_INPROCESS_WORKER=1` and `QUEUE_DRIVER=bullmq`, embedded `scripts/worker-all.ts` called only `campaign_send_batch` + `syncDbOutboxToBullmq` — **not** `processDueJobs()`. That explains Oct 9 **campaign** minute rows without **`calendar-reconcile:*`** rows. Merged code restores full minute scheduler + Postgres calendar maintenance drain.

---

## Test2: 13:48 vs 13:51 — what is resolved vs open

### Agreed distinction

- **Config overwrite** is a plausible, code-backed explanation for **empty `microsoftDeltaLinks`**.
- The **13:48 bulk miss** is **not closed** by delta persistence alone until demonstrated in production.

### Database evidence (ws_1, Test2)

| Field | Value |
|--------|--------|
| `startsAt` (current) | `2026-10-19T14:00:00.000Z` |
| `externalUpdatedAt` | `2026-10-09T13:50:56.895Z` |
| `lastExternalSyncAt` | `2026-10-09T13:51:19.711Z` |

This timing aligns with **targeted `GET /me/events/{id}` ~13:51**, not the **13:48** inline stale sync:

- Connection `lastSyncAt`: `2026-10-09T13:48:59.384Z`
- **No** `calendar_connection_sync` job in the 13:40–13:52 window → likely `maybeSyncStaleAppointmentRemindersCalendars` (15 min rule on calendar API).

### Still open for 13:48 UTC

At that moment we need (not replayable from logs alone):

1. Which synchronization path ran (delta bootstrap vs incremental vs discovery fallback).
2. Which calendars and date windows were queried.
3. Whether Test2 was in the Graph response set.
4. If returned, what `start` / `lastModifiedDateTime` Graph had.
5. If not returned, why discovery missed it.

### Hypotheses (not proven)

1. Stale or incomplete `calendarView/delta` page in that pass (no persisted `@odata.deltaLink` checkpoint).
2. Event discovery (window, pagination, instance identity).
3. Graph state timing — Oct 19 may not have been visible to the API at 13:48 even if the UI showed it later.

**Persisting delta may help in practice; production test 2 must prove it.**

---

## Post-deploy verification matrix

Run **after** deploy of fix commit `52b313a86` (or successor). Record for each row: UTC timestamp, Graph state, DB state, `job_queue.id`, `idempotencyKey`, path (webhook targeted / delta / reconcile / stale API), **PASS/FAIL**.

| # | Test | Pre-fix status (2026-10-09) | Evidence |
|---|------|-------------------------------|----------|
| **1** | **Delta persistence** — two incremental syncs; nonempty delta link after first; survives second; second run uses persisted link | **NOT RUN** (fix not deployed) | `microsoftDeltaLinks` keys: **none** on connection `cmu1uq7f15s1o5s4f6c5b6a57` despite syncs |
| **2** | **External time change** — move Outlook appointment without manual Transovo sync; Graph and DB converge; note path when **no webhook** | **NOT RUN** | Reconcile backstop **not executing** (maintenance queue; see below) |
| **3** | **Rapid updates** — create + edit while first sync processing; chaser runs with **distinct** idempotency key; DB matches final Graph | **NOT RUN** | Chaser only on fix branch |
| **4** | **Concurrency** — simultaneous sync/config writes must not wipe `microsoftDeltaLinks`; reproduce race if merge is insufficient | **Analysis only** | See atomicity section |

---

## `mergeCalendarConnectionConfig` — is it atomic?

**No.** It is **read → merge in application memory → full `config` JSON write** via `updateWorkspaceCalendarConnection`.

What the fix does:

- Merge on **every** config write.
- Final sync **re-reads** the connection from DB, then merges before writing `lastSyncAt` / `lastSyncError: null`.
- Per-calendar delta entries: **newer `updatedAt` wins** when both sides have an entry.

What it fixes:

- Dominant bug: Sync A starts with snapshot without deltas; Sync B persists `microsoftDeltaLinks`; Sync A finishes with old snapshot and **overwrites** B.

Residual risk:

- Two writers can still **last-writer-wins** if they read the same revision and write overlapping merges (not serializable without DB-level JSON merge or row versioning).

**Smallest correction if test 4 fails:** SQL `jsonb` merge on `microsoftDeltaLinks`, or optimistic lock on connection `updatedAt`. **Do not implement until reproduced post-deploy.**

---

## Chaser job idempotency (fix branch)

- Primary key: `calendar-sync-{connectionId}-inc-{minuteBucket}` (or `full`).
- Chaser key: `{primaryKey}:chaser` — **distinct**, not deduped by the primary key.
- At most one chaser per minute bucket while prior chaser is pending/processing; new chaser allowed after chaser **completed** or **failed**.

Preserves coalescing for the first notification; schedules follow-up when a sync is already **`processing`**.

---

## Maintenance jobs — production verification (failed)

Queried production DB (2026-10-09 ~14:56 UTC):

| Job type | Queue | Observation |
|----------|-------|-------------|
| `calendar_connections_reconcile` | `maintenance` | **47 pending**, `attempts: 0` (sample: `calendar-reconcile:2026-10-08T11:57`) |
| `calendar_subscription_renew` | `maintenance` | **6 pending**; **no completed** `calendar_subscription_renew` found in sample |
| `calendar_connection_sync` | `default` | **Completes** (e.g. `2026-10-09T13:29:26Z` completed) |

Implications:

- Webhook → **default** queue → worker path **works** for ws_1 (e.g. E2E webhooks ~13:29).
- **Scheduled reconciliation and subscription renewal are not draining** on the maintenance queue — weakens **no-webhook** recovery and P5 verification until maintenance consumers run.
- Coolify: web app on `90b938c1d…`; scheduler container on **older** image `fc8a5a96…` (separate from web deploy).

---

## ws_1 Microsoft connection snapshot (audit time)

| Field | Value |
|--------|--------|
| Connection id | `cmu1uq7f15s1o5s4f6c5b6a57` |
| `lastSyncAt` | `2026-10-09T13:48:59.384Z` |
| `microsoftSubscription.id` | `41da1ac5-a2eb-4366-b514-19868b32c5b9` (prefix in config) |
| Subscription `expiresAt` | `2026-10-16T11:31:39.479Z` |
| `microsoftDeltaLinks` | **Empty** (no calendar keys) |
| `lastSyncError` | `null` |

---

## Merged release changes (master)

1. `mergeCalendarConnectionConfig` — deep-merge `microsoftDeltaLinks` (and preserve subscription/watch metadata when omitted from patch).
2. Final `syncWorkspaceCalendarConnection` write merges with **fresh** DB config.
3. Delta bootstrap/incremental without `@odata.deltaLink` → error → existing discovery fallback in `import-sync.ts`.
4. `enqueueCalendarConnectionSync` — chaser job (+5s) when primary minute-bucket job is already `processing`.
5. `resolveMicrosoftCalendarViewSyncWindow` — stable UTC day bounds; reuse stored window until advance threshold.
6. `worker-all` BullMQ tick — `processDueJobs(40)` + `drainCalendarMaintenanceFromDb(8)`; calendar maintenance skips BullMQ enqueue.

**Constraints preserved:** webhook → queue → worker architecture; no Event Hubs; no broad reminder blocking on stale sync.

Local tests:

```bash
npx tsx scripts/test-calendar-config-merge.ts
npx tsx scripts/test-microsoft-delta-sync-window.ts
npx tsx scripts/test-calendar-maintenance-db-drain.ts
```

---

## Recommended next steps

1. **Merge + deploy** PR #625 (or cherry-pick), confirm `/api/health` `commitSha` includes fix.
2. **Restore maintenance queue processing** (scheduler/worker topology) so `calendar_connections_reconcile` and `calendar_subscription_renew` complete — required for meaningful test 2 without webhooks and for renewal proof.
3. Run tests **1–4** with runbook rows (timestamps, Graph, DB, job IDs, path, PASS/FAIL).
4. If any test fails, trace the **exact boundary** before further code changes.

---

## Assessment

Microsoft Graph **can** support this product (webhooks, imports, targeted event fetch proven on ws_1). Transovo must **consistently process and preserve** what Graph provides.

**Functionally working; not yet production-reliability verified** until delta persistence, missed-webhook recovery, concurrent update behavior, and maintenance jobs are proven in production after deploy.

---

## Governing sentence

**Do not treat a branch commit as a production fix. Verify merge, Coolify deploy, then run the four tests with evidence. Test2’s 13:48 bulk miss remains an open boundary until post-deploy observation or sync-time instrumentation proves otherwise.**
