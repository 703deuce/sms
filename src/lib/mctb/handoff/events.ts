import { getPrisma } from "@/lib/db";
import type { MctbHandoffEventType } from "./types";

export async function recordMctbHandoffEvent(input: {
  workspaceId: string;
  eventType: MctbHandoffEventType;
  idempotencyKey: string;
  missedCallEventId?: string | null;
  conversationId?: string | null;
  leadSnapshotId?: string | null;
  urgencyAssessmentId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (process.env.LR_CERT_E2E === "1") {
    return {
      event: {
        id: `e2e-handoff-${input.idempotencyKey}`,
        workspaceId: input.workspaceId,
        eventType: input.eventType,
        idempotencyKey: input.idempotencyKey,
      },
      created: true,
    };
  }
  const prisma = getPrisma();
  const existing = await prisma.mctbHandoffEvent.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return { event: existing, created: false };

  const event = await prisma.mctbHandoffEvent.create({
    data: {
      workspaceId: input.workspaceId,
      eventType: input.eventType,
      idempotencyKey: input.idempotencyKey,
      missedCallEventId: input.missedCallEventId ?? null,
      conversationId: input.conversationId ?? null,
      leadSnapshotId: input.leadSnapshotId ?? null,
      urgencyAssessmentId: input.urgencyAssessmentId ?? null,
      metadataJson: input.metadata || {},
    },
  });
  return { event, created: true };
}

export async function persistUrgencyAssessment(input: {
  workspaceId: string;
  conversationId?: string | null;
  missedCallEventId?: string | null;
  customerText: string;
  classification: string;
  confidence?: number;
  reason?: string;
  ruleVersion?: string;
}) {
  const prisma = getPrisma();
  return prisma.mctbUrgencyAssessment.create({
    data: {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId ?? null,
      missedCallEventId: input.missedCallEventId ?? null,
      customerText: input.customerText.slice(0, 4000),
      classification: input.classification,
      confidence: input.confidence ?? null,
      reason: input.reason ?? null,
      ruleVersion: input.ruleVersion ?? null,
    },
  });
}
