import "server-only";

import type { ArSmsReplySession } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { normalizeMctbCallerE164 } from "@/lib/mctb/messaging/caller-e164";
import { AR_REPLY_ELIGIBLE_STATES } from "./ar-platform-sender-pool";

const DEFAULT_HISTORY_DAYS = 14;

/** Minimum recent SMS context Luna receives (not necessarily DB retention). */
export function arPersistentConversationHistorySince(): Date {
  const days = Number(process.env.AR_SMS_CONVERSATION_HISTORY_DAYS || String(DEFAULT_HISTORY_DAYS));
  const ms =
    Number.isFinite(days) && days > 0 ? days * 24 * 60 * 60 * 1000 : DEFAULT_HISTORY_DAYS * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms);
}

/** Lifecycle states that may receive inbound SMS on a persistent customer thread. */
export const AR_INBOUND_ROUTABLE_LIFECYCLE_STATES = [
  ...AR_REPLY_ELIGIBLE_STATES,
  "COMPLETED",
  "NEEDS_CLARIFICATION",
] as const;

export type ArInboundRoutableLifecycleState = (typeof AR_INBOUND_ROUTABLE_LIFECYCLE_STATES)[number];

const OUTBOUND_PROOF_FILTER = {
  OR: [
    { lastOutboundProviderMessageId: { not: null } },
    { lastOutboundMessageId: { not: null } },
  ],
} as const;

export {
  groupArSessionsByWorkspace,
  pickPrimaryArReplySessionForInbound,
  resolveArInboundPrimarySession,
  type ArInboundPrimarySessionResolution,
} from "./ar-inbound-session-routing";

export async function listArInboundRoutableSessions(input: {
  consumerE164: string;
  platformPhoneNumberId: string;
}): Promise<ArSmsReplySession[]> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  return prisma.arSmsReplySession.findMany({
    where: {
      consumerE164: consumer,
      platformPhoneNumberId: input.platformPhoneNumberId,
      lifecycleState: { in: [...AR_INBOUND_ROUTABLE_LIFECYCLE_STATES] },
      AND: [OUTBOUND_PROOF_FILTER],
    },
    orderBy: { lastUsedAt: "desc" },
  });
}

export async function findPersistentArConversationId(input: {
  workspaceId: string;
  consumerE164: string;
  platformPhoneNumberId: string;
}): Promise<string | null> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  const session = await prisma.arSmsReplySession.findFirst({
    where: {
      workspaceId: input.workspaceId,
      consumerE164: consumer,
      platformPhoneNumberId: input.platformPhoneNumberId,
      conversationId: { not: null },
      AND: [OUTBOUND_PROOF_FILTER],
    },
    orderBy: { lastUsedAt: "desc" },
    select: { conversationId: true },
  });
  return session?.conversationId ?? null;
}

/** Bind every AR reply session on this sender+consumer+workspace to one conversation. */
export async function syncArReplySessionsToConversation(input: {
  workspaceId: string;
  consumerE164: string;
  platformPhoneNumberId: string;
  conversationId: string;
}): Promise<void> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  await prisma.arSmsReplySession.updateMany({
    where: {
      workspaceId: input.workspaceId,
      consumerE164: consumer,
      platformPhoneNumberId: input.platformPhoneNumberId,
    },
    data: { conversationId: input.conversationId },
  });
}

export async function appendArConversationOutboundMessage(input: {
  conversationId: string;
  body: string;
  providerMessageId?: string | null;
}): Promise<void> {
  const text = (input.body || "").trim();
  if (!text) return;
  const prisma = getPrisma();
  const providerMessageId = input.providerMessageId?.trim() || null;
  try {
    await prisma.conversationMessage.create({
      data: {
        conversationId: input.conversationId,
        direction: "outbound",
        body: text,
        providerMessageId,
      },
    });
    await prisma.conversation.update({
      where: { id: input.conversationId },
      data: { updatedAt: new Date() },
    });
  } catch (err) {
    if (!(err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002")) {
      throw err;
    }
  }
}

export async function loadArCustomerAppointmentsSummaryForLuna(input: {
  workspaceId: string;
  contactId: string;
}): Promise<string> {
  const prisma = getPrisma();
  const now = new Date();
  const rows = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
      startsAt: { gte: new Date(now.getTime() - 7 * 86400000) },
    },
    orderBy: { startsAt: "asc" },
    take: 8,
    select: { id: true, startsAt: true, timezone: true, serviceName: true },
  });
  if (!rows.length) {
    return "No upcoming appointments on file for this customer in this workspace.";
  }
  const lines = rows.map((r) => {
    const when = r.startsAt.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: r.timezone || undefined,
    });
    return `- appointment_id=${r.id} ${r.serviceName || "Appointment"} at ${when}`;
  });
  return `Customer appointments in this workspace (use appointment_id from tools only):\n${lines.join("\n")}`;
}
