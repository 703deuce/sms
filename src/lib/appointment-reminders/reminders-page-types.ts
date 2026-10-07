export type ArReminderOperationalStatus =
  | "scheduled"
  | "sent"
  | "delivered"
  | "failed"
  | "blocked"
  | "skipped"
  | "past_due"
  | "not_scheduled";

export type ArReminderOperationalRow = {
  id: string;
  appointmentId: string;
  customerLabel: string;
  appointmentLabel: string;
  reminderLabel: string;
  channel: string;
  scheduledFor: string | null;
  occurredAt: string | null;
  status: ArReminderOperationalStatus;
  statusLabel: string;
  detail: string | null;
  actionHint: string | null;
};

export type ArRemindersPagePayload = {
  rows: ArReminderOperationalRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    scheduled: number;
    sentToday: number;
    sent30d: number;
    failed7d: number;
    blocked: number;
  };
  timezone: string;
};
