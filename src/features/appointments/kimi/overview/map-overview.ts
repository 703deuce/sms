import { formatAppointmentTime } from "@/components/appointments/appointment-ui";
import { statusLabel } from "@/lib/appointments/types";
import type {
  OverviewAttentionItem,
  OverviewChartModel,
  OverviewConversationItem,
  OverviewPageModel,
  OverviewScheduleItem,
  OverviewStatItem,
} from "./types";

type ApiAppointment = {
  id: string;
  inviteeName: string | null;
  inviteePhone?: string | null;
  serviceName: string | null;
  startsAt: string;
  endsAt?: string | null;
  status: string;
  timezone: string | null;
  metadata?: { location?: string };
};

export type OverviewApiData = {
  counts: {
    todayTotal: number;
    confirmed: number;
    awaitingConfirmation: number;
    rescheduleRequested: number;
    unreadConversations: number;
    reminderFailed?: number;
  };
  todayAppointments: ApiAppointment[];
  upcomingAppointments?: ApiAppointment[];
  needsAttention: Array<{ id: string; kind: string; label: string; href: string }>;
  recentConversations?: Array<{
    id: string;
    name: string;
    preview: string;
    updatedAt: string;
    unread: boolean;
  }>;
};

export type AnalyticsApiData = {
  booked: number;
  confirmationRate: number;
  remindersSent: number;
  remindersFailed: number;
  series: Array<{ date: string; count: number }>;
};

const CONVERSATION_COLORS = ["purple", "green", "blue", "red", "amber", "indigo"];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function formatDuration(startsAt: string, endsAt?: string | null) {
  if (!endsAt) return "30m";
  const mins = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatRelativeTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 86_400_000) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  if (diff < 172_800_000) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function mapStats(data: OverviewApiData, analytics: AnalyticsApiData | null): OverviewStatItem[] {
  const upcoming = data.upcomingAppointments ?? [];
  const nextAppt = upcoming[0];
  const confirmationRate = analytics?.confirmationRate ?? 0;
  const remindersSent = analytics?.remindersSent ?? 0;
  const remindersFailed = analytics?.remindersFailed ?? data.counts.reminderFailed ?? 0;
  const reminderHealth =
    remindersSent > 0
      ? Math.round(((remindersSent - remindersFailed) / remindersSent) * 100)
      : remindersFailed > 0
        ? 0
        : 100;

  return [
    {
      label: "Upcoming appointments",
      value: String(upcoming.length > 0 ? upcoming.length : data.counts.todayTotal),
      sub: nextAppt
        ? `Next: ${formatAppointmentTime(nextAppt.startsAt, nextAppt.timezone)} →`
        : "No upcoming appointments",
      icon: "calendar",
      tint: "purple",
    },
    {
      label: "Confirmation rate",
      value: `${confirmationRate}%`,
      sub: analytics ? "Last 7 days" : "Analytics unavailable",
      icon: "check",
      tint: "green",
    },
    {
      label: "Reminders sent",
      value: String(remindersSent),
      sub: "Last 7 days",
      icon: "send",
      tint: "blue",
    },
    {
      label: "Reminder health",
      value: `${reminderHealth}%`,
      sub:
        reminderHealth >= 95
          ? "Excellent"
          : remindersFailed > 0
            ? `${remindersFailed} failed`
            : "Good",
      icon: "shield",
      tint: "amber",
    },
  ];
}

function mapSchedule(appointments: ApiAppointment[]): OverviewScheduleItem[] {
  return appointments.map((a) => ({
    id: a.id,
    time: formatAppointmentTime(a.startsAt, a.timezone),
    dur: formatDuration(a.startsAt, a.endsAt),
    type: a.serviceName || "Appointment",
    loc: a.metadata?.location || "In-office",
    name: a.inviteeName || "Customer",
    phone: a.inviteePhone || "—",
    status: statusLabel(a.status),
  }));
}

function mapChart(analytics: AnalyticsApiData | null): OverviewChartModel {
  if (!analytics?.series?.length) {
    return {
      points: [0, 0, 0, 0, 0, 0, 0],
      days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      total: 0,
      deltaLabel: "No bookings yet",
      peakLabel: "—",
      vsLastWeek: "—",
    };
  }

  const values = analytics.series.map((s) => s.count);
  const days = analytics.series.map((s) =>
    new Date(`${s.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" }),
  );
  const peak = analytics.series.reduce(
    (best, row) => (row.count > best.count ? row : best),
    analytics.series[0],
  );
  const peakDate = new Date(`${peak.date}T00:00:00`).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
  });

  return {
    points: values,
    days,
    total: analytics.booked,
    deltaLabel: `${analytics.booked} total booked`,
    peakLabel: `${peakDate} (${peak.count} appointments)`,
    vsLastWeek: analytics.booked > 0 ? "↑ this week" : "—",
  };
}

function mapConversations(
  rows: OverviewApiData["recentConversations"] = [],
): OverviewConversationItem[] {
  return rows.map((row, i) => ({
    id: row.id,
    initials: initials(row.name),
    color: CONVERSATION_COLORS[i % CONVERSATION_COLORS.length],
    name: row.name,
    msg: row.preview || "No messages yet",
    tag: row.unread ? "Unread" : "Recent",
    tagColor: row.unread ? "purple" : "blue",
    time: formatRelativeTime(row.updatedAt),
  }));
}

function mapAttention(items: OverviewApiData["needsAttention"]): OverviewAttentionItem[] {
  return items.map((item) => ({
    id: item.id,
    icon:
      item.kind === "reminder_failed"
        ? "bell"
        : item.kind === "reschedule_requested"
          ? "shield"
          : "check-square",
    tint:
      item.kind === "reminder_failed"
        ? "red"
        : item.kind === "reschedule_requested"
          ? "amber"
          : "purple",
    title: item.label,
    sub:
      item.kind === "reminder_failed"
        ? "Reminders couldn't be delivered"
        : item.kind === "reschedule_requested"
          ? "Customer requested a new time"
          : "Needs your review",
    href: item.href,
  }));
}

export function buildOverviewPageModel(
  data: OverviewApiData,
  analytics: AnalyticsApiData | null,
): OverviewPageModel {
  return {
    dateLabel: new Date().toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    stats: mapStats(data, analytics),
    schedule: mapSchedule(data.todayAppointments),
    scheduleTotal: data.counts.todayTotal,
    chart: mapChart(analytics),
    conversations: mapConversations(data.recentConversations),
    attention: mapAttention(data.needsAttention),
  };
}
