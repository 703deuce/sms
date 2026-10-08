import "server-only";

import type { PlatformInboundDestination } from "@/lib/messaging/platform-inbound-destination";
import { handlePlatformSenderComplianceInbound } from "@/lib/mctb/messaging/platform-inbound-boundary";
import { logPlatformInboundResolution } from "@/lib/mctb/messaging/platform-inbound-tenant-resolution";
import { acceptMctbInboundSmsIngress } from "@/lib/mctb/messaging/inbound-sms-ingress";
import {
  findActivePlatformSenderAssignments,
  resolvePlatformMctbInboundReplyWithAssignment,
  touchPlatformSenderAssignment,
} from "@/lib/mctb/messaging/platform-sender-assignment";
import { acceptArInboundSmsIngress } from "@/lib/appointment-reminders/messaging/inbound-sms-ingress";
import { findReplyEligibleArSessionsForInbound } from "@/lib/appointment-reminders/messaging/reply-session";
import { getPrisma } from "@/lib/db";

export type PlatformSmsInboundDispatchResolution =
  | "platform_reply_resolved"
  | "ar_platform_reply_resolved"
  | "ambiguous_platform_reply"
  | "ambiguous_cross_product_reply"
  | "unmatched_platform_reply"
  | "platform_opt_out"
  | "platform_help"
  | "platform_sender_not_configured"
  | "held_unrouted";

/**
 * Deterministic shared-platform SMS ingress.
 * Routes only on persisted product-scoped assignments/sessions — never on message body or recency heuristics.
 */
