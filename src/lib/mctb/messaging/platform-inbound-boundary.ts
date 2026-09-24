import "server-only";

import { getPrisma } from "@/lib/db";
import { DEFAULT_HELP_KEYWORDS, DEFAULT_OPT_OUT_KEYWORDS } from "@/lib/messaging/messaging-settings";
import { mctbCallerE164Variants, normalizeMctbCallerE164 } from "@/lib/mctb/messaging/caller-e164";
import type { CanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import {
  loadPlatformMctbReplyContexts,
  logPlatformInboundResolution,
} from "@/lib/mctb/messaging/platform-inbound-tenant-resolution";
import { recordPlatformMctbSenderOptOut } from "@/lib/mctb/messaging/platform-sender-suppression";
import { releasePlatformSenderAssignmentForConsumer } from "@/lib/mctb/messaging/platform-sender-assignment";

const PLATFORM_HELP_MESSAGE =
  "Transovo: Reply STOP to opt out. Msg&data rates may apply. For help email support@transovo.com.";

function isStopKeyword(body: string): boolean {
  const upper = (body || "").trim().toUpperCase();
  return DEFAULT_OPT_OUT_KEYWORDS.includes(upper);
}

function isHelpKeyword(body: string): boolean {
  const upper = (body || "").trim().toUpperCase();
  return DEFAULT_HELP_KEYWORDS.includes(upper);
}

async function applyWorkspaceOptOut(workspaceId: string, phone: string) {
  const prisma = getPrisma();
  const suppressionKey = `${workspaceId}:p:${phone}`;
  try {
    await prisma.suppression.create({
      data: {
        workspaceId,
        phone,
        suppressionKey,
        reason: "STOP",
        source: "mctb_platform_sender_inbound",
      },
    });
  } catch (err) {
    if (!(err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002")) {
      throw err;
    }
  }
  await prisma.contact.updateMany({
    where: { workspaceId, phone: { in: mctbCallerE164Variants(phone) } },
    data: { status: "UNSUBSCRIBED" },
  });
}

/**
 * STOP/HELP at the shared platform sender — does not require tenant resolution for STOP.
 */
export async function handlePlatformSenderComplianceInbound(input: {
  platformSender: CanonicalMctbPlatformSender;
  fromE164: string;
  body: string;
}): Promise<{ handled: true; replyText?: string; kind: "stop" | "help" | "none" }> {
  const body = (input.body || "").trim();
  const from = normalizeMctbCallerE164(input.fromE164);

  if (isStopKeyword(body)) {
    const contexts = await loadPlatformMctbReplyContexts({
      platformSender: input.platformSender,
      consumerE164: from,
    });
    const workspaceIds = [...new Set(contexts.map((c) => c.workspaceId))];
    for (const workspaceId of workspaceIds) {
      await applyWorkspaceOptOut(workspaceId, from);
    }
    await recordPlatformMctbSenderOptOut({
      platformSender: input.platformSender,
      consumerE164: from,
      source: "mctb_platform_sender_inbound",
    });
    await releasePlatformSenderAssignmentForConsumer({
      platformSender: input.platformSender,
      consumerE164: from,
      releaseReason: "OPT_OUT",
    });
    logPlatformInboundResolution({
      event: "platform_opt_out",
      fromE164: from,
      platformSenderE164: input.platformSender.e164,
      workspaceCount: workspaceIds.length,
    });
    return { handled: true, kind: "stop" };
  }

  if (isHelpKeyword(body)) {
    logPlatformInboundResolution({
      event: "platform_help",
      fromE164: from,
      platformSenderE164: input.platformSender.e164,
    });
    return { handled: true, kind: "help", replyText: PLATFORM_HELP_MESSAGE };
  }

  return { handled: true, kind: "none" };
}

export { PLATFORM_HELP_MESSAGE };
