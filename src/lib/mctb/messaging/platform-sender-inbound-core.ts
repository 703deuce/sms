import "server-only";

import {
  isActiveMctbPlatformSenderE164,
  resolveCanonicalMctbPlatformSender,
} from "@/lib/mctb/messaging/platform-sender-config";
import { handlePlatformSenderComplianceInbound } from "@/lib/mctb/messaging/platform-inbound-boundary";
import {
  logPlatformInboundResolution,
  resolvePlatformMctbInboundReply,
} from "@/lib/mctb/messaging/platform-inbound-tenant-resolution";
import { acceptMctbInboundSmsIngress } from "@/lib/mctb/messaging/inbound-sms-ingress";

export async function handleMctbPlatformSenderInboundCore(input: {
  channel: "twilio" | "telnyx";
  toRaw: string;
  fromE164: string;
  body: string;
  providerMessageId?: string | null;
  mediaUrls?: string[] | null;
}): Promise<{
  replyText?: string;
  resolution:
    | "platform_reply_resolved"
    | "ambiguous_platform_reply"
    | "unmatched_platform_reply"
    | "platform_opt_out"
    | "platform_help"
    | "platform_sender_not_configured";
  workspaceId?: string;
}> {
  const isPlatform = await isActiveMctbPlatformSenderE164(input.toRaw);
  if (!isPlatform) {
    return { resolution: "unmatched_platform_reply" };
  }

  const platformSender = await resolveCanonicalMctbPlatformSender();
  if (!platformSender) {
    logPlatformInboundResolution({
      event: "platform_sender_not_configured",
      channel: input.channel,
      to: input.toRaw,
    });
    return { resolution: "platform_sender_not_configured" };
  }

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

  const resolution = await resolvePlatformMctbInboundReply({
    platformSender,
    consumerE164: input.fromE164,
  });

  logPlatformInboundResolution({
    event: resolution.status === "RESOLVED" ? "platform_reply_resolved" : resolution.reason,
    channel: input.channel,
    status: resolution.status,
    fromE164: input.fromE164,
    toE164: platformSender.e164,
    ...(resolution.status === "RESOLVED"
      ? { workspaceId: resolution.workspaceId }
      : resolution.status === "AMBIGUOUS"
        ? { workspaceIds: resolution.workspaceIds }
        : {}),
  });

  if (resolution.status !== "RESOLVED") {
    return { resolution: resolution.reason };
  }

  if (!input.providerMessageId?.trim()) {
    throw new Error("mctb_platform_inbound_missing_provider_message_id");
  }

  await acceptMctbInboundSmsIngress({
    workspaceId: resolution.workspaceId,
    from: input.fromE164,
    to: platformSender.e164,
    body: input.body,
    provider: input.channel,
    providerMessageId: input.providerMessageId,
    mediaUrls: input.mediaUrls ?? null,
  });

  return {
    resolution: "platform_reply_resolved",
    workspaceId: resolution.workspaceId,
  };
}
