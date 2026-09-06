export type TimeWindow = { open: string; close: string };

export type DateOverride = {
  date: string;
  closed?: boolean;
  windows?: TimeWindow[];
};

export type Holiday = { date: string; name: string; closed: boolean };

export type NamedSchedule = {
  id: string;
  name: string;
  isDefault?: boolean;
  openDays: number;
};

export type AvailabilityFormState = {
  weeklyHours: Record<string, TimeWindow[]>;
  dateOverrides: DateOverride[];
  timezone: string;
  minimumNotice: number;
  maximumDays: number;
  maxPerDay: number;
  maxPerWeek: number;
  maxPerMonth: number;
  maxPerTypePerDay: number;
  activeScheduleId: string;
  namedSchedules: NamedSchedule[];
  holidays: Holiday[];
  overrideDate: string;
  overrideClosed: boolean;
  overrideOpen: string;
  overrideClose: string;
  holidayDate: string;
  holidayName: string;
  holidayClosed: boolean;
};

export const DAY_LABELS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
] as const;

export const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Australia/Sydney",
];

export function defaultWeeklyHours(): Record<string, TimeWindow[]> {
  return {
    monday: [{ open: "09:00", close: "17:00" }],
    tuesday: [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "17:00" }],
    wednesday: [{ open: "09:00", close: "17:00" }],
    thursday: [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "17:00" }],
    friday: [{ open: "09:00", close: "17:00" }],
    saturday: [],
    sunday: [],
  };
}

export function nextDateISO(daysAhead: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

export const EMPTY_AVAILABILITY_FORM: AvailabilityFormState = {
  weeklyHours: defaultWeeklyHours(),
  dateOverrides: [
    { date: nextDateISO(9), closed: true },
    { date: nextDateISO(16), windows: [{ open: "10:00", close: "14:00" }] },
  ],
  timezone: "America/New_York",
  minimumNotice: 60,
  maximumDays: 14,
  maxPerDay: 12,
  maxPerWeek: 40,
  maxPerMonth: 150,
  maxPerTypePerDay: 6,
  activeScheduleId: "standard",
  namedSchedules: [
    { id: "standard", name: "Standard hours", isDefault: true, openDays: 5 },
    { id: "evening", name: "Evening hours", openDays: 4 },
    { id: "summer", name: "Summer Fridays", openDays: 5 },
  ],
  holidays: [
    { date: nextDateISO(84), name: "Thanksgiving Day", closed: true },
    { date: nextDateISO(109), name: "Christmas Day", closed: true },
    { date: nextDateISO(115), name: "New Year's Day", closed: true },
  ],
  overrideDate: "",
  overrideClosed: false,
  overrideOpen: "10:00",
  overrideClose: "14:00",
  holidayDate: "",
  holidayName: "",
  holidayClosed: true,
};

export function formatTime12h(time: string) {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatWindowRange(windows: TimeWindow[]) {
  if (!windows.length) return "—";
  return windows.map((w) => `${formatTime12h(w.open)} – ${formatTime12h(w.close)}`).join(", ");
}

export function formatOverrideDate(date: string) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
