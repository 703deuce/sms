import { getPrisma } from "@/lib/server/db";

export type AiCallbackSource = "ai_receptionist_missed" | "ai_after_hours" | "ai_qualified_lead";

/** M74 — create power-dialer callback from AI receptionist / voice context. */
export async function createCallbackFromAiReceptionist(input: {
  workspaceId: string;
  campaignId: string;
  contactId: string;
  scheduledAt: Date;
  timezone?: string;
  notes?: string;
  source: AiCallbackSource;
  assignedUserId?: string;
  routingPool?: string;
  priority?: number;
}) {
  const prisma = getPrisma();
  const campaign = await prisma.powerDialerCampaign.findFirst({
    where: { id: input.campaignId, workspaceId: input.workspaceId },
  });
  if (!campaign) throw new Error("Campaign not found");

  return prisma.powerDialerCallback.create({
    data: {
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      contactId: input.contactId,
      scheduledAt: input.scheduledAt,
      timezone: input.timezone || campaign.timezone,
      notes: input.notes,
      status: "scheduled",
      assignedUserId: input.assignedUserId,
      visibility: input.assignedUserId ? "personal" : "team",
      source: input.source,
      routingPool: input.routingPool,
      priority: input.priority ?? 2,
      disposition: "AI callback",
    },
  });
}

export async function enrollAiLeadInCampaign(input: {
  workspaceId: string;
  campaignId: string;
  contactId: string;
  source: AiCallbackSource;
}) {
  const prisma = getPrisma();
  const campaign = await prisma.powerDialerCampaign.findFirst({
    where: { id: input.campaignId, workspaceId: input.workspaceId },
  });
  if (!campaign) throw new Error("Campaign not found");
  const member = await prisma.contactListMember.findFirst({
    where: { listId: campaign.listId, contactId: input.contactId },
  });
  if (!member) {
    await prisma.contactListMember.create({
      data: { listId: campaign.listId, contactId: input.contactId },
    });
  }
  const cf =
    (await prisma.contact.findFirst({
      where: { id: input.contactId },
      select: { customFields: true },
    }))?.customFields;
  const base = cf && typeof cf === "object" ? (cf as Record<string, unknown>) : {};
  await prisma.contact.update({
    where: { id: input.contactId },
    data: {
      customFields: {
        ...base,
        powerDialerAiLeadSource: input.source,
        powerDialerAiEnrolledAt: new Date().toISOString(),
      },
    },
  });
  return { ok: true, campaignId: input.campaignId };
}
