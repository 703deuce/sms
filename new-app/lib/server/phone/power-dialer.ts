import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import {
  mergePowerDialerSettings,
  type PowerDialerWorkspaceSettings,
} from "@/lib/products/power-dialer";

export async function listCampaigns(workspaceId: string) {
  const prisma = getPrisma();
  const rows = await prisma.powerDialerCampaign.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    include: { list: { select: { name: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    listId: c.listId,
    listName: c.list.name,
    callerId: c.callerIdE164,
    status: c.status,
    completedPct: c.totalContacts
      ? Math.round((c.completedCount / c.totalContacts) * 100)
      : 0,
    attempts: c.attemptedCount,
    owner: "Operator",
    created: c.createdAt.toISOString(),
    maxAttempts: (c.configJson as { maxAttempts?: number })?.maxAttempts ?? 3,
    config: c.configJson,
  }));
}

export async function createCampaign(
  workspaceId: string,
  input: {
    name: string;
    description?: string;
    listId: string;
    callerIdE164: string;
    timezone?: string;
    configJson?: Record<string, unknown>;
  },
) {
  const prisma = getPrisma();
  const callerIdE164 = normalizeE164(input.callerIdE164);
  const members = await prisma.contactListMember.count({ where: { listId: input.listId } });
  return prisma.powerDialerCampaign.create({
    data: {
      workspaceId,
      name: input.name,
      description: input.description,
      listId: input.listId,
      callerIdE164,
      timezone: input.timezone || "America/Chicago",
      configJson: (input.configJson || {}) as import("@prisma/client").Prisma.InputJsonValue,
      totalContacts: members,
      status: "draft",
    },
  });
}

export async function updateCampaign(
  workspaceId: string,
  id: string,
  patch: Partial<{
    name: string;
    description: string;
    status: string;
    configJson: Record<string, unknown>;
  }>,
) {
  const prisma = getPrisma();
  const { configJson, ...rest } = patch;
  return prisma.powerDialerCampaign.updateMany({
    where: { id, workspaceId },
    data: {
      ...rest,
      ...(configJson !== undefined
        ? { configJson: configJson as import("@prisma/client").Prisma.InputJsonValue }
        : {}),
    },
  });
}

export async function startSession(workspaceId: string, campaignId: string) {
  const prisma = getPrisma();
  const campaign = await prisma.powerDialerCampaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) throw new Error("Campaign not found");

  const active = await prisma.powerDialerSession.findFirst({
    where: { campaignId, status: { in: ["active", "paused"] } },
  });
  if (active) return active;

  return prisma.powerDialerSession.create({
    data: {
      workspaceId,
      campaignId,
      status: "active",
    },
  });
}

export async function pauseSession(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  return prisma.powerDialerSession.updateMany({
    where: { id: sessionId, workspaceId },
    data: { status: "paused", pausedAt: new Date() },
  });
}

export async function resumeSession(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  return prisma.powerDialerSession.updateMany({
    where: { id: sessionId, workspaceId },
    data: { status: "active", pausedAt: null },
  });
}

export async function endSession(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  return prisma.powerDialerSession.updateMany({
    where: { id: sessionId, workspaceId },
    data: { status: "completed", endedAt: new Date() },
  });
}

export async function getNextEligibleContact(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: { campaign: true },
  });
  if (!session) throw new Error("Session not found");
  if (session.status === "paused") throw new Error("Session is paused");

  const maxAttempts = (session.campaign.configJson as { maxAttempts?: number })?.maxAttempts ?? 3;
  const members = await prisma.contactListMember.findMany({
    where: { listId: session.campaign.listId },
    include: { contact: true },
  });

  const attempted = await prisma.powerDialerAttempt.findMany({
    where: { sessionId },
    select: { contactId: true, attemptNumber: true, status: true },
  });
  const attemptCount = new Map<string, number>();
  for (const a of attempted) {
    attemptCount.set(a.contactId, Math.max(attemptCount.get(a.contactId) || 0, a.attemptNumber));
  }

  for (const m of members) {
    const count = attemptCount.get(m.contactId) || 0;
    if (count >= maxAttempts) continue;
    const blocked = m.contact.status === "UNSUBSCRIBED" || m.contact.status === "BLOCKED";
    if (blocked) continue;
    const pending = attempted.some((a) => a.contactId === m.contactId && a.status === "dialing");
    if (pending) continue;
    return {
      contact: m.contact,
      attemptNumber: count + 1,
      campaign: session.campaign,
      sessionId: session.id,
    };
  }
  return null;
}

