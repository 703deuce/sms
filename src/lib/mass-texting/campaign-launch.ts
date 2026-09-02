import "server-only";

import { getPrisma } from "@/lib/db";
import { buildPreSendReview } from "@/lib/mass-texting/pre-send-review";
import {
  reserveSegmentsForCampaign,
  releaseReservation,
  getActiveCampaignReservation,
  settleCampaignReservation,
} from "@/lib/mass-texting/credit-accounting";
import { emitMassTextOpsEvent } from "@/lib/mass-texting/ops-events";
import { canonicalLaunchIdempotencyKey } from "@/lib/mass-texting/launch-key";

export type CampaignLaunchResult =
  | { ok: true; campaignId: string; auditId: string; idempotentReplay?: boolean }
  | { ok: false; error: string; available?: number; required?: number };

const LAUNCHED_STATUSES = new Set(["SENDING", "SCHEDULED", "COMPLETED"]);

type ReservationHandle = {
  ok: true;
  reservationId: string;
  reserved: number;
  createdThisCall: boolean;
};

async function pruneStaleLaunchRecipients(input: {
  workspaceId: string;
  campaignId: string;
  acceptedPhones: string[];
}) {
  const prisma = getPrisma();
  const keep = new Set(input.acceptedPhones.filter(Boolean));
  if (!keep.size) return;
  const enrolled = await prisma.campaignRecipient.findMany({
    where: { campaignId: input.campaignId, workspaceId: input.workspaceId },
    select: { id: true, phone: true, workflowStatus: true },
  });
  for (const row of enrolled) {
    if (row.phone && keep.has(row.phone)) continue;
    if (!["pending", "scheduled", "in_progress", "waiting"].includes(row.workflowStatus)) {
      continue;
    }
    await prisma.campaignRecipient.update({
      where: { id: row.id },
      data: {
        workflowStatus: "stopped",
        stopReason: "left_audience_before_launch",
        completedAt: new Date(),
        enrollmentKey: null,
        nextActionAt: null,
      },
    });
  }
}

async function ensureLaunchReservation(input: {
  workspaceId: string;
  campaignId: string;
  segments: number;
  idempotencyKey: string;
}): Promise<ReservationHandle | { ok: false; error: string; available?: number }> {
  const active = await getActiveCampaignReservation(input.campaignId);
  if (active) {
    return {
      ok: true,
      reservationId: active.id,
      reserved: active.reservedSegments,
      createdThisCall: false,
    };
  }
  const reservation = await reserveSegmentsForCampaign({
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    segments: input.segments,
    idempotencyKey: `reserve:${input.idempotencyKey}`,
  });
  if (!reservation.ok) {
    return {
      ok: false,
      error: reservation.error,
      available: reservation.available,
    };
  }
  return {
    ok: true,
    reservationId: reservation.reservationId,
    reserved: reservation.reserved,
    createdThisCall: true,
  };
}

async function applyLaunchStatus(input: {
  workspaceId: string;
  campaignId: string;
  sendLater: boolean;
  scheduledAt: Date | null;
}): Promise<
  { ok: true; nextStatus: "SENDING" | "SCHEDULED" } | { ok: false; error: string }
> {
  const prisma = getPrisma();
  const nextStatus = input.sendLater ? "SCHEDULED" : "SENDING";
  const updated = await prisma.campaign.updateMany({
    where: {
      id: input.campaignId,
      workspaceId: input.workspaceId,
      status: { in: ["DRAFT", "SCHEDULED", "PAUSED"] },
    },
    data: { status: nextStatus, scheduledAt: input.scheduledAt || undefined },
  });
  if (updated.count === 1) {
    return { ok: true, nextStatus };
  }

  const latest = await prisma.campaign.findFirst({
    where: { id: input.campaignId, workspaceId: input.workspaceId },
    select: { status: true },
  });
  if (latest && LAUNCHED_STATUSES.has(latest.status)) {
    return { ok: true, nextStatus: latest.status === "SCHEDULED" ? "SCHEDULED" : "SENDING" };
  }
  if (latest?.status === "CANCELED") {
    await settleCampaignReservation(input.campaignId);
    return { ok: false, error: "Campaign is canceled" };
  }
  return { ok: false, error: "Campaign could not be started (status changed)" };
}

