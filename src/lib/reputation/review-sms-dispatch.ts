import "server-only";

import { sendQuickSms } from "@/lib/sms/send-quick";
import {
  parseMassMessagingSenderMode,
  resolveSharedPlatformOutboundSender,
  type MassMessagingSenderMode,
} from "@/lib/messaging/platform-outbound-sender";
import { touchPlatformProductConsumerAssignment } from "@/lib/messaging/platform-product-consumer-assignment";
import { getPrisma } from "@/lib/db";
import { resolveMassTextSendingNumber } from "@/lib/mass-texting/messaging-registration";

export type ReviewSmsDispatchInput = {
  workspaceId: string;
  toE164: string;
  body: string;
  senderMode?: MassMessagingSenderMode;
  idempotencyKey: string;
  trackingToken?: string;
  destinationUrl?: string;
  customerName?: string;
  businessName?: string;
};

export async function dispatchReviewRequestSms(input: ReviewSmsDispatchInput) {
  const senderMode = input.senderMode ?? "WORKSPACE";
  const prisma = getPrisma();

  if (senderMode === "PLATFORM") {
    const platformRoute = await resolveSharedPlatformOutboundSender();
    if (!platformRoute?.fromE164) {
      return { ok: false as const, error: "Platform sender is not configured" };
    }
    const { PLATFORM_DISPATCH_PRIORITY_BULK } = await import(
      "@/lib/messaging/platform-dispatch/priority"
    );
    const result = await sendQuickSms({
      workspaceId: input.workspaceId,
      to: input.toE164,
      body: input.body,
      senderRoute: platformRoute,
      idempotencyKey: input.idempotencyKey,
      destinationUrl: input.destinationUrl,
      customerName: input.customerName,
      businessName: input.businessName,
      platformDispatchPriority: PLATFORM_DISPATCH_PRIORITY_BULK,
    });

    if (platformRoute.phoneNumberId) {
      const contact = await prisma.contact.findFirst({
        where: { workspaceId: input.workspaceId, phone: input.toE164 },
        select: { id: true },
      });
      if (contact) {
        const { ensureProductConversation } = await import(
          "@/lib/mass-texting/conversation-context"
        );
        const conv = await ensureProductConversation({
          workspaceId: input.workspaceId,
          contactId: contact.id,
          productSource: "mass_text",
          phoneNumberId: platformRoute.phoneNumberId,
          fromE164: platformRoute.fromE164,
        });
        await touchPlatformProductConsumerAssignment({
          workspaceId: input.workspaceId,
          consumerE164: input.toE164,
          platformPhoneNumberId: platformRoute.phoneNumberId,
          product: "review_requests",
          conversationId: conv.conversationId,
        });
      }
    }

    return { ok: true as const, messageSid: result.sid, trackingToken: result.trackingToken };
  }

  const sender = await resolveMassTextSendingNumber(input.workspaceId);
  if (!sender?.phoneE164) {
    return { ok: false as const, error: "Workspace SMS sender is not configured" };
  }

  const result = await sendQuickSms({
    workspaceId: input.workspaceId,
    to: input.toE164,
    body: input.body,
    from: sender.phoneE164,
    idempotencyKey: input.idempotencyKey,
    destinationUrl: input.destinationUrl,
    customerName: input.customerName,
    businessName: input.businessName,
  });

  return { ok: true as const, messageSid: result.sid, trackingToken: result.trackingToken };
}

export { parseMassMessagingSenderMode };
