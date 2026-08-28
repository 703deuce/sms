import "server-only";

import { isAdminUnlimitedWorkspace } from "@/lib/billing/admin-unlimited-workspace";
import { getPrisma } from "@/lib/db";
import { getOrCreateMassTextingBillingAccount } from "@/lib/mass-texting/billing-account";
import { MASS_TEXT_TRIAL } from "@/lib/mass-texting/pricing";
import { estimateSmsSegments } from "@/lib/utils";
import {
  getWorkspaceCreditSegmentsAvailable,
  holdCreditsForCampaignReservation,
  releaseCreditsForCampaignReservation,
} from "@/lib/settings/billing";

/** Segment balance returned for admin / certification workspaces. */
export const ADMIN_UNLIMITED_SEGMENT_BALANCE = 999_999_999;

export type SegmentAvailability = {
  available: number;
  /** Segments from Mass Texting plan buckets (trial / monthly / PAYG). */
  massTextSegments: number;
  /** Segments from the shared workspace credit balance (MCTB + campaigns). */
  workspaceCreditSegments: number;
  monthlyRemaining: number;
  paygRemaining: number;
  trialRemaining: number;
  lifecycleState: string;
  /** True when the account is allowed to send regardless of remaining credits. */
  accountSendEligible: boolean;
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
  let accountSendEligible = false;
  let blockReason: string | null = null;

  if (account.lifecycleState === "TRIAL_ACTIVE") {
    available = trialRemaining;
    accountSendEligible = true;
    canSend = available > 0;
    if (!canSend) blockReason = "Trial segment limit reached";
  } else if (account.lifecycleState === "PRODUCTION_ACTIVE") {
    available = monthlyRemaining + Math.max(0, account.paygCreditsSegments);
    accountSendEligible = account.billingModel !== "payg" || account.paygLineActive;
    canSend = available > 0 && accountSendEligible;
    if (!canSend) {
      blockReason = !accountSendEligible
        ? "PAYG Messaging Line inactive"
        : "Insufficient segments";
    }
  } else {
    blockReason =
      account.lifecycleState === "TRIAL_PENDING_A2P" ||
      account.lifecycleState === "PRODUCTION_A2P_PENDING"
        ? "Messaging approval pending — complete shared workspace A2P setup"
        : `Cannot send in state ${account.lifecycleState}`;
  }

  const massTextSegments = available;

  return {
    available: massTextSegments,
    massTextSegments,
    workspaceCreditSegments: 0,
    monthlyRemaining,
    paygRemaining: Math.max(0, account.paygCreditsSegments),
    trialRemaining,
    lifecycleState: account.lifecycleState,
    accountSendEligible,
    canSend,
    blockReason,
  };
}

function adminUnlimitedAvailability(): SegmentAvailability {
  return {
    available: ADMIN_UNLIMITED_SEGMENT_BALANCE,
    massTextSegments: ADMIN_UNLIMITED_SEGMENT_BALANCE,
    workspaceCreditSegments: ADMIN_UNLIMITED_SEGMENT_BALANCE,
    monthlyRemaining: ADMIN_UNLIMITED_SEGMENT_BALANCE,
    paygRemaining: ADMIN_UNLIMITED_SEGMENT_BALANCE,
    trialRemaining: ADMIN_UNLIMITED_SEGMENT_BALANCE,
    lifecycleState: "TRIAL_ACTIVE",
    accountSendEligible: true,
    canSend: true,
    blockReason: null,
  };
}

async function mergeWorkspaceCredits(
  workspaceId: string,
  base: SegmentAvailability,
): Promise<SegmentAvailability> {
  const workspaceCreditSegments = await getWorkspaceCreditSegmentsAvailable(workspaceId);
  const available = base.massTextSegments + workspaceCreditSegments;
  let canSend = base.canSend;
  let blockReason = base.blockReason;

  if (!canSend && workspaceCreditSegments > 0 && base.accountSendEligible) {
    canSend = available > 0;
    if (canSend) blockReason = null;
  } else if (!canSend && workspaceCreditSegments > 0 && base.blockReason?.includes("approval pending")) {
    const { assertWorkspaceMessagingSendAllowed } = await import(
      "@/lib/messaging/unified-send-gate"
    );
    const a2p = await assertWorkspaceMessagingSendAllowed(workspaceId);
    if (a2p.allowed) {
      canSend = available > 0;
      blockReason = canSend ? null : base.blockReason;
    }
  }

  return {
    ...base,
    available,
    workspaceCreditSegments,
    canSend,
    blockReason,
  };
}

