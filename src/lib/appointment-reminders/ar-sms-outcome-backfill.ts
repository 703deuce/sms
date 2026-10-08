import type { AppointmentMetadata, AppointmentTimelineEvent } from "@/lib/appointments/types";
import {
  arSmsOutcomeTimelineType,
  isArSmsOutcomeTimelineEvent,
  type ArSmsRecordableOutcome,
} from "./ar-sms-customer-outcome";

export type ArSmsSessionBackfillRow = {
  id: string;
  timelineType: string | null;
  lifecycleState: string;
  conversationId: string | null;
  createdAt: Date;
  completedAt: Date | null;
  lastUsedAt: Date;
};

export type InferredArSmsOutcome = {
  outcome: ArSmsRecordableOutcome;
  at: string;
  reminderTimelineType: string;
  note?: string;
  newStartsAtIso?: string;
};

export function hasArSmsOutcomeInTimeline(
  timeline: AppointmentTimelineEvent[],
  outcome: ArSmsRecordableOutcome,
): boolean {
  const type = arSmsOutcomeTimelineType(outcome);
  return timeline.some((e) => e.type === type);
}

function pickReminderTypeForTime(
  meta: AppointmentMetadata,
  sessions: ArSmsSessionBackfillRow[],
  at: Date,
): string {
  const eligible = sessions
    .filter((s) => s.timelineType && s.createdAt.getTime() <= at.getTime())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (eligible[0]?.timelineType) return eligible[0].timelineType!;

  const sent = (meta.timeline || []).filter((e) => {
    if (!e.at) return false;
    const isSent =
      e.type.includes("reminder") ||
      e.type.includes("confirmation") ||
      e.type.includes("_sent");
    return isSent && new Date(e.at).getTime() <= at.getTime();
  });
  const lastSent = sent[sent.length - 1];
  if (lastSent?.type) return lastSent.type;

  const lastReminder = (meta as { lastReminderTimelineType?: string }).lastReminderTimelineType;
  return lastReminder || "unknown_reminder";
}

function sessionAt(session: ArSmsSessionBackfillRow): Date {
  return session.completedAt || session.lastUsedAt || session.createdAt;
}

/**
 * Infer missing customer-outcome events from legacy appointment + session state.
 */
