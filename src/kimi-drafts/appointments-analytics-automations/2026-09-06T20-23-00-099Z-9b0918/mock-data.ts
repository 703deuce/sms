export type WorkflowRow = {
  id: string;
  name: string;
  trigger: string;
  status: "active" | "paused" | "draft";
  enrolled: number;
  stepsSent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
  replies: number;
  replyRate: number;
  confirmed: number;
  confirmationRate: number;
};

export type AnalyticsData = {
  rangeDays: number;
  activeWorkflows: number;
  workflowExecutions: number;
  stepsSent: number;
  stepsDelivered: number;
  stepsFailed: number;
  deliveryRate: number;
  remindersSent: number;
  remindersFailed: number;
  confirmationsReceived: number;
  confirmationRate: number;
  rescheduleHandled: number;
  noShowRecovery: number;
  followUpsSent: number;
  reviewsRequested: number;
  workflows: WorkflowRow[];
  series: Array<{ date: string; sent: number; delivered: number; failed: number }>;
};

export const RANGE_OPTIONS: Array<{ value: 7 | 30; label: string }> = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
];

export const analyticsTabs = [
  { label: "Overview", href: "/appointments/analytics" },
  { label: "Booking", href: "/appointments/analytics/booking" },
  { label: "Reminders", href: "/appointments/analytics/reminders" },
  { label: "Automations", href: "/appointments/analytics/automations" },
  { label: "Reports", href: "/appointments/analytics/reports" },
];

function buildSeries(days: number) {
  const out: AnalyticsData["series"] = [];
  const now = new Date("2026-09-08T12:00:00");
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const seed = (days - i) * 7 + days;
    const sent = 34 + ((seed * 13) % 28);
    const failed = seed % 4 === 0 ? 2 : seed % 3;
    out.push({ date: iso, sent, delivered: sent - failed, failed });
  }
  return out;
}

const baseWorkflows: WorkflowRow[] = [
  {
    id: "wf-1",
    name: "Standard Reminders",
    trigger: "Appointment booked",
    status: "active",
    enrolled: 212,
    stepsSent: 486,
    delivered: 479,
    failed: 7,
    deliveryRate: 98.6,
    replies: 96,
    replyRate: 19.8,
    confirmed: 121,
    confirmationRate: 57.1,
  },
  {
    id: "wf-2",
    name: "Confirmation Required",
    trigger: "Appointment booked",
    status: "active",
    enrolled: 84,
    stepsSent: 168,
    delivered: 165,
    failed: 3,
    deliveryRate: 98.2,
    replies: 52,
    replyRate: 31.0,
    confirmed: 49,
    confirmationRate: 58.3,
  },
  {
    id: "wf-3",
    name: "No-Show Recovery",
    trigger: "Marked no-show",
    status: "active",
    enrolled: 17,
    stepsSent: 34,
    delivered: 33,
    failed: 1,
    deliveryRate: 97.1,
    replies: 6,
    replyRate: 17.6,
    confirmed: 5,
    confirmationRate: 29.4,
  },
  {
    id: "wf-4",
    name: "Post-Appointment Follow-Up",
    trigger: "Appointment completed",
    status: "active",
    enrolled: 141,
    stepsSent: 141,
    delivered: 138,
    failed: 3,
    deliveryRate: 97.9,
    replies: 23,
    replyRate: 16.3,
    confirmed: 0,
    confirmationRate: 0,
  },
  {
    id: "wf-5",
    name: "Review Request",
    trigger: "Appointment completed",
    status: "paused",
    enrolled: 96,
    stepsSent: 96,
    delivered: 94,
    failed: 2,
    deliveryRate: 97.9,
    replies: 11,
    replyRate: 11.5,
    confirmed: 0,
    confirmationRate: 0,
  },
  {
    id: "wf-6",
    name: "Reschedule Follow-Up",
    trigger: "Reschedule requested",
    status: "draft",
    enrolled: 0,
    stepsSent: 0,
    delivered: 0,
    failed: 0,
    deliveryRate: 0,
    replies: 0,
    replyRate: 0,
    confirmed: 0,
    confirmationRate: 0,
  },
];

export const mockAnalytics: Record<7 | 30, AnalyticsData> = {
  7: {
    rangeDays: 7,
    activeWorkflows: 4,
    workflowExecutions: 214,
    stepsSent: 925,
    stepsDelivered: 909,
    stepsFailed: 16,
    deliveryRate: 98.3,
    remindersSent: 486,
    remindersFailed: 7,
    confirmationsReceived: 121,
    confirmationRate: 57.1,
    rescheduleHandled: 12,
    noShowRecovery: 5,
    followUpsSent: 141,
    reviewsRequested: 96,
    workflows: baseWorkflows,
    series: buildSeries(7),
  },
  30: {
    rangeDays: 30,
    activeWorkflows: 4,
    workflowExecutions: 861,
    stepsSent: 3712,
    stepsDelivered: 3651,
    stepsFailed: 61,
    deliveryRate: 98.4,
    remindersSent: 1904,
    remindersFailed: 29,
    confirmationsReceived: 472,
    confirmationRate: 55.4,
    rescheduleHandled: 48,
    noShowRecovery: 19,
    followUpsSent: 553,
    reviewsRequested: 384,
    workflows: baseWorkflows.map((w) => ({
      ...w,
      enrolled: w.enrolled * 4,
      stepsSent: w.stepsSent * 4,
      delivered: w.delivered * 4,
      failed: w.failed * 4,
      replies: w.replies * 4,
      confirmed: w.confirmed * 4,
    })),
    series: buildSeries(30),
  },
};

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatSeriesDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
