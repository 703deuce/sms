# Microsoft Graph calendar sync — webhook + delta + backstop (production status)

**Date:** 2026-10-09 (UTC)  
**Purpose:** Copyable snapshot of production evidence, Test2/Test3 interpretation, deploy status, Microsoft alignment, and next steps.  
**Related:** `docs/AR-MICROSOFT-GRAPH-CALENDAR-SYNC-AUDIT.md`, `docs/AR-MICROSOFT-CALENDAR-SYNC-VERIFICATION-STATUS.md`, PR #625, PR #626

---

## Production deploy status (checked ~16:13 UTC, 2026-10-09)

| Item | Value |
|------|--------|
| **Web `commitSha`** | `90b938c1dfaf07841a7629161df1a334609c9a03` (`fix(ar): faster Microsoft calendar webhook sync and calendar UI polling`) |
| **PR #625** (`cursor/ar-microsoft-calendar-sync-fix-f350`) | **Not on production** (branch tip `285887ad2…`) |
| **PR #626** (`cursor/ar-maintenance-queue-drain-f350`) | **Not on production** (branch tip `b73b19a7c…`) |
| **Web worker mode** | `EMBEDDED_JOB_WORKER=1`, `QUEUE_DRIVER=bullmq`, `DISABLE_INPROCESS_WORKER=1` |
| **Microsoft connection `cmu1uq7f15s1o5s4f6c5b6a57` (workspace `ws_1`)** | `connected`, `lastSyncAt` **2026-10-09T15:59:38.935Z**, `microsoftDeltaLinks` **empty** |
| **Maintenance backlog** | `calendar_connections_reconcile` / `calendar_subscription_renew` **pending = 0** (after emergency DB drain ~15:30 UTC) |
| **`calendar_connection_sync` pending** | **3** (stuck/pending rows still present) |

Delta persistence and config-merge hardening from #625 are **not** live. Maintenance Postgres drain from #626 is **not** live.

---

## Priority 1 — scheduler root cause (confirmed in code, production `90b938c1`)

**Symptom:** On 2026-10-09, `campaign-send-batch:2026-10-09*` rows exist (~1/minute) but **`calendar-reconcile:2026-10-09*` = 0** (and other `processDueJobs` minute ticks missing). Oct 8 reconcile rows only **completed** during the emergency DB drain (~15:30 UTC)—not proof of ongoing scheduling.

**Root cause:** With `QUEUE_DRIVER=bullmq`, embedded `scripts/worker-all.ts` on **`90b938c1` does not call `processDueJobs()`**. It only:

1. Enqueues `campaign_send_batch` for the current minute, and  
2. Runs `syncDbOutboxToBullmq(50)`.

Web has `DISABLE_INPROCESS_WORKER=1`, so the Next.js process does **not** run the full minute scheduler either. **`/api/jobs/process`** would enqueue all ticks, but there is no evidence those rows exist for Oct 9 unless cron calls it every minute.

**Fix (already on `cursor/ar-maintenance-queue-drain-f350`, commit `b73b19a7c`):** BullMQ `worker-all` interval calls **`processDueJobs(40)`** (full scheduler + outbox sync) and **`drainCalendarMaintenanceFromDb(8)`** for calendar maintenance jobs.

