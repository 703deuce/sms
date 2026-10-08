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
  /** Compact list/table line, e.g. "Cancelled — policy accepted" */
  listDisplayLine?: string;
};

export type ArCustomerActionHistoryItem = {
  at: string;
  kind: string;
  label: string;
  detailLine?: string;
  actor?: "customer" | "transovo" | "system";
  direction?: "inbound" | "outbound";
  messageText?: string;
  providerMessageId?: string;
  consequenceLabel?: string;
  policyWindowLabel?: string;
  calendarResult?: string;
  operationId?: string;
  reminderTimelineType?: string;
};

const AR_SMS_OUTCOME_PREFIX = "ar_sms_outcome_";

export type ArSmsOutcomeSuffix =
  | "confirmed"
  | "cancel_pending"
  | "cancelled"
  | "reschedule_started"
  | "reschedule_requested"
  | "rescheduled"
  | "policy_disclosed"
  | "policy_accepted"
  | "policy_declined"
  | "reminder_sent"
  | "calendar_verified";

export function arSmsOutcomeTimelineType(outcome: ArSmsOutcomeSuffix): string {
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
    case "policy_disclosed":
    case "policy_accepted":
    case "policy_declined":
    case "reminder_sent":
    case "calendar_verified":
      return null;
    default:
      return null;
  }
}

function formatPolicyWindowLabel(cutoffMinutes?: number): string | undefined {
  if (!cutoffMinutes || cutoffMinutes <= 0) return undefined;
  if (cutoffMinutes % 1440 === 0) {
    const days = cutoffMinutes / 1440;
    return days === 1 ? "24-hour cancellation" : `${days}-day cancellation`;
  }
  if (cutoffMinutes % 60 === 0) {
    return `${cutoffMinutes / 60}-hour cancellation`;
  }
  return `${cutoffMinutes}-minute cancellation`;
}

function hadPolicyAcceptanceBefore(
  timeline: AppointmentTimelineEvent[],
  terminalAt: string,
  action?: "cancel" | "reschedule",
): boolean {
  const terminalMs = new Date(terminalAt).getTime();
  return timeline.some((e) => {
    if (!e.type.endsWith("policy_accepted")) return false;
    if (new Date(e.at).getTime() > terminalMs) return false;
    const parsed = parseArSmsOutcomeDetail(e.detail);
    if (action && parsed.evidence?.action && parsed.evidence.action !== action) return false;
    return true;
  });
}

function enrichListDisplay(
  summary: ArCustomerResponseSummary,
  input: {
    timeline: AppointmentTimelineEvent[];
    timezone?: string | null;
    startsAt: string;
  },
): ArCustomerResponseSummary {
  const latest = latestOutcomeEvent(input.timeline);
  if (summary.kind === "cancelled") {
    const policyAccepted =
      latest && hadPolicyAcceptanceBefore(input.timeline, latest.at, "cancel");
    return {
      ...summary,
      listDisplayLine: policyAccepted ? "Cancelled — policy accepted" : "Cancelled",
    };
  }
  if (summary.kind === "rescheduled" && summary.detailLine) {
    const short = summary.detailLine.replace(/^Now /, "");
    return { ...summary, listDisplayLine: `Rescheduled — ${short}` };
  }
  if (summary.kind === "confirmed") {
    return { ...summary, listDisplayLine: "Confirmed" };
  }
  if (summary.kind === "cancel_pending") {
    return { ...summary, listDisplayLine: "Awaiting cancel confirmation" };
  }
  if (summary.kind === "reschedule_pending" || summary.kind === "reschedule_requested") {
    return { ...summary, listDisplayLine: "Reschedule in progress" };
  }
  if (summary.kind === "awaiting_reply" || summary.kind === "replied") {
    return { ...summary, listDisplayLine: "Awaiting response" };
  }
  if (summary.kind === "none") {
    return { ...summary, listDisplayLine: "Awaiting response" };
  }
  return summary;
}

export function mapOutcomeEventToHistoryItem(
  ev: AppointmentTimelineEvent,
  timezone?: string | null,
): ArCustomerActionHistoryItem {
  const parsed = parseArSmsOutcomeDetail(ev.detail);
  const evd = parsed.evidence;
  const suffix = ev.type.slice(AR_SMS_OUTCOME_PREFIX.length);
  const policyWindowLabel =
    evd?.policyCutoffMinutes != null
      ? formatPolicyWindowLabel(evd.policyCutoffMinutes)
      : undefined;

  let actor: ArCustomerActionHistoryItem["actor"] = "system";
  let direction = evd?.direction;
  if (direction === "inbound") actor = "customer";
  if (direction === "outbound") actor = "transovo";
  if (suffix === "cancelled" || suffix === "rescheduled" || suffix === "calendar_verified") {
    actor = "system";
  }

  const messageText =
    evd?.messageText?.trim() ||
    (parsed.note?.startsWith("Customer texted:")
      ? parsed.note.replace(/^Customer texted:\s*/i, "").replace(/^"|"$/g, "")
      : undefined);

  return {
    at: ev.at,
    kind: suffix,
    label: ev.label || suffix,
    detailLine: parsed.newStartsAtIso
      ? formatAppointmentWhen(parsed.newStartsAtIso, timezone)
      : undefined,
    actor,
    direction,
    messageText,
    providerMessageId: evd?.providerMessageId,
    consequenceLabel: evd?.consequenceLabel,
    policyWindowLabel,
    calendarResult: evd?.calendarResult,
    operationId: evd?.operationId,
    reminderTimelineType: parsed.reminderTimelineType,
  };
}

