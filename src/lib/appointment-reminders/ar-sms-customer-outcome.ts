import type { AppointmentMetadata, AppointmentTimelineEvent } from "@/lib/appointments/types";

export type ArCustomerResponseKind =
  | "none"
  | "awaiting_reply"
  | "confirmed"
  | "cancel_pending"
  | "cancelled"
  | "reschedule_pending"
  | "reschedule_requested"
  | "rescheduled"
  | "replied";

export type ArCustomerResponseSummary = {
  kind: ArCustomerResponseKind;
  label: string;
  detailLine?: string;
  at?: string;
};

const AR_SMS_OUTCOME_PREFIX = "ar_sms_outcome_";

export function arSmsOutcomeTimelineType(
  outcome:
    | "confirmed"
    | "cancel_pending"
    | "cancelled"
    | "reschedule_started"
    | "reschedule_requested"
    | "rescheduled",
): string {
  return `${AR_SMS_OUTCOME_PREFIX}${outcome}`;
}

export function isArSmsOutcomeTimelineEvent(type: string): boolean {
  return type.startsWith(AR_SMS_OUTCOME_PREFIX);
}

function formatAppointmentWhen(iso: string, timezone?: string | null): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone || undefined,
    });
  } catch {
    return iso;
  }
}

function latestOutcomeEvent(timeline: AppointmentTimelineEvent[]): AppointmentTimelineEvent | null {
  const outcomes = timeline.filter((e) => isArSmsOutcomeTimelineEvent(e.type));
  if (!outcomes.length) return null;
  return outcomes[outcomes.length - 1]!;
}

function kindFromOutcomeType(type: string): ArCustomerResponseKind | null {
  const suffix = type.slice(AR_SMS_OUTCOME_PREFIX.length);
  switch (suffix) {
    case "confirmed":
      return "confirmed";
    case "cancel_pending":
      return "cancel_pending";
    case "cancelled":
      return "cancelled";
    case "reschedule_started":
      return "reschedule_pending";
    case "reschedule_requested":
      return "reschedule_requested";
    case "rescheduled":
      return "rescheduled";
    default:
      return null;
  }
}

/**
 * Authoritative customer response summary for list rows and headers (metadata + status).
 */
