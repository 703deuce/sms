import { getPrisma } from "@/lib/db";
import type {
  MctbHandoffEventType,
  MctbLeadSnapshotDerived,
  MctbLeadSnapshotFacts,
} from "./types";

export async function createMctbLeadSnapshot(input: {
  workspaceId: string;
  missedCallEventId?: string | null;
  conversationId?: string | null;
  triggerEvent: MctbHandoffEventType;
  customerFacts: MctbLeadSnapshotFacts;
  aiDerived?: MctbLeadSnapshotDerived;
}) {
  if (process.env.LR_CERT_E2E === "1") {
    return {
      id: `e2e-snapshot-${input.conversationId || "none"}`,
      workspaceId: input.workspaceId,
    };
  }
  const prisma = getPrisma();
  const summaryLines: string[] = [];
  if (input.customerFacts.callerName) summaryLines.push(input.customerFacts.callerName);
  if (input.customerFacts.callerPhone) summaryLines.push(input.customerFacts.callerPhone);
  if (input.customerFacts.serviceReason) summaryLines.push(input.customerFacts.serviceReason);
  if (input.aiDerived?.requestedAction) summaryLines.push(input.aiDerived.requestedAction);

  return prisma.mctbLeadSnapshot.create({
    data: {
      workspaceId: input.workspaceId,
      missedCallEventId: input.missedCallEventId ?? null,
      conversationId: input.conversationId ?? null,
      triggerEvent: input.triggerEvent,
      customerFactsJson: input.customerFacts,
      aiDerivedJson: input.aiDerived || {},
      summaryText: summaryLines.filter(Boolean).join(" · ") || null,
    },
  });
}

export function buildSnapshotFactsFromCaptured(
  captured: Record<string, unknown>,
  callerPhone: string,
  customerMessages: string[],
): MctbLeadSnapshotFacts {
  return {
    callerPhone,
    callerName: stringOrUndefined(captured.caller_name),
    serviceReason: stringOrUndefined(captured.service_reason),
    urgency: stringOrUndefined(captured.urgency),
    locationZip: stringOrUndefined(captured.location_zip),
    serviceAddress: stringOrUndefined(captured.service_address),
    callbackTime: stringOrUndefined(captured.callback_time),
    customerType: stringOrUndefined(captured.customer_type),
    appointmentIntent: stringOrUndefined(captured.appointment_intent),
    additionalDetails: stringOrUndefined(captured.additional_details),
    customerMessages,
  };
}

function stringOrUndefined(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}
