# Appointment Reminders — Microsoft 365 production hardening results

**Branch:** `cursor/ar-microsoft-production-hardening-f350`  
**Scope:** Microsoft 365 / Outlook calendar sync, central scheduler, subscription renewal, reminder discovery/dispatch, Telnyx idempotency boundaries, worker queue separation, ops metrics. **Google Calendar sync code unchanged**; new AR connections default to Microsoft-only via `AR_MICROSOFT_ONLY_CALENDAR` (default `true`).

---

## 1. Implemented changes

### Database

- Migration `prisma/migrations/20261009120000_ar_microsoft_production_hardening/migration.sql`
- `src/lib/supabase/prisma-compat.ts` — `arReminderDispatch` mapping

### Scheduler, sync, webhooks, reminders, Telnyx

See prior sections in git history (`f5a400178` + verification pass commits). Verification pass additions:

| File | Role |
|------|------|
| `src/lib/calendar/microsoft-reconcile-discovery.ts` | `dryRun` **does not** advance `nextSyncDueAt` / leases |
| `src/lib/appointment-reminders/ar-dispatch-telnyx-reconcile.ts` | Reconcile `unknown` dispatches from Telnyx delivery webhooks |
| `src/lib/messaging/delivery-status.ts` | Calls AR dispatch reconcile on status updates |
| `src/lib/appointment-reminders/reminder-dispatch-executor.ts` | Test mock path when `AR_REMINDER_DISPATCH_TEST_*` env set |
| `scripts/lib/ar-scale-test-workspace.ts` | Isolated workspace for scale tests (`AR_SCALE_TEST_DO_NOT_USE`) |
| `scripts/audit-microsoft-schedule-side-effects.ts` | Audit/cleanup `sim-ms-*` connections |

### Test-only environment variables (not production defaults)

| Variable | Purpose |
|----------|---------|
| `AR_REMINDER_DISCOVERY_TEST_WORKSPACE` | Scope reminder discovery to one workspace in tests |
| `AR_REMINDER_DISCOVERY_TEST_SKIP_ENQUEUE` | Measure discovery without Redis/BullMQ enqueue |
| `AR_REMINDER_DISPATCH_TEST_MOCK` + `AR_REMINDER_DISPATCH_TEST_WORKSPACE` | Mock accepted dispatch without Telnyx POST |

---

## 2. Dry-run scheduler side effects (investigation)

**Finding:** Earlier scale tests used `dryRun: true` but still called `markMicrosoftSyncEnqueueLease()`, which **did** advance `nextSyncDueAt` on touched connections.

**Fix:** `dryRun: true` now skips both `enqueueCalendarConnectionSync` **and** `markMicrosoftSyncEnqueueLease`.

**Customer impact audit** (`scripts/audit-microsoft-schedule-side-effects.ts`):

- **0** non-`sim-ms-*` Microsoft connections with suspicious far-future `nextSyncDueAt` at audit time
- Leftover `sim-ms-*` rows from earlier runs were **deleted** by the audit script (20 rows)
- Scale tests now use workspace `AR_SCALE_TEST_DO_NOT_USE` only

**Command:**

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/audit-microsoft-schedule-side-effects.ts
```

---

## 3. Recurring appointment dispatch identity

Each Microsoft recurring **instance** is a separate `voice_appointment` (`externalId` = `microsoft:{connectionId}:{instanceEventId}`).  
`ar_reminder_dispatches` unique key is `(appointmentId, timelineType, reminderGeneration)` — occurrences do **not** share dispatch rows.

**Test (PASS):**

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-recurring-dispatch-identity.ts
```

---

## 4. Telnyx unknown-outcome handling

- Reuses existing `applyOutboundDeliveryStatus` / `handleTelnyxMessageStatus` pipeline
- `reconcileArReminderDispatchFromTelnyxDelivery()` matches `telnyxMessageId` / `providerMessageId`, advances `unknown` → `sent` → `delivered` monotonically
- Does **not** resubmit SMS on ambiguous POST timeout (executor still sets `unknown` and blocks reclaim)

**Test (PASS):**

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-dispatch-telnyx-reconcile.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-reminder-dispatch-idempotency.ts
```

Ops metrics: `GET /api/appointment-reminders/ops/metrics` → `reminders.unknownSubmissions`

**Not claimed:** carrier-level exactly-once delivery (provider cannot guarantee).

---

## 5. Reminder throughput (simulation)

**Command:**

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-reminder-throughput.ts --count=50
```

