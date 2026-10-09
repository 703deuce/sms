# Microsoft Graph calendar sync audit (Appointment Reminders)

**Date:** 2026-10-09  
**Scope:** Transovo Microsoft 365 calendar import for Appointment Reminders (`ws_1` production evidence + codebase).  
**Instruction:** Audit only — preserve webhook → queue → worker architecture; no redesign.

**Microsoft references:**

- [Change notifications delivery (webhooks)](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks)
- [Lifecycle events](https://learn.microsoft.com/en-us/graph/change-notifications-lifecycle-events)
- [Delta query (events)](https://learn.microsoft.com/en-us/graph/delta-query-events)
- [Change notifications overview](https://learn.microsoft.com/en-us/graph/change-notifications-overview)

---

## Executive summary

Transovo already matches Microsoft’s **recommended shape**: webhook → durable work → sync, plus subscription renewal and lifecycle handlers in code. Production on `ws_1` proves **webhooks work** for create/title edit (Test2 `created` + `updated` ~1.3s apart).

The **recovery layer is only partly real in production**: `calendarView/delta` is implemented in code, but for the live Microsoft connection **`microsoftDeltaLinks` is empty** — incremental delta recovery is **not established** on that connection. That aligns with observed behavior: **no `updated` webhook for a date reschedule**, and a full incremental job at 13:48 UTC did **not** move Test2’s time until a **single-event** sync.

**Smallest hardening (recommended, not implemented in this doc):** persist delta reliably, tighten webhook→sync idempotency for back-to-back `updated`, and add reminder guards when sync is stale.

---

## Recommended combined model (Microsoft)

| Mechanism | Purpose | When it runs |
|-----------|---------|----------------|
| Graph webhook | Fast notification | When Outlook changes |
| Delta sync | Retrieve changes reliably | After webhook and periodically |
| Subscription renewal | Keep notifications active | Before expiration |
| Lifecycle notifications | Auth / missed-delivery problems | When Microsoft sends an alert |
| Reconciliation | Recover from outages / missed changes | Scheduled and after recovery |

**Production-grade flow:**

```
Outlook → Webhook → Sync
         backed by subscription maintenance + delta synchronization + recovery
```

Not: `Outlook → Webhook → Database` alone.

---

## 1. Subscription lifecycle

| Aspect | Status | Code | Production evidence |
|--------|--------|------|---------------------|
| Create subscription (`me/events`, 7d cap) | **Implemented & verified** | `ensureMicrosoftCalendarSubscription` in `src/lib/calendar/webhooks.ts`; `OUTLOOK_EVENTS_SUBSCRIPTION_RESOURCE`, `outlookEventSubscriptionExpiration` in `src/lib/microsoft/graph-helpers.ts` | Connection `cmu1uq7f15s1o5s4f6c5b6a57`: sub `41da1ac5-a2eb-4366-b514-19868b32c5b9`, expires **2026-10-16** |
| Persist subscription on connection | **Implemented & verified** | `config.microsoftSubscription` via `updateWorkspaceCalendarConnection` | Same as above |
| Renew before expiry | **Implemented, partially verified** | `renewExpiringCalendarSubscriptions()` renews if &lt; 6h to expiry; job `calendar_subscription_renew` enqueued from `processDueJobs` hourly (`src/lib/jobs/job-handlers.ts` ~1410–1415) | Sub healthy; hourly renew job success not log-audited for this tenant |
| Repair missing subscription | **Implemented & verified** | `src/lib/calendar/ensure-microsoft-subscriptions.ts`; also on sync + calendar events API load | Was missing earlier; repaired via ensure + deploy `6e0839f32` |
| Delete on disconnect | **Implemented, unverified** | `deleteMicrosoftCalendarSubscription` in `webhooks.ts` | Not exercised in this audit |

**Microsoft requirement:** renew before expiration — **met in code**; **verify** maintenance worker runs in prod (scheduler + `calendar_subscription_renew` completing).

---

## 2. Webhook delivery

| Aspect | Status | Code | Production evidence |
|--------|--------|------|---------------------|
| Validation token (GET/POST) | **Implemented & verified** | `src/app/api/integrations/calendars/webhooks/microsoft/route.ts` | Subscription created successfully |
| `clientState` HMAC | **Implemented** | `signCalendarWebhookState` / `parseCalendarWebhookState` in `src/lib/calendar/webhooks.ts` | Payloads show signed `clientState` for `cmu1uq7f15s1o5s4f6c5b6a57:ws_1:…` |
| Durable record before work | **Partial** | `recordWebhookOnce` → `providerWebhookEvent` then sync/enqueue | Test2 at **13:02:15** / **13:02:17** UTC with full payload |
| HTTP response | **Partial vs MS docs** | Returns **200** + `{ ok: true }`, not **202** | Works in practice |
| Batched notifications | **Implemented** | Loop over `body.value` in route | — |
| Enqueue background sync | **Implemented & verified** | `enqueueCalendarConnectionSync` → `job_queue` + BullMQ `default` | Job **13:02:16** → completed **13:02:36** for Test2 create |
| Targeted event sync on webhook | **Implemented (deploy `90b938c1d`)** | `syncCalendarProviderEventById` when `resourceData.id` present (`webhooks.ts`) | After Test2 date test window |
| Job deduplication | **Partial — gap** | `idempotencyKey`: `calendar-sync-{connectionId}-inc-{minute}` | `updated` at 13:02:17 had **no** separate job (same minute as create) |

### Production proof: Test2 create + rename

Same Graph event id (`…AFQ21Q4AAAA=`):

| Time (UTC) | Microsoft `changeType` | Stored |
|------------|------------------------|--------|
| 13:02:15.932 | `created` | `providerWebhookEvent` |
| 13:02:17.268 | `updated` (~1.3s later) | second webhook, same event id |

Matches: create appointment, then add title **Test2** — **without** pressing Sync in Transovo.

### Production gap: Test2 date reschedule

- **No** additional webhook for that event id after 13:02 (waited; none in last 5+ minutes).
- Graph showed **Oct 19**; DB stayed **Oct 16** until targeted `syncCalendarProviderEventById` at 13:51 UTC.
- **Conclusion:** Microsoft did not push the reschedule (or not in time); recovery must come from **delta + reconciliation**, not webhook alone.

---

## 3. Lifecycle notifications

| Aspect | Status | Code | Production evidence |
|--------|--------|------|---------------------|
| Endpoint | **Implemented** | `/api/integrations/calendars/webhooks/microsoft/lifecycle` | Same validation pattern as main webhook |
| `reauthorizationRequired` | **Implemented, unverified** | Re-calls `ensureMicrosoftCalendarSubscription` | **0** lifecycle rows in `provider_webhook_events` |
| `subscriptionRemoved` | **Implemented, unverified** | Clears sub, recreate, enqueue sync | None seen |
| `missed` | **Implemented, unverified** | Enqueue incremental sync | None seen |

**Note:** Lifecycle events are stored via `recordWebhookOnce` with `eventType: "calendar_change"` (not a separate event type) — monitoring gap.

**Handler:** `handleMicrosoftCalendarLifecycleWebhook` in `src/lib/calendar/webhooks.ts`.

---

## 4. Delta synchronization

| Aspect | Status | Code | Production evidence |
|--------|--------|------|---------------------|
| `calendarView/delta` with date window | **Implemented** | `syncMicrosoftCalendarDelta` in `src/lib/calendar/microsoft-delta-sync.ts` | `microsoftCalendarViewDeltaUrl`, pagination in `src/lib/calendar/providers.ts` |
| Persist `@odata.deltaLink` per calendar + window | **Implemented in code** | `persistDeltaLink` → `config.microsoftDeltaLinks[calendarId]` | **Production: `microsoftDeltaLinks` = empty `{}` keys on `cmu1uq7f15s1o5s4f6c5b6a57`** |
| Use delta on incremental sync | **Implemented** | `syncWorkspaceCalendarConnection` in `import-sync.ts` when `incremental: true` | Jobs run incremental; without stored delta, runs are bootstrap/fallback |
| Fallback if delta fails | **Implemented** | Catch → `listMicrosoftCalendarEventsForAppointmentDiscovery` | Imports work without delta tokens |
| Multi-calendar | **Implemented** | Loop `resolveImportCalendarIds` | ws_1: **1** import calendar |

**Classification:** **Partial** — code matches [delta-query-events](https://learn.microsoft.com/en-us/graph/delta-query-events); **not established in production** for the audited connection.

**Doc reference in repo:** `docs/AR-CALENDAR-MICROSOFT-365-NATIVE-ACTIONS.md` (Background sync table).

---

## 5. Periodic reconciliation

| Mechanism | Status | Code | Behavior |
|-----------|--------|------|----------|
| Global reconcile job | **Implemented** | `reconcileWorkspaceCalendarConnections` in `src/lib/calendar/reconcile.ts` | If `lastSyncAt` older than **15 minutes**, enqueue incremental sync |
| Scheduler | **Implemented** | `calendar_connections_reconcile` every minute via `processDueJobs` (`job-handlers.ts` ~1396–1401) | Completion not log-audited this session |
| AR stale backstop | **Implemented** | `maybe-sync-stale-calendars.ts` — same **15 min** | On calendar events API (async) or `refresh=1` |
| UI “Sync now” | **Implemented** | `POST /api/appointment-reminders/sync` | Manual; not primary recovery |

**Gap:** Recent `lastSyncAt` (e.g. 13:48 UTC) suppresses reconcile for 15 minutes even if rows are wrong (Test2 time unchanged until 13:51 targeted sync).

---

## 6. Event correctness (production tests)

| Scenario | Status | Evidence |
|----------|--------|----------|
| Create | **Verified** | Webhook `created` → job → `voiceAppointment` |
| Title edit | **Verified** | `updated` webhook ~1.3s after `created`; **Test2** in DB |
| Time reschedule | **Partial / auto path failed** | Graph Oct 19; DB Oct 16 until targeted sync; no webhook for reschedule |
| Delete | **Implemented, unverified** | Delta `@removed`; cancel in `syncCalendarProviderEventById` |
| Rapid consecutive edits | **Partial** | Same-minute job dedupe may skip second enqueue |
| Recurring | **Implemented, unverified** | `seriesMasterId` / recurrence in import metadata |

**Helpers:** `scripts/ar-calendar-prod-audit-once.ts`, `scripts/ar-calendar-microsoft-webhook-e2e.ts`, `scripts/ar-calendar-prod-lookup-test2.ts`.

---

## 7. Reminder correctness

| Aspect | Status | Code |
|--------|--------|------|
| Reschedule → reset reminders | **Implemented** | `timesChanged` → `resetAppointmentReminders` in `import-sync.ts` |
| Cancel → suppress | **Implemented** | `suppressAppointmentReminders` |
| Mirror-only (no SMS) | **Implemented & verified** | `reminderSmsEligible`; `reminder-delivery.ts` skips when false |
| Block send if calendar sync stale vs appointment time | **Missing / partial** | `lastSyncError` in some AR surfaces; no proximity-based stale guard |

---

## 8. Production monitoring

| Signal | Status |
|--------|--------|
| Webhook audit | **Partial** — `provider_webhook_events`, audit scripts |
| Failed sync jobs | **Partial** — `job_queue.lastError`, `config.lastSyncError` |
| Expired subscription | **Partial** — `config.microsoftSubscription.expiresAt`; renew job exists |
| Stale sync per connection | **Partial** — `lastSyncAt` only |
| Lifecycle / missed delivery | **No production events observed** |

---

## Component matrix (from production review)

| Component | Current evidence | What to verify |
|-----------|------------------|----------------|
| Graph subscription | Active on ws_1 | Automatic renewal job in prod |
| Microsoft webhook | Real `created`/`updated` for Test2 | Reschedule push; response time |
| Background sync worker | Jobs completed | Retries, idempotency, concurrency |
| Calendar mirror | Imports + title update | Time update without manual sync |
| Delta query | **Code yes; prod tokens no** | `microsoftDeltaLinks` after each sync |
| Lifecycle webhook | **Code yes; prod events no** | reauthorization, removed, missed |
| Periodic reconciliation | **Code yes (15 min)** | Runs without UI; catches missed webhooks |

---

## Smallest necessary changes (recommendations — not implemented)

1. **Establish delta in production** — ensure `microsoftDeltaLinks` is written after successful sync; fix bootstrap/fallback so incremental sync uses persisted `@odata.deltaLink`.
2. **Webhook follow-up** — keep targeted `syncCalendarProviderEventById` on `updated`; fix enqueue idempotency so back-to-back `updated` notifications are not collapsed into one per-minute job.
3. **Reconciliation** — keep 15 min bulk stale; add shorter recovery or “event modified &gt; lastExternalSyncAt” checks for appointments nearing start time.
4. **Lifecycle `missed`** — already enqueues sync; verify in prod when Microsoft sends it.
5. **Reminders** — do not send (or flag) when connection sync is stale relative to appointment proximity.
6. **Monitoring** — alert on: missing subscription, empty `microsoftDeltaLinks` after N successful syncs, failed `calendar_connection_sync`, lifecycle events.

---

## Microsoft requirements vs optional hardening

**Aligned with Microsoft guidance:**

- Validation token handling  
- Signed `clientState`  
- Subscription lifetime and renewal  
- Separate lifecycle notification URL  
- Delta query for incremental recovery after missed notifications  

**Optional (not required at current scale):**

- HTTP 202 instead of 200  
- Ack-first webhook with zero inline Graph work  
- Azure Event Hubs  

Existing **webhook + BullMQ `default` queue + embedded/maintenance workers** can satisfy Microsoft’s model if **delta persistence and reconciliation** are verified.

---

## Key code locations

| Area | Path |
|------|------|
| Webhooks + subscriptions | `src/lib/calendar/webhooks.ts` |
| Delta sync | `src/lib/calendar/microsoft-delta-sync.ts` |
| Import + enqueue | `src/lib/calendar/import-sync.ts` |
| Reconciliation | `src/lib/calendar/reconcile.ts` |
| AR stale backstop | `src/lib/appointment-reminders/calendar/maybe-sync-stale-calendars.ts` |
| Subscription ensure on load | `src/lib/calendar/ensure-microsoft-subscriptions.ts` |
| Graph constants | `src/lib/microsoft/graph-helpers.ts` |
| HTTP ingress | `src/app/api/integrations/calendars/webhooks/microsoft/route.ts`, `.../lifecycle/route.ts` |
| Jobs | `src/lib/jobs/job-handlers.ts` (`calendar_connection_sync`, `calendar_connections_reconcile`, `calendar_subscription_renew`) |
| Product doc | `docs/AR-CALENDAR-MICROSOFT-365-NATIVE-ACTIONS.md` |

---

## Governing sentence

**Webhooks are the fast path and are working for create/title updates on the audited account. Reliability at scale depends on delta tokens and scheduled reconciliation being proven in production — today delta is not persisted on the primary Microsoft connection, which explains missed reschedules when Microsoft does not push an `updated` notification.**

---

## Post-audit root cause (2026-10-09) — Test2 @ 13:48 UTC vs 13:51 UTC

### What production proved

| Time (UTC) | Action | Test2 `startsAt` | Notes |
|------------|--------|------------------|-------|
| 13:02 | Create + title via webhooks | Oct 16 | Targeted + queued sync path worked |
| 13:48 | Inline stale sync (`maybeSyncStaleAppointmentRemindersCalendars` / 15 min rule) | **Still Oct 16** | Connection `lastSyncAt` advanced; appointment `lastExternalSyncAt` ~13:48:48 |
| 13:51 | `syncCalendarProviderEventById` (single `/me/events/{id}`) | **Oct 19** | Matches Graph |

No `updated` webhook arrived for the reschedule — recovery had to come from bulk sync or reconciliation, not the webhook fast path.

### Most likely explanation (code + evidence)

1. **`microsoftDeltaLinks` never stuck in production** — `persistDeltaLink` wrote tokens during sync, but `syncWorkspaceCalendarConnection` finished with a **full config replace** from a snapshot taken at sync start (`config: { ...config, lastSyncError: null }`). Concurrent or overlapping syncs (inline stale sync + webhook job + UI poll) could **overwrite** the row and drop `microsoftDeltaLinks`. That matches empty delta state despite incremental jobs running.

2. **13:48 bulk path did not apply the reschedule** — Either the `calendarView/delta` page set in that pass still reflected the pre-move instance, or the event was not in the delta/bootstrap page set returned for the sync window. Empty delta forces repeated bootstraps; without a persisted `@odata.deltaLink`, incremental semantics are weaker and reconciliation depends on full window enumeration being correct every time.

3. **13:51 targeted sync succeeded** because `/me/events/{id}` returns the **authoritative** event document (Oct 19), independent of delta pagination/window quirks.

4. **Same-minute job coalescing** is a separate, smaller risk (create + title at 13:02). It does **not** explain the reschedule gap (no webhook). Coalescing **during an in-flight** `calendar_connection_sync` can still drop a follow-up enqueue when a second notification arrives while `status === processing`.

### Fixes shipped on branch `cursor/ar-microsoft-calendar-sync-fix-f350`

| Priority | Change |
|----------|--------|
| P1 / P2 | `mergeCalendarConnectionConfig` on every connection config write; final sync merges with **fresh** DB config so delta links survive |
| P2 | Treat bootstrap/incremental delta rounds **without** `@odata.deltaLink` as failure → fallback discovery list (do not silently “succeed”) |
| P3 | When enqueue hits a **processing** sync in the same minute bucket, schedule one **chaser** job (+5s) |

**Not done (per product guidance):** broad reminder blocking on stale `lastSyncAt`; Event Hubs; architecture redesign.

### Verification after deploy

1. Run incremental sync twice on `cmu1uq7f15s1o5s4f6c5b6a57` — confirm `config.microsoftDeltaLinks[calendarId].deltaLink` is non-empty after the second run.
2. Reschedule an Outlook event **without** webhook (or with webhook suppressed) — within 15 min reconcile or stale backstop should correct mirror; targeted webhook path should still use `/me/events/{id}` when `resourceData.id` is present.
3. Rapid create → edit with sync in-flight — chaser job should run; DB should match final Graph state.
