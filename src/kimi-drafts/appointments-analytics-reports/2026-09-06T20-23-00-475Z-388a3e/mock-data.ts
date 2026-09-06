export type AnalyticsData = {
  rangeDays: number;
  booked: number;
  completed?: number;
  confirmed: number;
  awaiting: number;
  canceled: number;
  noShow: number;
  rescheduleRequested: number;
  confirmationRate: number;
  cancellationRate?: number;
  noShowRate?: number;
  rescheduleRate?: number;
  remindersSent: number;
  remindersFailed: number;
  emailOpens?: number;
  emailClicks?: number;
  smsResponses?: number;
  utmConversions?: number;
  conversionRate?: number;
  popularTypes?: Array<{ name: string; count: number }>;
  popularTimes?: Array<{ hour: number; count: number }>;
  series: Array<{ date: string; count: number }>;
};

function buildSeries(days: number, seed: number) {
  const out: Array<{ date: string; count: number }> = [];
  const today = new Date("2026-02-12T00:00:00");
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    const base = dow === 0 || dow === 6 ? 2 : 7;
    const wave = Math.round(
      base + ((i * seed) % 5) + (dow === 3 ? 3 : 0)
    );
    out.push({
      date: d.toISOString().slice(0, 10),
      count: Math.max(1, wave),
    });
  }
  return out;
}

export const analytics7: AnalyticsData = {
  rangeDays: 7,
  booked: 48,
  completed: 31,
  confirmed: 34,
  awaiting: 9,
  canceled: 4,
  noShow: 3,
  rescheduleRequested: 5,
  confirmationRate: 71,
  cancellationRate: 8.3,
  noShowRate: 6.3,
  rescheduleRate: 10.4,
  remindersSent: 132,
  remindersFailed: 2,
  emailOpens: 96,
  emailClicks: 41,
  smsResponses: 27,
  utmConversions: 12,
  conversionRate: 25,
  popularTypes: [
    { name: "Initial Consultation", count: 16 },
    { name: "Follow-up Visit", count: 12 },
    { name: "Water Heater Estimate", count: 8 },
    { name: "Annual Checkup", count: 6 },
    { name: "Strategy Call", count: 6 },
  ],
  popularTimes: [
    { hour: 8, count: 3 },
    { hour: 9, count: 7 },
    { hour: 10, count: 9 },
    { hour: 11, count: 6 },
    { hour: 13, count: 5 },
    { hour: 14, count: 8 },
    { hour: 15, count: 6 },
    { hour: 16, count: 4 },
  ],
  series: buildSeries(7, 3),
};

export const analytics30: AnalyticsData = {
  rangeDays: 30,
  booked: 214,
  completed: 156,
  confirmed: 161,
  awaiting: 28,
  canceled: 17,
  noShow: 11,
  rescheduleRequested: 19,
  confirmationRate: 75,
  cancellationRate: 7.9,
  noShowRate: 5.1,
  rescheduleRate: 8.9,
  remindersSent: 587,
  remindersFailed: 9,
  emailOpens: 431,
  emailClicks: 187,
  smsResponses: 122,
  utmConversions: 54,
  conversionRate: 25.2,
  popularTypes: [
    { name: "Initial Consultation", count: 72 },
    { name: "Follow-up Visit", count: 51 },
    { name: "Water Heater Estimate", count: 34 },
    { name: "Annual Checkup", count: 29 },
    { name: "Strategy Call", count: 28 },
  ],
  popularTimes: [
    { hour: 8, count: 14 },
    { hour: 9, count: 31 },
    { hour: 10, count: 38 },
    { hour: 11, count: 27 },
    { hour: 13, count: 24 },
    { hour: 14, count: 35 },
    { hour: 15, count: 26 },
    { hour: 16, count: 19 },
  ],
  series: buildSeries(30, 2),
};

export const analyticsEmpty: AnalyticsData = {
  rangeDays: 7,
  booked: 0,
  completed: 0,
  confirmed: 0,
  awaiting: 0,
  canceled: 0,
  noShow: 0,
  rescheduleRequested: 0,
  confirmationRate: 0,
  cancellationRate: 0,
  noShowRate: 0,
  rescheduleRate: 0,
  remindersSent: 0,
  remindersFailed: 0,
  emailOpens: 0,
  emailClicks: 0,
  smsResponses: 0,
  utmConversions: 0,
  conversionRate: 0,
  popularTypes: [],
  popularTimes: [],
  series: [],
};

export const appointmentsAnalyticsTabs = [
  { label: "Overview", href: "/appointments/analytics" },
  { label: "Booking", href: "/appointments/analytics/booking" },
  { label: "Reminders", href: "/appointments/analytics/reminders" },
  { label: "Automations", href: "/appointments/analytics/automations" },
  { label: "Reports", href: "/appointments/analytics/reports" },
];

export type AppointmentsAnalyticsSection =
  | "overview"
  | "booking"
  | "reminders"
  | "automations"
  | "reports";

export function getAnalytics(range: 7 | 30): AnalyticsData {
  return range === 7 ? analytics7 : analytics30;
}
