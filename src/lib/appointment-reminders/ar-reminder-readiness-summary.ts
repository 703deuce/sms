import type { ArAppointmentRow } from "@/lib/appointment-reminders/appointments-page-types";
import type { ArReminderEngagementStep } from "@/lib/appointment-reminders/ar-sms-customer-outcome";

export type ArReminderReadinessSummary = {
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
      automationLabel: "Reminders off for this appointment",
      nextDispatchLabel: "No automated sends while reminders are stopped",
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
      automationLabel,
      nextDispatchLabel: `${nextFuture.label} · ${formatWhen(nextFuture.scheduledFor, timeZone)}`,
      tone: "success",
    };
  }

  const blockedEngagement = reminderEngagement.find((s) => s.sendStatus === "skipped");
  if (blockedEngagement) {
    return {
      automationLabel,
      nextDispatchLabel: `${blockedEngagement.reminderLabel} skipped — see Reminders tab`,
      tone: "warning",
    };
  }

  if (row.reminder.status === "needs_attention" || row.reminder.status === "failed") {
    return {
      automationLabel,
      nextDispatchLabel: row.reminder.secondaryLine || row.reminder.label,
      tone: "warning",
    };
  }

  const lastSent = reminderEngagement.find((s) => s.sendStatus === "sent" || s.sendStatus === "delivered");
  if (lastSent && reminderEngagement.every((s) => s.sendStatus !== "scheduled")) {
    return {
      automationLabel,
      nextDispatchLabel: "No further reminders scheduled for this appointment",
      tone: "neutral",
    };
  }

  return {
    automationLabel,
    nextDispatchLabel: "No upcoming send scheduled yet — check Reminders tab for timeline",
    tone: "neutral",
  };
}
