import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeMctbCallerE164 } from "@/lib/mctb/messaging/caller-e164";

export type PlatformProductSource = "mass_text" | "review_requests";

/**
 * Records (consumer, platform sender) → workspace for inbound reply routing on shared platform numbers.
 */
export async function touchPlatformProductConsumerAssignment(input: {
  workspaceId: string;
  consumerE164: string;
  platformPhoneNumberId: string;
  product: PlatformProductSource;
  conversationId?: string | null;
}): Promise<void> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  const now = new Date();
  await prisma.platformProductConsumerAssignment.upsert({
    where: {
      consumerE164_platformPhoneNumberId_product: {
        consumerE164: consumer,
        platformPhoneNumberId: input.platformPhoneNumberId,
        product: input.product,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      consumerE164: consumer,
      platformPhoneNumberId: input.platformPhoneNumberId,
      product: input.product,
      conversationId: input.conversationId ?? null,
      lastUsedAt: now,
    },
    update: {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId ?? undefined,
      lastUsedAt: now,
    },
  });
}

export async function resolveWorkspaceFromPlatformProductAssignment(input: {
  consumerE164: string;
  platformPhoneNumberId: string;
  product: PlatformProductSource;
}): Promise<{ workspaceId: string; conversationId: string | null } | null> {
  const prisma = getPrisma();
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  const row = await prisma.platformProductConsumerAssignment.findFirst({
    where: {
      consumerE164: consumer,
      platformPhoneNumberId: input.platformPhoneNumberId,
      product: input.product,
    },
    orderBy: { lastUsedAt: "desc" },
    select: { workspaceId: true, conversationId: true },
  });
  if (!row) return null;
  return { workspaceId: row.workspaceId, conversationId: row.conversationId };
}
