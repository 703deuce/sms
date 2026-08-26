import "server-only";

import { getPrisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getOrCreateMassTextingBillingAccount } from "@/lib/mass-texting/billing-account";
import { MASS_TEXT_TRIAL } from "@/lib/mass-texting/pricing";

export type SegmentAvailability = {
  available: number;
  monthlyRemaining: number;
  paygRemaining: number;
  trialRemaining: number;
  lifecycleState: string;
  canSend: boolean;
  blockReason: string | null;
};

export async function getSegmentAvailability(
  workspaceId: string,
): Promise<SegmentAvailability> {
  const account = await getOrCreateMassTextingBillingAccount(workspaceId);
  const monthlyRemaining = Math.max(
    0,
    account.monthlySegmentsIncluded - account.monthlySegmentsUsed,
  );
  const trialRemaining = Math.max(
    0,
    MASS_TEXT_TRIAL.includedSegments - account.trialSegmentsUsed,
  );

  let available = 0;
  let canSend = false;
  let blockReason: string | null = null;

  if (account.lifecycleState === "TRIAL_ACTIVE") {
    available = trialRemaining;
    canSend = available > 0;
    if (!canSend) blockReason = "Trial segment limit reached";
  } else if (account.lifecycleState === "PRODUCTION_ACTIVE") {
    available = monthlyRemaining + account.paygCreditsSegments;
    canSend = available > 0 && (account.billingModel !== "payg" || account.paygLineActive);
    if (!canSend) {
      blockReason =
        account.billingModel === "payg" && !account.paygLineActive
          ? "PAYG Messaging Line inactive"
          : "Insufficient segments";
    }
  } else {
    blockReason = `Cannot send in state ${account.lifecycleState}`;
  }

  return {
    available,
    monthlyRemaining,
    paygRemaining: account.paygCreditsSegments,
    trialRemaining,
    lifecycleState: account.lifecycleState,
    canSend,
    blockReason,
  };
}

export async function reserveSegmentsForCampaign(input: {
  workspaceId: string;
  campaignId: string;
  segments: number;
  idempotencyKey: string;
}): Promise<
  | { ok: true; reservationId: string; reserved: number }
  | { ok: false; error: string; available?: number }
> {
  const prisma = getPrisma();
  const availability = await getSegmentAvailability(input.workspaceId);
  if (!availability.canSend) {
    return { ok: false, error: availability.blockReason || "Cannot send", available: 0 };
  }
  if (input.segments > availability.available) {
    return {
      ok: false,
      error: `Need ${input.segments} segments but only ${availability.available} available`,
      available: availability.available,
    };
  }

  const account = await getOrCreateMassTextingBillingAccount(input.workspaceId);

  const existing = await prisma.massTextingCreditReservation.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    return { ok: true, reservationId: existing.id, reserved: existing.reservedSegments };
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const fresh = await tx.massTextingBillingAccount.findUnique({
      where: { id: account.id },
    });
    if (!fresh) throw new Error("billing_account_missing");

    const monthlyRemaining = Math.max(
      0,
      fresh.monthlySegmentsIncluded - fresh.monthlySegmentsUsed,
    );
    const trialRemaining = Math.max(
      0,
      MASS_TEXT_TRIAL.includedSegments - fresh.trialSegmentsUsed,
    );
    let available = 0;
    if (fresh.lifecycleState === "TRIAL_ACTIVE") available = trialRemaining;
    else if (fresh.lifecycleState === "PRODUCTION_ACTIVE") {
      available = monthlyRemaining + fresh.paygCreditsSegments;
    }
    if (input.segments > available) {
      return {
        ok: false as const,
        error: `Need ${input.segments} segments but only ${available} available`,
        available,
      };
    }

    let remaining = input.segments;
    const patch: Record<string, number> = {};

    if (fresh.lifecycleState === "TRIAL_ACTIVE") {
      patch.trialSegmentsUsed = fresh.trialSegmentsUsed + remaining;
      remaining = 0;
    } else {
      const fromMonthly = Math.min(monthlyRemaining, remaining);
      if (fromMonthly > 0) {
        patch.monthlySegmentsUsed = fresh.monthlySegmentsUsed + fromMonthly;
        remaining -= fromMonthly;
      }
      if (remaining > 0) {
        patch.paygCreditsSegments = fresh.paygCreditsSegments - remaining;
      }
    }

    await tx.massTextingBillingAccount.update({
      where: { id: fresh.id },
      data: patch,
    });

    const reservation = await tx.massTextingCreditReservation.create({
      data: {
        workspaceId: input.workspaceId,
        billingAccountId: fresh.id,
        campaignId: input.campaignId,
        reservedSegments: input.segments,
        idempotencyKey: input.idempotencyKey,
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return { ok: true as const, reservationId: reservation.id, reserved: input.segments };
  });
}

export async function releaseReservation(reservationId: string, reason: string) {
  const prisma = getPrisma();
  const reservation = await prisma.massTextingCreditReservation.findUnique({
    where: { id: reservationId },
    include: { billingAccount: true },
  });
  if (!reservation || reservation.status !== "ACTIVE") return;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const account = reservation.billingAccount;
    if (account.lifecycleState === "TRIAL_ACTIVE") {
      await tx.massTextingBillingAccount.update({
        where: { id: account.id },
        data: {
          trialSegmentsUsed: Math.max(
            0,
            account.trialSegmentsUsed - reservation.reservedSegments,
          ),
        },
      });
    } else {
      const monthlyUsed = account.monthlySegmentsUsed;
      const monthlyIncluded = account.monthlySegmentsIncluded;
      const monthlyConsumed = Math.min(
        monthlyUsed,
        Math.min(reservation.reservedSegments, monthlyUsed),
      );
      const paygRefund = reservation.reservedSegments - monthlyConsumed;
      await tx.massTextingBillingAccount.update({
        where: { id: account.id },
        data: {
          monthlySegmentsUsed: monthlyUsed - monthlyConsumed,
          paygCreditsSegments: account.paygCreditsSegments + paygRefund,
        },
      });
    }
    await tx.massTextingCreditReservation.update({
      where: { id: reservationId },
      data: { status: "RELEASED" },
    });
  });
}

export async function consumeReservation(reservationId: string) {
  const prisma = getPrisma();
  await prisma.massTextingCreditReservation.updateMany({
    where: { id: reservationId, status: "ACTIVE" },
    data: { status: "CONSUMED" },
  });
}
