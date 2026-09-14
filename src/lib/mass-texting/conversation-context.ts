import "server-only";

import { getPrisma } from "@/lib/db";
import type { MassTextConversationProductSource } from "@/lib/mass-texting/constants";
import {
  appProductSourceToPrisma,
  inferInboundProductSource,
} from "@/lib/mass-texting/product-source";

export type EnsureConversationInput = {
  workspaceId: string;
  contactId: string;
  productSource: MassTextConversationProductSource;
  phoneNumberId?: string | null;
  fromE164?: string | null;
  campaignId?: string | null;
  missedCallEventId?: string | null;
};

export async function ensureProductConversation(
  input: EnsureConversationInput,
): Promise<{ conversationId: string }> {
  const prisma = getPrisma();
  const productSource = appProductSourceToPrisma(input.productSource);

  const openMatches = await prisma.conversation.findMany({
    where: {
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      status: { not: "CLOSED" },
      ...(input.phoneNumberId ? { phoneNumberId: input.phoneNumberId } : {}),
      ...(input.productSource ? { productSource } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 1,
  });

  let conversation = openMatches[0] ?? null;
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        status: "OPEN",
        unread: true,
        productSource,
        phoneNumberId: input.phoneNumberId ?? null,
        fromE164: input.fromE164 ?? null,
        campaignId: input.campaignId ?? null,
        missedCallEventId: input.missedCallEventId ?? null,
      },
    });
    return { conversationId: conversation.id };
  }

  const patch: Record<string, unknown> = {};
  if (!conversation.productSource) patch.productSource = productSource;
  if (!conversation.phoneNumberId && input.phoneNumberId) patch.phoneNumberId = input.phoneNumberId;
  if (!conversation.fromE164 && input.fromE164) patch.fromE164 = input.fromE164;
  if (!conversation.campaignId && input.campaignId) patch.campaignId = input.campaignId;
  if (!conversation.missedCallEventId && input.missedCallEventId) {
    patch.missedCallEventId = input.missedCallEventId;
  }
  if (Object.keys(patch).length) {
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: patch,
    });
  }

  return { conversationId: conversation.id };
}

export async function resolvePhoneForInbound(workspaceId: string, toE164: string) {
  const prisma = getPrisma();
  return prisma.phoneNumber.findFirst({
    where: {
      workspaceId,
      e164: toE164,
      status: "Active",
    },
    select: {
      id: true,
      workspaceId: true,
      e164: true,
      settingsJson: true,
    },
  });
}

export async function resolveInboundConversation(input: {
  workspaceId: string;
  contactId: string;
  toE164: string;
  fromE164?: string;
}): Promise<{
  conversationId: string;
  productSource: MassTextConversationProductSource;
  phoneNumberId?: string;
  campaignId?: string;
}> {
  const prisma = getPrisma();
  const phone = await resolvePhoneForInbound(input.workspaceId, input.toE164);

  let campaignId: string | null = null;
  let campaignProductSource: MassTextConversationProductSource | null = null;
  if (input.fromE164) {
    const recentRecipient = await prisma.campaignRecipient.findFirst({
      where: {
        workspaceId: input.workspaceId,
        phone: input.fromE164,
        workflowStatus: { in: ["pending", "scheduled", "in_progress", "waiting", "completed"] },
      },
      orderBy: { enrolledAt: "desc" },
      select: { campaignId: true, campaign: { select: { configJson: true } } },
    });
    campaignId = recentRecipient?.campaignId ?? null;
    const config =
      recentRecipient?.campaign?.configJson &&
      typeof recentRecipient.campaign.configJson === "object"
        ? (recentRecipient.campaign.configJson as Record<string, unknown>)
        : {};
    if (config.productSource === "mass_text" || config.massTexting === true) {
      campaignProductSource = "mass_text";
    }
  }

  let productSource = inferInboundProductSource({
    phoneSettingsJson: phone?.settingsJson,
    campaignId,
    campaignProductSource,
  });

  if (input.fromE164) {
    const { isMctbCustomerReplyThread } = await import(
      "@/lib/agents/missed-call-text-back/customer-sms"
    );
    if (await isMctbCustomerReplyThread(input.workspaceId, input.fromE164)) {
      productSource = "mctb";
    }
  }

  const { conversationId } = await ensureProductConversation({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    productSource,
    phoneNumberId: phone?.id ?? null,
    fromE164: phone?.e164 ?? input.toE164,
    campaignId,
  });

  return {
    conversationId,
    productSource,
    phoneNumberId: phone?.id,
    campaignId: campaignId ?? undefined,
  };
}

export async function inferProductFromInboundPhone(phone: {
  settingsJson: unknown;
}): Promise<MassTextConversationProductSource> {
  return inferInboundProductSource({ phoneSettingsJson: phone.settingsJson });
}
