export type AnalyticsData = {
  rangeDays: number;
  booked: number;
  completed: number;
  confirmed: number;
  awaiting: number;
  canceled: number;
  noShow: number;
  rescheduleRequested: number;
  confirmationRate: number;
  cancellationRate: number;
  noShowRate: number;
  rescheduleRate: number;
  remindersSent: number;
  remindersFailed: number;
  emailOpens: number;
  emailClicks: number;
  smsResponses: number;
  utmConversions: number;
  conversionRate: number;
  popularTypes: Array<{ name: string; count: number }>;
  popularTimes: Array<{ hour: number; count: number }>;
  series: Array<{ date: string; count: number }>;
};

function buildSeries(days: number, base: number[]): Array<{ date: string; count: number }> {
  const out: Array<{ date: string; count: number }> = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const count = base[(days - 1 - i) % base.length];
    out.push({ date: d.toISOString().slice(0, 10), count });
  }
  return out;
}

export const analytics7: AnalyticsData = {
  rangeDays: 7,
  booked: 148,
  completed: 96,
  confirmed: 112,
  awaiting: 21,
  canceled: 9,
  noShow: 6,
  rescheduleRequested: 11,
  confirmationRate: 86,
  cancellationRate: 6.1,
  noShowRate: 4.1,
  rescheduleRate: 7.4,
  remindersSent: 402,
  remindersFailed: 3,
  emailOpens: 268,
  emailClicks: 94,
  smsResponses: 61,
  utmConversions: 38,
  conversionRate: 62,
  popularTypes: [
    { name: "Initial Consultation", count: 54 },
    { name: "Follow-up Visit", count: 37 },
    { name: "Water Heater Estimate", count: 22 },
    { name: "Annual Review", count: 18 },
    { name: "Demo Call", count: 17 },
  ],
  popularTimes: [
    { hour: 8, count: 6 },
    { hour: 9, count: 18 },
    { hour: 10, count: 27 },
    { hour: 11, count: 22 },
    { hour: 12, count: 9 },
    { hour: 13, count: 14 },
    { hour: 14, count: 24 },
    { hour: 15, count: 19 },
    { hour: 16, count: 9 },
  ],
  series: buildSeries(7, [14, 22, 19, 26, 31, 18, 18]),
};

export const analytics30: AnalyticsData = {
  rangeDays: 30,
  booked: 612,
  completed: 428,
  confirmed: 489,
  awaiting: 74,
  canceled: 31,
  noShow: 18,
  rescheduleRequested: 46,
  confirmationRate: 84,
  cancellationRate: 5.1,
  noShowRate: 2.9,
  rescheduleRate: 7.5,
  remindersSent: 1738,
  remindersFailed: 14,
  emailOpens: 1104,
  emailClicks: 402,
  smsResponses: 263,
  utmConversions: 171,
  conversionRate: 58,
  popularTypes: [
    { name: "Initial Consultation", count: 226 },
    { name: "Follow-up Visit", count: 158 },
    { name: "Water Heater Estimate", count: 84 },
    { name: "Annual Review", count: 79 },
    { name: "Demo Call", count: 65 },
  ],
  popularTimes: [
    { hour: 8, count: 24 },
    { hour: 9, count: 76 },
    { hour: 10, count: 112 },
    { hour: 11, count: 96 },
    { hour: 12, count: 41 },
    { hour: 13, count: 58 },
    { hour: 14, count: 98 },
    { hour: 15, count: 74 },
    { hour: 16, count: 33 },
  ],
  series: buildSeries(30, [
    12, 18, 22, 19, 26, 14, 9, 21, 24, 28, 17, 23, 31, 12, 16, 25, 29, 20, 27, 33, 15, 11, 22, 26, 30, 18, 24, 28, 13, 20,
  ]),
};

export function getAnalytics(range: 7 | 30): AnalyticsData {
  return range === 7 ? analytics7 : analytics30;
}

export const analyticsTabs = [
  { id: "overview", label: "Overview" },
  { id: "booking", label: "Booking" },
  { id: "reminders", label: "Reminders" },
  { id: "automations", label: "Automations" },
  { id: "reports", label: "Reports" },
] as const;

export type AnalyticsSection = (typeof analyticsTabs)[number]["id"];

export const sectionMeta: Record<AnalyticsSection, { title: string; description: string }> = {
  overview: {
    title: "Analytics",
    description: "High-level appointment operation performance.",
  },
  booking: {
    title: "Booking analytics",
    description: "Booking volume, conversion, and popular booking patterns.",
  },
  reminders: {
    title: "Reminder analytics",
    description: "Reminder delivery and customer response metrics.",
  },
  automations: {
    title: "Automation analytics",
    description: "Workflow execution and follow-up performance.",
  },
  reports: {
    title: "Reports",
    description: "Scheduled and exported analytics reports.",
  },
};
