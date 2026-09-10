import type { AppointmentPlatformConfig } from "@/lib/appointments/types";
import type {
  AvailabilityFormState,
  AvailabilityPageModel,
  DateOverride,
  DayScheduleRow,
  OverrideRow,
  PreviewDayRow,
  SummaryItem,
  TimeWindow,
} from "./types";

export const DAY_LABELS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
] as const;

export function defaultWeeklyHours(): Record<string, TimeWindow[]> {
  return {
    monday: [{ open: "09:00", close: "17:00" }],
    tuesday: [{ open: "09:00", close: "17:00" }],
    wednesday: [{ open: "09:00", close: "17:00" }],
    thursday: [{ open: "09:00", close: "17:00" }],
    friday: [{ open: "09:00", close: "17:00" }],
    saturday: [],
    sunday: [],
  };
}

export const EMPTY_AVAILABILITY_FORM: AvailabilityFormState = {
  weeklyHours: defaultWeeklyHours(),
  dateOverrides: [],
  timezone: "America/New_York",
  minimumNotice: 60,
  maximumDays: 14,
  namedSchedules: [],
  holidays: [],
  overrideDate: "",
  overrideClosed: false,
  overrideOpen: "10:00",
  overrideClose: "14:00",
  blackoutDates: [],
  customStartIntervalMinutes: undefined,
  fixedStartTimesEnabled: false,
  fixedStartTimes: "",
  availabilityDensityHidePercent: undefined,
  minimizeGapsMode: "off",
};

export function formStateFromSettings(data: AppointmentPlatformConfig): AvailabilityFormState {
  return {
    ...EMPTY_AVAILABILITY_FORM,
    weeklyHours:
      data.weeklyHours && Object.keys(data.weeklyHours).length
        ? data.weeklyHours
        : defaultWeeklyHours(),
    dateOverrides: data.dateOverrides || [],
    timezone: data.timezone || "America/New_York",
    minimumNotice: data.minimumBookingNoticeMinutes ?? 60,
    maximumDays: data.maximumBookingDaysAhead ?? 14,
    maxBookingsPerDay: data.bookingLimits?.maxBookingsPerDay,
    maxBookingsPerWeek: data.bookingLimits?.maxBookingsPerWeek,
    maxPerTypePerDay: data.bookingLimits?.maxPerTypePerDay,
    namedSchedules: (data.namedSchedules || []).map((s) => ({
      id: s.id,
      name: s.name,
      timezone: s.timezone,
      weeklyHours: s.weeklyHours || defaultWeeklyHours(),
      isDefault: s.isDefault,
    })),
    holidays: (data.holidays || []).map((h) => ({
      date: h.date,
      name: h.name,
      closed: h.closed,
    })),
    blackoutDates: data.blackoutDates || [],
    customStartIntervalMinutes: data.schedulingLimits?.customStartIntervalMinutes,
    fixedStartTimesEnabled: data.schedulingLimits?.fixedStartTimes?.enabled ?? false,
    fixedStartTimes: (data.schedulingLimits?.fixedStartTimes?.times || []).join(", "),
    availabilityDensityHidePercent: data.schedulingLimits?.availabilityDensityHidePercent,
    minimizeGapsMode: data.schedulingLimits?.minimizeGapsMode ?? "off",
  };
}

function formatTime12h(time: string) {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatWindowRange(windows: TimeWindow[]) {
  if (!windows.length) return "—";
  return windows.map((w) => `${formatTime12h(w.open)} – ${formatTime12h(w.close)}`).join(", ");
}

function formatOverrideDate(date: string) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function mapWeeklyHours(weeklyHours: Record<string, TimeWindow[]>): DayScheduleRow[] {
  return DAY_LABELS.map(({ key, label }) => {
    const windows = weeklyHours[key] || [];
    const open = windows.length > 0;
    return {
      key,
      day: label,
      open,
      windows,
      closedNote: open ? undefined : `No availability on ${label}s.`,
    };
  });
}

function mapOverrides(overrides: DateOverride[]): OverrideRow[] {
  return overrides
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((o) => {
      const d = new Date(`${o.date}T12:00:00`);
      return {
        isoDate: o.date,
        month: Number.isNaN(d.getTime())
          ? ""
          : d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
        dayNum: Number.isNaN(d.getTime()) ? "" : String(d.getDate()),
        date: formatOverrideDate(o.date),
        type: o.closed ? "closed" : "custom",
        hours: o.closed ? "—" : formatWindowRange(o.windows || []),
        note: o.closed ? "Closed all day" : "Custom hours",
      };
    });
}

function countOpenDays(weeklyHours: Record<string, TimeWindow[]>) {
  return DAY_LABELS.filter(({ key }) => (weeklyHours[key] || []).length > 0).length;
}

function buildPreviewDays(
  weeklyHours: Record<string, TimeWindow[]>,
  dateOverrides: DateOverride[],
): PreviewDayRow[] {
  const overrideMap = new Map(dateOverrides.map((o) => [o.date, o]));
  const rows: PreviewDayRow[] = [];

  for (let i = 1; i <= 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const override = overrideMap.get(iso);
    const dayKey = DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1].key;
    const windows = weeklyHours[dayKey] || [];

    let status: PreviewDayRow["status"] = "open";
    let hours: string | undefined;

    if (override?.closed) {
      status = "override";
      hours = undefined;
    } else if (override?.windows?.length) {
      status = "override";
      hours = formatWindowRange(override.windows);
    } else if (!windows.length) {
      status = "closed";
    } else {
      hours = formatWindowRange(windows);
    }

    rows.push({
      label: i === 1 ? "Tomorrow" : "",
      date: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      hours: status === "closed" ? undefined : hours,
      status: status === "open" && !windows.length ? "closed" : status,
    });
  }

  return rows;
}

