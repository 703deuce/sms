/**
 * Keyword opt-in / automation runtime.
 */

import { getPrisma } from "@/lib/db";
import { enrollContactInCampaign } from "@/lib/campaigns/enroll-campaign";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function handleKeywordInbound(input: {
  workspaceId: string;
  from: string;
  to: string;
  body: string;
}): Promise<{ matched: boolean; replyText?: string; keyword?: string }> {
  const prisma = getPrisma();
  const word = (input.body || "").trim().split(/\s+/)[0]?.toUpperCase() || "";
  if (!word || ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "START", "YES", "UNSTOP", "HELP", "INFO"].includes(word)) {
    return { matched: false };
  }

  let to = input.to;
  try {
    to = normalizeE164(input.to);
  } catch {
    // keep
  }

  const keyword = await prisma.keyword.findFirst({
    where: {
      workspaceId: input.workspaceId,
      status: "Active",
      keyword: { equals: word, mode: "insensitive" },
      OR: [{ phoneNumber: to }, { phoneNumber: input.to }, { phoneNumber: "*" }],
    },
  });
  if (!keyword) return { matched: false };

  let from = input.from;
  try {
    from = normalizeE164(input.from);
  } catch {
    // keep
  }

  let contact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: from } },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId: input.workspaceId,
        phone: from,
        status: "SUBSCRIBED",
        consentSource: `keyword:${keyword.keyword}`,
        consentDate: new Date(),
      },
    });
  } else if (contact.status !== "SUBSCRIBED") {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { status: "SUBSCRIBED", consentSource: `keyword:${keyword.keyword}`, consentDate: new Date() },
    });
  }

  await prisma.consentRecord.create({
    data: {
      workspaceId: input.workspaceId,
      contactId: contact.id,
      phone: from,
      consentDate: new Date(),
      source: `keyword:${keyword.keyword}`,
      disclosureVersion: "keyword-v1",
      disclosureText: keyword.confirmation,
    },
  });

  // Ensure list membership when listName is set
  if (keyword.listName) {
    let list = await prisma.contactList.findFirst({
      where: { workspaceId: input.workspaceId, name: keyword.listName },
    });
    if (!list) {
      list = await prisma.contactList.create({
        data: { workspaceId: input.workspaceId, name: keyword.listName },
      });
    }
    try {
      await prisma.contactListMember.create({
        data: { listId: list.id, contactId: contact.id },
      });
    } catch {
      // already a member
    }
  }

  const tags = Array.isArray(keyword.tagsJson) ? (keyword.tagsJson as string[]) : [];
  for (const tagName of tags) {
    if (!tagName) continue;
    let tag = await prisma.tag.findFirst({
      where: { workspaceId: input.workspaceId, name: String(tagName) },
    });
    if (!tag) {
      tag = await prisma.tag.create({
        data: { workspaceId: input.workspaceId, name: String(tagName) },
      });
    }
    try {
      await prisma.contactTag.create({ data: { tagId: tag.id, contactId: contact.id } });
    } catch {
      // already tagged
    }
  }

  if (keyword.startCampaignId) {
    try {
      await enrollContactInCampaign({
        workspaceId: input.workspaceId,
        campaignId: keyword.startCampaignId,
        phone: from,
        contactId: contact.id,
        metadata: { source: "keyword", keyword: keyword.keyword },
      });
    } catch (err) {
      console.error("[keyword] enroll failed", err);
    }
  }

  await prisma.keyword.update({
    where: { id: keyword.id },
    data: { subscribers: { increment: 1 } },
  });

  return {
    matched: true,
    keyword: keyword.keyword,
    replyText: keyword.autoReply || keyword.confirmation || undefined,
  };
}