export async function launchCampaignWithAudit(input: {
  workspaceId: string;
  campaignId: string;
  userId?: string | null;
  idempotencyKey?: string;
  confirmLargeSend?: boolean;
}): Promise<CampaignLaunchResult> {
  const prisma = getPrisma();
  const idempotencyKey = canonicalLaunchIdempotencyKey(
    input.workspaceId,
    input.campaignId,
    input.idempotencyKey,
  );

  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId, workspaceId: input.workspaceId },
  });
  if (!campaign) return { ok: false, error: "Campaign not found" };
  if (campaign.status === "CANCELED") return { ok: false, error: "Campaign is canceled" };

  const existingAudit = await prisma.campaignLaunchAudit.findUnique({
    where: {
      workspaceId_idempotencyKey: {
        workspaceId: input.workspaceId,
        idempotencyKey,
      },
    },
  });

  if (existingAudit && LAUNCHED_STATUSES.has(campaign.status)) {
    return {
      ok: true,
      campaignId: input.campaignId,
      auditId: existingAudit.id,
      idempotentReplay: true,
    };
  }

  if (!existingAudit && LAUNCHED_STATUSES.has(campaign.status)) {
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
    if (campaign.status === "SENDING" || campaign.status === "COMPLETED") {
      return { ok: false, error: "Campaign is already sending" };
    }
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

  const { assertMassTextMarketingSendAllowed } = await import(
    "@/lib/mass-texting/a2p-enforcement"
  );
  const a2p = await assertMassTextMarketingSendAllowed(input.workspaceId);
  if (!a2p.allowed) {
    return { ok: false, error: a2p.reason || "Messaging A2P not ready" };
  }
  if (!review.phoneE164) {
    return { ok: false, error: "No sending number configured" };
  }

  const { massTextProductConfigPatch } = await import("@/lib/mass-texting/campaign-send");
  const { readBroadcastConfig } = await import("@/lib/mass-texting/broadcast/service");
  const broadcastConfig = readBroadcastConfig(campaign.configJson);
  const isRecurringTemplate = broadcastConfig?.scheduleMode === "recurring";

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

  const { refreshMassTextingTrialState } = await import("@/lib/mass-texting/trial-lifecycle");
  await refreshMassTextingTrialState(input.workspaceId);

  if (isRecurringTemplate) {
    let audit = existingAudit;
    if (!audit) {
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
            scheduledAt: campaign.scheduledAt,
            metadata: {
              recurringTemplate: true,
              listIds: review.listIds,
              listNames: review.listNames,
              a2pUseCase: review.a2pUseCase,
            },
          },
        });
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: string }).code === "P2002"
        ) {
          audit = await prisma.campaignLaunchAudit.findUnique({
            where: {
              workspaceId_idempotencyKey: {
                workspaceId: input.workspaceId,
                idempotencyKey,
              },
            },
          });
        }
        if (!audit) throw err;
      }
    }

    const scheduledAt = campaign.scheduledAt;
    if (!scheduledAt) {
      return { ok: false, error: "Recurring campaign has no first run scheduled" };
    }

    const statusResult = await applyLaunchStatus({
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      sendLater: true,
      scheduledAt,
    });
    if (!statusResult.ok) return statusResult;

    try {
      await emitMassTextOpsEvent({
        workspaceId: input.workspaceId,
        eventType: "mass_text.recurring_campaign_activated",
        campaignId: input.campaignId,
        idempotencyKey,
        payload: {
          auditId: audit!.id,
          finalRecipientCount: review.finalRecipientCount,
          scheduledAt: scheduledAt.toISOString(),
        },
      });
    } catch {
      // observability is best-effort
    }

    return {
      ok: true,
      campaignId: input.campaignId,
      auditId: audit!.id,
      idempotentReplay: Boolean(existingAudit),
    };
  }

  const reservation = await ensureLaunchReservation({
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    segments: review.estimatedSegments,
    idempotencyKey,
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
      if (reservation.createdThisCall) {
        await releaseReservation(reservation.reservationId, "enroll_failed");
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Could not enroll audience",
      };
    }
  } else {
    const { isBroadcastCampaign, readBroadcastConfig } = await import(
      "@/lib/mass-texting/broadcast/service"
    );
    const { enrollBroadcastAudience } = await import("@/lib/mass-texting/broadcast/audience");
    if (isBroadcastCampaign(campaign.configJson)) {
      const broadcastConfig = readBroadcastConfig(campaign.configJson);
      if (broadcastConfig?.audience) {
        try {
          await enrollBroadcastAudience(
            input.workspaceId,
            input.campaignId,
            broadcastConfig.audience,
          );
        } catch (err) {
          if (reservation.createdThisCall) {
            await releaseReservation(reservation.reservationId, "enroll_failed");
          }
          return {
            ok: false,
            error: err instanceof Error ? err.message : "Could not enroll audience",
          };
        }
      }
    }
  }

  await pruneStaleLaunchRecipients({
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    acceptedPhones: review.acceptedPhones,
  });

  let audit = existingAudit;
  if (!audit) {
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
          audit = raced;
        }
      }
      if (!audit) {
        if (reservation.createdThisCall) {
          await releaseReservation(reservation.reservationId, "audit_create_failed");
        }
        throw err;
      }
    }
  }
  if (!audit) {
    return { ok: false, error: "Launch audit missing" };
  }

  const scheduledAt = review.scheduledAt ? new Date(review.scheduledAt) : null;
  const sendLater = Boolean(scheduledAt && scheduledAt.getTime() > Date.now() + 15_000);
  const statusResult = await applyLaunchStatus({
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    sendLater,
    scheduledAt,
  });
  if (!statusResult.ok) {
    return statusResult;
  }

  if (statusResult.nextStatus === "SENDING") {
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
        status: statusResult.nextStatus,
        resumed: Boolean(existingAudit),
      },
    });
  } catch {
    // observability is best-effort
  }

  return {
    ok: true,
    campaignId: input.campaignId,
    auditId: audit.id,
    idempotentReplay: Boolean(existingAudit),
  };
}
