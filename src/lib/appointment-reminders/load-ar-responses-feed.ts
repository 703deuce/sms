import "server-only";

import { listHeldInboundForWorkspace } from "@/lib/appointment-reminders/messaging/platform-inbound-held";
import {
  loadRecentArCustomerResponses,
  type ArOverviewCustomerResponseRow,
} from "@/lib/appointment-reminders/load-recent-customer-responses";
import type { ArCustomerResponseKind } from "@/lib/appointment-reminders/ar-sms-customer-outcome";

export type ArResponseFeedView = "all" | "needs_attention" | "held";

export type ArResponseEventRow = {
  id: string;
  source: "appointment" | "held";
  appointmentId: string | null;
  customerLabel: string;
  appointmentLabel: string;
  startsAt: string | null;
  channel: string;
  responseLabel: string;
  responseKind: ArCustomerResponseKind | "held";
  detailLine?: string;
  occurredAt: string;
  actionHref: string | null;
  holdReason?: string;
  bodyPreview?: string;
  heldId?: string;
  heldReplySessionId?: string | null;
};

const NEEDS_ATTENTION_KINDS = new Set<ArCustomerResponseKind>([
  "cancel_pending",
  "reschedule_pending",
  "reschedule_requested",
  "awaiting_reply",
]);

function appointmentRowToEvent(row: ArOverviewCustomerResponseRow): ArResponseEventRow {
  const ch =
    row.customerResponse.detailLine?.toLowerCase().includes("email") ? "email" : "sms";
  const verbatim =
    row.customerResponse.kind === "replied"
      ? row.customerResponse.detailLine || row.customerResponse.reasonLine
      : undefined;
  return {
    id: `appt:${row.appointmentId}:${row.responseAt}`,
    source: "appointment",
    appointmentId: row.appointmentId,
    customerLabel: row.customerName,
    appointmentLabel: row.appointmentTitle,
    startsAt: row.startsAt,
    channel: ch,
    responseLabel: row.customerResponse.listDisplayLine || row.customerResponse.label,
    responseKind: row.customerResponse.kind,
    detailLine: row.customerResponse.detailLine || row.customerResponse.reasonLine,
    bodyPreview: verbatim,
    occurredAt: row.responseAt,
    actionHref: `/appointment-reminders/appointments?highlight=${encodeURIComponent(row.appointmentId)}`,
  };
}

export async function loadArResponsesFeed(
  workspaceId: string,
  view: ArResponseFeedView,
  limit = 100,
): Promise<ArResponseEventRow[]> {
  if (view === "held") {
    const held = await listHeldInboundForWorkspace(workspaceId);
    return held.map((row) => {
      const candidates = (row.candidateContexts as Array<{
        product: string;
        appointmentId?: string;
        replySessionId?: string;
      }>).filter((c) => c);
      const arCandidates = candidates.filter((c) => c.product === "appointment_reminders");
      const singleAr = arCandidates.length === 1 ? arCandidates[0] : null;
      const appointmentId =
        singleAr?.appointmentId ?? candidates.find((c) => c.appointmentId)?.appointmentId ?? null;
      return {
        id: `held:${row.id}`,
        source: "held" as const,
        appointmentId,
        customerLabel: row.fromE164,
        appointmentLabel: "Held inbound message",
        startsAt: null,
        channel: row.channel || "sms",
        responseLabel: "Needs review",
        responseKind: "held",
        detailLine: row.holdReason.replace(/_/g, " "),
        bodyPreview: row.bodyPreview,
        occurredAt: row.createdAt.toISOString(),
        actionHref: appointmentId
          ? `/appointment-reminders/appointments?highlight=${encodeURIComponent(appointmentId)}`
          : null,
        holdReason: row.holdReason,
        heldId: row.id,
        heldReplySessionId: singleAr?.replySessionId ?? null,
      };
    });
  }

  const responses = await loadRecentArCustomerResponses(workspaceId, Math.min(limit, 200));

  let events = responses.map(appointmentRowToEvent);

  if (view === "needs_attention") {
    events = events.filter((e) => NEEDS_ATTENTION_KINDS.has(e.responseKind as ArCustomerResponseKind));
    const held = await loadArResponsesFeed(workspaceId, "held", 50);
    events = [...events, ...held].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
    return events.slice(0, limit);
  }

  return events.slice(0, limit);
}