export async function getSegmentAvailability(
  workspaceId: string,
): Promise<SegmentAvailability> {
  if (await isAdminUnlimitedWorkspace(workspaceId)) {
    return adminUnlimitedAvailability();
  }
  const account = await getOrCreateMassTextingBillingAccount(workspaceId);
  const base = availabilityFromAccount({
    ...account,
    paygLineActive: account.paygLineActive,
    billingModel: account.billingModel,
  });
  return mergeWorkspaceCredits(workspaceId, base);
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

  let idempotencyKey = input.idempotencyKey;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const existing = await prisma.massTextingCreditReservation.findUnique({
      where: { idempotencyKey },
    });
    if (existing?.status === "ACTIVE") {
      return {
        ok: true,
        reservationId: existing.id,
        reserved: existing.reservedSegments,
      };
    }
    if (existing) {
      // RELEASED/CONSUMED rows keep the unique key; reserve on a suffix instead
      // of treating a spent reservation as a successful replay.
      idempotencyKey = `${input.idempotencyKey}:${attempt + 1}`;
      continue;
    }

    if (await isAdminUnlimitedWorkspace(input.workspaceId)) {
      const account = await getOrCreateMassTextingBillingAccount(input.workspaceId);
      try {
        const reservation = await prisma.massTextingCreditReservation.create({
          data: {
            workspaceId: input.workspaceId,
            billingAccountId: account.id,
            campaignId: input.campaignId,
            reservedSegments: input.segments,
            idempotencyKey,
            status: "ACTIVE",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        return { ok: true, reservationId: reservation.id, reserved: input.segments };
      } catch (err) {
        if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
          const raced = await prisma.massTextingCreditReservation.findUnique({
            where: { idempotencyKey },
          });
          if (raced?.status === "ACTIVE") {
            return {
              ok: true,
              reservationId: raced.id,
              reserved: raced.reservedSegments,
            };
          }
        }
        throw err;
      }
    }

    const availability = await getSegmentAvailability(input.workspaceId);
    if (!availability.accountSendEligible && availability.workspaceCreditSegments <= 0) {
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
    const fromMassText = Math.min(input.segments, availability.massTextSegments);
    const fromWorkspace = input.segments - fromMassText;
    const next =
      fromMassText > 0
        ? nextCounters(account, fromMassText)
        : {
            ok: true as const,
            trialSegmentsUsed: account.trialSegmentsUsed,
            monthlySegmentsUsed: account.monthlySegmentsUsed,
            paygCreditsSegments: account.paygCreditsSegments,
          };
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
          idempotencyKey,
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      if (fromWorkspace > 0) {
        try {
          await holdCreditsForCampaignReservation(
            input.workspaceId,
            fromWorkspace,
            reservation.id,
          );
        } catch (holdErr) {
          await prisma.massTextingCreditReservation.updateMany({
            where: { id: reservation.id, status: "ACTIVE" },
            data: { status: "RELEASED" },
          });
          if (fromMassText > 0) {
            await refundAccount(account.id, fromMassText, account.lifecycleState);
          }
          throw holdErr;
        }
      }
      return { ok: true, reservationId: reservation.id, reserved: input.segments };
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
        const raced = await prisma.massTextingCreditReservation.findUnique({
          where: { idempotencyKey },
        });
        await refundAccount(account.id, fromMassText, account.lifecycleState);
        if (raced?.status === "ACTIVE") {
          return { ok: true, reservationId: raced.id, reserved: raced.reservedSegments };
        }
        idempotencyKey = `${input.idempotencyKey}:${attempt + 1}`;
        continue;
      }
      if (fromMassText > 0) {
        await refundAccount(account.id, fromMassText, account.lifecycleState);
      }
      throw err;
    }
  }

  return { ok: false, error: "Could not reserve segments (concurrent campaigns)", available: 0 };
}

async function workspaceCreditHoldSegments(
  workspaceId: string,
  reservationId: string,
): Promise<number> {
  const prisma = getPrisma();
  const hold = await prisma.creditLedgerEntry.findFirst({
    where: {
      workspaceId,
      description: `Campaign reservation hold ${reservationId}`,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!hold) return 0;
  const { smsCostCents } = await import("@/lib/settings/billing");
  const cost = smsCostCents();
  if (cost <= 0) return 0;
  return Math.max(0, Math.round(Math.abs(hold.amountCents) / cost));
}

async function releaseReservationCredits(
  reservation: {
    id: string;
    workspaceId: string;
    billingAccountId: string;
    reservedSegments: number;
    billingAccount: { lifecycleState: string };
  },
  segmentsToRelease: number,
) {
  if (segmentsToRelease <= 0) return;
  const workspaceHeld = await workspaceCreditHoldSegments(reservation.workspaceId, reservation.id);
  const releaseWorkspace = Math.min(segmentsToRelease, workspaceHeld);
  const releaseMassText = segmentsToRelease - releaseWorkspace;
  if (releaseMassText > 0) {
    await refundAccount(
      reservation.billingAccountId,
      releaseMassText,
      reservation.billingAccount.lifecycleState,
    );
  }
  if (releaseWorkspace > 0) {
    await releaseCreditsForCampaignReservation(
      reservation.workspaceId,
      releaseWorkspace,
      reservation.id,
    );
  }
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

  await releaseReservationCredits(reservation, reservation.reservedSegments);
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
    await releaseReservationCredits(reservation, unused);
  }
  return { settled: true as const, consumed, unused };
}
