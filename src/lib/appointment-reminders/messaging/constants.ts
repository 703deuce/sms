import "server-only";

export const AR_JOB_PROCESS_INBOUND_SMS = "ar_process_inbound_sms";
export const AR_QUEUE_NAME = "appointment_reminders";

export const AR_SMS_IDEMPOTENCY_PREFIX = "ar:";

export function arReminderOutboundIdempotencyKey(input: {
  workspaceId: string;
  appointmentId: string;
  timelineType: string;
}): string {
  return `${AR_SMS_IDEMPOTENCY_PREFIX}reminder:${input.workspaceId}:${input.appointmentId}:${input.timelineType}`;
}