export async function createAttempt(
  workspaceId: string,
  sessionId: string,
  contactId: string,
  attemptNumber: number,
) {
  const prisma = getPrisma();
  return prisma.powerDialerAttempt.create({
    data: {
      workspaceId,
      sessionId,
      contactId,
      attemptNumber,
      status: "pending",
    },
  });
}

export async function listSessionAttempts(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  const rows = await prisma.powerDialerAttempt.findMany({
    where: { sessionId, workspaceId },
    include: {
      contact: { select: { firstName: true, lastName: true, phone: true, company: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((a) => ({
    id: a.id,
    disposition: a.disposition,
    notes: a.notes,
    status: a.status,
    attemptNumber: a.attemptNumber,
    createdAt: a.createdAt.toISOString(),
    contactName: [a.contact.firstName, a.contact.lastName].filter(Boolean).join(" ") || "Unknown",
    contactPhone: a.contact.phone,
  }));
}

export async function getSession(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  return prisma.powerDialerSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: { campaign: { include: { list: { select: { name: true } } } } },
  });
}

export async function saveAttemptOutcome(
  workspaceId: string,
  attemptId: string,
  input: { disposition: string; notes?: string; callbackAt?: string | null },
) {
  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: attemptId, workspaceId },
    include: { session: { include: { campaign: true } } },
  });
  if (!attempt) throw new Error("Attempt not found");

  await prisma.powerDialerAttempt.update({
    where: { id: attemptId },
    data: {
      disposition: input.disposition,
      notes: input.notes,
      callbackAt: input.callbackAt ? new Date(input.callbackAt) : null,
      status: "completed",
      endedAt: new Date(),
    },
  });

  const dnc =
    input.disposition.toLowerCase().includes("do not call") ||
    input.disposition.toLowerCase() === "dnc";
  if (dnc) {
    await prisma.contact.updateMany({
      where: { id: attempt.contactId, workspaceId },
      data: { status: "BLOCKED" },
    });
  }

  const campaign = attempt.session.campaign;
  await prisma.powerDialerCampaign.update({
    where: { id: campaign.id },
    data: {
      attemptedCount: { increment: 1 },
      connectedCount:
        input.disposition === "Booked" || input.disposition === "Interested"
          ? { increment: 1 }
          : undefined,
      completedCount: { increment: 1 },
    },
  });

  return attempt;
}

export async function getPowerDialerSettings(workspaceId: string): Promise<PowerDialerWorkspaceSettings> {
  const prisma = getPrisma();
  const row = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const root = (row?.limits || {}) as Record<string, unknown>;
  return mergePowerDialerSettings(root.powerDialer);
}

export async function updatePowerDialerSettings(
  workspaceId: string,
  patch: Partial<PowerDialerWorkspaceSettings>,
) {
  const prisma = getPrisma();
  const row = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const root = (row?.limits || {}) as Record<string, unknown>;
  const current = mergePowerDialerSettings(root.powerDialer);
  const next = { ...current, ...patch };
  await prisma.workspaceLimits.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      limits: { ...root, powerDialer: next } as import("@prisma/client").Prisma.InputJsonValue,
    },
    update: {
      limits: { ...root, powerDialer: next } as import("@prisma/client").Prisma.InputJsonValue,
    },
  });
  return next;
}

