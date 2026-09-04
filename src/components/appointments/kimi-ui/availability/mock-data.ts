export interface DaySchedule {
  day: string;
  open: boolean;
  windows: { start: string; end: string }[];
  closedNote?: string;
}

export const weeklyHours: DaySchedule[] = [
  { day: "Monday", open: true, windows: [{ start: "09:00 AM", end: "05:00 PM" }] },
  { day: "Tuesday", open: true, windows: [{ start: "09:00 AM", end: "05:00 PM" }] },
  { day: "Wednesday", open: true, windows: [{ start: "09:00 AM", end: "05:00 PM" }] },
  { day: "Thursday", open: true, windows: [{ start: "09:00 AM", end: "05:00 PM" }] },
  { day: "Friday", open: true, windows: [{ start: "09:00 AM", end: "05:00 PM" }] },
  { day: "Saturday", open: false, windows: [], closedNote: "No availability on Saturdays." },
  { day: "Sunday", open: false, windows: [], closedNote: "No availability on Sundays." },
];

export interface Override {
  month: string;
  dayNum: string;
  date: string;
  type: "custom" | "closed";
  hours: string;
  note: string;
}

export const overrides: Override[] = [
  { month: "MAY", dayNum: "27", date: "Tue, May 27, 2026", type: "custom", hours: "10:00 AM – 02:00 PM", note: "Team offsite" },
  { month: "JUL", dayNum: "04", date: "Fri, Jul 4, 2026", type: "closed", hours: "—", note: "Independence Day" },
  { month: "DEC", dayNum: "25", date: "Thu, Dec 25, 2026", type: "closed", hours: "—", note: "Christmas Day" },
];

export interface PreviewDay {
  label: string;
  date: string;
  hours?: string;
  status: "open" | "closed" | "override";
}

export const previewDays: PreviewDay[] = [
  { label: "Tomorrow", date: "Sat, May 24", hours: "9:00 AM – 5:00 PM", status: "open" },
  { label: "", date: "Sun, May 25", status: "closed" },
  { label: "", date: "Mon, May 26", hours: "9:00 AM – 5:00 PM", status: "open" },
  { label: "", date: "Tue, May 27", hours: "10:00 AM – 2:00 PM", status: "override" },
  { label: "", date: "Wed, May 28", hours: "9:00 AM – 5:00 PM", status: "open" },
];

export const bookingRules = {
  timezone: "America/New_York",
  minimumNotice: 60,
  minimumNoticeUnit: "minutes",
  bookingHorizon: 14,
  bookingHorizonUnit: "days",
};
