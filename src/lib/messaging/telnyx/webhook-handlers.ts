/**
 * Shared Telnyx webhook business logic (inbound, status, compliance).
 */

import { getPrisma } from "@/lib/db";
import { processInboundMessage, resolveInboundContext } from "@/lib/messaging/inbound-process";
import { enqueueMessagingRegistrationAdvance } from "@/lib/messaging/enqueue-advance";
import { markRecipientFact } from "@/lib/campaigns/sequence-runner";
import { looksLikeTwilioMessagingServiceSid } from "../provider-ids";
import { telnyxProvider } from "./provider";
import {
  isApprovedBrandStatus,
  isApprovedCampaignStatus,
  isRejectedBrandStatus,
  isRejectedCampaignStatus,
} from "./status-map";
import { telnyxEventType } from "./webhook-auth";

const STATUS_RANK: Record<string, number> = {
  queued: 0,
  sending: 1,
  sent: 2,
  undelivered: 3,
  failed: 3,
  expired: 3,
  delivered: 4,
  clicked: 5,
};

function statusesAtOrBelow(rank: number) {
  return Object.entries(STATUS_RANK)
    .filter(([, r]) => r <= rank)
    .map(([s]) => s);
}

const INBOUND_EVENTS = new Set(["message.received"]);
const STATUS_EVENTS = new Set([
  "message.sent",
  "message.finalized",
  "message.delivered",
  "message.delivery_failed",
  "message.delivery_unconfirmed",
  "message.sending.failed",
]);

export function classifyTelnyxMessagingEvent(eventType: string): "inbound" | "status" | "other" {
  if (INBOUND_EVENTS.has(eventType)) return "inbound";
  if (STATUS_EVENTS.has(eventType)) return "status";
  if (eventType.startsWith("message.")) {
    // Treat unknown message.* lifecycle events as status updates.
    return eventType === "message.received" ? "inbound" : "status";
  }
  return "other";
}

export async function handleTelnyxInbound(payload: unknown) {
  const eventType = telnyxEventType(payload);
  if (eventType && !INBOUND_EVENTS.has(eventType) && eventType !== "message.received") {
    // Allow missing event_type for older payloads; reject clear non-inbound types.
    if (eventType.startsWith("message.") && eventType !== "message.received") {
      return { ok: true as const, skipped: true as const, reason: "not_inbound_event", eventType };
    }
  }

  const parsed = telnyxProvider.parseInboundMessage(payload);
  if (!parsed.to || !parsed.from) {
    return { ok: true as const, skipped: true as const, reason: "missing_from_or_to" };
  }

  try {
    const { isPlatformDemoNumber, resolveDemoWorkspaceForCaller, recordDemoReplyReceived } =
      await import("@/lib/mctb/onboarding/demo");
    if (isPlatformDemoNumber(parsed.to)) {
      const match = await resolveDemoWorkspaceForCaller(parsed.from);
      if (match) {
        await recordDemoReplyReceived(match.workspaceId);
      }
    }
  } catch (demoErr) {
    console.warn("[telnyx/inbound] demo reply tracking failed", demoErr);
  }

  const root = payload as { data?: { payload?: { messaging_profile_id?: string } } };
  const profileId = root?.data?.payload?.messaging_profile_id;
  const ctx = await resolveInboundContext(parsed.to, profileId);
  if (!ctx) {
    return { ok: true as const, unmatched: true as const };
  }

  const result = await processInboundMessage({
    workspaceId: ctx.workspaceId,
    from: parsed.from,
    to: parsed.to,
    body: parsed.body,
    providerMessageId: parsed.providerMessageId,
    mediaUrls: parsed.mediaUrls || null,
    registration: ctx.registration,
  });

  let replySent = false;
  if (result.replyText && ctx.registration) {
    const profileId =
      ctx.registration.messagingProfileId ||
      (looksLikeTwilioMessagingServiceSid(ctx.registration.messagingServiceSid)
        ? null
        : ctx.registration.messagingServiceSid);
    try {
      await telnyxProvider.sendMessage(ctx.registration as any, {
        to: parsed.from,
        from: ctx.phoneE164 || parsed.to,
        body: result.replyText,
        messagingProfileId: profileId,
        mediaUrls: result.mediaUrls?.filter(Boolean),
      });
      replySent = true;
    } catch (err) {
      console.error("[telnyx/inbound] keyword reply send failed", err);
    }
  }

  if (!replySent && parsed.body?.trim()) {
    try {
      const { handleJohnCustomerSmsReply } = await import(
        "@/lib/agents/missed-call-text-back/customer-sms"
      );
      const john = await handleJohnCustomerSmsReply({
        workspaceId: ctx.workspaceId,
        fromE164: parsed.from,
        toE164: parsed.to,
        body: parsed.body,
        conversationId: result.conversationId || null,
      });
      if (john.handled && john.action === "replied") replySent = true;
    } catch (err) {
      console.warn("[telnyx/inbound] John customer SMS failed", err);
    }
  }

  return {
    ok: true as const,
    kind: result.kind,
    reply: result.replyText || null,
    replySent,
  };
}

