import "server-only";

import { getPrisma } from "@/lib/db";
import { resolveMassTextInboundFromPlatformAssignment } from "@/lib/messaging/resolve-mass-text-platform-inbound";
import { resolveWorkspaceFromPlatformProductAssignment } from "@/lib/messaging/platform-product-consumer-assignment";
import { normalizeMctbCallerE164 } from "@/lib/mctb/messaging/caller-e164";

export async function routePlatformMassTextOrReviewInbound(input: {
  consumerE164: string;
  platformPhoneNumberId: string;
  body: string;
  provider: "twilio" | "telnyx";
  providerMessageId: string;
}):
  | { status: "matched"; workspaceId: string; product: "mass_text" | "review_requests"; conversationId: string | null }
  | { status: "ambiguous"; workspaceIds: string[] }
  | { status: "unmatched" } {
  const mass = await resolveMassTextInboundFromPlatformAssignment({
    consumerE164: input.consumerE164,
    platformPhoneNumberId: input.platformPhoneNumberId,
  });
  if (mass.status === "ambiguous") {
    return { status: "ambiguous", workspaceIds: mass.workspaceIds };
  }
  if (mass.status === "matched") {
    return {
      status: "matched",
      workspaceId: mass.workspaceId,
      product: "mass_text",
      conversationId: mass.conversationId,
    };
  }

  const review = await resolveWorkspaceFromPlatformProductAssignment({
    consumerE164: input.consumerE164,
    platformPhoneNumberId: input.platformPhoneNumberId,
    product: "review_requests",
  });
  if (review) {
    return {
      status: "matched",
      workspaceId: review.workspaceId,
      product: "review_requests",
      conversationId: review.conversationId,
    };
  }

  return { status: "unmatched" };
}

export async function persistPlatformProductInboundMessage(input: {
  workspaceId: string;
  product: "mass_text" | "review_requests";
  consumerE164: string;
  platformPhoneNumberId: string;
  body: string;
  providerMessageId: string;
  conversationId?: string | null;
}): Promise<{ conversationId: string }> {
  const prisma = getPrisma();
  const phone = normalizeMctbCallerE164(input.consumerE164);
  let contact = await prisma.contact.findFirst({
    where: { workspaceId: input.workspaceId, phone },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId: input.workspaceId,
        phone,
        firstName: "Unknown",
        lastName: "",
        status: "SUBSCRIBED",
      },
    });
  }

  let conversationId = input.conversationId;
  if (!conversationId) {
    const open = await prisma.conversation.findFirst({
      where: {
        workspaceId: input.workspaceId,
        contactId: contact.id,
        status: { not: "CLOSED" },
        phoneNumberId: input.platformPhoneNumberId,
      },
      orderBy: { updatedAt: "desc" },
    });
    conversationId =
      open?.id ??
      (
        await prisma.conversation.create({
          data: {
            workspaceId: input.workspaceId,
            contactId: contact.id,
            status: "OPEN",
            unread: true,
            productSource:
              input.product === "review_requests" ? "REVIEW_REQUESTS" : "MASS_TEXT",
            phoneNumberId: input.platformPhoneNumberId,
            fromE164: phone,
          },
        })
      ).id;
  }

  if (input.product === "review_requests") {
    const { storeReviewReply } = await import("@/lib/reputation/reply-store");
    await storeReviewReply({
      organizationId: input.workspaceId,
      businessId: input.workspaceId,
      channel: "sms",
      body: input.body,
      fromAddress: phone,
      providerSid: input.providerMessageId,
      metadata: { platformInbound: true },
    }).catch(() => undefined);
  }

  await prisma.conversationMessage.create({
    data: {
      conversationId,
      direction: "inbound",
      body: input.body,
      providerMessageId: input.providerMessageId,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { unread: true, updatedAt: new Date() },
  });

  return { conversationId };
}
