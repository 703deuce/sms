import type { AggregateReminderView } from "@/lib/appointment-reminders/aggregate-reminder-status";

export type ArAppointmentRow = {
  id: string;
  customerName: string;
  appointmentTitle: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  isAllDay: boolean;
  phone: string | null;
  phoneState: "ok" | "missing" | "invalid";
  contactEmail?: string | null;
  reminder: AggregateReminderView;
  sourceProvider: string | null;
  sourceCalendarLabel: string | null;
  connectionId: string | null;
  status: string;
  sourceEventUrl: string | null;
  arRescheduleRequest?: {
    status: string;
    proposedStartsAt?: string;
    proposedEndsAt?: string;
    requestedAt?: string;
    failureReason?: string;
  };
};

export type ArAppointmentsPagePayload = {
  rows: ArAppointmentRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    upcoming: number;
    scheduled: number;
    sent: number;
    needsAttention: number;
  };
  sync: {
    connected: boolean;
    lastSyncAt: string | null;
    syncError: string | null;
  };
  calendars: Array<{ id: string; label: string; provider: string }>;
  timezone: string;
};
