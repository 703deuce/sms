export type EventType = "consultation" | "call" | "followup" | "onboarding" | "canceled";
export type EventStatus = "confirmed" | "pending" | "canceled";

export type CalEvent = {
  id: string;
  day: number; // 0-6 index into weekDays
  start: number; // hour, fractional (8..18)
  duration: number; // hours
  timeLabel: string;
  title: string;
  name: string;
  type: EventType;
  status: EventStatus;
};

export const TYPE_COLORS: Record<EventType, { label: string; dot: string; bg: string; border: string; text: string }> = {
  consultation: { label: "Consultation", dot: "#a78bfa", bg: "#f5f3ff", border: "#ddd6fe", text: "#6d28d9" },
  call: { label: "Call", dot: "#93c5fd", bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  followup: { label: "Follow-up", dot: "#fcd34d", bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
  onboarding: { label: "Onboarding", dot: "#6ee7b7", bg: "#ecfdf5", border: "#a7f3d0", text: "#047857" },
  canceled: { label: "Canceled", dot: "#f9a8d4", bg: "#fdf2f8", border: "#fbcfe8", text: "#be185d" },
};

export const HOURS = [
  "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM",
  "2 PM", "3 PM", "4 PM", "5 PM", "6 PM",
];

export const WEEK_DAYS = [
  { label: "Sun", date: "14", today: false },
  { label: "Mon", date: "15", today: false },
  { label: "Tue", date: "16", today: false },
  { label: "Wed", date: "17", today: true },
  { label: "Thu", date: "18", today: false },
  { label: "Fri", date: "19", today: false },
  { label: "Sat", date: "20", today: false },
];

export const WEEK_EVENTS: CalEvent[] = [
  { id: "1", day: 1, start: 9, duration: 1, timeLabel: "9:00 AM", title: "Initial Consultation", name: "Sarah Johnson", type: "consultation", status: "confirmed" },
  { id: "2", day: 1, start: 13, duration: 0.5, timeLabel: "1:00 PM", title: "Discovery Call", name: "Marcus Lee", type: "call", status: "pending" },
  { id: "3", day: 2, start: 10, duration: 0.5, timeLabel: "10:00 AM", title: "Follow-up Call", name: "Priya Patel", type: "followup", status: "confirmed" },
  { id: "4", day: 2, start: 14, duration: 1, timeLabel: "2:00 PM", title: "Water Heater Estimate", name: "Tom Alvarez", type: "consultation", status: "confirmed" },
  { id: "5", day: 3, start: 9, duration: 1, timeLabel: "9:00 AM", title: "Onboarding Session", name: "Emily Chen", type: "onboarding", status: "confirmed" },
  { id: "6", day: 3, start: 11, duration: 0.5, timeLabel: "11:00 AM", title: "Rescheduled Consult", name: "Dan Wright", type: "consultation", status: "canceled" },
  { id: "7", day: 3, start: 15, duration: 1, timeLabel: "3:00 PM", title: "Follow-up Visit", name: "Alicia Gomez", type: "followup", status: "pending" },
  { id: "8", day: 4, start: 10, duration: 0.5, timeLabel: "10:00 AM", title: "Demo Call", name: "Jordan Kim", type: "call", status: "confirmed" },
  { id: "9", day: 4, start: 13, duration: 1, timeLabel: "1:00 PM", title: "Quarterly Review", name: "Noah Smith", type: "consultation", status: "confirmed" },
  { id: "10", day: 5, start: 11, duration: 0.5, timeLabel: "11:00 AM", title: "Onboarding Call", name: "Grace Miller", type: "onboarding", status: "pending" },
];

export const STATS = [
  { icon: "calendar", tone: "indigo", value: "10", label: "Appointments", delta: "In selected range" },
  { icon: "check", tone: "green", value: "6", label: "Confirmed", delta: "60% of total" },
  { icon: "clock", tone: "amber", value: "3", label: "Pending", delta: "30% of total" },
  { icon: "x", tone: "red", value: "1", label: "Canceled", delta: "10% of total" },
  { icon: "users", tone: "violet", value: "7h 30m", label: "Total duration", delta: "Across 10 bookings" },
] as const;

export const AGENDA_ITEMS = [
  { id: "5", time: "9:00 AM", duration: "60 min", title: "Onboarding Session", name: "Emily Chen", status: "confirmed" as const, dot: "#6ee7b7" },
  { id: "6", time: "11:00 AM", duration: "30 min", title: "Rescheduled Consult", name: "Dan Wright", status: "canceled" as const, dot: "#f9a8d4" },
  { id: "7", time: "3:00 PM", duration: "60 min", title: "Follow-up Visit", name: "Alicia Gomez", status: "pending" as const, dot: "#fcd34d" },
];

export const NEXT_APPOINTMENT = {
  id: "7",
  inLabel: "In 2 hours",
  time: "3:00 – 4:00 PM",
  duration: "60 min",
  title: "Follow-up Visit",
  name: "Alicia Gomez",
  method: "Video meeting",
  phone: "(571) 555-0142",
  status: "pending" as const,
};

export const MINI_MONTH = {
  monthLabel: "September 2026",
  days: [
    // 6 weeks x 7; muted = prev/next month, selected day = 17, event days marked
    ...Array.from({ length: 31 }, (_, i) => ({ day: i + 1, muted: false })),
  ].map((d) => ({
    ...d,
    selected: d.day === 17,
    hasEvent: [1, 3, 8, 10, 14, 15, 16, 17, 18, 19, 22, 25, 29].includes(d.day),
  })),
  leadMuted: [30, 31], // prev-month trailing days
  trailMuted: [1, 2, 3],
};
