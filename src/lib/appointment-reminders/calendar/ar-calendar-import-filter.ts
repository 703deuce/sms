import type { AppointmentMetadata } from "@/lib/appointments/types";
import { parseImportedExternalId } from "../../calendar/external-id";

export type ArCalendarSourceRow = {
  externalId?: string | null;
  metadata?: AppointmentMetadata | Record<string, unknown> | null;
};

/** True when the appointment row came from a connected provider calendar import/sync. */
export function isImportedCalendarAppointmentRow(row: ArCalendarSourceRow): boolean {
  const meta = (row.metadata || {}) as AppointmentMetadata;
  const externalId = row.externalId || "";
  const parsed = externalId ? parseImportedExternalId(externalId) : null;
  return (
    parsed?.provider === "microsoft" ||
    parsed?.provider === "google" ||
    (meta as { source?: string }).source === "calendar_import" ||
    Boolean((meta as { providerEventId?: string }).providerEventId)
  );
}
