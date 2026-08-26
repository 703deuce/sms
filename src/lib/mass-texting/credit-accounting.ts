import "server-only";

import { getPrisma } from "@/lib/db";
import { getOrCreateMassTextingBillingAccount } from "@/lib/mass-texting/billing-account";
import { MASS_TEXT_TRIAL } from "@/lib/mass-texting/pricing";
import { estimateSmsSegments } from "@/lib/utils";

export type SegmentAvailability = {
  available: number;
  monthlyRemaining: number;
  paygRemaining: number;
  trialRemaining: number;
  lifecycleState: string;
  canSend: boolean;
  blockReason: string | null;
};

function availabilityFromAccount(account: {
  lifecycleState: string;
  monthlySegmentsIncluded: number;
  monthlySegmentsUsed: number;
  paygCreditsSegments: number;
  paygLineActive: boolean;
  trialSegmentsUsed: number;
  billingModel: string | null;
}): SegmentAvailability {
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
    available = monthlyRemaining + Math.max(0, account.paygCreditsSegments);
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
    paygRemaining: Math.max(0, account.paygCreditsSegments),
    trialRemaining,
    lifecycleState: account.lifecycleState,
    canSend,
    blockReason,
  };
}

export async function getSegmentAvailability(
  workspaceId: string,
): Promise<SegmentAvailability> {
  const account = await getOrCreateMassTextingBillingAccount(workspaceId);
  return availabilityFromAccount(account);
}

