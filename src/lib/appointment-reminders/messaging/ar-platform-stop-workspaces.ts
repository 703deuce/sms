import "server-only";

import { getPrisma } from "@/lib/db";
import { mctbCallerE164Variants, normalizeMctbCallerE164 } from "@/lib/mctb/messaging/caller-e164";

const OUTBOUND_PROOF_OR = [
  { lastOutboundProviderMessageId: { not: null } },
  { lastOutboundMessageId: { not: null } },
] as const;

/** Workspaces with a recent AR reminder thread on this platform sender (STOP resolution). */
export async function listArWorkspaceIdsForPlatformStop(input: {
  consumerE164: string;
  platformPhoneNumberId: string;
}): Promise<string[]> {
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  const prisma = getPrisma();

  const assignmentRows = await prisma.arSmsConsumerPlatformSenderAssignment.findMany({
    where: {
      consumerE164: consumer,
      platformPhoneNumberId: input.platformPhoneNumberId,
    },
    select: { workspaceId: true },
    distinct: ["workspaceId"],
  });

  const sessionRows = await prisma.arSmsReplySession.findMany({
    where: {
      consumerE164: consumer,
      platformPhoneNumberId: input.platformPhoneNumberId,
      OR: [...OUTBOUND_PROOF_OR],
    },
    select: { workspaceId: true },
    distinct: ["workspaceId"],
  });

  const contactWorkspaces = await prisma.contact.findMany({
    where: { phone: { in: mctbCallerE164Variants(input.consumerE164) } },
    select: { workspaceId: true },
    distinct: ["workspaceId"],
  });

  const convoWorkspaces = await prisma.conversation.findMany({
    where: {
      contact: { phone: { in: mctbCallerE164Variants(input.consumerE164) } },
      productSource: "APPOINTMENT_REMINDERS",
      phoneNumberId: input.platformPhoneNumberId,
    },
    select: { workspaceId: true },
    distinct: ["workspaceId"],
  });

  return [
    ...new Set([
      ...assignmentRows.map((r) => r.workspaceId),
      ...sessionRows.map((r) => r.workspaceId),
      ...convoWorkspaces.map((r) => r.workspaceId),
      // Fallback when contact exists but conversation not tagged yet
      ...contactWorkspaces.map((r) => r.workspaceId),
    ]),
  ];
}
