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

function buildSeries(days: number, base: number): Array<{ date: string; count: number }> {
  const out: Array<{ date: string; count: number }> = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    const weekendDip = dow === 0 || dow === 6 ? 0.35 : 1;
    const wave = Math.sin(i * 1.7) * 0.25 + Math.cos(i * 0.6) * 0.15;
    const count = Math.max(0, Math.round(base * weekendDip * (1 + wave)));
    out.push({ date: d.toISOString().slice(0, 10), count });
  }
  return out;
}

export const analytics7: AnalyticsData = {
  rangeDays: 7,
  booked: 48,
  completed: 31,
  confirmed: 34,
  awaiting: 9,
  canceled: 3,
  noShow: 2,
  rescheduleRequested: 4,
  confirmationRate: 71,
  cancellationRate: 6.3,
  noShowRate: 4.2,
  rescheduleRate: 8.3,
  remindersSent: 112,
  remindersFailed: 2,
  emailOpens: 86,
  emailClicks: 41,
  smsResponses: 29,
  utmConversions: 17,
  conversionRate: 35.4,
  popularTypes: [
    { name: "Initial Consultation", count: 16 },
    { name: "Follow-Up Visit", count: 12 },
    { name: "Water Heater Estimate", count: 9 },
    { name: "Annual Inspection", count: 6 },
    { name: "Strategy Call", count: 5 },
  ],
  popularTimes: [
    { hour: 8, count: 2 },
    { hour: 9, count: 6 },
    { hour: 10, count: 9 },
    { hour: 11, count: 7 },
    { hour: 12, count: 3 },
    { hour: 13, count: 4 },
    { hour: 14, count: 8 },
    { hour: 15, count: 6 },
    { hour: 16, count: 3 },
  ],
  series: buildSeries(7, 7),
};

export const analytics30: AnalyticsData = {
  rangeDays: 30,
  booked: 214,
  completed: 158,
  confirmed: 152,
  awaiting: 38,
  canceled: 14,
  noShow: 10,
  rescheduleRequested: 19,
  confirmationRate: 71,
  cancellationRate: 6.5,
  noShowRate: 4.7,
  rescheduleRate: 8.9,
  remindersSent: 489,
  remindersFailed: 11,
  emailOpens: 371,
  emailClicks: 168,
  smsResponses: 122,
  utmConversions: 74,
  conversionRate: 34.6,
  popularTypes: [
    { name: "Initial Consultation", count: 71 },
    { name: "Follow-Up Visit", count: 54 },
    { name: "Water Heater Estimate", count: 38 },
    { name: "Annual Inspection", count: 27 },
    { name: "Strategy Call", count: 24 },
  ],
  popularTimes: [
    { hour: 8, count: 9 },
    { hour: 9, count: 28 },
    { hour: 10, count: 41 },
    { hour: 11, count: 33 },
    { hour: 12, count: 14 },
    { hour: 13, count: 18 },
    { hour: 14, count: 36 },
    { hour: 15, count: 24 },
    { hour: 16, count: 11 },
  ],
  series: buildSeries(30, 7),
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
  series: buildSeries(7, 0),
};

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatSeriesDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatHour(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}
