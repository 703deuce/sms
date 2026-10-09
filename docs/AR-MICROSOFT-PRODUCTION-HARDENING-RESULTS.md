# Appointment Reminders — Microsoft 365 production hardening results

**Branch:** `cursor/ar-microsoft-production-hardening-f350`  
**Scope:** Microsoft 365 / Outlook calendar sync, central scheduler, subscription renewal, reminder discovery/dispatch, Telnyx idempotency boundaries, worker queue separation, ops metrics. **Google Calendar sync code unchanged**; new AR connections default to Microsoft-only via `AR_MICROSOFT_ONLY_CALENDAR` (default `true`).

---

## 1. Implemented changes

### Database

- Migration `prisma/migrations/20261009120000_ar_microsoft_production_hardening/migration.sql`
  - `voice_calendar_connections`: `nextSyncDueAt`, `syncBackoffUntil`, `subscriptionRenewDueAt` + indexes
  - `ar_reminder_dispatches` with unique `(appointmentId, timelineType, reminderGeneration)`
  - `voice_appointments(status, startsAt)` index for reminder scan
- `prisma/schema.prisma` — model + connection columns
- `src/lib/supabase/prisma-compat.ts` — `arReminderDispatch` table mapping (required for Supabase runtime)

### Microsoft scheduler & reconciliation (Part 2)

| File | Role |
|------|------|
| `src/lib/calendar/microsoft-schedule-config.ts` | `MICROSOFT_CALENDAR_RECONCILE_MINUTES` (default 5), batch budgets |
| `src/lib/calendar/microsoft-connection-schedule.ts` | Stagger, success/failure, enqueue lease |
| `src/lib/calendar/microsoft-reconcile-discovery.ts` | Keyset due-work discovery, bounded enqueue, `dryRun` for tests |
| `src/lib/calendar/reconcile.ts` | Microsoft → discovery; Google legacy `take: 100` preserved |

### Microsoft Graph sync (Part 3)

| File | Role |
|------|------|
| `src/lib/calendar/microsoft-delta-sync.ts` | Checkpoint commit deferred via `commitMicrosoftDeltaCheckpoint()` |
| `src/lib/calendar/import-sync.ts` | Per-calendar success/failure; no connection-level success on partial failure |
| `src/lib/calendar/providers.ts` | Mailbox limiter + 429/`Retry-After`/5xx backoff on `microsoftGraphFetch` |
| `src/lib/microsoft/graph-mailbox-concurrency.ts` | Per-connection + global Graph concurrency |
| `src/lib/calendar/webhooks.ts` | Webhook HTTP path: durable record + enqueue only |
| `src/lib/calendar/microsoft-webhook-process.ts` | Worker: targeted event sync + connection sync job |

### Subscription renewal (Part 4)

- `src/lib/calendar/microsoft-subscription-renewal-scheduler.ts` — expiration-ordered bounded batches
- `renewExpiringCalendarSubscriptions()` — Microsoft via scheduler; Google unchanged (`take: 200`)

### Reminders (Part 5–6)

| File | Role |
|------|------|
| `src/lib/appointment-reminders/reminder-discovery.ts` | Paginated discovery, `ar_reminder_dispatches`, enqueue `ar_dispatch_reminder` |
| `src/lib/appointment-reminders/reminder-dispatch-executor.ts` | Atomic claim; `unknown` without blind resubmit |
| `src/lib/appointments/reminder-delivery.ts` | `scanPlatformAppointmentReminders()` discovery-only; dispatch SMS updates dispatch row |
| `src/lib/jobs/job-handlers.ts` | `ar_dispatch_reminder`, `microsoft_calendar_webhook_process` |
| `src/lib/jobs/bullmq.ts` | Separate concurrency envs (`BULLMQ_MAINTENANCE_CONCURRENCY`, `BULLMQ_AR_REMINDER_CONCURRENCY`, …) |

### Launch / Google policy

- `src/lib/appointment-reminders/calendar-provider-policy.ts`
- API: `POST /api/integrations/calendars` + Google OAuth block when `productContext: appointment_reminders`
- UI: `calendar-integrations-opus.tsx` — hides new Google connect for AR when policy disallows; existing Google rows remain
- `GET /api/appointments/integrations/status` — exposes `appointmentRemindersGoogleCalendarAllowed`

### Monitoring (Part 8)

- `GET /api/appointment-reminders/ops/metrics` (auth: `appointment_reminders.read`)

### Tests (Part 9)

- `scripts/test-microsoft-reconcile-scale.ts`
- `scripts/test-microsoft-subscription-renew-scale.ts`
- `scripts/test-ar-reminder-dispatch-idempotency.ts`

---

## 2. Existing behavior preserved

- Microsoft OAuth, webhook subscriptions, lifecycle handlers, `calendarView/delta`, `microsoftDeltaLinks`, UTC window model, webhook dedupe/chaser, appointment upsert, reminder generation invalidation, cancellation suppression, Telnyx sender paths, PostgreSQL job queue + BullMQ, `processDueJobs()` / `worker-all.ts`
- Google calendar sync implementation **not modified** (only AR connect policy + reconcile path split)
- No mandatory pre-send Graph call on every reminder send
- No new queue infrastructure (Kafka/K8s)

---

## 3. Microsoft Graph compliance

Follows documented behaviors (see audit `docs/AR-PRODUCTION-ARCHITECTURE-AUDIT.md` when present on `master`):

