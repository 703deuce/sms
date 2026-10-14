import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeMctbCallerE164 } from "@/lib/mctb/messaging/caller-e164";
import { resolveWorkspaceFromPlatformProductAssignment } from "@/lib/messaging/platform-product-consumer-assignment";

export async function resolveMassTextInboundFromPlatformAssignment(input: {
  consumerE164: string;
  platformPhoneNumberId: string;
}): Promise<
  | { status: "matched"; workspaceId: string; conversationId: string | null }
  | { status: "unmatched" }
  | { status: "ambiguous"; workspaceIds: string[] }
> {
  const consumer = normalizeMctbCallerE164(input.consumerE164);
  const prisma = getPrisma();

  const assignment = await resolveWorkspaceFromPlatformProductAssignment({
    consumerE164: consumer,
    platformPhoneNumberId: input.platformPhoneNumberId,
    product: "mass_text",
  });
  if (assignment) {
    return {
      status: "matched",
      workspaceId: assignment.workspaceId,
      conversationId: assignment.conversationId,
    };
  }

  const recent = await prisma.campaignMessage.findMany({
    where: {
      to: consumer,
      status: { in: ["sent", "delivered", "clicked"] },
      sentAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    },
    select: { workspaceId: true },
    distinct: ["workspaceId"],
    take: 5,
  });
  const workspaceIds = recent.map((r) => r.workspaceId);
  if (workspaceIds.length === 1) {
    return { status: "matched", workspaceId: workspaceIds[0]!, conversationId: null };
  }
  if (workspaceIds.length > 1) {
    return { status: "ambiguous", workspaceIds };
  }
  return { status: "unmatched" };
}
