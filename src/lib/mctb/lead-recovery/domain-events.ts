import { getPrisma } from "@/lib/db";

export const LEAD_RECOVERY_DOMAIN_EVENTS = [
  "INTENT_IDENTIFIED",
  "POLICY_MATCHED",
  "FIELD_COLLECTED",
  "LEAD_QUALIFIED",
  "CALLBACK_REQUESTED",
  "OWNER_NOTIFIED",
  "EMERGENCY_ESCALATED",
  "BOOKING_LINK_SENT",
  "BOOKING_CONFIRMED",
  "BOOKING_RESCHEDULED",
  "BOOKING_CANCELLED",
  "PAYMENT_REQUEST_SENT",
  "PAYMENT_CONFIRMED",
  "PAYMENT_FAILED",
  "HUMAN_HANDOFF",
  "OPT_OUT",
] as const;

export type LeadRecoveryDomainEventKind = (typeof LEAD_RECOVERY_DOMAIN_EVENTS)[number];

export async function recordLeadRecoveryDomainEvent(input: {
  workspaceId: string;
  conversationId: string;
  kind: LeadRecoveryDomainEventKind;
  idempotencyKey: string;
  contactId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const recent = await prisma.mctbConversationBookingActivity.findMany({
    where: { conversationId: input.conversationId, kind: input.kind },
    take: 20,
    orderBy: { createdAt: "desc" },
  });
  const existing = recent.find(
    (r) =>
      (r.payloadJson as Record<string, unknown>)?.idempotencyKey === input.idempotencyKey,
  );
  if (existing) return { created: false, id: existing.id };

  const row = await prisma.mctbConversationBookingActivity.create({
    data: {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      contactId: input.contactId ?? null,
      kind: input.kind,
      payloadJson: {
        idempotencyKey: input.idempotencyKey,
        ...input.payload,
      },
    },
  });
  return { created: true, id: row.id };
}

export function actionToDomainEvent(action: string): LeadRecoveryDomainEventKind | null {
  const map: Record<string, LeadRecoveryDomainEventKind> = {
    booking_link_sent: "BOOKING_LINK_SENT",
    callback_requested: "CALLBACK_REQUESTED",
    escalate_human: "HUMAN_HANDOFF",
    opt_out: "OPT_OUT",
    payment_request_sent: "PAYMENT_REQUEST_SENT",
    payment_needs_amount: "PAYMENT_FAILED",
    send_owner_sms: "OWNER_NOTIFIED",
    send_team_sms: "OWNER_NOTIFIED",
  };
  return map[action] || null;
}
