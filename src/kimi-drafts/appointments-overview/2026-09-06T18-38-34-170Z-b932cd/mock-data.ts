export type StatItem = {
  label: string;
  value: string;
  sub: string;
  icon: "calendar" | "check" | "send" | "shield";
  tint: "purple" | "green" | "blue" | "amber";
};

export type ScheduleItem = {
  id: string;
  time: string;
  dur: string;
  type: string;
  loc: string;
  name: string;
  phone: string;
  status: string;
};

export type ConversationItem = {
  id: string;
  initials: string;
  color: string;
  name: string;
  msg: string;
  tag: string;
  tagColor: string;
  time: string;
};

export type AttentionItem = {
  id: string;
  icon: "bell" | "shield" | "check-square";
  tint: string;
  title: string;
  sub: string;
  href: string;
};

export type OnboardingStep = {
  id: string;
  label: string;
  sub: string;
  done: boolean;
  cta: string;
};

export const stats: StatItem[] = [
  { label: "Upcoming appointments", value: "18", sub: "Next: Today 2:00 PM →", icon: "calendar", tint: "purple" },
  { label: "Confirmation rate", value: "92%", sub: "Last 7 days", icon: "check", tint: "green" },
  { label: "Reminders sent", value: "47", sub: "Last 7 days", icon: "send", tint: "blue" },
  { label: "Reminder health", value: "98%", sub: "Excellent", icon: "shield", tint: "amber" },
];

export const schedule: ScheduleItem[] = [
  { id: "a1", time: "9:00 AM", dur: "30m", type: "Water Heater Estimate", loc: "On-site", name: "Sarah Johnson", phone: "(571) 555-0142", status: "Confirmed" },
  { id: "a2", time: "10:30 AM", dur: "1h", type: "Initial Consultation", loc: "In-office", name: "Marcus Lee", phone: "(703) 555-0198", status: "Confirmed" },
  { id: "a3", time: "12:00 PM", dur: "45m", type: "Follow-up Visit", loc: "Video call", name: "Priya Patel", phone: "(202) 555-0177", status: "Awaiting confirmation" },
  { id: "a4", time: "2:00 PM", dur: "30m", type: "HVAC Inspection", loc: "On-site", name: "David Ortiz", phone: "(571) 555-0123", status: "Confirmed" },
  { id: "a5", time: "3:30 PM", dur: "1h", type: "Water Heater Estimate", loc: "On-site", name: "Emily Chen", phone: "(703) 555-0164", status: "Reschedule requested" },
];

export const scheduleTotal = 7;

export const chart = {
  points: [3, 5, 4, 7, 6, 8, 5],
  days: ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"],
  total: 38,
  deltaLabel: "38 total booked",
  peakLabel: "Tue 10/8 (8 appointments)",
  vsLastWeek: "↑ 12% vs last week",
};

export const conversations: ConversationItem[] = [
  { id: "c1", initials: "SJ", color: "purple", name: "Sarah Johnson", msg: "Perfect, see you at 9 tomorrow!", tag: "Unread", tagColor: "purple", time: "9:42 AM" },
  { id: "c2", initials: "ML", color: "green", name: "Marcus Lee", msg: "Can I move my consultation to next week?", tag: "Unread", tagColor: "purple", time: "8:15 AM" },
  { id: "c3", initials: "PP", color: "blue", name: "Priya Patel", msg: "Thanks for the reminder 👍", tag: "Recent", tagColor: "blue", time: "Yesterday" },
  { id: "c4", initials: "DO", color: "red", name: "David Ortiz", msg: "Confirmed for Thursday at 2.", tag: "Recent", tagColor: "blue", time: "Yesterday" },
];

export const attention: AttentionItem[] = [
  { id: "n1", icon: "check-square", tint: "amber", title: "2 awaiting confirmation", sub: "Appointments within 48 hours", href: "/appointments?status=awaiting" },
  { id: "n2", icon: "shield", tint: "red", title: "1 reschedule request", sub: "Emily Chen — Thu 3:30 PM", href: "/appointments/a5" },
  { id: "n3", icon: "bell", tint: "red", title: "1 reminder failed", sub: "Delivery failed — check phone number", href: "/appointments/reminders" },
  { id: "n4", icon: "bell", tint: "purple", title: "2 unread conversations", sub: "Customers replied in Messages", href: "/conversations" },
];

export const onboardingSteps: OnboardingStep[] = [
  { id: "s1", label: "Connect your calendar", sub: "Sync Microsoft or Google to block busy times", done: true, cta: "Connect" },
  { id: "s2", label: "Create a booking type", sub: "Define a service customers can book", done: true, cta: "Create type" },
  { id: "s3", label: "Set your availability", sub: "Hours, buffers, and blackout dates", done: false, cta: "Set hours" },
  { id: "s4", label: "Share your booking link", sub: "Copy your public booking page URL", done: false, cta: "Copy link" },
];

export const overviewModel = {
  dateLabel: "Today, Oct 9",
  stats,
  schedule,
  scheduleTotal,
  chart,
  conversations,
  attention,
};

// First-use / zero-data model (guided empty dashboard)
export const emptyModel = {
  dateLabel: "Today, Oct 9",
  stats: [
    { label: "Upcoming appointments", value: "0", sub: "No upcoming appointments", icon: "calendar", tint: "purple" },
    { label: "Confirmation rate", value: "—", sub: "No bookings yet", icon: "check", tint: "green" },
    { label: "Reminders sent", value: "0", sub: "Last 7 days", icon: "send", tint: "blue" },
    { label: "Reminder health", value: "—", sub: "No reminders yet", icon: "shield", tint: "amber" },
  ] as StatItem[],
  schedule: [] as ScheduleItem[],
  scheduleTotal: 0,
  chart: {
    points: [0, 0, 0, 0, 0, 0, 0],
    days: ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"],
    total: 0,
    deltaLabel: "No bookings yet",
    peakLabel: "—",
    vsLastWeek: "—",
  },
  conversations: [] as ConversationItem[],
  attention: [] as AttentionItem[],
};
