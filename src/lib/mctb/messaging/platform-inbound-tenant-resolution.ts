import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { MCTB_PLATFORM_REPLY_CONTEXT_WINDOW_MS } from "@/lib/mctb/messaging/platform-sender-suppression";
import {
  mctbCallerE164Variants,
  normalizeMctbCallerE164,
} from "@/lib/mctb/messaging/caller-e164";
import type { CanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";

export type PlatformInboundReplyStatus = "RESOLVED" | "AMBIGUOUS" | "UNMATCHED";

export type PlatformInboundReplyResolution =
  | {
      status: "RESOLVED";
      workspaceId: string;
      conversationId: string | null;
      reason: "platform_reply_resolved";
    }
  | {
      status: "AMBIGUOUS";
      workspaceIds: string[];
      reason: "ambiguous_platform_reply";
    }
  | {
      status: "UNMATCHED";
      reason: "unmatched_platform_reply";
    };

export type PlatformMctbReplyContext = {
  workspaceId: string;
  conversationId: string | null;
  lastOutboundAt: Date;
};

/** Safe read when Prisma nested `messages` is missing or unloaded. */
export function latestConversationOutboundAt(
  messages: Array<{ createdAt: Date }> | null | undefined,
): Date | undefined {
  return messages?.[0]?.createdAt;
}

/**
 * Collect workspaces with an active MCTB recovery thread on the shared platform sender.
 * Recency is evidence for ranking only — never used alone to pick a tenant when count > 1.
 */
export async function loadPlatformMctbReplyContexts(input: {
  platformSender: CanonicalMctbPlatformSender;
  consumerE164: string;
  since?: Date;
}): Promise<PlatformMctbReplyContext[]> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  const variants = mctbCallerE164Variants(input.consumerE164);
  const since = input.since ?? new Date(Date.now() - MCTB_PLATFORM_REPLY_CONTEXT_WINDOW_MS);
  const platformFrom = input.platformSender.e164;
  let platformFromNorm = platformFrom;
  try {
    platformFromNorm = normalizeE164(platformFrom);
  } catch {
    // keep
  }

  const contacts = await prisma.contact.findMany({
    where: { phone: { in: variants } },
    select: { id: true, workspaceId: true },
  });
  if (!contacts.length) return [];

  const workspaceIds = [...new Set(contacts.map((c) => c.workspaceId))];
  const contactIds = contacts.map((c) => c.id);

  const conversations = await prisma.conversation.findMany({
    where: {
      workspaceId: { in: workspaceIds },
      contactId: { in: contactIds },
      productSource: "MCTB",
      OR: [
        { phoneNumberId: input.platformSender.phoneNumberId },
        { fromE164: platformFrom },
        { fromE164: platformFromNorm },
      ],
    },
    select: {
      id: true,
      workspaceId: true,
      updatedAt: true,
      messages: {
        where: {
          direction: { in: ["out", "outbound"] },
          createdAt: { gte: since },
          OR: [{ fromE164: platformFrom }, { fromE164: platformFromNorm }],
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const byWorkspace = new Map<string, PlatformMctbReplyContext>();

  for (const conv of conversations) {
    const outboundAt = latestConversationOutboundAt(conv.messages);
    if (!outboundAt || outboundAt < since) continue;
    const existing = byWorkspace.get(conv.workspaceId);
    if (!existing || outboundAt > existing.lastOutboundAt) {
      byWorkspace.set(conv.workspaceId, {
        workspaceId: conv.workspaceId,
        conversationId: conv.id,
        lastOutboundAt: outboundAt,
      });
    }
  }

  const messageHits = await prisma.message.findMany({
    where: {
      workspaceId: { in: workspaceIds },
      to: { in: variants },
      from: { in: [platformFrom, platformFromNorm] },
      createdAt: { gte: since },
      status: { notIn: ["failed", "canceled", "cancelled"] },
    },
    orderBy: { createdAt: "desc" },
    select: { workspaceId: true, createdAt: true },
    take: 100,
  });
  for (const hit of messageHits) {
    if (!hit.workspaceId) continue;
    const existing = byWorkspace.get(hit.workspaceId);
    if (!existing || hit.createdAt > existing.lastOutboundAt) {
      byWorkspace.set(hit.workspaceId, {
        workspaceId: hit.workspaceId,
        conversationId: existing?.conversationId ?? null,
        lastOutboundAt: hit.createdAt,
      });
    }
  }

  const missedHits = await prisma.missedCallEvent.findMany({
    where: {
      workspaceId: { in: workspaceIds },
      callerE164: { in: variants },
      smsSentAt: { gte: since, not: null },
    },
    orderBy: { smsSentAt: "desc" },
    select: { workspaceId: true, smsSentAt: true, metadata: true },
    take: 100,
  });
  for (const hit of missedHits) {
    const meta = hit.metadata && typeof hit.metadata === "object" ? (hit.metadata as Record<string, unknown>) : {};
    const outboundSenderId = String(meta.outboundSmsPhoneNumberId || "");
    const outboundFrom = String(meta.outboundSmsFromE164 || "");
    const matchesPlatform =
      outboundSenderId === input.platformSender.phoneNumberId ||
      outboundFrom === platformFrom ||
      outboundFrom === platformFromNorm;
    if (!matchesPlatform) continue;
    if (!hit.smsSentAt) continue;
    const existing = byWorkspace.get(hit.workspaceId);
    if (!existing || hit.smsSentAt > existing.lastOutboundAt) {
      byWorkspace.set(hit.workspaceId, {
        workspaceId: hit.workspaceId,
        conversationId: existing?.conversationId ?? null,
        lastOutboundAt: hit.smsSentAt,
      });
    }
  }

  return [...byWorkspace.values()].sort(
    (a, b) => b.lastOutboundAt.getTime() - a.lastOutboundAt.getTime(),
  );
}

export function resolvePlatformInboundReplyFromContexts(
  contexts: PlatformMctbReplyContext[],
): PlatformInboundReplyResolution {
  if (!contexts.length) {
    return { status: "UNMATCHED", reason: "unmatched_platform_reply" };
  }
  const unique = [...new Set(contexts.map((c) => c.workspaceId))];
  if (unique.length > 1) {
    return {
      status: "AMBIGUOUS",
      workspaceIds: unique,
      reason: "ambiguous_platform_reply",
    };
  }
  const ctx = contexts[0]!;
  return {
    status: "RESOLVED",
    workspaceId: ctx.workspaceId,
    conversationId: ctx.conversationId,
    reason: "platform_reply_resolved",
  };
}

export async function resolvePlatformMctbInboundReply(input: {
  platformSender: CanonicalMctbPlatformSender;
  consumerE164: string;
}): Promise<PlatformInboundReplyResolution> {
  const contexts = await loadPlatformMctbReplyContexts({
    platformSender: input.platformSender,
    consumerE164: input.consumerE164,
  });
  return resolvePlatformInboundReplyFromContexts(contexts);
}

export function logPlatformInboundResolution(event: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      source: "mctb-platform-sender-inbound",
      timestamp: new Date().toISOString(),
      ...event,
    }),
  );
}
