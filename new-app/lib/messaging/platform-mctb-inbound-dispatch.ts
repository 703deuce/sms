import "server-only";

import type { PlatformInboundDestination } from "@/lib/messaging/platform-inbound-destination";
import { acceptMctbInboundSmsIngress } from "@/lib/mctb/messaging/inbound-sms-ingress";
import { handlePlatformSenderComplianceInbound } from "@/lib/mctb/messaging/platform-inbound-boundary";
import { logPlatformInboundResolution } from "@/lib/mctb/messaging/platform-inbound-tenant-resolution";
import {
  findActivePlatformSenderAssignments,
  resolvePlatformMctbInboundReplyWithAssignment,
  touchPlatformSenderAssignment,
} from "@/lib/mctb/messaging/platform-sender-assignment";
import { persistPlatformInboundHeldMessage } from "@/lib/messaging/platform-inbound-held";

export type PlatformMctbInboundResolution =
  | "platform_reply_resolved"
  | "ambiguous_platform_reply"
  | "unmatched_platform_reply"
  | "platform_opt_out"
  | "platform_help"
  | "platform_sender_not_configured";

export async function dispatchPlatformMctbInboundSms(input: {
  channel: "twilio" | "telnyx";
  destination: PlatformInboundDestination;
  fromE164: string;
  body: string;
  providerMessageId: string;
  mediaUrls?: string[] | null;
}): Promise<{
  product?: "mctb";
  replyText?: string;
  resolution: PlatformMctbInboundResolution;
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

  const mctbAssignments = await findActivePlatformSenderAssignments({
    consumerE164: input.fromE164,
    platformPhoneNumberId: input.destination.phoneNumberId,
  });

  if (mctbAssignments.length > 1) {
    const workspaceIds = [...new Set(mctbAssignments.map((a) => a.workspaceId))];
    logPlatformInboundResolution({
      event: "ambiguous_platform_reply",
      channel: input.channel,
      fromE164: input.fromE164,
      mctbWorkspaceIds: workspaceIds,
    });
    await persistPlatformInboundHeldMessage({
      providerMessageId: input.providerMessageId,
      channel: input.channel,
      fromE164: input.fromE164,
      toE164: input.destination.e164,
      platformPhoneNumberId: input.destination.phoneNumberId,
      body: input.body,
      holdReason: "ambiguous_mctb_assignments",
      candidateContexts: mctbAssignments.map((a) => ({
        product: "mctb",
        workspaceId: a.workspaceId,
        assignmentId: a.id,
        conversationId: a.conversationId ?? undefined,
      })),
    });
    return { resolution: "ambiguous_platform_reply" };
  }

  if (mctbAssignments.length === 1) {
    const row = mctbAssignments[0]!;
    await acceptMctbInboundSmsIngress({
      workspaceId: row.workspaceId,
      from: input.fromE164,
      to: input.destination.e164,
      body: input.body,
      provider: input.channel,
      providerMessageId: input.providerMessageId,
      mediaUrls: input.mediaUrls ?? null,
    });
    await touchPlatformSenderAssignment({
      workspaceId: row.workspaceId,
      consumerE164: input.fromE164,
      platformPhoneNumberId: input.destination.phoneNumberId,
      conversationId: row.conversationId,
    }).catch(() => undefined);
    return {
      product: "mctb",
      resolution: "platform_reply_resolved",
      workspaceId: row.workspaceId,
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

  if (legacy.status === "AMBIGUOUS") {
    await persistPlatformInboundHeldMessage({
      providerMessageId: input.providerMessageId,
      channel: input.channel,
      fromE164: input.fromE164,
      toE164: input.destination.e164,
      platformPhoneNumberId: input.destination.phoneNumberId,
      body: input.body,
      holdReason: "ambiguous_legacy_reply_contexts",
      candidateContexts: legacy.workspaceIds.map((workspaceId) => ({
        product: "mctb",
        workspaceId,
      })),
    });
    return { resolution: "ambiguous_platform_reply" };
  }

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
