import { getPrisma } from "@/lib/server/db";
import { buildCallbackTabWhere, type CallbackTab } from "./callback-tab-filters";

export type { CallbackTab };

export async function listPowerDialerCallbacksV2(workspaceId: string, tab: CallbackTab) {
  const prisma = getPrisma();
  const where = buildCallbackTabWhere(workspaceId, tab);

  const rows = await prisma.powerDialerCallback.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    take: 200,
    include: {
      contact: { select: { firstName: true, lastName: true, phone: true, company: true, status: true } },
      campaign: { select: { id: true, name: true, timezone: true } },
    },
  });

  return rows.map((c) => ({
    id: c.id,
    callbackAt: c.scheduledAt.toISOString(),
    disposition: c.disposition,
    notes: c.notes,
    status: c.status,
    contactId: c.contactId,
    contactName: [c.contact.firstName, c.contact.lastName].filter(Boolean).join(" ") || "Unknown",
    contactPhone: c.contact.phone,
    company: c.contact.company,
    contactStatus: c.contact.status,
    campaignId: c.campaignId,
    campaignName: c.campaign.name,
    timezone: c.timezone || c.campaign.timezone,
    assignedUserId: c.assignedUserId,
    visibility: c.visibility,
    priority: c.priority,
    source: c.source,
    routingPool: c.routingPool,
    overdue: c.status === "scheduled" && c.scheduledAt < new Date(),
  }));
}

export async function upsertCallbackFromDisposition(input: {
  workspaceId: string;
  campaignId: string;
  contactId: string;
  attemptId: string;
  scheduledAt: Date;
  timezone: string;
  notes?: string;
  disposition?: string;
  assignedUserId?: string;
  visibility?: string;
  priority?: number;
  source?: string;
  routingPool?: string;
}) {
  const prisma = getPrisma();
  const existing = await prisma.powerDialerCallback.findFirst({
    where: { attemptId: input.attemptId },
  });
  if (existing) {
    return prisma.powerDialerCallback.update({
      where: { id: existing.id },
      data: {
        scheduledAt: input.scheduledAt,
        timezone: input.timezone,
        notes: input.notes,
        disposition: input.disposition,
        status: "scheduled",
        assignedUserId: input.assignedUserId,
        visibility: input.visibility,
        priority: input.priority,
        source: input.source,
        routingPool: input.routingPool,
      },
    });
  }
  return prisma.powerDialerCallback.create({
    data: {
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      contactId: input.contactId,
      attemptId: input.attemptId,
      scheduledAt: input.scheduledAt,
      timezone: input.timezone,
      notes: input.notes,
      disposition: input.disposition,
      assignedUserId: input.assignedUserId,
      status: "scheduled",
      visibility: input.visibility || "personal",
      priority: input.priority ?? 0,
      source: input.source,
      routingPool: input.routingPool,
    },
  });
}

export async function countCallbacksDue(workspaceId: string) {
  const prisma = getPrisma();
  const now = new Date();
  return prisma.powerDialerCallback.count({
    where: {
      workspaceId,
      status: "scheduled",
      scheduledAt: { lte: now },
    },
  });
}
