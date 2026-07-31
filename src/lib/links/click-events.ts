import { getPrisma } from "@/lib/db";

export async function recordLinkClick(input: {
  workspaceId: string;
  trackingToken: string;
  contactId?: string | null;
  phone?: string | null;
  campaignId?: string | null;
  messageId?: string | null;
  campaignMessageId?: string | null;
  destinationUrl?: string | null;
  userAgent?: string | null;
}) {
  const prisma = getPrisma();
  return prisma.linkClickEvent.create({
    data: {
      workspaceId: input.workspaceId,
      trackingToken: input.trackingToken,
      contactId: input.contactId || null,
      phone: input.phone || null,
      campaignId: input.campaignId || null,
      messageId: input.messageId || null,
      campaignMessageId: input.campaignMessageId || null,
      destinationUrl: input.destinationUrl || null,
      userAgent: input.userAgent || null,
    },
  });
}

export async function loadLinkClickReport(workspaceId: string, days = 30) {
  const prisma = getPrisma();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const clicks = await prisma.linkClickEvent.findMany({
    where: { workspaceId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const byCampaign: Record<string, number> = {};
  const byContact: Record<string, number> = {};
  for (const c of clicks) {
    const camp = c.campaignId || "direct";
    byCampaign[camp] = (byCampaign[camp] || 0) + 1;
    const who = c.contactId || c.phone || "unknown";
    byContact[who] = (byContact[who] || 0) + 1;
  }

  return {
    totalClicks: clicks.length,
    uniqueContacts: Object.keys(byContact).length,
    byCampaign,
    recent: clicks.slice(0, 50).map((c: {
      id: string;
      phone: string | null;
      contactId: string | null;
      campaignId: string | null;
      destinationUrl: string | null;
      createdAt: Date;
    }) => ({
      id: c.id,
      phone: c.phone,
      contactId: c.contactId,
      campaignId: c.campaignId,
      destinationUrl: c.destinationUrl,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}