- [Delta query for events](https://learn.microsoft.com/en-us/graph/delta-query-events) — reuse saved delta URL; follow `@odata.nextLink`; persist `@odata.deltaLink` after durable appointment writes
- [event delta](https://learn.microsoft.com/en-us/graph/api/event-delta) — no unsupported `$top` on bootstrap (prior fix `601e25f0b`)
- [Throttling](https://learn.microsoft.com/en-us/graph/throttling) — 429 + `Retry-After`, bounded backoff, per-mailbox concurrency cap
- [Change notifications](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks) — fast HTTP ack after durable enqueue

---

## 4. Telnyx reliability

- Logical send identity: `ar_reminder_dispatches` unique on appointment + timeline + **reminder generation**
- Dispatch executor: atomic claim → `submitting` → on timeout/`unknown` **no automatic resubmit** (`unknown_outcome_no_resubmit`)
- SMS path persists `telnyxMessageId` / `providerMessageId` on dispatch when returned from outbound helper
- Does **not** invent `Idempotency-Key` headers; aligns with [Telnyx command retry guidance](https://developers.telnyx.com/docs/development/api-fundamentals/reliability/command-retries) (ambiguous timeout → reconcile, not blind POST retry)

**Remaining:** full reconciliation of `unknown` rows against Telnyx delivery webhooks/list API (operational tooling) — state machine states exist; automated provider-evidence reconcile not fully wired in this pass.

---

## 5. Scheduler capacity (simulated, dry-run discovery)

Measured on Cloud Agent VM against Supabase Postgres (`discoverAndEnqueueMicrosoftCalendarSyncs` with `dryRun: true`, lease advancement enabled). **Not** real Graph throughput.

| Connections | Ticks | Discovered/enqueued | Wall time | Rate |
|-------------|-------|---------------------|-----------|------|
| 100 | 1 | 100 | 454 ms | ~1,101/s |
| 1,000 | 2 | 1,000 | 1,295 ms | ~772/s |
| 5,000 | 10 | 5,000 | 6,764 ms | ~739/s |
| 10,000 | (run in progress / rerun locally) | — | — | — |

At 5-minute reconcile interval, 10,000 calendars need ~2,000 sync **enqueues/minute** admission — discovery rate above supports enqueue scheduling; **worker + Graph limits** remain the real bottleneck.

Subscription renewal scheduler (import-disabled connections, no Graph): 200 connections scanned in ~19s (~10/s) — renewal **calls** are bounded per tick via `microsoftSubscriptionRenewBatchPerTick()`.

---

## 6. Reminder capacity

- Discovery: keyset pagination over `voice_appointments`, no global 500-row send cap; up to `MAX_DISPATCH_ENQUEUE_PER_TICK` (2,000) jobs per maintenance tick
- Late policy: `REMINDER_MAX_LATE_MS` (30 min) → `suppressed` with `too_late` (not silent drop)
- Dispatch: `appointment_reminders` BullMQ queue with dedicated concurrency env

**Not run in this environment:** 600 / 2,000 / 10,000 simultaneous reminder simulations (would require seeded appointments + dispatch workers).

---

## 7. Failure recovery (automated)

| Test | Result |
|------|--------|
| `test-ar-reminder-dispatch-idempotency.ts` | **PASS** — `unknown` blocks resubmit; single winner on claim |
| `test-microsoft-subscription-renew-scale.ts` (200, no Graph) | **PASS** |
| `test-microsoft-reconcile-scale.ts` | **PASS** at 100 / 1,000 / 5,000 |

**Not automated here:** multi-page delta fixtures, webhook-backstop E2E without webhooks, live M365 E2E on production test tenant, Redis outage drills.

---

## 8. Deployment

| Item | Status |
|------|--------|
| Commit SHA | _(filled at push)_ |
| Migration | Additive `20261009120000_ar_microsoft_production_hardening` — safe `migrate deploy` on Coolify |
| Coolify build | Pending agent push + monitor |
| Production verify | Pending — M365 test connection smoke per Part 9 §E2E |

---

## 9. Remaining limitations

- 10,000-connection **live** Graph sync and subscription renewal not proven (mocks/dry-run only)
- `unknown` Telnyx dispatch reconciliation to provider evidence (manual/ops)
- Multi-scheduler **global** lease (per-connection enqueue lease only)
- Comprehensive delta/webhook/backstop integration test suite partially specified, not all cases implemented
- Google Calendar remains in codebase; hidden for **new** AR connects only

---

## 10. Launch readiness

**Classification: Ready for Microsoft 365 pilot** (engineering), **not** yet **ready for broader scaling** until:

1. Coolify deploy green on `master` with migration applied  
2. Production worker health + ops metrics reviewed  
3. Controlled M365 E2E (create/change/delete + webhook-disabled backstop) on test workspace  
4. Live SMS spot-check (not bulk) for one reminder dispatch  

**Not ready for limited paying customers** until items 1–3 are **production-verified** with evidence (not build-only).

---

## Environment variables (operations)

| Variable | Default | Purpose |
|----------|---------|---------|
| `MICROSOFT_CALENDAR_RECONCILE_MINUTES` | `5` | Scheduled Microsoft backstop interval |
| `AR_MICROSOFT_ONLY_CALENDAR` | `true` | Block new Google AR calendar connects |
| `BULLMQ_MAINTENANCE_CONCURRENCY` | `3` | Maintenance worker |
| `BULLMQ_AR_REMINDER_CONCURRENCY` | `6` | Reminder SMS dispatch worker |
