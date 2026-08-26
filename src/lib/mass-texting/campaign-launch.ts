import "server-only";

import { getPrisma } from "@/lib/db";
import { buildPreSendReview } from "@/lib/mass-texting/pre-send-review";
import { reserveSegmentsForCampaign, releaseReservation } from "@/lib/mass-texting/credit-accounting";
import { emitMassTextOpsEvent } from "@/lib/mass-texting/ops-events";

export type CampaignLaunchResult =
  | { ok: true; campaignId: string; auditId: string; idempotentReplay?: boolean }
  | { ok: false; error: string };

export async function launchCampaignWithAudit(input: {
  workspaceId: string;
  campaignId: string;
  userId?: string | null;
  idempotencyKey: string;
  confirmLargeSend?: boolean;
}): Promise<CampaignLaunchResult> {
  const prisma = getPrisma();
  const review = await buildPreSendReview(input.workspaceId, input.campaignId);
  if (!review) return { ok: false, error: "Campaign not found" };

  const existingAudit = await prisma.campaignLaunchAudit.findUnique({
    where: {
      workspaceId_idempotencyKey: {
        workspaceId: input.workspaceId,
        idempotencyKey: input.idempotencyKey,
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

  if (review.finalRecipientCount === 0) {
    return { ok: false, error: "No send-ready recipients after suppression filtering" };
  }

  if (review.finalRecipientCount >= 1000 && !input.confirmLargeSend) {
    return {
      ok: false,
      error: "Large send requires confirmLargeSend=true",
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
    data: { configJson: massTextProductConfigPatch(campaign.configJson) },
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
    idempotencyKey: `reserve:${input.idempotencyKey}`,
  });
  if (!reservation.ok) {
    return { ok: false, error: reservation.error };
  }

  const audit = await prisma.campaignLaunchAudit.create({
    data: {
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      launchedByUserId: input.userId ?? null,
      idempotencyKey: input.idempotencyKey,
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
      },
    },
  });

  const updated = await prisma.campaign.updateMany({
    where: {
      id: input.campaignId,
      workspaceId: input.workspaceId,
      status: { in: ["DRAFT", "SCHEDULED", "PAUSED"] },
    },
    data: { status: "SENDING" },
  });
  if (updated.count !== 1) {
    await releaseReservation(reservation.reservationId, "launch_status_race");
    return { ok: false, error: "Campaign could not be started (status changed)" };
  }

  try {
    const { processSequenceWaits } = await import("@/lib/campaigns/sequence-runner");
    await processSequenceWaits();
  } catch {
    // queue kick is best-effort
  }

  try {
    await emitMassTextOpsEvent({
      workspaceId: input.workspaceId,
      eventType: "mass_text.campaign_launched",
      campaignId: input.campaignId,
      idempotencyKey: input.idempotencyKey,
      payload: {
        auditId: audit.id,
        finalRecipientCount: review.finalRecipientCount,
        reservedSegments: reservation.reserved,
        reservationId: reservation.reservationId,
      },
    });
  } catch {
    // observability is best-effort
  }

  return { ok: true, campaignId: input.campaignId, auditId: audit.id };
}
