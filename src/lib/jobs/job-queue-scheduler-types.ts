/**
 * Global scheduler job types enqueued from processDueJobs() (minute/hour/day ticks).
 * These typically have workspaceId null and time-bucket idempotency keys.
 */

export type SchedulerTickClass = "durable_tick_required" | "rescannable_poll";

/**
 * Job types created on every processDueJobs() drain (infrastructure ticks).
 * Keep in sync with enqueue block in job-handlers.ts processDueJobs.
 */
export const PROCESS_DUE_JOBS_SCHEDULER_JOB_TYPES: readonly string[] = [
  "campaign_send_batch",
  "automation_batch",
  "voice_campaign_batch",
  "list_cleanup",
  "notification_digest",
  "campaign_recurrence_tick",
  "crm_scheduled_incremental",
  "mctb_trial_lifecycle",
  "appointment_webhook_sweep",
  "mctb_provider_reconciliation",
  "appointment_starting_soon_scan",
  "appointment_completed_scan",
  "appointment_workflow_time_scan",
  "appointment_no_show_scan",
  "appointments_platform_reminder_scan",
  "voice_v2_callback_sla_overdue_scan",
  "calendar_connections_reconcile",
  "calendar_subscription_renew",
  "promote_scheduled_receptionists",
  "crm_task_due_scan",
  "voice_ai_retention",
  "voice_webhook_dlq_reprocess",
  "job_queue_terminal_prune",
  /** Used only by scripts/test-job-queue-lifecycle.ts */
  "job_queue_lifecycle_scheduler_fixture",
] as const;

const SCHEDULER_SET = new Set<string>(PROCESS_DUE_JOBS_SCHEDULER_JOB_TYPES);

export function isProcessDueJobsSchedulerJobType(jobType: string): boolean {
  return SCHEDULER_SET.has(jobType);
}

/**
 * DURABLE TICK REQUIRED — missing the tick could skip work that is not fully recovered
 * by the next bucket (day/hour boundaries, batch launch, DLQ sweep).
 *
 * RESCANNABLE POLL — next tick re-reads authoritative DB/calendar state; empty scan
 * rows are bookkeeping only. Row creation kept for crash recovery unless proven redundant.
 */
export const SCHEDULER_TICK_CLASSIFICATION: Record<
  (typeof PROCESS_DUE_JOBS_SCHEDULER_JOB_TYPES)[number],
  SchedulerTickClass
> = {
  campaign_send_batch: "durable_tick_required",
  automation_batch: "durable_tick_required",
  voice_campaign_batch: "durable_tick_required",
  list_cleanup: "durable_tick_required",
  notification_digest: "durable_tick_required",
  campaign_recurrence_tick: "durable_tick_required",
  crm_scheduled_incremental: "durable_tick_required",
  mctb_trial_lifecycle: "durable_tick_required",
  appointment_webhook_sweep: "rescannable_poll",
  mctb_provider_reconciliation: "durable_tick_required",
  appointment_starting_soon_scan: "rescannable_poll",
  appointment_completed_scan: "rescannable_poll",
  appointment_workflow_time_scan: "rescannable_poll",
  appointment_no_show_scan: "rescannable_poll",
  appointments_platform_reminder_scan: "rescannable_poll",
  voice_v2_callback_sla_overdue_scan: "rescannable_poll",
  calendar_connections_reconcile: "rescannable_poll",
  calendar_subscription_renew: "durable_tick_required",
  promote_scheduled_receptionists: "rescannable_poll",
  crm_task_due_scan: "rescannable_poll",
  voice_ai_retention: "durable_tick_required",
  voice_webhook_dlq_reprocess: "durable_tick_required",
  job_queue_terminal_prune: "durable_tick_required",
  job_queue_lifecycle_scheduler_fixture: "rescannable_poll",
};

/** No tick-row creation changes in this pass — classification only. */
export const SCHEDULER_EMPTY_TICK_ROW_ELIMINATION: Record<string, "keep_durable_row"> =
  Object.fromEntries(
    PROCESS_DUE_JOBS_SCHEDULER_JOB_TYPES.map((t) => [t, "keep_durable_row"]),
  );
