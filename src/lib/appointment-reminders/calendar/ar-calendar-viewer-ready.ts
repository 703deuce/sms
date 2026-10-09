import { isCalendarConnectionLinked } from "../calendar-connection";

export type ArOverviewCalendarRow = {
  status: string;
  importCalendarCount?: number | null;
};

export type ArIntegrationCalendarRow = {
  provider?: string;
  status?: string;
};

/** True when Calendar integrations would show a connected Microsoft/Google row. */
export function isArCalendarViewerReadyFromIntegrationRows(
  rows: ArIntegrationCalendarRow[] | null | undefined,
): boolean {
  if (!rows?.length) return false;
  return rows
    .filter((c) => ["google", "microsoft"].includes(String(c.provider || "")))
    .some((c) => isCalendarConnectionLinked(c.status));
}

/** True when the AR Calendar viewer should show the grid (not the connect empty state). */
export function isArCalendarViewerReadyFromOverview(
  data: {
    setup?: { calendarConnected?: boolean };
    calendars?: ArOverviewCalendarRow[];
  } | null
  | undefined,
): boolean {
  if (!data) return false;
  const calendars = data.calendars ?? [];
  if (calendars.some((c) => isCalendarConnectionLinked(c.status))) return true;
  return Boolean(data.setup?.calendarConnected);
}
