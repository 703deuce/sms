# PR #567 merge delta — scheduler retention split + actionable backlog

## Scheduler types classified (`processDueJobs`)

| Job type | Tick class | Empty tick row elimination (this PR) |
|----------|------------|--------------------------------------|
| `campaign_send_batch` | DURABLE_TICK_REQUIRED | keep durable row |
| `automation_batch` | DURABLE_TICK_REQUIRED | keep durable row |
| `voice_campaign_batch` | DURABLE_TICK_REQUIRED | keep durable row |
| `list_cleanup` | DURABLE_TICK_REQUIRED | keep durable row |
| `notification_digest` | DURABLE_TICK_REQUIRED | keep durable row |
| `campaign_recurrence_tick` | DURABLE_TICK_REQUIRED | keep durable row |
| `crm_scheduled_incremental` | DURABLE_TICK_REQUIRED | keep durable row |
| `mctb_trial_lifecycle` | DURABLE_TICK_REQUIRED | keep durable row |
| `appointment_webhook_sweep` | RESCANNABLE_POLL | keep durable row (uncertain → retention only) |
| `mctb_provider_reconciliation` | DURABLE_TICK_REQUIRED | keep durable row |
| `appointment_starting_soon_scan` | RESCANNABLE_POLL | keep durable row |
| `appointment_completed_scan` | RESCANNABLE_POLL | keep durable row |
| `appointment_workflow_time_scan` | RESCANNABLE_POLL | keep durable row |
| `appointment_no_show_scan` | RESCANNABLE_POLL | keep durable row |
| `appointments_platform_reminder_scan` | RESCANNABLE_POLL | keep durable row |
| `voice_v2_callback_sla_overdue_scan` | RESCANNABLE_POLL | keep durable row |
| `calendar_connections_reconcile` | RESCANNABLE_POLL | keep durable row |
| `calendar_subscription_renew` | DURABLE_TICK_REQUIRED | keep durable row |
| `promote_scheduled_receptionists` | RESCANNABLE_POLL | keep durable row |
| `crm_task_due_scan` | RESCANNABLE_POLL | keep durable row |
| `voice_ai_retention` | DURABLE_TICK_REQUIRED | keep durable row |
| `voice_webhook_dlq_reprocess` | DURABLE_TICK_REQUIRED | keep durable row |
| `job_queue_terminal_prune` | DURABLE_TICK_REQUIRED | keep durable row |

Source: `src/lib/jobs/job-queue-scheduler-types.ts` (sync with `processDueJobs` in `job-handlers.ts`).

**Rescannable polls** could skip per-minute Postgres rows in a future change only with a proven recovery equivalence proof. This PR does **not** remove tick rows.

## Retention implementation

| Category | Policy | Env |
|----------|--------|-----|
| Successful **scheduler/tick** | **48 hours** | `JOB_QUEUE_SCHEDULER_COMPLETED_RETENTION_HOURS` (default 48) |
| Successful **normal** operational/customer jobs | **30 days** | `JOB_QUEUE_COMPLETED_RETENTION_DAYS` |
| **Failed** (all types) | **90 days** | `JOB_QUEUE_FAILED_RETENTION_DAYS` |
| **Actionable** (`pending`, `processing`, `deferred`) | never age-delete | — |

Prune: batched deletes, scheduler vs normal completed passes, in-memory cutoff filter (avoids Supabase compat `OR`/`lt` bugs), failed pass unchanged at 90d.

## Actionable-job investigation (production DB, read-only)

Run: `npx tsx scripts/operations/investigate-actionable-job-queue.ts`

**Totals (2026-09-30):** 990 actionable — 92 null-workspace, 898 `ws_1`.

### Null workspace (~92)

| Classification | Finding |
|----------------|---------|
| Oldest | **~35 days** — `integration_automation_event` |
| Mix | `campaign_send_batch` (25), `send_campaign_sms` (23), `voice_post_call` (17), `voice_v3_call_history` (15), … |
| Verdict | **STALE_BUT_RECOVERABLE / UNKNOWN** — zero-attempt or reclaimed SMS/campaign rows with **null workspace** (orphaned outbox). Worker recognizes types. **Do not delete** without fixing routing/workspace assignment. |

### `ws_1` (~898)

| Classification | Finding |
|----------------|---------|
| Dominant types | CRM/Zoho sync and task automation jobs (high volume pending backlog) |
| Verdict | **LEGITIMATE_ACTIONABLE / STALE_BUT_RECOVERABLE** — real integration backlog, not test garbage. **Do not mass-delete.** Use `oldestActionable.ageMinutes` + CRM health; fix worker throughput or stuck CRM sync, not retention. |

**Oldest actionable age is the launch gate metric** — not total row count. Pending from minutes ago = healthy; pending from months = defect or backlog to triage.

## Regression

`npm run test:job-queue-lifecycle` — **PASS** (classification + scoped integration prune).

## Revised steady-state (scheduler only)

**Measured creation rate:** ~20 scheduler types × 1/minute ≈ **28,800 completed scheduler rows/day**.

| Retention | Rolling scheduler completed rows (order of magnitude) |
|-----------|------------------------------------------------------|
| 30 days (old) | ~864,000 |
| **48 hours (new)** | **~57,600** |
| 24 hours | ~28,800 |

Plus workspace-scoped completed jobs at **30 days** (customer/automation volume).

## SAFE TO MERGE PR #567

**YES** — after review of actionable backlog triage (separate from merge): scheduler retention split implemented, tests pass, no tick-row removal without proof, failed retention unchanged, actionable jobs never age-deleted.