| Count | Discovery | Enqueued (due) | Mock dispatch sample | Unknown |
|-------|-----------|----------------|----------------------|---------|
| 50 | 18.3s | 50 | 50 in 23.5s | 0 |

**600 / 2,000 / 10,000:** Inserts are sequential against Supabase (~1s/row in this environment); full 600+ runs exceed practical agent time limits here. Use the same script on a machine with faster DB access or batch insert tooling. Discovery logic is scoped per workspace in tests; production scans all workspaces.

**Verified:** 2,000/tick enqueue budget does not drop rows permanently — keyset pagination continues on subsequent maintenance ticks (same pattern as calendar discovery).

---

## 6. Scheduler & renewal (simulation)

**Reconcile discovery (dry-run, isolated workspace, no lease mutation):**

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-microsoft-reconcile-scale.ts --connections=1000
```

Result: `{"connections":1000,"ticks":2,"totalEnqueued":1000,"elapsedMs":1172,"enqueuedPerSecond":853}` — **PASS**

Earlier runs: 5,000 connections in 6.7s dry-run discovery (~739/s). **Not** measured Graph sync completion throughput.

**Subscription renewal scan (no Graph, import disabled):**

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-microsoft-subscription-renew-scale.ts --connections=200
```

**PASS** (~10 scans/s)

**Multi-scheduler:** `calendar_connections_reconcile` is idempotent per minute (`calendar-reconcile:${minuteKey}`). Per-connection `nextSyncDueAt` lease reduces duplicate enqueue. **No global Postgres advisory lock** — deployment should run **one** maintenance worker fleet (documented in `microsoft-schedule-config.ts`).

**Not simulated here:** live Graph 429, Redis outage, multi-calendar partial failure (covered by unit/contract tests + code paths in `import-sync.ts`).

**Delta multi-page contract (PASS):**

```bash
npx tsx scripts/test-microsoft-delta-multipage-contract.ts
```

---

## 7. Deployment & production verification

| Step | Status |
|------|--------|
| Commits pushed to `cursor/ar-microsoft-production-hardening-f350` | See git log on branch |
| PR #628 merge to `master` | **Pending / run after review** |
| Coolify build green | **Pending** post-merge |
| Migration on production | **Pending** (`20261009120000_ar_microsoft_production_hardening`) |
| M365 E2E (create/modify/delete + webhook-disabled backstop) | **Manual** — requires test tenant |
| One live SMS reminder | **Manual** — requires authorized phone |

After merge, verify:

```bash
curl -sS "$COOLIFY_FQDN/api/health"
curl -sS -H "Cookie: ..." "$COOLIFY_FQDN/api/appointment-reminders/ops/metrics"
```

---

## 8. Launch readiness

| Classification | Rationale |
|----------------|-----------|
| **Microsoft 365 pilot (engineering)** | Core architecture + simulations PASS; dry-run bug fixed; Telnyx reconcile wired |
| **First paying customers** | Requires production deploy + M365 E2E + one live SMS smoke |
| **10,000 live calendars** | Enqueue discovery simulated; Graph/worker capacity must be measured in staging/production |

**Explicitly not verified in this pass:** 10k reminder end-to-end in one run, Redis outage recovery, multi-scheduler race at scale, live Graph 429 soak.

---

## 9. Test command summary

| Script | Result |
|--------|--------|
| `scripts/audit-microsoft-schedule-side-effects.ts` | PASS (0 customer rows flagged; sim cleanup) |
| `scripts/test-microsoft-reconcile-scale.ts` | PASS @ 100, 1000, 5000 |
| `scripts/test-microsoft-subscription-renew-scale.ts` | PASS @ 200 |
| `scripts/test-ar-reminder-dispatch-idempotency.ts` | PASS |
| `scripts/test-ar-dispatch-telnyx-reconcile.ts` | PASS |
| `scripts/test-ar-recurring-dispatch-identity.ts` | PASS |
| `scripts/test-microsoft-delta-multipage-contract.ts` | PASS |
| `scripts/test-ar-reminder-throughput.ts --count=50` | PASS |
| `scripts/test-ar-reminder-throughput.ts --count=600` | Not completed (DB insert time) |
