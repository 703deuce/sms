import "server-only";

import type { PlatformInboundDestination } from "@/lib/messaging/platform-inbound-destination";
import { acceptMctbInboundSmsIngress } from "@/lib/mctb/messaging/inbound-sms-ingress";
import { logPlatformInboundResolution } from "@/lib/mctb/messaging/platform-inbound-tenant-resolution";
import {
  findActivePlatformSenderAssignments,
  resolvePlatformMctbInboundReplyWithAssignment,
  touchPlatformSenderAssignment,
} from "@/lib/mctb/messaging/platform-sender-assignment";

import type { PlatformSmsInboundDispatchResolution } from "./platform-sms-inbound-dispatch";

/**
 * MCTB platform-sender inbound — only when MCTB is a launched product.
 * Not used during Appointment Reminders–only launch (see platform-launch flags).
 */
export async function dispatchPlatformSmsInboundToMctb(input: {
  channel: "twilio" | "telnyx";
  destination: PlatformInboundDestination;
  fromE164: string;
  body: string;
  providerMessageId: string;
  mediaUrls?: string[] | null;
  recordHeld: (hold: {
    reason: string;
    mctbAssignments: Array<{ id: string; workspaceId: string; conversationId: string | null }>;
  }) => Promise<void>;
}): Promise<{
  product?: "mctb";
  resolution: PlatformSmsInboundDispatchResolution;
  workspaceId?: string;
}> {
  const platformSender = {
    phoneNumberId: input.destination.phoneNumberId,
    e164: input.destination.e164,
    workspaceId: input.destination.workspaceId,
    provider: input.destination.provider,
  };

  const mctbAssignments = await findActivePlatformSenderAssignments({
    consumerE164: input.fromE164,
    platformPhoneNumberId: input.destination.phoneNumberId,
  });

  if (mctbAssignments.length > 1) {
    logPlatformInboundResolution({
      event: "ambiguous_platform_reply",
      channel: input.channel,
      fromE164: input.fromE164,
      mctbWorkspaceIds: [...new Set(mctbAssignments.map((a) => a.workspaceId))],
    });
    await input.recordHeld({
      reason: "ambiguous_mctb_assignments",
      mctbAssignments,
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
