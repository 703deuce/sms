import "server-only";

import { getPrisma } from "@/lib/db";
import type { ArPlatformSmsInboundReceiptState } from "@/lib/domain";

export type RecordPlatformInboundReceiptInput = {
  providerMessageId: string;
  channel: "twilio" | "telnyx";
  fromE164: string;
  toE164: string;
  platformPhoneNumberId?: string;
  body: string;
};

export async function recordArPlatformSmsInboundReceipt(
  input: RecordPlatformInboundReceiptInput,
): Promise<{ id: string; created: boolean }> {
  const prisma = getPrisma();
  const providerMessageId = input.providerMessageId.trim();
  const existing = await prisma.arPlatformSmsInboundReceipt.findUnique({
    where: { providerMessageId },
    select: { id: true },
  });
  if (existing) {
    return { id: existing.id, created: false };
  }
  const row = await prisma.arPlatformSmsInboundReceipt.create({
    data: {
      providerMessageId,
      channel: input.channel,
      fromE164: input.fromE164,
      toE164: input.toE164,
      platformPhoneNumberId: input.platformPhoneNumberId ?? null,
      bodyPreview: input.body.slice(0, 500),
      state: "RECEIVED",
    },
    select: { id: true },
  });
  return { id: row.id, created: true };
}

export async function patchArPlatformSmsInboundReceipt(
  providerMessageId: string,
  patch: {
    state?: ArPlatformSmsInboundReceiptState;
    routingResolution?: string;
    replySessionId?: string | null;
    conversationId?: string | null;
    processInboundJobId?: string | null;
    outboundMessageId?: string | null;
    holdReason?: string | null;
    lastError?: string | null;
  },
) {
  const prisma = getPrisma();
  await prisma.arPlatformSmsInboundReceipt.updateMany({
    where: { providerMessageId },
    data: {
      ...patch,
      updatedAt: new Date(),
    },
  });
}
