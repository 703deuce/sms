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
import { isAppointmentReminderImportEligible } from "@/lib/calendar/import-eligibility";

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
  createdAt?: string;
  endsAt: string | null;
  timezone: string | null;
  inviteePhone: string | null;
  inviteeEmail?: string | null;
  metadata: AppointmentMetadata;
  platform: AppointmentPlatformConfig;
  workflowConflict?: PlatformReminderWorkflowConflict | null;
  appointmentRemindersActivatedAt?: string | null;
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

  if (meta.remindersSuppressed || meta.reminderOverride?.suppressed) {
    return {
      status: "not_scheduled",
      label: "Reminders off",
      secondaryLine: "Turned off for this appointment",
      attentionReason: "suppressed",
    };
  }

  if (!isAppointmentReminderImportEligible(meta)) {
    const code =
      meta.reminderImportIneligibleReason ||
      (meta.reminderSmsIneligibleReason as string | undefined);
    return {
      status: "not_scheduled",
      label: "Excluded",
      secondaryLine: code ? `Calendar rules (${code})` : "Excluded by calendar rules",
      attentionReason: "calendar_excluded",
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
  const needsSms =
    (input.platform.reminders.confirmation.enabled &&
      input.platform.reminders.confirmation.channel === "sms") ||
    (input.platform.reminders.reminder24h.enabled &&
      input.platform.reminders.reminder24h.channel === "sms") ||
    (input.platform.reminders.reminder2h.enabled &&
      input.platform.reminders.reminder2h.channel === "sms") ||
    (input.platform.reminders.additionalSteps || []).some(
      (s) => s.enabled && s.channel === "sms",
    );

  const eligibility = evaluateSmsReminderEligibility({
    metadata: meta,
    inviteePhone: input.inviteePhone,
    appointmentStatus: input.status,
    platform: input.platform,
    appointmentRemindersActivatedAt: input.appointmentRemindersActivatedAt,
  });

  const emailOk = !needsEmail || emailEligibility.eligible;
  const smsOk =
    !needsSms ||
    (eligibility.eligible && Boolean(phone?.trim()) && isValidReminderPhone(phone));

  if (!emailOk && !smsOk) {
    const secondary =
      needsEmail && emailEligibility.blockReason === "missing_email"
        ? emailEligibility.detail
        : eligibility.detail || "Missing contact information for reminders";
    const attentionReason =
      needsEmail && emailEligibility.blockReason === "missing_email"
        ? "missing_email"
        : eligibility.blockReason === "consent_required"
          ? "consent"
          : "missing_phone";
    return {
      status: "needs_attention",
      label: "Needs attention",
      secondaryLine: secondary,
      attentionReason,
    };
  }

  if (!smsOk && emailOk) {
    const reasonMap: Record<string, AggregateReminderView["attentionReason"]> = {
      missing_phone: "missing_phone",
      invalid_phone: "invalid_phone",
      phone_needs_review: "missing_phone",
      consent_required: "consent",
      opted_out: "consent",
      suppressed: undefined,
      sender_unavailable: "delivery_failed",
      none: undefined,
    };
    // Email reminders can still run — surface SMS gap without blocking overall schedule.
    const smsNote = eligibility.detail || "SMS not available for this appointment";
    const timelineEarly = buildDedicatedReminderTimeline(meta);
    const failedEarly = timelineEarly.find((e) => e.type.includes("failed"));
    if (failedEarly) {
      return {
        status: "failed",
        label: "Failed",
        secondaryLine: failedEarly.detail || "Delivery failed",
        attentionReason: "delivery_failed",
      };
    }
    const futureEarly = buildFutureReminderSchedule({
      startsAt: input.startsAt,
      createdAt: input.createdAt,
      timezone: input.timezone || input.platform.timezone,
      steps: [
        { key: "confirmation", step: input.platform.reminders.confirmation },
        { key: "reminder24h", step: input.platform.reminders.reminder24h },
        { key: "reminder2h", step: input.platform.reminders.reminder2h },
      ],
      metadata: meta,
      weeklyHours: resolveWeeklyHours(input.platform),
      confirmationStepEnabled: input.platform.reminders.confirmation.enabled,
    });
    const nextEarly = futureEarly.find((f) => f.status === "scheduled" && f.scheduledFor);
    if (nextEarly?.scheduledFor) {
      return {
        status: "scheduled",
        label: "Scheduled",
        secondaryLine: `${formatWhen(nextEarly.scheduledFor)} · ${smsNote}`,
        attentionReason: reasonMap[eligibility.blockReason],
      };
    }
    return {
      status: "needs_attention",
      label: "Needs attention",
      secondaryLine: smsNote,
      attentionReason: reasonMap[eligibility.blockReason],
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
    createdAt: input.createdAt,
    timezone: tz,
    steps: [
      { key: "confirmation", step: input.platform.reminders.confirmation },
      { key: "reminder24h", step: input.platform.reminders.reminder24h },
      { key: "reminder2h", step: input.platform.reminders.reminder2h },
    ],
    metadata: meta,
    weeklyHours,
    confirmationStepEnabled: input.platform.reminders.confirmation.enabled,
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