export function buildCustomerActionHistory(input: {
  metadata: AppointmentMetadata;
  timezone?: string | null;
  status: string;
  startsAt: string;
  reminderSentEvents?: Array<{ at: string; label: string; timelineType: string }>;
}): ArCustomerActionHistoryItem[] {
  const outcomeItems = listArSmsOutcomeEvents(input.metadata).map((ev) =>
    mapOutcomeEventToHistoryItem(ev, input.timezone),
  );
  const reminderItems: ArCustomerActionHistoryItem[] = (input.reminderSentEvents || [])
    .filter((r) => !outcomeItems.some((o) => o.kind === "reminder_sent" && o.at === r.at))
    .map((r) => ({
      at: r.at,
      kind: "reminder_sent",
      label: r.label || "Reminder sent",
      actor: "transovo",
      direction: "outbound",
      reminderTimelineType: r.timelineType,
    }));

  return [...reminderItems, ...outcomeItems].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

export type ArSmsEvidenceSummary = {
  customerAction?: string;
  policyWindowLabel?: string;
  acceptanceStatus?: "recorded" | "declined" | "not_required" | "pending";
  consequenceLabel?: string;
};

export function resolveArSmsEvidenceSummary(metadata: AppointmentMetadata): ArSmsEvidenceSummary {
  const timeline = metadata.timeline || [];
  const outcomes = listArSmsOutcomeEvents(metadata);
  const latestPolicyDisclosed = [...outcomes]
    .reverse()
    .find((e) => e.type.endsWith("policy_disclosed"));
  const latestPolicyAccepted = [...outcomes]
    .reverse()
    .find((e) => e.type.endsWith("policy_accepted"));
  const latestPolicyDeclined = [...outcomes]
    .reverse()
    .find((e) => e.type.endsWith("policy_declined"));

  const disclosed = latestPolicyDisclosed
    ? parseArSmsOutcomeDetail(latestPolicyDisclosed.detail)
    : null;
  const consequenceLabel = disclosed?.evidence?.consequenceLabel;

  let acceptanceStatus: ArSmsEvidenceSummary["acceptanceStatus"] = "not_required";
  if (latestPolicyDeclined) acceptanceStatus = "declined";
  else if (latestPolicyAccepted) acceptanceStatus = "recorded";
  else if (latestPolicyDisclosed) acceptanceStatus = "pending";

  const latestTerminal = [...outcomes]
    .reverse()
    .find((e) =>
      ["cancelled", "rescheduled", "confirmed"].some((s) => e.type.endsWith(s)),
    );
  let customerAction: string | undefined;
  if (latestTerminal?.type.endsWith("cancelled")) customerAction = "Cancelled by SMS";
  else if (latestTerminal?.type.endsWith("rescheduled")) customerAction = "Rescheduled by SMS";
  else if (latestTerminal?.type.endsWith("confirmed")) customerAction = "Confirmed by SMS";

  return {
    customerAction,
    policyWindowLabel: disclosed?.evidence?.policyCutoffMinutes
      ? formatPolicyWindowLabel(disclosed.evidence.policyCutoffMinutes)
      : undefined,
    acceptanceStatus,
    consequenceLabel,
  };
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
    if (fromEvent) {
      return enrichListDisplay(fromEvent, {
        timeline,
        timezone: input.timezone,
        startsAt: input.startsAt,
      });
    }
  }

  if (statusLower === "canceled" || statusLower === "cancelled") {
    const ev = timeline.find((e) => e.type === arSmsOutcomeTimelineType("cancelled"));
    return enrichListDisplay(
      {
        kind: "cancelled",
        label: "Cancelled by customer",
        detailLine: `Was scheduled for ${whenLabel}`,
        at: ev?.at,
        reasonLine: ev ? parseArSmsOutcomeDetail(ev.detail).note : undefined,
      },
      { timeline, timezone: input.timezone, startsAt: input.startsAt },
    );
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

  return enrichListDisplay(
    {
      kind: "none",
      label: "No response yet",
      detailLine: undefined,
    },
    { timeline, timezone: input.timezone, startsAt: input.startsAt },
  );
}

export type ArReminderEngagementStep = {
  reminderLabel: string;
  timelineType: string;
  sentAt?: string;
  sendStatus: "scheduled" | "sent" | "delivered" | "failed" | "skipped" | "past_due";
  customerResponse?: ArCustomerResponseSummary;
};
