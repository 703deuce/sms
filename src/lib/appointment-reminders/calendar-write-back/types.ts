import type { AppointmentMetadata } from "@/lib/appointments/types";

export type ArCalendarWriteBackKind =
  | "confirmed"
  | "cancellation_requested"
  | "canceled"
  | "reschedule_requested"
  | "rescheduled";

export type ArCalendarWriteBackJobStatus = "pending" | "succeeded" | "failed" | "skipped";

export type ArCalendarWriteBackRecord = {
  revision: number;
  lastKind?: ArCalendarWriteBackKind;
  lastStatus: ArCalendarWriteBackJobStatus;
  lastAttemptAt?: string;
  lastSucceededAt?: string;
  lastError?: string;
  provider?: "microsoft";
  lastIdempotencyKey?: string;
  /** Provider @odata.etag or changeKey after last successful write */
  lastProviderEtag?: string;
};

export type ArCalendarWriteBackJobPayload = {
  workspaceId: string;
  appointmentId: string;
  kind: ArCalendarWriteBackKind;
  revision: number;
  atIso: string;
  timezone: string;
  previousStartsAtIso?: string;
  previousEndsAtIso?: string;
  newStartsAtIso?: string;
  newEndsAtIso?: string;
};

export type AppointmentMetadataWithWriteBack = AppointmentMetadata & {
  arCalendarWriteBack?: ArCalendarWriteBackRecord;
};

export const AR_CALENDAR_WRITE_BACK_JOB_TYPE = "ar_calendar_write_back";
