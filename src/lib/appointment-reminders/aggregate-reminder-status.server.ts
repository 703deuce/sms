import "server-only";

import {
  buildDedicatedReminderTimeline,
  buildFutureReminderSchedule,
} from "@/lib/appointments/reminder-engine";
import { resolveWeeklyHours } from "@/lib/appointments/availability-engine-policy";
import type { AppointmentMetadata, AppointmentPlatformConfig } from "@/lib/appointments/types";
import {
  isValidReminderPhone,
  resolveReminderContactPhone,
  type AggregateReminderView,
} from "@/lib/appointment-reminders/aggregate-reminder-status";

function consentBlocksSms(meta: AppointmentMetadata): boolean {
  if (meta.remindersSuppressed) return false;
  if (meta.emailOnly) return true;
  if (meta.smsCapable === false) return true;
  return false;
}

function formatWhen(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function computeAggregateReminderView(input: {
  status: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  inviteePhone: string | null;
  metadata: AppointmentMetadata;
  platform: AppointmentPlatformConfig;
}): AggregateReminderView {
  const meta = input.metadata;
  const inactive = ["canceled", "cancelled", "completed", "no_show"].includes(
    input.status.toLowerCase(),
  );

  if (inactive) {
    return {
      status: "cancelled",
      label: "Cancelled",
      secondaryLine: "Appointment not active",
    };
  }

  if (meta.remindersSuppressed) {
    return {
      status: "not_scheduled",
      label: "Not scheduled",
      secondaryLine: "Reminders suppressed",
    };
  }

  const phone = resolveReminderContactPhone(meta, input.inviteePhone);
  if (!phone?.trim()) {
    return {
      status: "needs_attention",
      label: "Needs attention",
      secondaryLine: "Phone number required",
      attentionReason: "missing_phone",
    };
  }
  if (!isValidReminderPhone(phone)) {
    return {
      status: "needs_attention",
      label: "Needs attention",
      secondaryLine: "Invalid phone",
      attentionReason: "invalid_phone",
    };
  }

  if (consentBlocksSms(meta)) {
    return {
      status: "needs_attention",
      label: "Needs attention",
      secondaryLine: "Consent required",
      attentionReason: "consent",
    };
  }

  const timeline = buildDedicatedReminderTimeline(meta);
  const failed = timeline.find((e) => e.type.includes("failed"));
  if (failed) {
    return {
      status: "failed",
      label: "Failed",
      secondaryLine: failed.detail || "Delivery failed",
      attentionReason: "delivery_failed",
    };
  }

  const weeklyHours = resolveWeeklyHours(input.platform);
  const tz = input.timezone || input.platform.timezone;
  const future = buildFutureReminderSchedule({
    startsAt: input.startsAt,
    timezone: tz,
    steps: [
      { key: "confirmation", step: input.platform.reminders.confirmation },
      { key: "reminder24h", step: input.platform.reminders.reminder24h },
      { key: "reminder2h", step: input.platform.reminders.reminder2h },
    ],
    metadata: meta,
    weeklyHours,
  });

  const delivered = timeline.find((e) => e.type.includes("delivered"));
  if (delivered) {
    return {
      status: "delivered",
      label: "Delivered",
      secondaryLine: formatWhen(delivered.at),
    };
  }

  const sent = timeline.filter((e) => e.type.includes("sent") || e.type.includes("confirmation"));
  if (sent.length > 0) {
    const last = sent[sent.length - 1];
    return {
      status: "sent",
      label: "Sent",
      secondaryLine: formatWhen(last.at),
    };
  }

  const next = future.find((f) => f.status === "scheduled" && f.scheduledFor);
  if (next?.scheduledFor) {
    return {
      status: "scheduled",
      label: "Scheduled",
      secondaryLine: formatWhen(next.scheduledFor),
    };
  }

  if (meta.isAllDay) {
    return {
      status: "not_scheduled",
      label: "Not scheduled",
      secondaryLine: "All-day event",
    };
  }

  return {
    status: "not_scheduled",
    label: "Not scheduled",
    secondaryLine: "No pending reminders",
  };
}
