import { isCalendarConnectionUsable } from "../calendar-connection";

export type ArOverviewCalendarRow = {
  status: string;
  importCalendarCount?: number | null;
};

/** True when the AR Calendar viewer should show the grid (≥1 usable connection with import calendars). */
export function isArCalendarViewerReadyFromOverview(
  data: {
    setup?: { calendarConnected?: boolean };
    calendars?: ArOverviewCalendarRow[];
    readiness?: { hasImportCalendars?: boolean };
  } | null
  | undefined,
): boolean {
  if (!data) return false;
  const calendars = data.calendars ?? [];
  const hasImportingConnection = calendars.some(
    (c) => isCalendarConnectionUsable(c.status) && (c.importCalendarCount ?? 0) > 0,
  );
  if (hasImportingConnection) return true;
  if (data.setup?.calendarConnected === true) return true;
  return Boolean(
    data.readiness?.hasImportCalendars &&
      calendars.some((c) => isCalendarConnectionUsable(c.status)),
  );
}
