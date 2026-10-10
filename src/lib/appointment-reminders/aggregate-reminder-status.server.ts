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
import { evaluateSmsReminderEligibility } from "@/lib/appointment-reminders/sms-eligibility";
import type { PlatformReminderWorkflowConflict } from "@/lib/appointment-reminders/platform-reminder-workflow";
import { evaluateEmailReminderEligibility } from "@/lib/appointment-reminders/email-reminder-eligibility";

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
  inviteeEmail?: string | null;
  metadata: AppointmentMetadata;
  platform: AppointmentPlatformConfig;
  workflowConflict?: PlatformReminderWorkflowConflict | null;
}): AggregateReminderView {
  const meta = input.metadata;
  const inactive = ["canceled", "cancelled", "completed", "no_show"].includes(
    input.status.toLowerCase(),
  );

  if (input.workflowConflict?.blocked) {
    return {
      status: "not_scheduled",
      label: "Workflow active",
      secondaryLine: input.workflowConflict.detail || "Another automation sends reminders for this appointment type.",
      attentionReason: "workflow_conflict",
    };
  }

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
  const emailEligibility = evaluateEmailReminderEligibility({
    metadata: meta,
    inviteeEmail: input.inviteeEmail ?? (meta.inviteeEmail as string) ?? null,
    appointmentStatus: input.status,
  });
  const needsEmail =
    (input.platform.reminders.confirmation.enabled &&
      input.platform.reminders.confirmation.channel === "email") ||
    (input.platform.reminders.reminder24h.enabled &&
      input.platform.reminders.reminder24h.channel === "email") ||
    (input.platform.reminders.reminder2h.enabled &&
      input.platform.reminders.reminder2h.channel === "email") ||
    (input.platform.reminders.additionalSteps || []).some(
      (s) => s.enabled && s.channel === "email",
    );
  if (needsEmail && !emailEligibility.eligible && emailEligibility.blockReason === "missing_email") {
    return {
      status: "needs_attention",
      label: "Needs attention",
      secondaryLine: emailEligibility.detail || "Email address required",
      attentionReason: "missing_email",
    };
  }

  const eligibility = evaluateSmsReminderEligibility({
    metadata: meta,
    inviteePhone: input.inviteePhone,
    appointmentStatus: input.status,
  });
  if (!eligibility.eligible) {
    const reasonMap: Record<string, AggregateReminderView["attentionReason"]> = {
      missing_phone: "missing_phone",
      invalid_phone: "invalid_phone",
      consent_required: "consent",
      opted_out: "consent",
      suppressed: undefined,
      sender_unavailable: "delivery_failed",
      none: undefined,
    };
    return {
      status: "needs_attention",
      label: "Needs attention",
      secondaryLine: eligibility.detail || "Cannot send SMS",
      attentionReason: reasonMap[eligibility.blockReason],
    };
  }
  if (!phone?.trim() || !isValidReminderPhone(phone)) {
    return {
      status: "needs_attention",
      label: "Needs attention",
      secondaryLine: "Phone number required",
      attentionReason: "missing_phone",
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
