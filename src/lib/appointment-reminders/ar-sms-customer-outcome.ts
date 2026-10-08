import type { AppointmentMetadata, AppointmentTimelineEvent } from "@/lib/appointments/types";
import { parseArSmsOutcomeDetail } from "./ar-sms-outcome-detail";

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
  /** Customer message snippet or contextual note when known */
  reasonLine?: string;
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
  const outcomes = timeline
    .filter((e) => isArSmsOutcomeTimelineEvent(e.type))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  if (!outcomes.length) return null;
  return outcomes[outcomes.length - 1]!;
}

export function listArSmsOutcomeEvents(
  metadata: AppointmentMetadata,
): AppointmentTimelineEvent[] {
  return (metadata.timeline || [])
    .filter((e) => isArSmsOutcomeTimelineEvent(e.type))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function summaryFromOutcomeEvent(
  ev: AppointmentTimelineEvent,
  whenLabel: string,
  timezone?: string | null,
): ArCustomerResponseSummary | null {
  const kind = kindFromOutcomeType(ev.type);
  if (!kind) return null;
  const parsed = parseArSmsOutcomeDetail(ev.detail);
  const newWhen = parsed.newStartsAtIso
    ? formatAppointmentWhen(parsed.newStartsAtIso, timezone)
    : whenLabel;
  const base: ArCustomerResponseSummary = {
    kind,
    label: ev.label || kind,
    at: ev.at,
    reasonLine: parsed.note,
  };
  switch (kind) {
    case "confirmed":
      return { ...base, label: "Confirmed", detailLine: `Appointment on ${whenLabel}` };
    case "cancelled":
      return {
        ...base,
        label: "Cancelled by customer",
        detailLine: `Was scheduled for ${whenLabel}`,
      };
    case "cancel_pending":
      return {
        ...base,
        label: "Awaiting cancel confirmation",
        detailLine: `Appointment on ${whenLabel}`,
      };
    case "rescheduled":
      return { ...base, label: "Rescheduled", detailLine: `Now ${newWhen}` };
    case "reschedule_requested":
      return { ...base, label: "Reschedule requested", detailLine: parsed.note || whenLabel };
    case "reschedule_pending":
      return { ...base, label: "Rescheduling in progress", detailLine: whenLabel };
    default:
      return base;
  }
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

  const latest = latestOutcomeEvent(timeline);
  if (latest) {
    const fromEvent = summaryFromOutcomeEvent(latest, whenLabel, input.timezone);
    if (fromEvent) return fromEvent;
  }

  if (statusLower === "canceled" || statusLower === "cancelled") {
    const ev = timeline.find((e) => e.type === arSmsOutcomeTimelineType("cancelled"));
    return {
      kind: "cancelled",
      label: "Cancelled by customer",
      detailLine: `Was scheduled for ${whenLabel}`,
      at: ev?.at,
      reasonLine: ev ? parseArSmsOutcomeDetail(ev.detail).note : undefined,
    };
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
