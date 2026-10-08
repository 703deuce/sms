import "server-only";

import type { PlatformInboundDestination } from "@/lib/messaging/platform-inbound-destination";
import { resolveArInboundFromOutboundInitiatedConversation } from "@/lib/appointment-reminders/messaging/resolve-initiated-ar-inbound";
import { handlePlatformSenderComplianceInbound } from "@/lib/mctb/messaging/platform-inbound-boundary";
import { logPlatformInboundResolution } from "@/lib/mctb/messaging/platform-inbound-tenant-resolution";
import { acceptMctbInboundSmsIngress } from "@/lib/mctb/messaging/inbound-sms-ingress";
import {
  findActivePlatformSenderAssignments,
  resolvePlatformMctbInboundReplyWithAssignment,
  touchPlatformSenderAssignment,
} from "@/lib/mctb/messaging/platform-sender-assignment";
import { acceptArInboundSmsIngress } from "@/lib/appointment-reminders/messaging/inbound-sms-ingress";
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
 * Shared platform SMS ingress.
 * Appointment Reminders: match only outbound-initiated AR conversations (customer + platform sender).
 * MCTB: independent call-forwarding/consent workflow when no AR match.
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

  const arMatch = await resolveArInboundFromOutboundInitiatedConversation({
    consumerE164: input.fromE164,
    platformPhoneNumberId: input.destination.phoneNumberId,
  });

  if (arMatch.status === "matched") {
    const session = arMatch.session;
    await acceptArInboundSmsIngress({
      workspaceId: session.workspaceId,
      contactId: session.contactId,
      replySessionId: session.id,
      appointmentId: session.appointmentId,
      from: input.fromE164,
      to: input.destination.e164,
      body: input.body,
      provider: input.channel,
      providerMessageId: input.providerMessageId,
      mediaUrls: input.mediaUrls ?? null,
    });
    logPlatformInboundResolution({
      event: "ar_platform_reply_resolved",
      channel: input.channel,
      fromE164: input.fromE164,
      workspaceId: session.workspaceId,
      appointmentId: session.appointmentId,
      replySessionId: session.id,
    });
    return {
      product: "appointment_reminders",
      resolution: "ar_platform_reply_resolved",
      workspaceId: session.workspaceId,
    };
  }

  if (arMatch.status === "ambiguous") {
    logPlatformInboundResolution({
      event: "ambiguous_ar_initiated_conversations",
      channel: input.channel,
      fromE164: input.fromE164,
      sessionCount: arMatch.sessions.length,
      workspaceIds: [...new Set(arMatch.sessions.map((s) => s.workspaceId))],
    });
    await recordHeldPlatformInbound({
      channel: input.channel,
      destination: input.destination,
      providerMessageId: input.providerMessageId,
      fromE164: input.fromE164,
      body: input.body,
      reason: "ambiguous_ar_initiated_conversations",
      arSessions: arMatch.sessions.map((s) => ({
        id: s.id,
        workspaceId: s.workspaceId,
        appointmentId: s.appointmentId,
        conversationId: s.conversationId,
      })),
      mctbAssignments: [],
    });
    return { resolution: "ambiguous_platform_reply" };
  }

  const mctbAssignments = await findActivePlatformSenderAssignments({
    consumerE164: input.fromE164,
    platformPhoneNumberId: input.destination.phoneNumberId,
  });

  const mctbEligible = mctbAssignments.length === 1 ? mctbAssignments[0]! : null;
  const mctbAmbiguous = mctbAssignments.length > 1;

  if (mctbAmbiguous) {
    logPlatformInboundResolution({
      event: "ambiguous_platform_reply",
      channel: input.channel,
      fromE164: input.fromE164,
      mctbWorkspaceIds: [...new Set(mctbAssignments.map((a) => a.workspaceId))],
    });
    await recordHeldPlatformInbound({
      channel: input.channel,
      destination: input.destination,
      providerMessageId: input.providerMessageId,
      fromE164: input.fromE164,
      body: input.body,
      reason: "ambiguous_mctb_assignments",
      arSessions: [],
      mctbAssignments,
    });
    return { resolution: "ambiguous_platform_reply" };
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
  channel: "twilio" | "telnyx";
  destination: PlatformInboundDestination;
  providerMessageId: string;
  fromE164: string;
  body: string;
  reason: string;
  arSessions: Array<{
    id: string;
    workspaceId: string;
    appointmentId: string;
    conversationId: string | null;
  }>;
  mctbAssignments: Array<{
    id: string;
    workspaceId: string;
    conversationId: string | null;
  }>;
}) {
  const { persistArInboundHeldMessage } = await import(
    "@/lib/appointment-reminders/messaging/platform-inbound-held"
  );
  const candidateContexts = [
    ...input.arSessions.map((s) => ({
      product: "appointment_reminders" as const,
      workspaceId: s.workspaceId,
      replySessionId: s.id,
      appointmentId: s.appointmentId,
      conversationId: s.conversationId ?? undefined,
    })),
    ...input.mctbAssignments.map((a) => ({
      product: "mctb" as const,
      workspaceId: a.workspaceId,
      assignmentId: a.id,
      conversationId: a.conversationId ?? undefined,
    })),
  ];
  const workspaceId =
    candidateContexts.length === 1 ? candidateContexts[0]!.workspaceId : null;

  const held = await persistArInboundHeldMessage({
    providerMessageId: input.providerMessageId,
    channel: input.channel,
    fromE164: input.fromE164,
    toE164: input.destination.e164,
    platformPhoneNumberId: input.destination.phoneNumberId,
    body: input.body,
    holdReason: input.reason,
    candidateContexts,
    workspaceId,
  });

  const prisma = getPrisma();
  const idempotencyKey = `platform-inbound-held:${input.providerMessageId}`;
  await prisma.jobQueue
    .upsert({
      where: { idempotencyKey },
      create: {
        jobType: "ar_inbound_held",
        queueName: "appointment_reminders",
        priority: 60,
        maxAttempts: 3,
        idempotencyKey,
        payload: {
          heldMessageId: held.id,
          providerMessageId: input.providerMessageId,
          reason: input.reason,
          heldAt: new Date().toISOString(),
        },
      },
      update: {
        payload: {
          heldMessageId: held.id,
          providerMessageId: input.providerMessageId,
          reason: input.reason,
          heldAt: new Date().toISOString(),
        },
      },
    })
    .catch(() => undefined);
}