function buildSummary(
  form: AvailabilityFormState,
  weeklyHours: DayScheduleRow[],
): SummaryItem[] {
  const openDays = countOpenDays(form.weeklyHours);
  return [
    {
      icon: "globe",
      bg: "#efecfd",
      color: "#147d74",
      title: "Timezone",
      value: form.timezone,
    },
    {
      icon: "clock",
      bg: "#e6f7ef",
      color: "#16a05a",
      title: "Minimum notice",
      value: `${form.minimumNotice} minutes`,
    },
    {
      icon: "calendar",
      bg: "#efecfd",
      color: "#147d74",
      title: "Booking horizon",
      value: `${form.maximumDays} days`,
    },
    {
      icon: "calendar-range",
      bg: "#fdf3e3",
      color: "#d98a16",
      title: "Weekly coverage",
      value: `${openDays} day${openDays === 1 ? "" : "s"} per week`,
    },
    {
      icon: "sparkles",
      bg: "#dcefeb",
      color: "#147d74",
      title: "Next available",
      value:
        weeklyHours.find((d) => d.open)?.windows[0]
          ? `Tomorrow at ${formatTime12h(weeklyHours.find((d) => d.open)!.windows[0].open)}`
          : "No upcoming slots",
    },
  ];
}

export function buildAvailabilityPageModel(
  form: AvailabilityFormState,
  opts: { saving: boolean; saved: boolean },
): AvailabilityPageModel {
  const weeklyHours = mapWeeklyHours(form.weeklyHours);
  return {
    weeklyHours,
    overrides: mapOverrides(form.dateOverrides),
    previewDays: buildPreviewDays(form.weeklyHours, form.dateOverrides),
    summary: buildSummary(form, weeklyHours),
    bookingRules: {
      timezone: form.timezone,
      minimumNotice: form.minimumNotice,
      minimumNoticeUnit: "minutes",
      bookingHorizon: form.maximumDays,
      bookingHorizonUnit: "days",
    },
    form,
    saving: opts.saving,
    saved: opts.saved,
  };
}

export function buildSettingsPatch(form: AvailabilityFormState) {
  const bookingLimits =
    form.maxBookingsPerDay || form.maxBookingsPerWeek || form.maxPerTypePerDay
      ? {
          maxBookingsPerDay: form.maxBookingsPerDay || undefined,
          maxBookingsPerWeek: form.maxBookingsPerWeek || undefined,
          maxPerTypePerDay: form.maxPerTypePerDay || undefined,
        }
      : undefined;
  const fixedTimes = form.fixedStartTimes
    .split(/[,;\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const hasSchedulingRules =
    form.customStartIntervalMinutes != null ||
    form.fixedStartTimesEnabled ||
    form.availabilityDensityHidePercent != null ||
    form.minimizeGapsMode !== "off";
  const schedulingLimits = hasSchedulingRules
    ? {
        customStartIntervalMinutes: form.customStartIntervalMinutes || undefined,
        fixedStartTimes: form.fixedStartTimesEnabled
          ? { enabled: true, times: fixedTimes }
          : undefined,
        availabilityDensityHidePercent:
          form.availabilityDensityHidePercent && form.availabilityDensityHidePercent > 0
            ? form.availabilityDensityHidePercent
            : undefined,
        minimizeGapsMode: form.minimizeGapsMode,
      }
    : undefined;

  return {
    weeklyHours: form.weeklyHours,
    dateOverrides: form.dateOverrides,
    timezone: form.timezone,
    minimumBookingNoticeMinutes: form.minimumNotice,
    maximumBookingDaysAhead: form.maximumDays,
    bookingLimits,
    schedulingLimits,
    namedSchedules: form.namedSchedules,
    holidays: form.holidays,
    blackoutDates: form.blackoutDates,
  };
}
