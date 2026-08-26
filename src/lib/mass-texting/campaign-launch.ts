import "server-only";

import { getPrisma } from "@/lib/db";
import { buildPreSendReview } from "@/lib/mass-texting/pre-send-review";
import {
  reserveSegmentsForCampaign,
  releaseReservation,
} from "@/lib/mass-texting/credit-accounting";
import { emitMassTextOpsEvent } from "@/lib/mass-texting/ops-events";

export type CampaignLaunchResult =
  | { ok: true; campaignId: string; auditId: string; idempotentReplay?: boolean }
  | { ok: false; error: string; available?: number; required?: number };

function stableLaunchKey(workspaceId: string, campaignId: string, provided?: string) {
  const trimmed = provided?.trim();
  if (trimmed) return trimmed;
  return `launch:${workspaceId}:${campaignId}`;
}

export async function launchCampaignWithAudit(input: {
  workspaceId: string;
  campaignId: string;
  userId?: string | null;
  idempotencyKey?: string;
  confirmLargeSend?: boolean;
}): Promise<CampaignLaunchResult> {
  const prisma = getPrisma();
  const idempotencyKey = stableLaunchKey(
    input.workspaceId,
    input.campaignId,
    input.idempotencyKey,
  );

  const existingAudit = await prisma.campaignLaunchAudit.findUnique({
    where: {
      workspaceId_idempotencyKey: {
        workspaceId: input.workspaceId,
        idempotencyKey,
      },
    },
  });
  if (existingAudit) {
    return {
      ok: true,
      campaignId: input.campaignId,
      auditId: existingAudit.id,
      idempotentReplay: true,
    };
  }

  const alreadySending = await prisma.campaign.findFirst({
    where: {
      id: input.campaignId,
      workspaceId: input.workspaceId,
      status: "SENDING",
    },
    select: { id: true },
  });
  if (alreadySending) {
    const prior = await prisma.campaignLaunchAudit.findFirst({
      where: { workspaceId: input.workspaceId, campaignId: input.campaignId },
      orderBy: { confirmedAt: "desc" },
    });
    if (prior) {
      return {
        ok: true,
        campaignId: input.campaignId,
        auditId: prior.id,
        idempotentReplay: true,
      };
    }
    return { ok: false, error: "Campaign is already sending" };
  }

  const review = await buildPreSendReview(input.workspaceId, input.campaignId);
  if (!review) return { ok: false, error: "Campaign not found" };

  if (review.mmsBlocked) {
    return { ok: false, error: review.blockReason || "MMS is not enabled" };
  }
  if (review.finalRecipientCount === 0) {
    return { ok: false, error: "No send-ready recipients after suppression filtering" };
  }
  if (review.finalRecipientCount >= 1000 && !input.confirmLargeSend) {
    return { ok: false, error: "Large send requires confirmLargeSend=true" };
  }
  if (!review.canSend) {
    return {
      ok: false,
      error: review.blockReason || "Insufficient messaging credits",
      available: review.availableSegments,
      required: review.requiredSegments,
    };
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId, workspaceId: input.workspaceId },
  });
  if (!campaign) return { ok: false, error: "Campaign not found" };
  if (campaign.status === "CANCELED") return { ok: false, error: "Campaign is canceled" };
  if (campaign.status === "SENDING") {
    return { ok: false, error: "Campaign is already sending" };
  }

  const { massTextProductConfigPatch } = await import("@/lib/mass-texting/campaign-send");
  await prisma.campaign.update({
    where: { id: input.campaignId },
    data: {
      configJson: massTextProductConfigPatch(campaign.configJson, {
        launchSnapshot: {
          estimatedSegments: review.estimatedSegments,
          finalRecipientCount: review.finalRecipientCount,
          phoneE164: review.phoneE164,
          launchedAt: new Date().toISOString(),
        },
      }),
    },
  });

  const { assertMassTextMarketingSendAllowed } = await import(
    "@/lib/mass-texting/a2p-enforcement"
  );
  const a2pGate = await assertMassTextMarketingSendAllowed(input.workspaceId);
  if (!a2pGate.allowed) {
    return { ok: false, error: a2pGate.reason || "Mass Texting A2P not ready" };
  }

  const { refreshMassTextingTrialState } = await import("@/lib/mass-texting/trial-lifecycle");
  await refreshMassTextingTrialState(input.workspaceId);

  const reservation = await reserveSegmentsForCampaign({
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    segments: review.estimatedSegments,
    idempotencyKey: `reserve:${idempotencyKey}`,
  });
  if (!reservation.ok) {
    return {
      ok: false,
      error: reservation.error,
      available: reservation.available,
      required: review.estimatedSegments,
    };
  }

  if (review.listIds.length) {
    try {
      const { enrollListInCampaign } = await import("@/lib/campaigns/enroll-campaign");
      for (const listId of review.listIds) {
        await enrollListInCampaign(input.workspaceId, input.campaignId, listId);
      }
    } catch (err) {
      await releaseReservation(reservation.reservationId, "enroll_failed");
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Could not enroll audience",
      };
    }
  }

  let audit;
  try {
    audit = await prisma.campaignLaunchAudit.create({
      data: {
        workspaceId: input.workspaceId,
        campaignId: input.campaignId,
        launchedByUserId: input.userId ?? null,
        idempotencyKey,
        rawContactCount: review.rawContactCount,
        duplicateRemoved: review.duplicateRemoved,
        invalidRemoved: review.invalidRemoved,
        suppressedRemoved: review.suppressedRemoved,
        finalRecipientCount: review.finalRecipientCount,
        estimatedSegments: review.estimatedSegments,
        estimatedCreditsCents: review.estimatedSegments,
        phoneNumberId: review.phoneNumberId,
        phoneE164: review.phoneE164,
        scheduledAt: review.scheduledAt ? new Date(review.scheduledAt) : null,
        metadata: {
          listIds: review.listIds,
          listNames: review.listNames,
          a2pUseCase: review.a2pUseCase,
          reservationId: reservation.reservationId,
        },
      },
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      const raced = await prisma.campaignLaunchAudit.findUnique({
        where: {
          workspaceId_idempotencyKey: {
            workspaceId: input.workspaceId,
            idempotencyKey,
          },
        },
      });
      if (raced) {
        return {
          ok: true,
          campaignId: input.campaignId,
          auditId: raced.id,
          idempotentReplay: true,
        };
      }
    }
    await releaseReservation(reservation.reservationId, "audit_create_failed");
    throw err;
  }

  const scheduledAt = review.scheduledAt ? new Date(review.scheduledAt) : null;
  const sendLater = Boolean(scheduledAt && scheduledAt.getTime() > Date.now() + 15_000);
  const nextStatus = sendLater ? "SCHEDULED" : "SENDING";

  const updated = await prisma.campaign.updateMany({
    where: {
      id: input.campaignId,
      workspaceId: input.workspaceId,
      status: { in: ["DRAFT", "SCHEDULED", "PAUSED"] },
    },
    data: { status: nextStatus, scheduledAt: scheduledAt || undefined },
  });
  if (updated.count !== 1) {
    await releaseReservation(reservation.reservationId, "launch_status_race");
    return { ok: false, error: "Campaign could not be started (status changed)" };
  }

  if (!sendLater) {
    try {
      const { processSequenceWaits } = await import("@/lib/campaigns/sequence-runner");
      await processSequenceWaits();
    } catch {
      // queue kick is best-effort
    }
  }

  try {
    await emitMassTextOpsEvent({
      workspaceId: input.workspaceId,
      eventType: "mass_text.campaign_launched",
      campaignId: input.campaignId,
      idempotencyKey,
      payload: {
        auditId: audit.id,
        finalRecipientCount: review.finalRecipientCount,
        reservedSegments: reservation.reserved,
        reservationId: reservation.reservationId,
        status: nextStatus,
      },
    });
  } catch {
    // observability is best-effort
  }

  return { ok: true, campaignId: input.campaignId, auditId: audit.id };
}
