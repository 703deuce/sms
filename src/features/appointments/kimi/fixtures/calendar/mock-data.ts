export const stats = [
  { icon: "calendar", tone: "indigo", value: "28", label: "Appointments", delta: "27% vs last week", deltaUp: true },
  { icon: "check", tone: "green", value: "22", label: "Confirmed", delta: "79% of total", deltaUp: false },
  { icon: "clock", tone: "amber", value: "4", label: "Pending", delta: "14% of total", deltaUp: false },
  { icon: "x", tone: "red", value: "2", label: "Canceled", delta: "7% of total", deltaUp: false },
  { icon: "users", tone: "violet", value: "15h 30m", label: "Total duration", delta: "12% vs last week", deltaUp: true },
];

export const weekDays = [
  { label: "SUN", date: "Aug 30", today: false },
  { label: "MON", date: "Aug 31", today: false },
  { label: "TUE", date: "Sep 1", today: false },
  { label: "WED", date: "Sep 2", today: false },
  { label: "THU", date: "Sep 3", today: false },
  { label: "FRI", date: "Sep 4", today: true },
  { label: "SAT", date: "Sep 5", today: false },
];

export const hours = [
  "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM",
  "2 PM", "3 PM", "4 PM", "5 PM", "6 PM",
];

export type WeekEvent = {
  id: string;
  day: number;
  start: number;
  duration: number;
  timeLabel: string;
  title: string;
  name: string;
  type: "consultation" | "call" | "followup" | "onboarding" | "canceled";
  status: "confirmed" | "pending" | "canceled";
};

export const weekEvents: WeekEvent[] = [
  { id: "1", day: 1, start: 9, duration: 1, timeLabel: "9:00 AM", title: "Consultation", name: "Alex Johnson", type: "consultation", status: "confirmed" },
  { id: "2", day: 2, start: 9.5, duration: 0.75, timeLabel: "9:30 AM", title: "Strategy Call", name: "Maria Garcia", type: "call", status: "confirmed" },
  { id: "3", day: 3, start: 10, duration: 1, timeLabel: "10:00 AM", title: "Follow-up", name: "James Lee", type: "followup", status: "pending" },
  { id: "4", day: 5, start: 8.5, duration: 0.75, timeLabel: "8:30 AM", title: "Discovery Call", name: "Sarah Williams", type: "consultation", status: "confirmed" },
  { id: "5", day: 5, start: 10.5, duration: 0.5, timeLabel: "10:30 AM", title: "Consultation", name: "Robert Brown", type: "consultation", status: "confirmed" },
  { id: "6", day: 0, start: 11, duration: 1, timeLabel: "11:00 AM", title: "Onboarding Call", name: "Michael Davis", type: "onboarding", status: "confirmed" },
  { id: "7", day: 2, start: 11.5, duration: 1, timeLabel: "11:30 AM", title: "Product Demo", name: "Jennifer Wilson", type: "call", status: "confirmed" },
  { id: "8", day: 3, start: 13, duration: 0.75, timeLabel: "1:00 PM", title: "Check-in Call", name: "David Miller", type: "call", status: "confirmed" },
  { id: "9", day: 1, start: 14.5, duration: 0.75, timeLabel: "2:30 PM", title: "Proposal Review", name: "William Taylor", type: "followup", status: "pending" },
  { id: "10", day: 4, start: 14, duration: 1, timeLabel: "2:00 PM", title: "Consultation", name: "Lisa Anderson", type: "consultation", status: "confirmed" },
  { id: "11", day: 3, start: 15.5, duration: 1, timeLabel: "3:30 PM", title: "Training Session", name: "Emily Thomas", type: "onboarding", status: "confirmed" },
  { id: "12", day: 5, start: 16, duration: 0.75, timeLabel: "4:00 PM", title: "Canceled", name: "Brian Martinez", type: "canceled", status: "canceled" },
];

export const typeColors: Record<string, { label: string; dot: string }> = {
  consultation: { label: "Consultation", dot: "#a78bfa" },
  call: { label: "Call", dot: "#93c5fd" },
  followup: { label: "Follow-up", dot: "#fcd34d" },
  onboarding: { label: "Onboarding", dot: "#6ee7b7" },
  canceled: { label: "Canceled", dot: "#f9a8d4" },
};

const days: { day: number; muted: boolean; selected: boolean; hasEvent: boolean }[] = [];
[26, 27, 28, 29, 30, 31, 1].forEach((d) => days.push({ day: d, muted: true, selected: false, hasEvent: false }));
const eventDays = new Set([4, 6, 10, 13, 18, 21, 26, 30]);
for (let d = 2; d <= 31; d++) {
  days.push({ day: d, muted: false, selected: d === 30, hasEvent: eventDays.has(d) });
}
[1, 2, 3, 4, 5].forEach((d) => days.push({ day: d, muted: true, selected: false, hasEvent: false }));
export const miniCal = days;

export const agenda = [
  { id: "a1", time: "8:30 AM", duration: "45m", title: "Discovery Call", name: "Sarah Williams", status: "confirmed", dot: "#a78bfa" },
  { id: "a2", time: "10:30 AM", duration: "30m", title: "Consultation", name: "Robert Brown", status: "confirmed", dot: "#a78bfa" },
  { id: "a3", time: "2:00 PM", duration: "45m", title: "Strategy Review", name: "Kevin White", status: "pending", dot: "#a78bfa" },
  { id: "a4", time: "4:00 PM", duration: "30m", title: "Canceled", name: "Brian Martinez", status: "canceled", dot: "#f9a8d4" },
];

export const nextAppointment = {
  inLabel: "in 2h 15m",
  time: "10:30 AM – 11:00 AM",
  duration: "30 min",
  title: "Consultation",
  name: "Robert Brown",
  method: "Phone Call",
  phone: "+1 (555) 567-8901",
};
