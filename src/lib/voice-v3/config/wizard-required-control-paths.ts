/**
 * Customer-editable wizard control paths that must each have a manifest row
 * (exact statePath match). Repeatable collections use `[]` item-property form.
 */
const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const AFTER_HOURS_WHEN_CLOSED_KEYS = [
  "allowLiveBooking",
  "allowCallbackRequest",
  "allowMessageTaking",
  "allowOnCallEscalation",
  "allowOfficeTransfer",
  "allowNormalTransferDestinations",
] as const;

function weeklyDayPaths(): string[] {
  const paths: string[] = [];
  for (const day of WEEKDAYS) {
    paths.push(`operatingMaturity.businessSchedule.weekly.${day}.closed`);
    paths.push(`operatingMaturity.businessSchedule.weekly.${day}.ranges[].start`);
    paths.push(`operatingMaturity.businessSchedule.weekly.${day}.ranges[].end`);
  }
  return paths;
}

function afterHoursPaths(): string[] {
  return [
    "operatingMaturity.afterHoursBehavior.useOperatingStateDuringCalls",
    ...AFTER_HOURS_WHEN_CLOSED_KEYS.map(
      (k) => `operatingMaturity.afterHoursBehavior.whenClosed.${k}`,
    ),
  ];
}

/** Paths that must appear as manifest rows (nested control-level gate). */
export const WIZARD_REQUIRED_CONTROL_PATHS: readonly string[] = [
  ...weeklyDayPaths(),
  ...afterHoursPaths(),
  "operatingMaturity.businessSchedule.holidays[].id",
  "operatingMaturity.businessSchedule.holidays[].name",
  "operatingMaturity.businessSchedule.holidays[].startDate",
  "operatingMaturity.businessSchedule.holidays[].endDate",
  "operatingMaturity.businessSchedule.holidays[].closedAllDay",
  "operatingMaturity.onCallSchedule.enabled",
  "operatingMaturity.onCallSchedule.entries[].id",
  "operatingMaturity.onCallSchedule.entries[].label",
  "operatingMaturity.onCallSchedule.entries[].phoneE164",
];
