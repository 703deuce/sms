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
  remindersDelivered: number;
  deliveryRate: number;
  emailSent: number;
  emailOpens: number;
  emailClicks: number;
  emailOpenRate: number;
  emailClickRate: number;
  smsResponses: number;
  utmConversions: number;
  conversionRate: number;
  byChannel: Array<{ channel: string; sent: number; delivered: number; failed: number }>;
  bySequence: Array<{ name: string; sent: number; delivered: number; failed: number; responses: number }>;
  series: Array<{ date: string; count: number }>;
};

function buildSeries(days: number, base: number, variance: number) {
  const out: Array<{ date: string; count: number }> = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const wave = Math.sin(i / 2.3) * variance + Math.cos(i / 5.1) * (variance / 2);
    out.push({ date: iso, count: Math.max(0, Math.round(base + wave)) });
  }
  return out;
}

export const ANALYTICS_7: AnalyticsData = {
  rangeDays: 7,
  booked: 84,
  completed: 51,
  confirmed: 62,
  awaiting: 14,
  canceled: 5,
  noShow: 3,
  rescheduleRequested: 7,
  confirmationRate: 74,
  cancellationRate: 6,
  noShowRate: 4,
  rescheduleRate: 8,
  remindersSent: 226,
  remindersFailed: 4,
  remindersDelivered: 222,
  deliveryRate: 98.2,
  emailSent: 68,
  emailOpens: 141,
  emailClicks: 38,
  emailOpenRate: 62,
  emailClickRate: 17,
  smsResponses: 57,
  utmConversions: 12,
  conversionRate: 14.3,
  byChannel: [
    { channel: "SMS", sent: 158, delivered: 156, failed: 2 },
    { channel: "Email", sent: 68, delivered: 66, failed: 2 },
  ],
  bySequence: [
    { name: "Booking confirmation", sent: 84, delivered: 84, failed: 0, responses: 31 },
    { name: "24-hour reminder", sent: 79, delivered: 78, failed: 1, responses: 19 },
    { name: "2-hour reminder", sent: 63, delivered: 60, failed: 3, responses: 7 },
  ],
  series: buildSeries(7, 30, 9),
};

export const ANALYTICS_30: AnalyticsData = {
  rangeDays: 30,
  booked: 342,
  completed: 218,
  confirmed: 261,
  awaiting: 47,
  canceled: 21,
  noShow: 13,
  rescheduleRequested: 29,
  confirmationRate: 76,
  cancellationRate: 6.1,
  noShowRate: 3.8,
  rescheduleRate: 8.5,
  remindersSent: 931,
  remindersFailed: 17,
  remindersDelivered: 914,
  deliveryRate: 98.2,
  emailSent: 276,
  emailOpens: 588,
  emailClicks: 154,
  emailOpenRate: 61,
  emailClickRate: 16,
  smsResponses: 243,
  utmConversions: 49,
  conversionRate: 14.3,
  byChannel: [
    { channel: "SMS", sent: 655, delivered: 646, failed: 9 },
    { channel: "Email", sent: 276, delivered: 268, failed: 8 },
  ],
  bySequence: [
    { name: "Booking confirmation", sent: 342, delivered: 341, failed: 1, responses: 129 },
    { name: "24-hour reminder", sent: 327, delivered: 321, failed: 6, responses: 84 },
    { name: "2-hour reminder", sent: 262, delivered: 252, failed: 10, responses: 30 },
  ],
  series: buildSeries(30, 31, 11),
};

export function getAnalytics(range: 7 | 30): AnalyticsData {
  return range === 7 ? ANALYTICS_7 : ANALYTICS_30;
}
