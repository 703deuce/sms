import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import {
  releasePlatformSenderAssignment,
  type MctbPlatformSenderReleaseReason,
} from "@/lib/mctb/messaging/platform-sender-assignment";

export async function maybeReleasePlatformAssignmentForConversation(input: {
  workspaceId: string;
  conversationId: string;
  releaseReason: MctbPlatformSenderReleaseReason;
}) {
  const prisma = getPrisma();
  const config = await loadMissedCallTextConfig(input.workspaceId);
  if (config.senderMode !== "PLATFORM") return;

  const platform = await resolveCanonicalMctbPlatformSender();
  if (!platform) return;

  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, workspaceId: input.workspaceId },
    select: { contact: { select: { phone: true } } },
  });
  const phone = conversation?.contact?.phone;
  if (!phone) return;

  await releasePlatformSenderAssignment({
    workspaceId: input.workspaceId,
    consumerE164: phone,
    platformPhoneNumberId: platform.phoneNumberId,
    conversationId: input.conversationId,
    releaseReason: input.releaseReason,
  });
}