export function resolveArCustomerResponseSummary(input: {
  status: string;
  startsAt: string;
  timezone?: string | null;
  metadata: AppointmentMetadata;
}): ArCustomerResponseSummary {
  const meta = input.metadata;
  const timeline = meta.timeline || [];
  const statusLower = input.status.toLowerCase();
  const whenLabel = formatAppointmentWhen(input.startsAt, input.timezone);

  if (statusLower === "canceled" || statusLower === "cancelled") {
    const ev = timeline.find((e) => e.type === arSmsOutcomeTimelineType("cancelled"));
    return {
      kind: "cancelled",
      label: "Cancelled by customer",
      detailLine: `Was scheduled for ${whenLabel}`,
      at: ev?.at || meta.arCustomerConfirmedAt,
    };
  }

  const latest = latestOutcomeEvent(timeline);
  if (latest) {
    const kind = kindFromOutcomeType(latest.type);
    if (kind === "confirmed") {
      return {
        kind: "confirmed",
        label: "Confirmed",
        detailLine: `Appointment on ${whenLabel}`,
        at: latest.at,
      };
    }
    if (kind === "cancel_pending") {
      return {
        kind: "cancel_pending",
        label: "Awaiting cancel confirmation",
        detailLine: latest.detail || `Reply YES to cancel · ${whenLabel}`,
        at: latest.at,
      };
    }
    if (kind === "reschedule_pending") {
      return {
        kind: "reschedule_pending",
        label: "Rescheduling in progress",
        detailLine: latest.detail || whenLabel,
        at: latest.at,
      };
    }
    if (kind === "reschedule_requested") {
      return {
        kind: "reschedule_requested",
        label: "Reschedule requested",
        detailLine: latest.detail || whenLabel,
        at: latest.at,
      };
    }
    if (kind === "rescheduled") {
      const newWhen = latest.detail
        ? formatAppointmentWhen(latest.detail, input.timezone)
        : whenLabel;
      return {
        kind: "rescheduled",
        label: "Rescheduled",
        detailLine: `Now ${newWhen}`,
        at: latest.at,
      };
    }
  }

  const cancelPending = (meta as { arCancelPending?: { requestedAt?: string } }).arCancelPending;
  if (cancelPending) {
    return {
      kind: "cancel_pending",
      label: "Awaiting cancel confirmation",
      detailLine: `Appointment on ${whenLabel}`,
      at: cancelPending.requestedAt,
    };
  }

  const rescheduleReq = (
    meta as {
      arRescheduleRequest?: {
        status?: string;
        requestedAt?: string;
        proposedStartsAt?: string;
      };
    }
  ).arRescheduleRequest;
  if (
    rescheduleReq &&
    (rescheduleReq.status === "pending_approval" ||
      rescheduleReq.status === "pending_business" ||
      rescheduleReq.status === "processing")
  ) {
    const proposed = rescheduleReq.proposedStartsAt
      ? formatAppointmentWhen(rescheduleReq.proposedStartsAt, input.timezone)
      : undefined;
    return {
      kind: "reschedule_requested",
      label: "Reschedule requested",
      detailLine: proposed ? `Requested ${proposed}` : `Original ${whenLabel}`,
      at: rescheduleReq.requestedAt,
    };
  }

  const confirmedAt = (meta as { arCustomerConfirmedAt?: string }).arCustomerConfirmedAt;
  if (statusLower === "confirmed" && confirmedAt) {
    return {
      kind: "confirmed",
      label: "Confirmed",
      detailLine: `Appointment on ${whenLabel}`,
      at: confirmedAt,
    };
  }

  const rescheduledLegacy = timeline.filter((e) => e.type === "rescheduled").pop();
  if (rescheduledLegacy) {
    return {
      kind: "rescheduled",
      label: "Rescheduled",
      detailLine: `Now ${whenLabel}`,
      at: rescheduledLegacy.at,
    };
  }

  const stoppedOnReply = timeline.find((e) => e.type === "reminders_stopped_on_reply");
  if (stoppedOnReply) {
    return {
      kind: "replied",
      label: "Customer replied",
      detailLine: stoppedOnReply.detail?.slice(0, 80) || undefined,
      at: stoppedOnReply.at,
    };
  }

  return {
    kind: "none",
    label: "No response yet",
    detailLine: undefined,
  };
}

export type ArReminderEngagementStep = {
  reminderLabel: string;
  timelineType: string;
  sentAt?: string;
  sendStatus: "scheduled" | "sent" | "delivered" | "failed" | "skipped" | "past_due";
  customerResponse?: ArCustomerResponseSummary;
};

export function mergeReminderSentWithOutcomes(input: {
  sentEvents: Array<{ label: string; type: string; at: string; detail?: string }>;
  outcomeEvents: AppointmentTimelineEvent[];
  timezone?: string | null;
  currentStartsAt: string;
}): ArReminderEngagementStep[] {
  const outcomesByReminder = new Map<string, AppointmentTimelineEvent[]>();
  for (const ev of input.outcomeEvents) {
    if (!isArSmsOutcomeTimelineEvent(ev.type)) continue;
    const reminderKey = ev.detail?.split("|")[0]?.trim() || "unknown";
    const list = outcomesByReminder.get(reminderKey) || [];
    list.push(ev);
    outcomesByReminder.set(reminderKey, list);
  }

  return input.sentEvents.map((sent) => {
    const linked = outcomesByReminder.get(sent.type) || [];
    const latestOutcome = linked[linked.length - 1];
    let customerResponse: ArCustomerResponseSummary | undefined;
    if (latestOutcome) {
      const kind = kindFromOutcomeType(latestOutcome.type);
      if (kind) {
        customerResponse = resolveArCustomerResponseSummary({
          status: kind === "cancelled" ? "cancelled" : "scheduled",
          startsAt: input.currentStartsAt,
          timezone: input.timezone,
          metadata: {
            timeline: [latestOutcome],
            arCustomerConfirmedAt:
              kind === "confirmed" ? latestOutcome.at : undefined,
          },
        });
        customerResponse = { ...customerResponse, kind, at: latestOutcome.at };
        if (latestOutcome.label) {
          customerResponse.label = latestOutcome.label;
        }
      }
    }
    return {
      reminderLabel: sent.label,
      timelineType: sent.type,
      sentAt: sent.at,
      sendStatus: sent.type.includes("failed") ? "failed" : "sent",
      customerResponse,
    };
  });
}