export async function handleTelnyxMessageStatus(payload: unknown) {
  const eventType = telnyxEventType(payload);
  if (eventType && classifyTelnyxMessagingEvent(eventType) === "inbound") {
    return { ok: true as const, skipped: true as const, reason: "inbound_event" };
  }

  const parsed = telnyxProvider.parseDeliveryStatus(payload);
  const sid = parsed.providerMessageId;
  if (!sid) return { ok: true as const, skipped: true as const };

  const status =
    parsed.internalStatus === "unknown"
      ? parsed.providerStatus.toLowerCase()
      : parsed.internalStatus;
  const prisma = getPrisma();

  await prisma.message.updateMany({
    where: { providerId: sid },
    data: { status },
  });

  const campaignMsg = await prisma.campaignMessage.findFirst({ where: { providerId: sid } });
  if (campaignMsg) {
    const incomingRank = STATUS_RANK[status];
    if (incomingRank != null && campaignMsg.status !== "clicked") {
      await prisma.campaignMessage.updateMany({
        where: {
          id: campaignMsg.id,
          status: { in: statusesAtOrBelow(incomingRank) },
          NOT: { status: "clicked" },
        },
        data: {
          status,
          ...(parsed.errorDetail ? { error: parsed.errorDetail } : {}),
        },
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
        await markRecipientFact(campaignMsg.recipientId, "message_delivered").catch(() => undefined);
      }
    }
  }

  return { ok: true as const, status, eventType: eventType || null };
}

export async function handleTelnyxCompliance(payload: unknown) {
  const root = (payload || {}) as Record<string, any>;
  const data = root.data || root;
  const eventPayload = data.payload || data;
  const brandId = String(eventPayload.brandId || eventPayload.brand_id || "");
  const campaignId = String(eventPayload.campaignId || eventPayload.campaign_id || "");

  const prisma = getPrisma();
  let reg = null as Awaited<ReturnType<typeof prisma.messagingRegistration.findFirst>>;
  if (brandId) {
    reg = await prisma.messagingRegistration.findFirst({
      where: { OR: [{ brandId }, { brandSid: brandId }] },
    });
  }
  if (!reg && campaignId) {
    reg = await prisma.messagingRegistration.findFirst({
      where: { OR: [{ campaignId }, { a2pCampaignSid: campaignId }] },
    });
  }

  if (reg) {
    const eventType = String(data.event_type || root.event_type || "compliance");
    const brandStatusRaw = String(
      eventPayload.identityStatus ||
        eventPayload.brandStatus ||
        (brandId ? eventPayload.status : "") ||
        "",
    );
    const campaignStatusRaw = String(
      eventPayload.campaignStatus || (campaignId && !brandId ? eventPayload.status : "") || "",
    );
    const patch: Record<string, unknown> = {};
    if (brandId && brandStatusRaw) {
      patch.brandStatusRaw = brandStatusRaw;
      if (isRejectedBrandStatus(brandStatusRaw)) {
        patch.brandStatus = "failed";
        patch.messagingEnabled = false;
        patch.overallStatus = "failed";
        patch.registrationFailureReason = `Brand ${brandStatusRaw}`;
      } else if (isApprovedBrandStatus(brandStatusRaw)) {
        patch.brandStatus = "approved";
      } else {
        patch.brandStatus = "in_review";
        patch.messagingEnabled = false;
      }
    }
    if (campaignId && campaignStatusRaw) {
      patch.campaignStatusRaw = campaignStatusRaw;
      if (isRejectedCampaignStatus(campaignStatusRaw)) {
        patch.campaignStatus = "failed";
        patch.messagingEnabled = false;
        patch.overallStatus = "failed";
        patch.registrationFailureReason = `Campaign ${campaignStatusRaw}`;
      } else if (isApprovedCampaignStatus(campaignStatusRaw)) {
        patch.campaignStatus = "approved";
      } else {
        patch.campaignStatus = "in_review";
        patch.messagingEnabled = false;
      }
    }
    if (Object.keys(patch).length) {
      await prisma.messagingRegistration.update({
        where: { workspaceId: reg.workspaceId },
        data: patch,
      });
    }

    await prisma.messagingRegistrationEvent.create({
      data: {
        workspaceId: reg.workspaceId,
        registrationId: reg.id,
        eventType: "telnyx_compliance_webhook",
        message: eventType,
        payload: root,
      },
    });
    await enqueueMessagingRegistrationAdvance(reg.workspaceId, 2_000);
  }

  return { ok: true as const, matched: Boolean(reg) };
}