export async function listPowerDialerCallbacks(
  workspaceId: string,
  tab: "due_today" | "upcoming" | "overdue" | "completed" | "all" = "all",
) {
  const prisma = getPrisma();
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const where: Record<string, unknown> = {
    workspaceId,
    callbackAt: { not: null },
  };

  if (tab === "completed") {
    where.status = "completed";
    where.disposition = { not: null };
  } else if (tab === "due_today") {
    where.callbackAt = { gte: startOfDay, lte: endOfDay };
    where.status = { not: "cancelled" };
  } else if (tab === "upcoming") {
    where.callbackAt = { gt: endOfDay };
  } else if (tab === "overdue") {
    where.callbackAt = { lt: startOfDay };
    where.status = { in: ["pending", "dialing", "completed"] };
  }

  const rows = await prisma.powerDialerAttempt.findMany({
    where,
    orderBy: { callbackAt: "asc" },
    take: 100,
    include: {
      contact: { select: { firstName: true, lastName: true, phone: true, company: true, status: true } },
      session: { include: { campaign: { select: { id: true, name: true, timezone: true } } } },
    },
  });

  return rows.map((a) => ({
    id: a.id,
    callbackAt: a.callbackAt?.toISOString() ?? null,
    disposition: a.disposition,
    notes: a.notes,
    status: a.status,
    contactName: [a.contact.firstName, a.contact.lastName].filter(Boolean).join(" ") || "Unknown",
    contactPhone: a.contact.phone,
    company: a.contact.company,
    contactStatus: a.contact.status,
    campaignId: a.session.campaign.id,
    campaignName: a.session.campaign.name,
    timezone: a.session.campaign.timezone,
  }));
}

export async function getPowerDialerOverview(workspaceId: string) {
  const prisma = getPrisma();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [campaigns, lists, sessionsToday, attemptsToday, callbacksDue, activeSession] =
    await Promise.all([
      prisma.powerDialerCampaign.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: { list: { select: { name: true } } },
      }),
      prisma.contactList.count({ where: { workspaceId } }),
      prisma.powerDialerSession.count({
        where: { workspaceId, startedAt: { gte: startOfDay } },
      }),
      prisma.powerDialerAttempt.count({
        where: { workspaceId, createdAt: { gte: startOfDay } },
      }),
      prisma.powerDialerAttempt.count({
        where: {
          workspaceId,
          callbackAt: { lte: new Date() },
          status: { in: ["pending", "completed"] },
        },
      }),
      prisma.powerDialerSession.findFirst({
        where: { workspaceId, status: { in: ["active", "paused"] } },
        include: { campaign: { select: { id: true, name: true } } },
      }),
    ]);

  const outboundToday = await prisma.humanCall.findMany({
    where: {
      workspaceId,
      direction: "outbound",
      source: "power_dialer",
      startedAt: { gte: startOfDay },
    },
    select: { answeredAt: true, endedAt: true, startedAt: true, disposition: true },
  });

  let humanConversations = 0;
  let talkSec = 0;
  for (const c of outboundToday) {
    if (c.answeredAt) {
      humanConversations += 1;
      if (c.endedAt) {
        talkSec += Math.max(
          0,
          Math.floor((c.endedAt.getTime() - c.answeredAt.getTime()) / 1000),
        );
      }
    }
  }

  const attemptsCount = outboundToday.length;
  const answerRate = attemptsCount ? Math.round((humanConversations / attemptsCount) * 100) : 0;

  const recentAttempts = await prisma.powerDialerAttempt.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      contact: { select: { firstName: true, lastName: true, phone: true } },
      session: { include: { campaign: { select: { name: true } } } },
    },
  });

  return {
    kpis: {
      attemptsToday,
      humanConversations,
      answerRate,
      talkSec,
      sessionsToday,
      callbacksDue,
      outboundCallsToday: attemptsCount,
    },
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      listName: c.list.name,
      completedPct: c.totalContacts
        ? Math.round((c.completedCount / c.totalContacts) * 100)
        : 0,
      attemptedCount: c.attemptedCount,
      totalContacts: c.totalContacts,
    })),
    listCount: lists,
    activeSession: activeSession
      ? {
          id: activeSession.id,
          status: activeSession.status,
          campaignId: activeSession.campaign.id,
          campaignName: activeSession.campaign.name,
        }
      : null,
    recentActivity: recentAttempts.map((a) => ({
      id: a.id,
      disposition: a.disposition,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
      contactName: [a.contact.firstName, a.contact.lastName].filter(Boolean).join(" ") || "Unknown",
      contactPhone: a.contact.phone,
      campaignName: a.session.campaign.name,
    })),
  };
}