function nextCounters(
  account: {
    lifecycleState: string;
    monthlySegmentsIncluded: number;
    monthlySegmentsUsed: number;
    paygCreditsSegments: number;
    trialSegmentsUsed: number;
  },
  segments: number,
):
  | {
      ok: true;
      trialSegmentsUsed: number;
      monthlySegmentsUsed: number;
      paygCreditsSegments: number;
    }
  | { ok: false; available: number } {
  const avail = availabilityFromAccount({
    ...account,
    paygLineActive: true,
    billingModel: account.lifecycleState === "TRIAL_ACTIVE" ? "monthly" : "monthly",
  });
  if (segments > avail.available) {
    return { ok: false, available: avail.available };
  }

  if (account.lifecycleState === "TRIAL_ACTIVE") {
    return {
      ok: true,
      trialSegmentsUsed: account.trialSegmentsUsed + segments,
      monthlySegmentsUsed: account.monthlySegmentsUsed,
      paygCreditsSegments: account.paygCreditsSegments,
    };
  }

  const monthlyRemaining = Math.max(
    0,
    account.monthlySegmentsIncluded - account.monthlySegmentsUsed,
  );
  const fromMonthly = Math.min(monthlyRemaining, segments);
  const fromPayg = segments - fromMonthly;
  return {
    ok: true,
    trialSegmentsUsed: account.trialSegmentsUsed,
    monthlySegmentsUsed: account.monthlySegmentsUsed + fromMonthly,
    paygCreditsSegments: account.paygCreditsSegments - fromPayg,
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
  if (!Number.isFinite(input.segments) || input.segments <= 0) {
    return { ok: false, error: "Segment count must be positive", available: 0 };
  }

  const existingUpfront = await prisma.massTextingCreditReservation.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existingUpfront) {
    return {
      ok: true,
      reservationId: existingUpfront.id,
      reserved: existingUpfront.reservedSegments,
    };
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const existing = await prisma.massTextingCreditReservation.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return { ok: true, reservationId: existing.id, reserved: existing.reservedSegments };
    }
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
    const next = nextCounters(account, input.segments);
    if (!next.ok) {
      return {
        ok: false,
        error: `Need ${input.segments} segments but only ${next.available} available`,
        available: next.available,
      };
    }

    // PostgREST has no multi-statement transactions. CAS the counter row so two
    // concurrent campaigns cannot both reserve the same remaining balance.
    const cas = await prisma.massTextingBillingAccount.updateMany({
      where: {
        id: account.id,
        lifecycleState: account.lifecycleState,
        trialSegmentsUsed: account.trialSegmentsUsed,
        monthlySegmentsUsed: account.monthlySegmentsUsed,
        paygCreditsSegments: account.paygCreditsSegments,
      },
      data: {
        trialSegmentsUsed: next.trialSegmentsUsed,
        monthlySegmentsUsed: next.monthlySegmentsUsed,
        paygCreditsSegments: next.paygCreditsSegments,
      },
    });
    if (cas.count !== 1) continue;

    try {
      const reservation = await prisma.massTextingCreditReservation.create({
        data: {
          workspaceId: input.workspaceId,
          billingAccountId: account.id,
          campaignId: input.campaignId,
          reservedSegments: input.segments,
          idempotencyKey: input.idempotencyKey,
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return { ok: true, reservationId: reservation.id, reserved: input.segments };
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
        const raced = await prisma.massTextingCreditReservation.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (raced) {
          await refundAccount(account.id, input.segments, account.lifecycleState);
          return { ok: true, reservationId: raced.id, reserved: raced.reservedSegments };
        }
      }
      await refundAccount(account.id, input.segments, account.lifecycleState);
      throw err;
    }
  }

  return { ok: false, error: "Could not reserve segments (concurrent campaigns)", available: 0 };
}

async function refundAccount(
  accountId: string,
  segments: number,
  lifecycleState: string,
) {
  const prisma = getPrisma();
  const fresh = await prisma.massTextingBillingAccount.findUnique({ where: { id: accountId } });
  if (!fresh) return;
  if (lifecycleState === "TRIAL_ACTIVE" || fresh.lifecycleState === "TRIAL_ACTIVE") {
    await prisma.massTextingBillingAccount.updateMany({
      where: { id: accountId },
      data: {
        trialSegmentsUsed: Math.max(0, fresh.trialSegmentsUsed - segments),
      },
    });
    return;
  }
  const monthlyConsumed = Math.min(fresh.monthlySegmentsUsed, segments);
  const paygRefund = segments - monthlyConsumed;
  await prisma.massTextingBillingAccount.updateMany({
    where: { id: accountId },
    data: {
      monthlySegmentsUsed: fresh.monthlySegmentsUsed - monthlyConsumed,
      paygCreditsSegments: fresh.paygCreditsSegments + paygRefund,
    },
  });
}

export async function releaseReservation(reservationId: string, _reason: string) {
  const prisma = getPrisma();
  const reservation = await prisma.massTextingCreditReservation.findUnique({
    where: { id: reservationId },
    include: { billingAccount: true },
  });
  if (!reservation || reservation.status !== "ACTIVE") return;

  const claimed = await prisma.massTextingCreditReservation.updateMany({
    where: { id: reservationId, status: "ACTIVE" },
    data: { status: "RELEASED" },
  });
  if (claimed.count !== 1) return;

  await refundAccount(
    reservation.billingAccountId,
    reservation.reservedSegments,
    reservation.billingAccount.lifecycleState,
  );
}

export async function consumeReservation(reservationId: string) {
  const prisma = getPrisma();
  await prisma.massTextingCreditReservation.updateMany({
    where: { id: reservationId, status: "ACTIVE" },
    data: { status: "CONSUMED" },
  });
}

export async function getActiveCampaignReservation(campaignId: string) {
  const prisma = getPrisma();
  return prisma.massTextingCreditReservation.findFirst({
    where: { campaignId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
}

/** Refund unused reserved segments once a campaign is terminal, then consume. */
export async function settleCampaignReservation(campaignId: string) {
  const prisma = getPrisma();
  const reservation = await prisma.massTextingCreditReservation.findFirst({
    where: { campaignId, status: "ACTIVE" },
    include: { billingAccount: true },
    orderBy: { createdAt: "desc" },
  });
  if (!reservation) return { settled: false as const };

  const messages = await prisma.campaignMessage.findMany({
    where: { campaignId },
    select: { status: true, body: true, channel: true },
  });
  const consumed = messages
    .filter((m: { status: string }) =>
      ["sent", "delivered", "clicked", "sending"].includes(m.status),
    )
    .reduce((sum: number, m: { body: string; channel: string }) => {
      if (m.channel === "mms") return sum + 3;
      return sum + Math.max(1, estimateSmsSegments(m.body || "").segments || 1);
    }, 0);

  const unused = Math.max(0, reservation.reservedSegments - consumed);
  const nextStatus = consumed > 0 ? "CONSUMED" : "RELEASED";
  const claimed = await prisma.massTextingCreditReservation.updateMany({
    where: { id: reservation.id, status: "ACTIVE" },
    data: {
      status: nextStatus,
      reservedSegments: consumed,
    },
  });
  if (claimed.count !== 1) return { settled: false as const };

  if (unused > 0) {
    await refundAccount(
      reservation.billingAccountId,
      unused,
      reservation.billingAccount.lifecycleState,
    );
  }
  return { settled: true as const, consumed, unused };
}
