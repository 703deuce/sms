import type { ArAppointmentRow } from "@/lib/appointment-reminders/appointments-page-types";
import type { ArReminderEngagementStep } from "@/lib/appointment-reminders/ar-sms-customer-outcome";
import {
  compactWorkflowManagedLabel,
  isWorkflowManagedReminder,
} from "@/lib/appointment-reminders/calendar/reminder-display-copy";

export type ArReminderReadinessSummary = {
  headline: string;
  automationLabel: string;
  nextDispatchLabel: string;
  tone: "neutral" | "success" | "warning" | "danger";
};

type TimelineEntry = {
  label: string;
  scheduledFor?: string;
  status: string;
  detail?: string;
};

function formatWhen(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });
}

/** UI copy for panel + reminders tab — separates automation on/off from dispatch schedule. */
export function buildArReminderReadinessSummary(input: {
  remindersSuppressed: boolean;
  row: ArAppointmentRow;
  timeline: TimelineEntry[];
  reminderEngagement: ArReminderEngagementStep[];
  meta: Record<string, unknown>;
  timeZone: string;
}): ArReminderReadinessSummary {
  const { remindersSuppressed, row, timeline, reminderEngagement, meta, timeZone } = input;

  if (remindersSuppressed) {
    return {
      headline: "Reminders stopped for this appointment",
      automationLabel: "Reminders off for this appointment",
      nextDispatchLabel: "No automated sends while reminders are stopped",
      tone: "neutral",
    };
  }

  if (
    isWorkflowManagedReminder({
      label: row.reminder.label,
      status: row.reminder.status,
      attentionReason: row.reminder.attentionReason,
      secondaryLine: row.reminder.secondaryLine,
    })
  ) {
    const managed = compactWorkflowManagedLabel(row.reminder.secondaryLine);
    return {
      headline: managed,
      automationLabel: "Appointment Reminders not used for this type",
      nextDispatchLabel:
        "Another active workflow sends messages when this appointment is booked. Open Reminders for details.",
      tone: "neutral",
    };
  }

  const automationLabel = "Automated reminders enabled";

  const ineligible =
    (meta.reminderSmsIneligibleReason as string) ||
    (meta.reminderImportIneligibleReason as string) ||
    (meta.reminderBlockReason as string);
  if (ineligible) {
    return {
      headline: "Reminder blocked",
      automationLabel,
      nextDispatchLabel: String(ineligible),
      tone: "warning",
    };
  }

  const pastDueStep = reminderEngagement.find((s) => s.sendStatus === "past_due" || s.sendStatus === "failed");
  if (pastDueStep) {
    const detail =
      pastDueStep.sendStatus === "past_due"
        ? `${pastDueStep.reminderLabel} is past due — review timeline`
        : `${pastDueStep.reminderLabel} failed to send`;
    return {
      headline: "Reminder needs attention",
      automationLabel,
      nextDispatchLabel: detail,
      tone: "danger",
    };
  }

  const now = Date.now();
  const nextFuture = timeline
    .filter((t) => {
      if (!t.scheduledFor) return false;
      const st = t.status.toLowerCase();
      if (!st.includes("sched")) return false;
      return new Date(t.scheduledFor).getTime() > now;
    })
    .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime())[0];

  if (nextFuture?.scheduledFor) {
    return {
      headline: "Next reminder scheduled",
      automationLabel,
      nextDispatchLabel: `${nextFuture.label} · ${formatWhen(nextFuture.scheduledFor, timeZone)}`,
      tone: "success",
    };
  }

  const blockedEngagement = reminderEngagement.find((s) => s.sendStatus === "skipped");
  if (blockedEngagement) {
    return {
      headline: "Reminder skipped",
      automationLabel,
      nextDispatchLabel: `${blockedEngagement.reminderLabel} skipped — see Reminders tab`,
      tone: "warning",
    };
  }

  if (row.reminder.status === "needs_attention" || row.reminder.status === "failed") {
    return {
      headline: "Reminder needs attention",
      automationLabel,
      nextDispatchLabel: row.reminder.secondaryLine || row.reminder.label,
      tone: "warning",
    };
  }

  const lastSent = reminderEngagement.find((s) => s.sendStatus === "sent" || s.sendStatus === "delivered");
  if (lastSent && reminderEngagement.every((s) => s.sendStatus !== "scheduled")) {
    return {
      headline: "No further reminders scheduled",
      automationLabel,
      nextDispatchLabel: "All configured reminders for this appointment have been sent.",
      tone: "neutral",
    };
  }

  if (row.reminder.status === "scheduled" && row.reminder.secondaryLine) {
    return {
      headline: "Reminder scheduled",
      automationLabel,
      nextDispatchLabel: row.reminder.secondaryLine,
      tone: "success",
    };
  }

  return {
    headline: "No reminder currently scheduled",
    automationLabel,
    nextDispatchLabel:
      "Reminders are enabled, but nothing is queued to send yet. Check timing rules or the Reminders tab.",
    tone: "neutral",
  };
}
