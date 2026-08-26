import "server-only";

import { getPrisma } from "@/lib/db";
import { buildPreSendReview } from "@/lib/mass-texting/pre-send-review";

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
    return { ok: false, error: "Campaign could not be started (status changed)" };
  }

  try {
    const { processSequenceWaits } = await import("@/lib/campaigns/sequence-runner");
    await processSequenceWaits();
  } catch {
    // queue kick is best-effort
  }

  try {
    const { emitPlatformEvent } = await import("@/lib/platform/events");
    await emitPlatformEvent({
      workspaceId: input.workspaceId,
      type: "MASS_TEXT_CAMPAIGN_LAUNCHED",
      campaignId: input.campaignId,
      idempotencyKey: input.idempotencyKey,
      payload: {
        auditId: audit.id,
        finalRecipientCount: review.finalRecipientCount,
      },
    });
  } catch {
    // observability is best-effort
  }

  return { ok: true, campaignId: input.campaignId, auditId: audit.id };
}