export function inferArSmsOutcomesForBackfill(input: {
  metadata: AppointmentMetadata;
  status: string;
  startsAt: Date;
  sessions: ArSmsSessionBackfillRow[];
  /** Optional map sessionId -> last inbound SMS snippet */
  inboundSnippetBySessionId?: Record<string, string>;
}): InferredArSmsOutcome[] {
  const timeline = input.metadata.timeline || [];
  const statusLower = input.status.toLowerCase();
  const meta = input.metadata;
  const inferred: InferredArSmsOutcome[] = [];

  const push = (row: InferredArSmsOutcome) => {
    if (hasArSmsOutcomeInTimeline(timeline, row.outcome)) return;
    if (inferred.some((r) => r.outcome === row.outcome)) return;
    inferred.push(row);
  };

  const snippetForSession = (sessionId: string | null): string | undefined => {
    if (!sessionId || !input.inboundSnippetBySessionId) return undefined;
    const s = input.inboundSnippetBySessionId[sessionId]?.trim();
    return s ? `Customer texted: "${s.slice(0, 160)}"` : undefined;
  };

  const rescheduledLegacy = timeline.filter((e) => e.type === "rescheduled").pop();
  if (rescheduledLegacy) {
    const at = new Date(rescheduledLegacy.at);
    const iso = rescheduledLegacy.detail?.trim();
    push({
      outcome: "rescheduled",
      at: rescheduledLegacy.at,
      reminderTimelineType: pickReminderTypeForTime(meta, input.sessions, at),
      newStartsAtIso: iso && /^\d{4}-\d{2}-\d{2}T/.test(iso) ? iso : input.startsAt.toISOString(),
      note: "Rescheduled via SMS (backfilled from calendar update)",
    });
  }

  if (statusLower === "canceled" || statusLower === "cancelled") {
    const canceledEvent = timeline.find((e) => e.type === "canceled");
    const latestSession = [...input.sessions].sort(
      (a, b) => sessionAt(b).getTime() - sessionAt(a).getTime(),
    )[0];
    const at = canceledEvent?.at
      ? new Date(canceledEvent.at)
      : latestSession
        ? sessionAt(latestSession)
        : new Date();

    const initiatedBy = (meta as { lastChangeInitiatedBy?: string }).lastChangeInitiatedBy;
    const session = input.sessions.find((s) => s.lifecycleState === "COMPLETED") || input.sessions[0];
    const note =
      snippetForSession(session?.id ?? null) ||
      (initiatedBy === "customer"
        ? "Cancelled by customer via SMS"
        : "Appointment cancelled");

    push({
      outcome: "cancelled",
      at: at.toISOString(),
      reminderTimelineType: pickReminderTypeForTime(meta, input.sessions, at),
      note,
    });
  }

  const cancelPending = (meta as { arCancelPending?: { requestedAt?: string } }).arCancelPending;
  if (cancelPending && statusLower !== "canceled" && statusLower !== "cancelled") {
    const at = new Date(cancelPending.requestedAt || Date.now());
    const session = input.sessions.find((s) => s.lifecycleState === "AWAITING_CANCEL_CONFIRM");
    push({
      outcome: "cancel_pending",
      at: at.toISOString(),
      reminderTimelineType: pickReminderTypeForTime(meta, input.sessions, at),
      note:
        snippetForSession(session?.id ?? null) ||
        "Customer requested cancellation — awaiting YES to confirm",
    });
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
    const at = new Date(rescheduleReq.requestedAt || Date.now());
    const proposed = rescheduleReq.proposedStartsAt
      ? `Requested time: ${rescheduleReq.proposedStartsAt}`
      : "Business follow-up required";
    push({
      outcome: "reschedule_requested",
      at: at.toISOString(),
      reminderTimelineType: pickReminderTypeForTime(meta, input.sessions, at),
      note: proposed,
    });
  }

  const confirmedAt = (meta as { arCustomerConfirmedAt?: string }).arCustomerConfirmedAt;
  const confirmationSource = (meta as { confirmationSource?: string }).confirmationSource;
  if (
    confirmedAt &&
    (statusLower === "confirmed" || confirmationSource === "sms" || confirmationSource === "sms_reminder")
  ) {
    const at = new Date(confirmedAt);
    const session =
      input.sessions.find((s) => s.lifecycleState === "COMPLETED") ||
      input.sessions.find((s) => s.timelineType) ||
      input.sessions[0];
    push({
      outcome: "confirmed",
      at: confirmedAt,
      reminderTimelineType: pickReminderTypeForTime(meta, input.sessions, at),
      note: snippetForSession(session?.id ?? null) || "Confirmed attendance via SMS",
    });
  }

  const reschedulingSession = input.sessions.find((s) => s.lifecycleState === "RESCHEDULING");
  if (
    reschedulingSession &&
    !hasArSmsOutcomeInTimeline(timeline, "rescheduled") &&
    !inferred.some((i) => i.outcome === "rescheduled")
  ) {
    const at = sessionAt(reschedulingSession);
    push({
      outcome: "reschedule_started",
      at: at.toISOString(),
      reminderTimelineType:
        reschedulingSession.timelineType ||
        pickReminderTypeForTime(meta, input.sessions, at),
      note: snippetForSession(reschedulingSession.id) || "Customer started rescheduling by SMS",
    });
  }

  for (const session of input.sessions) {
    if (session.lifecycleState !== "COMPLETED" || !session.completedAt) continue;
    const hasTerminal = timeline.some(
      (e) => isArSmsOutcomeTimelineEvent(e.type) && e.detail?.startsWith(session.timelineType || ""),
    );
    if (hasTerminal || !session.timelineType) continue;
    if (inferred.length > 0) continue;
    push({
      outcome: "reschedule_started",
      at: session.completedAt.toISOString(),
      reminderTimelineType: session.timelineType,
      note: snippetForSession(session.id) || "SMS conversation completed (backfilled)",
    });
  }

  return inferred;
}
