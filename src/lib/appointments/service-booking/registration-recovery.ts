import "server-only";

import { getClassRegistrationDb } from "./class-registration-db";
import { CLASS_REGISTRATION_CHECKOUT_TYPE } from "./class-registration-checkout";
import { fulfillClassRegistrationBySessionId } from "./class-registration-checkout";

export type RegistrationRecoveryRow = {
  id: string;
  kind: "hold" | "fulfillment";
  stripeCheckoutSessionId: string | null;
  contactId: string | null;
  occurrenceId: string | null;
  status: string;
  recovery: string | null;
  reason: string | null;
  updatedAt: Date;
};

export async function listRegistrationRecoveryIssues(
  workspaceId: string,
): Promise<RegistrationRecoveryRow[]> {
  const prisma = getClassRegistrationDb();
  const holds = await prisma.classOccurrenceRegistrationHold.findMany({
    where: {
      workspaceId,
      OR: [
        { status: "failed_fulfillment" },
        { fulfillmentOutcome: { in: ["refund_pending", "manual_review"] } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const fulfillments = await prisma.serviceBookingStoreFulfillment.findMany({
    where: {
      workspaceId,
      transactionType: CLASS_REGISTRATION_CHECKOUT_TYPE,
      status: "failed",
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const rows: RegistrationRecoveryRow[] = [];

  for (const h of holds) {
    const meta =
      h.metadata && typeof h.metadata === "object"
        ? (h.metadata as { failureReason?: string })
        : {};
    rows.push({
      id: h.id,
      kind: "hold",
      stripeCheckoutSessionId: h.stripeCheckoutSessionId,
      contactId: h.contactId,
      occurrenceId: h.occurrenceId,
      status: h.status,
      recovery: h.fulfillmentOutcome,
      reason: meta.failureReason || null,
      updatedAt: h.updatedAt,
    });
  }

  for (const f of fulfillments) {
    rows.push({
      id: f.id,
      kind: "fulfillment",
      stripeCheckoutSessionId: f.stripeSessionId,
      contactId: null,
      occurrenceId: null,
      status: f.status,
      recovery: "manual_review",
      reason: f.errorMessage,
      updatedAt: f.updatedAt,
    });
  }

  rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return rows.slice(0, 50);
}

export async function retryRegistrationFulfillment(
  workspaceId: string,
  stripeCheckoutSessionId: string,
) {
  const prisma = getClassRegistrationDb();
  const failed = await prisma.serviceBookingStoreFulfillment.findUnique({
    where: { stripeSessionId: stripeCheckoutSessionId },
  });
  if (failed?.status === "failed") {
    await prisma.serviceBookingStoreFulfillment.update({
      where: { id: failed.id },
      data: { status: "processing", errorMessage: null },
    });
  }
  return fulfillClassRegistrationBySessionId(workspaceId, stripeCheckoutSessionId);
}
