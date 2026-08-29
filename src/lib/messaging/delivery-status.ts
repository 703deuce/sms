/**
 * Unified outbound SMS delivery status pipeline.
 * Provider webhooks → DB update → campaign aggregates.
 */

import { getPrisma } from "@/lib/db";
import { markRecipientFact } from "@/lib/campaigns/sequence-runner";
import { normalizeDeliveryError } from "@/lib/messaging/delivery-errors";
import type { ParsedDeliveryStatus } from "@/lib/messaging/provider";

/** Monotonic ranks — never downgrade (clicked is sticky via separate path). */
export const DELIVERY_STATUS_RANK: Record<string, number> = {
  queued: 0,
  sending: 1,
  sent: 2,
  undelivered: 3,
  failed: 3,
  expired: 3,
  delivered: 4,
  clicked: 5,
};

const TERMINAL_FAILURE = new Set(["failed", "undelivered", "expired"]);

export function statusesAtOrBelowRank(rank: number): string[] {
  return Object.entries(DELIVERY_STATUS_RANK)
    .filter(([, r]) => r <= rank)
    .map(([s]) => s);
}

export function resolveInternalDeliveryStatus(parsed: ParsedDeliveryStatus): string {
  if (parsed.internalStatus !== "unknown") return parsed.internalStatus;
  return parsed.providerStatus.toLowerCase() || "unknown";
}

export type ApplyDeliveryStatusInput = {
  providerMessageId: string;
  status: string;
  providerStatus?: string | null;
  errorCode?: string | null;
  errorDetail?: string | null;
  provider?: "twilio" | "telnyx" | null;
};

export type ApplyDeliveryStatusResult = {
  ok: true;
  status: string;
  updatedMessage: boolean;
  updatedCampaignMessage: boolean;
  campaignId?: string;
};

export async function applyOutboundDeliveryStatus(
  input: ApplyDeliveryStatusInput,
): Promise<ApplyDeliveryStatusResult> {
  const sid = input.providerMessageId;
  if (!sid) {
    return { ok: true, status: input.status, updatedMessage: false, updatedCampaignMessage: false };
  }

  const status = input.status.toLowerCase();
  const prisma = getPrisma();
  const now = new Date();
  const normalized =
    TERMINAL_FAILURE.has(status) && (input.errorCode || input.errorDetail)
      ? normalizeDeliveryError({
          provider: input.provider,
          errorCode: input.errorCode,
          errorDetail: input.errorDetail,
        })
      : null;

  const messagePatch: Record<string, unknown> = { status };
  if (input.providerStatus) messagePatch.providerStatus = input.providerStatus;
  if (input.errorCode) messagePatch.providerErrorCode = input.errorCode;
  if (normalized) messagePatch.failureCategory = normalized.category;
  if (status === "delivered") messagePatch.deliveredAt = now;
  if (TERMINAL_FAILURE.has(status)) messagePatch.failedAt = now;

  const messageUpdate = await prisma.message.updateMany({
    where: { providerId: sid },
    data: messagePatch,
  });

  const campaignMsg = await prisma.campaignMessage.findFirst({ where: { providerId: sid } });
  if (!campaignMsg) {
    return {
      ok: true,
      status,
      updatedMessage: messageUpdate.count > 0,
      updatedCampaignMessage: false,
    };
  }

  const incomingRank = DELIVERY_STATUS_RANK[status];
  if (incomingRank != null && campaignMsg.status !== "clicked") {
    const campaignPatch: Record<string, unknown> = { status };
    if (input.providerStatus) campaignPatch.providerStatus = input.providerStatus;
    if (input.errorCode) campaignPatch.providerErrorCode = input.errorCode;
    if (normalized) {
      campaignPatch.failureCategory = normalized.category;
      campaignPatch.error = normalized.explanation;
    } else if (input.errorDetail) {
      campaignPatch.error = input.errorDetail;
    }
    if (status === "delivered") campaignPatch.deliveredAt = now;
    if (TERMINAL_FAILURE.has(status)) campaignPatch.failedAt = now;

    await prisma.campaignMessage.updateMany({
      where: {
        id: campaignMsg.id,
        status: { in: statusesAtOrBelowRank(incomingRank) },
        NOT: { status: "clicked" },
      },
      data: campaignPatch,
    });
  }

  if (status === "delivered") {
    await prisma.$transaction(async (tx: any) => {
      const counted = await tx.campaignMessage.updateMany({
        where: { id: campaignMsg.id, deliveredCounted: false },
        data: { deliveredCounted: true },
      });
      if (counted.count === 1) {
        await tx.campaign.update({
          where: { id: campaignMsg.campaignId },
          data: { delivered: { increment: 1 } },
        });
      }
    });
    if (campaignMsg.recipientId) {
      await markRecipientFact(campaignMsg.recipientId, "message_delivered", true).catch(
        () => undefined,
      );
    }
  }

  if (TERMINAL_FAILURE.has(status)) {
    await prisma.$transaction(async (tx: any) => {
      const counted = await tx.campaignMessage.updateMany({
        where: { id: campaignMsg.id, failedCounted: false },
        data: { failedCounted: true },
      });
      if (counted.count === 1) {
        await tx.campaign.update({
          where: { id: campaignMsg.campaignId },
          data: { failed: { increment: 1 } },
        });
      }
    });
  }

  return {
    ok: true,
    status,
    updatedMessage: messageUpdate.count > 0,
    updatedCampaignMessage: true,
    campaignId: campaignMsg.campaignId,
  };
}

export async function applyParsedDeliveryStatus(
  parsed: ParsedDeliveryStatus,
  provider?: "twilio" | "telnyx",
): Promise<ApplyDeliveryStatusResult> {
  const status = resolveInternalDeliveryStatus(parsed);
  return applyOutboundDeliveryStatus({
    providerMessageId: parsed.providerMessageId,
    status,
    providerStatus: parsed.providerStatus,
    errorCode: parsed.errorCode,
    errorDetail: parsed.errorDetail,
    provider,
  });
}
