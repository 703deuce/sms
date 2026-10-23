import { getPrisma } from "@/lib/server/db";
import { parseCampaignAdvanced } from "./campaign-advanced";
import { sortCampaignQueueMembers } from "./queue-order";
import { loadCampaignEligibilityContext, evaluateListMemberEligibility } from "./campaign-eligibility-helpers";
import { loadCampaignAttemptMap } from "./campaign-rollups";
import { reasonToUserMessage } from "./eligibility";

export async function listCampaignQueue(
  workspaceId: string,
  campaignId: string,
  limit = 100,
) {
  const prisma = getPrisma();
  const campaign = await prisma.powerDialerCampaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) throw new Error("Campaign not found");

  const members = await prisma.contactListMember.findMany({
    where: { listId: campaign.listId },
    include: { contact: true },
    take: 5000,
  });

  const ctx = await loadCampaignEligibilityContext(campaign);
  const advanced = parseCampaignAdvanced(campaign.configJson);
  const sorted = sortCampaignQueueMembers(
    members.map((m) => ({
      member: m,
      contactId: m.contactId,
      dialPriority: m.dialPriority,
      queueSortOrder: m.queueSortOrder,
      createdAt: m.contact.createdAt,
    })),
    advanced,
  );

  const contactIds = sorted.map((r) => r.contactId);
  const attemptMap = await loadCampaignAttemptMap(workspaceId, campaignId, contactIds);
  const now = new Date();

  const rows = [];
  for (const row of sorted) {
    if (rows.length >= limit) break;
    const m = row.member;
    const attempts = attemptMap.get(m.contactId) || [];
    const eligibility = await evaluateListMemberEligibility({
      workspaceId,
      campaign,
      contact: m.contact,
      campaignAttempts: attempts,
      sessionAttempts: [],
      now,
      ctx,
      sessionActive: campaign.status === "active",
      sessionPaused: campaign.status === "paused",
    });
    rows.push({
      memberId: m.id,
      contactId: m.contactId,
      name: [m.contact.firstName, m.contact.lastName].filter(Boolean).join(" ") || "Unknown",
      phone: m.contact.phone,
      dialPriority: m.dialPriority,
      queueSortOrder: m.queueSortOrder,
      eligible: eligibility.eligible,
      bucket: eligibility.bucket,
      reason: eligibility.reason,
      reasonLabel: reasonToUserMessage(eligibility.reason),
    });
  }

  return {
    dialOrder: advanced.dialOrder || "fifo",
    rows,
    total: members.length,
  };
}

export async function patchCampaignQueue(
  workspaceId: string,
  campaignId: string,
  body: {
    reorder?: { contactId: string; queueSortOrder: number }[];
    setPriority?: { contactId: string; dialPriority: number }[];
    skipContactId?: string;
  },
) {
  const prisma = getPrisma();
  const campaign = await prisma.powerDialerCampaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) throw new Error("Campaign not found");

  if (body.reorder?.length) {
    for (const item of body.reorder) {
      await prisma.contactListMember.updateMany({
        where: { listId: campaign.listId, contactId: item.contactId },
        data: { queueSortOrder: item.queueSortOrder },
      });
    }
  }
  if (body.setPriority?.length) {
    for (const item of body.setPriority) {
      await prisma.contactListMember.updateMany({
        where: { listId: campaign.listId, contactId: item.contactId },
        data: { dialPriority: item.dialPriority },
      });
    }
  }
  if (body.skipContactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: body.skipContactId, workspaceId },
    });
    if (!contact) throw new Error("Contact not found");
    const cf =
      contact.customFields && typeof contact.customFields === "object"
        ? { ...(contact.customFields as object) }
        : {};
    await prisma.contact.update({
      where: { id: body.skipContactId },
      data: {
        customFields: {
          ...cf,
          powerDialerRemovedFromQueueAt: new Date().toISOString(),
        },
      },
    });
  }
  return { ok: true };
}