export async function dispatchSharedPlatformSmsInbound(input: {
  channel: "twilio" | "telnyx";
  destination: PlatformInboundDestination;
  fromE164: string;
  body: string;
  providerMessageId?: string | null;
  mediaUrls?: string[] | null;
}): Promise<{
  product?: "appointment_reminders" | "mctb";
  replyText?: string;
  resolution: PlatformSmsInboundDispatchResolution;
  workspaceId?: string;
}> {
  const platformSender = {
    phoneNumberId: input.destination.phoneNumberId,
    e164: input.destination.e164,
    workspaceId: input.destination.workspaceId,
    provider: input.destination.provider,
  };

  const compliance = await handlePlatformSenderComplianceInbound({
    platformSender,
    fromE164: input.fromE164,
    body: input.body,
  });

  if (compliance.kind === "help") {
    return { resolution: "platform_help", replyText: compliance.replyText };
  }
  if (compliance.kind === "stop") {
    return { resolution: "platform_opt_out" };
  }

  if (!input.providerMessageId?.trim()) {
    throw new Error("platform_inbound_missing_provider_message_id");
  }

  const arSessions = await findReplyEligibleArSessionsForInbound({
    consumerE164: input.fromE164,
    platformPhoneNumberId: input.destination.phoneNumberId,
  });

  const mctbAssignments = await findActivePlatformSenderAssignments({
    consumerE164: input.fromE164,
    platformPhoneNumberId: input.destination.phoneNumberId,
  });

  const arWorkspaceIds = [...new Set(arSessions.map((s) => s.workspaceId))];
  const mctbWorkspaceIds = [...new Set(mctbAssignments.map((a) => a.workspaceId))];

  const arEligible = arSessions.length === 1 ? arSessions[0]! : null;
  const arAmbiguous = arSessions.length > 1;
  const mctbEligible = mctbAssignments.length === 1 ? mctbAssignments[0]! : null;
  const mctbAmbiguous = mctbAssignments.length > 1;

  if (arAmbiguous || mctbAmbiguous) {
    logPlatformInboundResolution({
      event: "ambiguous_platform_reply",
      channel: input.channel,
      fromE164: input.fromE164,
      arWorkspaceIds,
      mctbWorkspaceIds,
    });
    return { resolution: "ambiguous_platform_reply" };
  }

  if (arEligible && mctbEligible) {
    logPlatformInboundResolution({
      event: "ambiguous_cross_product_reply",
      channel: input.channel,
      fromE164: input.fromE164,
      arWorkspaceId: arEligible.workspaceId,
      mctbWorkspaceId: mctbEligible.workspaceId,
    });
    await recordHeldPlatformInbound({
      providerMessageId: input.providerMessageId,
      fromE164: input.fromE164,
      toE164: input.destination.e164,
      body: input.body,
      reason: "cross_product_active_context",
    });
    return { resolution: "ambiguous_cross_product_reply" };
  }

  if (arEligible) {
    await acceptArInboundSmsIngress({
      workspaceId: arEligible.workspaceId,
      contactId: arEligible.contactId,
      replySessionId: arEligible.id,
      appointmentId: arEligible.appointmentId,
      from: input.fromE164,
      to: input.destination.e164,
      body: input.body,
      provider: input.channel,
      providerMessageId: input.providerMessageId,
      mediaUrls: input.mediaUrls ?? null,
    });
    return {
      product: "appointment_reminders",
      resolution: "ar_platform_reply_resolved",
      workspaceId: arEligible.workspaceId,
    };
  }

  if (mctbEligible) {
    await acceptMctbInboundSmsIngress({
      workspaceId: mctbEligible.workspaceId,
      from: input.fromE164,
      to: input.destination.e164,
      body: input.body,
      provider: input.channel,
      providerMessageId: input.providerMessageId,
      mediaUrls: input.mediaUrls ?? null,
    });
    await touchPlatformSenderAssignment({
      workspaceId: mctbEligible.workspaceId,
      consumerE164: input.fromE164,
      platformPhoneNumberId: input.destination.phoneNumberId,
      conversationId: mctbEligible.conversationId,
    }).catch(() => undefined);
    return {
      product: "mctb",
      resolution: "platform_reply_resolved",
      workspaceId: mctbEligible.workspaceId,
    };
  }

  const legacy = await resolvePlatformMctbInboundReplyWithAssignment({
    platformSender,
    consumerE164: input.fromE164,
  });

  logPlatformInboundResolution({
    event: legacy.status === "RESOLVED" ? "platform_reply_resolved" : legacy.reason,
    channel: input.channel,
    status: legacy.status,
    fromE164: input.fromE164,
    toE164: platformSender.e164,
    resolutionSource: legacy.resolutionSource,
    ...(legacy.status === "RESOLVED"
      ? { workspaceId: legacy.workspaceId }
      : legacy.status === "AMBIGUOUS"
        ? { workspaceIds: legacy.workspaceIds }
        : {}),
  });

  if (legacy.status !== "RESOLVED") {
    return { resolution: legacy.reason };
  }

  await acceptMctbInboundSmsIngress({
    workspaceId: legacy.workspaceId,
    from: input.fromE164,
    to: platformSender.e164,
    body: input.body,
    provider: input.channel,
    providerMessageId: input.providerMessageId,
    mediaUrls: input.mediaUrls ?? null,
  });

  await touchPlatformSenderAssignment({
    workspaceId: legacy.workspaceId,
    consumerE164: input.fromE164,
    platformPhoneNumberId: platformSender.phoneNumberId,
    conversationId: legacy.conversationId,
  }).catch(() => undefined);

  return {
    product: "mctb",
    resolution: "platform_reply_resolved",
    workspaceId: legacy.workspaceId,
  };
}

async function recordHeldPlatformInbound(input: {
  providerMessageId: string;
  fromE164: string;
  toE164: string;
  body: string;
  reason: string;
}) {
  const prisma = getPrisma();
  const idempotencyKey = `platform-inbound-held:${input.providerMessageId}`;
  await prisma.jobQueue
    .upsert({
      where: { idempotencyKey },
      create: {
        jobType: "ar_inbound_held",
        queueName: "appointment_reminders",
        priority: 60,
        maxAttempts: 1,
        idempotencyKey,
        payload: {
          providerMessageId: input.providerMessageId,
          fromE164: input.fromE164,
          toE164: input.toE164,
          body: input.body.slice(0, 500),
          reason: input.reason,
          heldAt: new Date().toISOString(),
        },
      },
      update: {},
    })
    .catch(() => undefined);
}
