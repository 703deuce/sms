import "server-only";

import { getPrisma } from "@/lib/server/db";

export type HeldInboundCandidateContext = {
  product: "mctb";
  workspaceId: string;
  assignmentId?: string;
  conversationId?: string;
};

export async function persistPlatformInboundHeldMessage(input: {
  providerMessageId: string;
  channel: "twilio" | "telnyx";
  fromE164: string;
  toE164: string;
  platformPhoneNumberId?: string;
  body: string;
  holdReason: string;
  candidateContexts: HeldInboundCandidateContext[];
  workspaceId?: string | null;
}): Promise<{ id: string }> {
  const prisma = getPrisma();
  const workspaceId =
    input.workspaceId ??
    (input.candidateContexts.length === 1 ? input.candidateContexts[0]!.workspaceId : null);

  const row = await prisma.arSmsInboundHeldMessage.upsert({
    where: { providerMessageId: input.providerMessageId },
    create: {
      workspaceId,
      providerMessageId: input.providerMessageId,
      channel: input.channel,
      fromE164: input.fromE164,
      toE164: input.toE164,
      platformPhoneNumberId: input.platformPhoneNumberId ?? null,
      bodyPreview: input.body.slice(0, 500),
      holdReason: input.holdReason,
      candidateContexts: input.candidateContexts as object,
      state: "HELD",
    },
    update: {
      holdReason: input.holdReason,
      candidateContexts: input.candidateContexts as object,
      bodyPreview: input.body.slice(0, 500),
      updatedAt: new Date(),
    },
  });
  return { id: row.id };
}
