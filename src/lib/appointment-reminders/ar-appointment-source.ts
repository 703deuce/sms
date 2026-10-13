import type { ArAppointmentRow } from "@/lib/appointment-reminders/appointments-page-types";

/** Provider-imported calendar row — scheduling edit/drag may be restricted. */
export function isImportedArAppointmentRow(row: Pick<ArAppointmentRow, "sourceProvider" | "connectionId">): boolean {
  const p = (row.sourceProvider || "").toLowerCase();
  if (p === "microsoft" || p === "google") return true;
  return Boolean(row.connectionId);
}

/** Native Transovo booking (admin create, public book, staff schedule). */
export function isNativeArAppointmentRow(row: Pick<ArAppointmentRow, "sourceProvider" | "connectionId">): boolean {
  return !isImportedArAppointmentRow(row);
}