**Deploy verification (required after #626):**

- Within 2 minutes of deploy, DB must show new rows e.g. `calendar-reconcile:2026-10-09T16:xx` and `calendar-sub-renew:2026-10-09T16` completing (not only cleared backlog).
- Maintenance worker must process `calendar_connections_reconcile` → `reconcileWorkspaceCalendarConnections` → enqueue `calendar_connection_sync` when `lastSyncAt` > 15 min stale.

**Do not** shorten backstop to 5 minutes until this passes with dashboard closed.

---

## Priority 2 — delta window (moving range vs stable checkpoint)

**Issue:** `defaultSyncWindow()` for incremental sync sets `timeMax` from **`now`**, so `endDateTime` changes every sync. Microsoft `calendarView/delta` tokens are scoped to the original range; `syncWindowMatches()` then fails → **bootstrap every run** → poor efficiency and empty/missing `microsoftDeltaLinks` in prod.

**Fix (on maintenance branch + should ship with #625):**

- `resolveMicrosoftCalendarViewSyncWindow()` — UTC **calendar-day** `timeMin` / `timeMax` (stable within a UTC day).
- Reuse **stored** `windowStart` / `windowEnd` from `microsoftDeltaLinks` on incremental sync when still valid.
- `shouldAdvanceMicrosoftDeltaWindow()` — deliberate re-bootstrap when within **21 days** of stored `windowEnd`.

Test: `npx tsx scripts/test-microsoft-delta-sync-window.ts`

---

## Trigger responsibilities (target, keep separate)

| Trigger | Expected behavior |
|---------|-------------------|
| Microsoft webhook | Immediate sync (`syncCalendarProviderEventById` when id present + `calendar_connection_sync`) |
| No webhook | Scheduled `calendar_connections_reconcile` → stale connection sync (delta backstop) |
| Lifecycle `missed` / `subscriptionRemoved` | Recovery sync (+ re-subscribe where applicable) — **implemented** in `webhooks.ts` |
| Subscription near expiry | `calendar_subscription_renew` — **must run via scheduler** (blocked until Priority 1 fix deployed) |
| Reminder about to send | **Postpone** Graph pre-send until webhook+delta+backstop latency is measured |

---

## Test2 and Test3 — what reached Transovo

### Test2 → “Test2 new” (rename / move, no webhook for that event)

| Field | Value |
|--------|--------|
| Title in Transovo | **Test2 new** |
| Start | **2026-10-20T14:00:00.000Z** (30 min) |
| Outlook change stored | `externalUpdatedAt` **2026-10-09T15:58:16.641Z** |
| Transovo sync stamp | `lastExternalSyncAt` **2026-10-09T15:59:31.671Z** |
| Webhook for Test2 event id in that window | **None** |

### Test3 — new appointment (webhooks + sync job)

| Field | Value |
|--------|--------|
| Title | **Test3** |
| Start | **2026-10-13T17:45:00.000Z** |
| Created in Transovo | **2026-10-09T15:59:16.313Z** |
| Webhooks | **`created` 15:59:14.181Z**, **`updated` 15:59:17.329Z** (event id ending `…Q21RAAAAA=`) |
| `calendar_connection_sync` | Enqueued **15:59:17.896Z**, **completed 15:59:39.329Z** |

### Correcting the Test2 recovery path (important)

Earlier narrative suggested **inline stale-sync (opening AR calendar UI)**. Production timestamps fit a **different explanation**:

| Event | UTC |
|--------|-----|
| Test2 rename/move in Outlook | **15:58:16** |
| Test3 webhooks created / updated | **15:59:14** / **15:59:17** |
| `calendar_connection_sync` enqueued (webhook path) | **15:59:17** |
| Test2 `lastExternalSyncAt` | **15:59:31** |
| Sync job completed | **15:59:39** |

There was **no** `calendar_change` webhook for Test2’s event id in that window—only Test3. Test2 was updated during the **same webhook-triggered connection sync** that Test3 caused (batch import), not via a separate Test2 webhook.

**Mechanisms in play for that incident:**

1. **Webhook → optional targeted `GET /events/{id}` + `calendar_connection_sync` (delta / calendarView import)** — Test3 + piggybacked Test2.
2. **Not proven:** scheduled `calendar_connections_reconcile` while nobody uses the app.
3. **Possible but not required for this incident:** UI `maybeSyncStaleAppointmentRemindersCalendars` (15-minute gate on `GET /appointment-reminders/calendar/events`, including fire-and-forget on normal loads).

**Bottom line:** Test2 shows Transovo can learn Outlook state **without a webhook for that event**, but that run does **not** prove the **independent backstop**—it proves **another sync run** (here, webhook-driven) can pick up other events in the same batch.

---

## What the latest tests prove (matrix)

| Behavior | Result |
|----------|--------|
| Create an appointment in Outlook | **Verified** (Test3) |
| Edit immediately after creation | **Verified** (Test3 create + update webhooks) |
| Rename existing appointment | **Verified in DB** (Test2 new) |
| Move existing appointment to another date | **Verified in DB** (Test2 on Oct 20) |
| Recover without webhook for that event | **Verified** (Test2 in DB) |
| Recover **without anyone opening Transovo** | **Not yet verified** |
| Recover via **scheduled reconciliation only** | **Not yet verified** |
| Automatically detect deletion | **Not yet verified** |
| Persist `microsoftDeltaLinks` after fixes | **Not yet verified** (#625 not deployed; prod links empty) |

---

## Microsoft notification pattern (production evidence)

- **Creating** appointments tends to trigger webhooks.
- **Immediate edits after create** tend to trigger webhooks.
- **Moving/rescheduling existing** appointments has **not** consistently produced a visible webhook in these tests.
- Transovo can still retrieve those changes via **Graph synchronization** (connection sync / delta / calendarView / targeted GET).

Do not assume Microsoft never sends update notifications; subscriptions support updates. **Do not depend on webhooks alone** for every reschedule—delta + backstop are required (Microsoft’s documented model).

---

## Microsoft’s model vs Transovo today

| Microsoft recommendation | Transovo today | Verdict |
|--------------------------|----------------|---------|
| **Webhooks trigger sync** | `handleMicrosoftCalendarWebhook`: optional `syncCalendarProviderEventById`, then `enqueueCalendarConnectionSync` (priority 15) | **Works** |
| **Webhook-triggered delta** | Incremental `syncWorkspaceCalendarConnection` → `syncMicrosoftCalendarDelta` for Microsoft, calendarView fallback | **Works in code**; **delta checkpoint not persisted in prod** |
| **Persist delta state** | `persistDeltaLink` in `microsoft-delta-sync.ts` (window + `deltaLink` per calendar) | **Not verified in prod**; #625 tightens bootstrap/incremental |
| **Backstop when no notifications** | `reconcileWorkspaceCalendarConnections`: enqueue sync if `lastSyncAt` > **15 min**; minute job `calendar_connections_reconcile` from `processDueJobs` | **Designed**; **not reliably ticking on Oct 9** (see below) |
| **UI backstop (AR)** | `maybeSyncStaleAppointmentRemindersCalendars` — same **15 min** on AR calendar API | **Works when AR calendar routes are hit** |
| **Lifecycle `missed` / `subscriptionRemoved`** | `handleMicrosoftCalendarLifecycleWebhook` → re-subscribe and/or enqueue sync | **Implemented** |
| **429 / Retry-After** | `parseRetryAfterMs`, `MICROSOFT_RATE_LIMITED` in `graph-errors.ts` | **Partial** — not clearly on every calendar sync retry path |
| **Pre-send authority check** | `scanPlatformAppointmentReminders` uses **DB** `startsAt` / metadata | **Not implemented** |
| **Deletions** | Delta `@removed` → cancel in import path | **In code**; not certified in production matrix |

Target architecture: **webhook speed when available**, **periodic delta backstop when not**, **pre-send freshness** before SMS (recommended; not built yet).

---

## Backstop reality on production (blocks UI-free test)

**Policy in code:**

- `src/lib/calendar/reconcile.ts` — stale if `lastSyncAt` older than **15 minutes** → `enqueueCalendarConnectionSync`.
- `src/lib/appointment-reminders/calendar/maybe-sync-stale-calendars.ts` — same **15 min** for AR calendar API loads.

**Reconcile execution evidence:**

- Last burst of `calendar_connections_reconcile` **completions** was **Oct 8 `minuteKey` backlog drain** (~**15:30 UTC**), not steady Oct 9 per-minute reconcile.
- For **2026-10-09** (DB counts): `calendar-reconcile:*` **0**, `automation-batch:*` **0**, `campaign-send-batch:2026-10-09*` **~976**.

`processDueJobs` is **not** leaving a normal minute maintenance trail for calendar reconcile on Oct 9, even though campaign minute batches exist. Until that is explained (web-worker tick failures, enqueue errors, etc.), the **controlled “no UI, wait for reconciliation” test cannot pass**.

**Earlier maintenance incident (context):**

- Coolify disk ~99% full → Redis AOF `MISCONF` → BullMQ **maintenance** worker failures → hundreds of pending reconcile/renew rows.
- Disk prune + Redis restart + one-time DB drain cleared backlog; **53** reconcile/renew completed around 15:00–15:30 UTC.

---

## Sync window behavior (calendarView/delta — Test2 / #625)

From `import-sync.ts` `defaultSyncWindow`:

- **Incremental:** `timeMin` = `lastSyncAt − 2 days`, `timeMax` = **now + 90 days** (configurable lookback/lookahead).
- **Delta reuse:** `syncWindowMatches` requires stored `windowStart` / `windowEnd` to match exactly; otherwise **bootstrap** new calendarView/delta range (correct for Microsoft scoped tokens).
- When the window moves, code **re-bootstraps** (more Graph work, correct semantics). #625 aims to ensure bootstrap/incremental **always persist** `deltaLink` and avoid silent config loss.

**Not used:** Microsoft beta event-level delta without fixed window (appropriate for production reminders).

---

## Graph request volume (5-minute backstop starting point)

Assumptions: one imported calendar per connection, one delta round-trip per backstop sync (pagination extra), plus webhook-triggered syncs.

| Backstop interval | Baseline connection syncs/hour (N calendars) |
|-------------------|-----------------------------------------------|
| 15 min (today) | N × 4 |
| **5 min (proposed start)** | **N × 12** |
| 2 min | N × 30 |

Examples: **1,000 calendars → ~12,000/hour** at 5 minutes (before pagination, retries, webhooks, targeted GETs, pre-send fetches).

Microsoft does not prescribe 2/5/15 minutes—it is a freshness vs throttling tradeoff. Measure 429s and **Outlook change → Transovo correct** latency before widening rollout.

---

## Smallest implementation path (preserve webhook → queue → worker)

### Phase A — unblock production truth (no new architecture)

1. **Deploy PR #626** — calendar maintenance Postgres drain; confirm reconcile/renew **complete** after deploy.
2. **Verify minute `processDueJobs`** — explain missing `calendar-reconcile` / `automation-batch` rows on Oct 9; restore steady minute ticks.
3. **Deploy PR #625** — delta persistence, config merge, chaser idempotency; confirm `microsoftDeltaLinks` non-empty after two incremental syncs.

### Phase B — Microsoft-aligned behavior (minimal diffs)

4. **Backstop:** evaluate **5-minute** stale threshold (both `reconcile.ts` and `maybe-sync-stale-calendars.ts` today use `15 * 60_000`); stagger via existing reconcile scan (`lastSyncAt asc`, `limit` 100); avoid duplicate overlapping syncs (existing enqueue idempotency + #625 chaser).
5. **Pre-send freshness:** before AR/platform reminder send, for calendar-imported rows with `providerEventId`, call existing **`syncCalendarProviderEventById`**, then re-evaluate fire time / suppress; bounded retry on 429 using `Retry-After`.
6. **Certify:** UI-free reschedule, deletion via delta `@removed`, lifecycle `missed` → full sync.

**Not required:** new infrastructure, beta delta, or full-calendar polling every N minutes.

---

## Controlled UI-free test (protocol)

**Prerequisites:** #626 + #625 deployed, `commitSha` updated, `microsoftDeltaLinks` populated, minute reconcile ticking.

1. Record baseline: `lastSyncAt`, `microsoftDeltaLinks`, target appointment `startsAt` / `externalUpdatedAt` / `providerEventId`.
2. Change **one** Outlook event (move or rename). **Do not** open Transovo AR calendar, scheduled list, or any route that calls `maybeSyncStaleAppointmentRemindersCalendars`. No manual sync.
3. Wait **≥15 minutes** (or **≥5** after threshold change).
4. Verify:
   - Did `calendar_connections_reconcile` **complete** for current `minuteKey`?
   - Did it enqueue (or worker run) `calendar_connection_sync` for `cmu1uq7f15s1o5s4f6c5b6a57`?
   - Did Graph return updated event (sync stats / appointment row)?
   - Did DB `startsAt` / title match Outlook?
   - Did `microsoftDeltaLinks` persist/update?
   - **Elapsed time** from Outlook edit to DB correct?
5. Classify path with timestamps: **webhook** (`providerWebhookEvent`), **scheduled-reconciliation** (`job_queue`), or **UI** (AR calendar API)—only one should apply if protocol is followed.

---

## Key code paths (reference)

| Concern | Path |
|---------|------|
| Webhooks | `src/lib/calendar/webhooks.ts` |
| Targeted event fetch | `syncCalendarProviderEventById` in `src/lib/calendar/import-sync.ts` |
| Delta | `src/lib/calendar/microsoft-delta-sync.ts` |
| Reconcile backstop | `src/lib/calendar/reconcile.ts` |
| AR UI stale sync | `src/lib/appointment-reminders/calendar/maybe-sync-stale-calendars.ts`, `src/app/api/appointment-reminders/calendar/events/route.ts` |
| Minute ticks | `processDueJobs` in `src/lib/jobs/job-handlers.ts` |
| Reminder scan (no pre-send Graph check today) | `scanPlatformAppointmentReminders` in `src/lib/appointments/reminder-delivery.ts` |

---

## Governing sentence

Transovo already implements most of **Microsoft’s webhook + delta + backstop** pattern in code, but **production is not there yet**: no delta checkpoints, #625/#626 not deployed, and **scheduled reconcile is not demonstrably ticking on Oct 9** despite backlog drain. Test2/Test3 are real wins; the remaining gate is **reliable background backstop** (and then pre-send freshness for reminders), measured with UI-free tests and Graph/throttle metrics—not perfect webhook delivery from Microsoft.
