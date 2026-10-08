/**
 * Canonical job_queue priority tiers (lower number = higher priority).
 * Used by claimDueJobs and priority-aware BullMQ outbox sync.
 */
export const JOB_PRIORITY_MCTB_OUTBOUND_SMS = 5;
export const JOB_PRIORITY_MCTB_INBOUND_SMS = 8;
export const JOB_PRIORITY_VOICE_CONSEQUENTIAL = 10;
export const JOB_PRIORITY_TRANSACTIONAL = 25;
export const JOB_PRIORITY_DEFAULT = 50;
export const JOB_PRIORITY_BULK_BACKFILL = 70;

/** Jobs at or below this priority are drained before bulk/integration backfill. */
export const JOB_PRIORITY_INTERACTIVE_MAX = 20;

export const AR_JOB_TYPES = new Set(["ar_process_inbound_sms", "ar_send_customer_sms"]);

export const MCTB_JOB_TYPES = new Set([
  "mctb_process_inbound_sms",
  "mctb_send_customer_sms",
  "mctb_durable_operation_process",
  "mctb_voice_operation_hold_tick",
  "mctb_voice_operation_deliver",
  "mctb_voice_operation_expire_check",
  "mctb_worker_smoke",
]);
