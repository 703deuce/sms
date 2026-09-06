export type WorkflowLog = {
  id: string;
  workflowName: string;
  appointmentId: string | null;
  contactName: string | null;
  stepName: string;
  status: "sent" | "delivered" | "scheduled" | "skipped" | "failed" | "suppressed";
  channel: "sms" | "email" | null;
  scheduledFor: string | null;
  executedAt: string | null;
  error: string | null;
  createdAt: string;
};

export type UnknownReply = {
  appointmentId: string;
  contactName: string;
  serviceName: string;
  startsAt: string;
  status: string;
  replyBody: string;
  repliedAt: string;
};

const now = Date.now();
const min = (m: number) => new Date(now - m * 60_000).toISOString();
const hours = (h: number) => new Date(now - h * 3_600_000).toISOString();
const daysAhead = (d: number, h: number) => {
  const dte = new Date(now + d * 86_400_000);
  dte.setHours(h, 0, 0, 0);
  return dte.toISOString();
};

export const workflowLogs: WorkflowLog[] = [
  {
    id: "log_01",
    workflowName: "Standard Reminders",
    appointmentId: "a1b2c3d4-9001",
    contactName: "Sarah Johnson",
    stepName: "24h reminder",
    status: "delivered",
    channel: "sms",
    scheduledFor: hours(2),
    executedAt: hours(2),
    error: null,
    createdAt: hours(2),
  },
  {
    id: "log_02",
    workflowName: "Confirmation Required",
    appointmentId: "e5f6a7b8-9002",
    contactName: "Marcus Lee",
    stepName: "Confirmation request",
    status: "sent",
    channel: "sms",
    scheduledFor: hours(3),
    executedAt: hours(3),
    error: null,
    createdAt: hours(3),
  },
  {
    id: "log_03",
    workflowName: "Standard Reminders",
    appointmentId: "c9d0e1f2-9003",
    contactName: "Priya Nair",
    stepName: "2h reminder",
    status: "scheduled",
    channel: "sms",
    scheduledFor: daysAhead(0, 16),
    executedAt: null,
    error: null,
    createdAt: hours(5),
  },
  {
    id: "log_04",
    workflowName: "High-Value Appointment",
    appointmentId: "a3b4c5d6-9004",
    contactName: "David Okafor",
    stepName: "Pre-appointment prep note",
    status: "delivered",
    channel: "email",
    scheduledFor: hours(7),
    executedAt: hours(7),
    error: null,
    createdAt: hours(7),
  },
  {
    id: "log_05",
    workflowName: "No-Show Recovery",
    appointmentId: "f7a8b9c0-9005",
    contactName: "Elena Rodriguez",
    stepName: "Rebooking offer",
    status: "failed",
    channel: "sms",
    scheduledFor: hours(9),
    executedAt: hours(9),
    error: "Recipient opted out of SMS",
    createdAt: hours(9),
  },
  {
    id: "log_06",
    workflowName: "Confirmation Required",
    appointmentId: "d1e2f3a4-9006",
    contactName: "Tom Becker",
    stepName: "Confirmation request",
    status: "skipped",
    channel: "sms",
    scheduledFor: hours(12),
    executedAt: hours(12),
    error: "Skipped — customer already confirmed",
    createdAt: hours(12),
  },
  {
    id: "log_07",
    workflowName: "Post-Appointment Follow-Up",
    appointmentId: "b5c6d7e8-9007",
    contactName: "Hannah Kim",
    stepName: "Thank-you message",
    status: "delivered",
    channel: "sms",
    scheduledFor: hours(26),
    executedAt: hours(26),
    error: null,
    createdAt: hours(26),
  },
  {
    id: "log_08",
    workflowName: "Review Request",
    appointmentId: "a9b0c1d2-9008",
    contactName: "James Whitfield",
    stepName: "Review link",
    status: "suppressed",
    channel: "sms",
    scheduledFor: hours(30),
    executedAt: hours(30),
    error: "Suppressed — customer opted out",
    createdAt: hours(30),
  },
  {
    id: "log_09",
    workflowName: "Standard Reminders",
    appointmentId: "e3f4a5b6-9009",
    contactName: "Olivia Chen",
    stepName: "24h reminder",
    status: "delivered",
    channel: "sms",
    scheduledFor: hours(31),
    executedAt: hours(31),
    error: null,
    createdAt: hours(31),
  },
  {
    id: "log_10",
    workflowName: "Reschedule Follow-Up",
    appointmentId: "c7d8e9f0-9010",
    contactName: "Noah Patel",
    stepName: "New confirmation",
    status: "delivered",
    channel: "sms",
    scheduledFor: hours(40),
    executedAt: hours(40),
    error: null,
    createdAt: hours(40),
  },
  {
    id: "log_11",
    workflowName: "Payment Follow-Up",
    appointmentId: null,
    contactName: null,
    stepName: "Deposit reminder",
    status: "failed",
    channel: "email",
    scheduledFor: hours(50),
    executedAt: hours(50),
    error: "Mailbox unavailable — retrying in 30 minutes",
    createdAt: hours(50),
  },
  {
    id: "log_12",
    workflowName: "Re-Engagement / Book Again",
    appointmentId: null,
    contactName: "Grace Muller",
    stepName: "Book-again nudge",
    status: "sent",
    channel: "sms",
    scheduledFor: min(90),
    executedAt: min(90),
    error: null,
    createdAt: min(90),
  },
];

export const unknownReplies: UnknownReply[] = [
  {
    appointmentId: "a1b2c3d4-9001",
    contactName: "Sarah Johnson",
    serviceName: "Water Heater Estimate",
    startsAt: daysAhead(1, 14),
    status: "Scheduled",
    replyBody: "Hey, is it okay if the tech comes closer to 3? I have a school pickup at 2:30.",
    repliedAt: min(42),
  },
  {
    appointmentId: "e5f6a7b8-9002",
    contactName: "Marcus Lee",
    serviceName: "Initial Consultation",
    startsAt: daysAhead(2, 10),
    status: "Awaiting confirmation",
    replyBody: "Can I bring my business partner to this meeting?",
    repliedAt: hours(4),
  },
  {
    appointmentId: "c9d0e1f2-9003",
    contactName: "Priya Nair",
    serviceName: "Follow-Up Visit",
    startsAt: daysAhead(0, 18),
    status: "Confirmed",
    replyBody: "The gate code is 4471, please call when you arrive.",
    repliedAt: hours(8),
  },
];
