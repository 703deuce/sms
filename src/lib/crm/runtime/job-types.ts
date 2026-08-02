/**
 * Canonical CRM job types emitted by the Salesforce/Zoho/Pipedrive runtime.
 * Every entry MUST have an active case in `src/lib/jobs/job-handlers.ts`.
 * Tests fail if Salesforce (or any CRM provider) emits an unregistered type.
 */

export const CRM_JOB_TYPES = [
  "crm_sync",
  "crm_push_event",
  "crm_metadata_refresh",
  "crm_bulk_sync",
  "crm_webhook_process",
  "crm_scheduled_incremental",
  "crm_automation_action",
] as const;

export type CrmJobType = (typeof CRM_JOB_TYPES)[number];

export function isCrmJobType(value: string): value is CrmJobType {
  return (CRM_JOB_TYPES as readonly string[]).includes(value);
}
