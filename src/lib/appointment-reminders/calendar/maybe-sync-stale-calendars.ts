import "server-only";

import { ensureAppointmentRemindersCalendarsSynced } from "@/lib/appointment-reminders/calendar/ensure-calendars-synced";

/** @deprecated Use ensureAppointmentRemindersCalendarsSynced */
export async function maybeSyncStaleAppointmentRemindersCalendars(workspaceId: string) {
  return ensureAppointmentRemindersCalendarsSynced(workspaceId);
}
