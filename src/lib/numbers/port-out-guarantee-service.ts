/**
 * 30-Day Portability Guarantee — refund execution and inventory return.
 */

import { getPrisma } from "@/lib/db";

function stripeSecretConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

async function stripeRefund(paymentIntentId: string, amountCents: number) {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Stripe is not configured");

  const res = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      payment_intent: paymentIntentId,
      amount: String(amountCents),
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error?.message === "string" ? body.error.message : "Stripe refund failed",
    );
  }
  return body;
}

async function findStripePaymentIntentForReservation(
  workspaceId: string,
  reservation: { id: string; phoneNumber: string },
): Promise<string | null> {
  const prisma = getPrisma();
  const ledger = await prisma.creditLedgerEntry.findFirst({
    where: {
      workspaceId,
      stripePaymentIntentId: { not: null },
      OR: [
        { description: { contains: reservation.id } },
        { description: { contains: reservation.phoneNumber } },
        { description: { contains: `premium:${reservation.id}` } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  return ledger?.stripePaymentIntentId ?? null;
}

export async function returnNumberToTransovoInventory(input: {
  workspaceId: string;
  phoneNumberId: string;
  strategy: "KEEP_AND_RELIST" | "RELEASE_TO_PROVIDER";
}) {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!row) throw new Error("Number not found");

  const settings =
    row.settingsJson && typeof row.settingsJson === "object"
      ? { ...(row.settingsJson as Record<string, unknown>) }
      : {};

  await prisma.phoneNumberAssignment.deleteMany({ where: { phoneNumberId: row.id } });

  await prisma.phoneNumber.update({
    where: { id: row.id },
    data: {
      status: "Released",
      releasedAt: new Date(),
      voiceForwardTo: null,
      settingsJson: {
        ...settings,
        personalServiceState: "INVENTORY",
        portStatus: "returned_to_inventory",
        inventoryStrategy: input.strategy,
        parked: true,
        personalParked: true,
        routingOwner: null,
        portOutLocked: true,
      },
    },
  });

  return { ok: true, strategy: input.strategy };
}

export async function executePortOutGuaranteeRefund(input: {
  workspaceId: string;
  portOutId: string;
  userId: string;
}) {
  const prisma = getPrisma();
  const portOut = await prisma.portOutRequest.findFirst({
    where: { id: input.portOutId, workspaceId: input.workspaceId },
  });
  if (!portOut) throw new Error("Port-out request not found");
  if (!portOut.guaranteeEligible) {
    throw new Error("This transfer is not eligible for the portability guarantee.");
  }

  const reservation = await prisma.premiumNumberReservation.findFirst({
    where: { workspaceId: input.workspaceId, phoneNumberId: portOut.phoneNumberId },
    orderBy: { createdAt: "desc" },
  });

  const refundCents = reservation?.premiumPriceCents ?? 0;
  let stripeRefundId: string | null = null;

  if (refundCents > 0 && stripeSecretConfigured() && reservation?.paymentStatus === "paid") {
    const paymentIntentId = await findStripePaymentIntentForReservation(
      input.workspaceId,
      reservation,
    );
    if (paymentIntentId) {
      const refund = await stripeRefund(paymentIntentId, refundCents);
      stripeRefundId = String(refund.id || "");
    }
  }

  if (refundCents > 0) {
    await prisma.creditLedgerEntry.create({
      data: {
        workspaceId: input.workspaceId,
        amountCents: refundCents,
        description: `Portability guarantee refund for ${portOut.phone} (reservation ${reservation?.id ?? "n/a"})`,
        source: "port_out_guarantee_refund",
        stripePaymentIntentId: stripeRefundId,
      },
    });
  }

  await returnNumberToTransovoInventory({
    workspaceId: input.workspaceId,
    phoneNumberId: portOut.phoneNumberId,
    strategy: "KEEP_AND_RELIST",
  });

  const updated = await prisma.portOutRequest.update({
    where: { id: portOut.id },
    data: {
      refundStatus: stripeRefundId
        ? "completed"
        : refundCents > 0
          ? "credited"
          : "no_payment_found",
      guaranteeReviewStatus: "refund_completed",
      returnedToInventoryAt: new Date(),
      status: "CANCELED",
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "number.port_out_guarantee_refund_completed",
      detail: `${portOut.phone}:${refundCents}`,
    },
  });

  return {
    refundCents,
    stripeRefundId,
    portOutId: updated.id,
    refundStatus: updated.refundStatus,
  };
}
