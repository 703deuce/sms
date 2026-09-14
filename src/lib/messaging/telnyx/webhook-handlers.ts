/**
 * Shared Telnyx webhook business logic (inbound, status, compliance).
 */

import { getPrisma } from "@/lib/db";
import { processInboundMessage, resolveInboundContext } from "@/lib/messaging/inbound-process";
import { enqueueMessagingRegistrationAdvance } from "@/lib/messaging/enqueue-advance";
import { applyParsedDeliveryStatus } from "@/lib/messaging/delivery-status";
import { looksLikeTwilioMessagingServiceSid } from "../provider-ids";
import { telnyxProvider } from "./provider";
import {
  isApprovedBrandStatus,
  isApprovedCampaignStatus,
  isRejectedBrandStatus,
  isRejectedCampaignStatus,
} from "./status-map";
import { telnyxEventType } from "./webhook-auth";

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
    const { recordDemoReplyReceived } = await import("@/lib/mctb/onboarding/demo");
    const { resolvePlatformDemoInboundWorkspace } = await import(
      "@/lib/mctb/messaging/inbound-routing"
    );
    const { getPrisma } = await import("@/lib/db");

    const prisma = getPrisma();
    const phone = await prisma.phoneNumber.findFirst({
      where: { e164: parsed.to, status: "Active" },
      select: { workspaceId: true, e164: true, settingsJson: true },
    });

    const routed = await resolvePlatformDemoInboundWorkspace({
      fromE164: parsed.from,
      phoneRecord: phone,
    });

    if (routed?.reason === "demo_session") {
      await recordDemoReplyReceived(routed.workspaceId);
    }
  } catch (demoErr) {
    console.warn("[telnyx/inbound] platform demo routing failed", demoErr);
  }

  const root = payload as { data?: { payload?: { messaging_profile_id?: string } } };
  const profileId = root?.data?.payload?.messaging_profile_id;
  const ctx = await resolveInboundContext(parsed.to, profileId, {
    fromE164: parsed.from,
    body: parsed.body,
  });
  if (!ctx) {
    return { ok: true as const, unmatched: true as const };
  }

  const { resolvePlatformDemoInboundWorkspace } = await import(
    "@/lib/mctb/messaging/inbound-routing"
  );
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const phoneRecord = await prisma.phoneNumber.findFirst({
    where: { e164: parsed.to, status: "Active" },
    select: { workspaceId: true, e164: true, settingsJson: true },
  });
  const platformRoute = await resolvePlatformDemoInboundWorkspace({
    fromE164: parsed.from,
    phoneRecord,
  });
  const targetWorkspaceId = platformRoute?.workspaceId || ctx.workspaceId;
  const targetRegistration =
    targetWorkspaceId === ctx.workspaceId
      ? ctx.registration
      : await prisma.messagingRegistration.findUnique({
          where: { workspaceId: targetWorkspaceId },
        });

  const result = await processInboundMessage({
    workspaceId: targetWorkspaceId,
    from: parsed.from,
    to: parsed.to,
    body: parsed.body,
    providerMessageId: parsed.providerMessageId,
    mediaUrls: parsed.mediaUrls || null,
    registration: targetRegistration,
  });

  const { isPlatformDemoPhoneRecord } = await import(
    "@/lib/messaging/compliance/phone-number-class"
  );
  const platformDemoLine =
    phoneRecord &&
    isPlatformDemoPhoneRecord({
      e164: phoneRecord.e164,
      settingsJson: phoneRecord.settingsJson,
    });
  /** Telnyx 10DLC campaign already sends opt-in/opt-out/help auto-replies on platform 571. */
  const skipKeywordAutoReply =
    platformDemoLine && (result.kind === "stop" || result.kind === "start" || result.kind === "help");

  let replySent = false;
  let inboundReplyText = result.replyText;
  if (inboundReplyText && result.kind === "away" && parsed.body?.trim()) {
    const { shouldSkipInboxAwayAutoReply } = await import("@/lib/mctb/messaging/skip-inbox-away");
    if (
      await shouldSkipInboxAwayAutoReply({
        workspaceId: targetWorkspaceId,
        fromE164: parsed.from,
        toE164: parsed.to,
      })
    ) {
      inboundReplyText = undefined;
    }
  }
  if (inboundReplyText && targetRegistration && !skipKeywordAutoReply) {
    const replyProfileId =
      targetRegistration.messagingProfileId ||
      (looksLikeTwilioMessagingServiceSid(targetRegistration.messagingServiceSid)
        ? null
        : targetRegistration.messagingServiceSid);
    try {
      await telnyxProvider.sendMessage(targetRegistration as any, {
        to: parsed.from,
        from: ctx.phoneE164 || parsed.to,
        body: inboundReplyText,
        messagingProfileId: replyProfileId,
        mediaUrls: result.mediaUrls?.filter(Boolean),
      });
      replySent = true;
    } catch (err) {
      console.error("[telnyx/inbound] keyword reply send failed", err);
    }
  }

  if (!replySent && parsed.body?.trim()) {
    try {
      const { handleMctbCustomerSmsReply } = await import(
        "@/lib/agents/missed-call-text-back/customer-sms"
      );
      const mctbReply = await handleMctbCustomerSmsReply({
        workspaceId: targetWorkspaceId,
        fromE164: parsed.from,
        toE164: parsed.to,
        body: parsed.body,
        conversationId: result.conversationId || null,
        providerMessageId: parsed.providerMessageId,
      });
      if (mctbReply.handled && mctbReply.reply?.trim()) replySent = true;
    } catch (err) {
      console.warn("[telnyx/inbound] MCTB Lead Recovery SMS failed", err);
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

  const result = await applyParsedDeliveryStatus(parsed, "telnyx");
  const status = result.status;

  const { appendMctbDeliveryTraceFromProviderStatus } = await import(
    "@/lib/mctb/messaging/delivery-trace"
  );
  await appendMctbDeliveryTraceFromProviderStatus({
    providerMessageId: sid,
    status,
    errorDetail: parsed.errorDetail,
  }).catch(() => undefined);

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
