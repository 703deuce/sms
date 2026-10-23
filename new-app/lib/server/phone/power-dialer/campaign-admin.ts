import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { campaignPatchToDbData, parseCampaignConfigPatch, resolveCampaignRules } from "./campaign-config";
import { computeCampaignEligibilityRollups } from "./campaign-rollups";
import { parseExtendedConfig } from "./campaign-extended-config";
import { isHumanConversation } from "./disposition-effects";

export async function listCampaignTableRows(
  workspaceId: string,
  input?: { search?: string; status?: string },
) {
  const prisma = getPrisma();
  const search = input?.search?.trim();
  const campaigns = await prisma.powerDialerCampaign.findMany({
    where: {
      workspaceId,
      ...(input?.status ? { status: input.status } : { status: { not: "archived" } }),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    include: { list: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  if (!campaigns.length) return [];

  const campaignIds = campaigns.map((c) => c.id);
  const listIds = [...new Set(campaigns.map((c) => c.listId))];

  const listCounts = await prisma.contactListMember.groupBy({
    by: ["listId"],
    where: { listId: { in: listIds } },
    _count: { contactId: true },
  });
  const listCountMap = new Map(listCounts.map((r) => [r.listId, r._count.contactId]));

  const attemptRows = await prisma.powerDialerAttempt.findMany({
    where: { workspaceId, session: { campaignId: { in: campaignIds } } },
    select: {
      createdAt: true,
      disposition: true,
      answerClassification: true,
      session: { select: { campaignId: true } },
    },
  });
  const aggMap = new Map<
    string,
    { attempts: number; humanConversations: number; lastActivity: Date | null }
  >();
  for (const a of attemptRows) {
    const cid = a.session.campaignId;
    const cur = aggMap.get(cid) || { attempts: 0, humanConversations: 0, lastActivity: null };
    cur.attempts += 1;
    if (isHumanConversation(a.disposition, a.answerClassification)) cur.humanConversations += 1;
    if (!cur.lastActivity || a.createdAt > cur.lastActivity) cur.lastActivity = a.createdAt;
    aggMap.set(cid, cur);
  }

  const rollupMap = new Map<
    string,
    { counts: Awaited<ReturnType<typeof computeCampaignEligibilityRollups>>["counts"]; truncated: boolean }
  >();
  for (const c of campaigns) {
    const total = listCountMap.get(c.listId) ?? c.totalContacts;
    if (total > 1000) {
      rollupMap.set(c.id, {
        counts: { eligible: 0, deferred: 0, completed: 0, suppressed: 0, failed: 0 },
        truncated: true,
      });
      continue;
    }
    try {
      const { counts, truncated } = await computeCampaignEligibilityRollups(workspaceId, c.id);
      rollupMap.set(c.id, { counts, truncated });
    } catch {
      rollupMap.set(c.id, {
        counts: { eligible: 0, deferred: 0, completed: 0, suppressed: 0, failed: 0 },
        truncated: false,
      });
    }
  }

  const configJson = (raw: unknown) => parseExtendedConfig(raw);

  return campaigns.map((c) => {
    const ext = configJson(c.configJson);
    const metrics = aggMap.get(c.id);
    const rollup = rollupMap.get(c.id);
    const total = listCountMap.get(c.listId) ?? c.totalContacts;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      ownerUserId: ext.ownerUserId ?? null,
      leadSource: ext.leadSource ?? c.list.name,
      listId: c.listId,
      listName: c.list.name,
      callerId: c.callerIdE164,
      dialingMode: c.dialingMode,
      totalContacts: total,
      eligible: rollup?.counts.eligible ?? 0,
      deferred: rollup?.counts.deferred ?? 0,
      completed: rollup?.counts.completed ?? 0,
      suppressed: rollup?.counts.suppressed ?? 0,
      failed: rollup?.counts.failed ?? 0,
      rollupTruncated: rollup?.truncated ?? false,
      attempts: metrics?.attempts ?? c.attemptedCount,
      humanConversations: metrics?.humanConversations ?? c.connectedCount,
      lastActivity: metrics?.lastActivity?.toISOString() ?? c.updatedAt.toISOString(),
      rules: resolveCampaignRules(c),
      configJson: c.configJson,
      extended: ext,
    };
  });
}

export async function getCampaignDetail(workspaceId: string, id: string) {
  const prisma = getPrisma();
  const c = await prisma.powerDialerCampaign.findFirst({
    where: { id, workspaceId },
    include: { list: true },
  });
  if (!c) throw new Error("Campaign not found");
  const { counts, truncated } = await computeCampaignEligibilityRollups(workspaceId, id);
  return {
    campaign: c,
    rules: resolveCampaignRules(c),
    extended: parseExtendedConfig(c.configJson),
    eligibility: { counts, truncated },
  };
}

export async function cloneCampaign(workspaceId: string, id: string, name?: string) {
  const prisma = getPrisma();
  const src = await prisma.powerDialerCampaign.findFirst({ where: { id, workspaceId } });
  if (!src) throw new Error("Campaign not found");
  const members = await prisma.contactListMember.count({ where: { listId: src.listId } });
  return prisma.powerDialerCampaign.create({
    data: {
      workspaceId,
      name: name || `${src.name} (copy)`,
      description: src.description,
      listId: src.listId,
      callerIdE164: src.callerIdE164,
      timezone: src.timezone,
      status: "draft",
      configJson: src.configJson as import("@prisma/client").Prisma.InputJsonValue,
      ringTimeoutSeconds: src.ringTimeoutSeconds,
      retryIntervalMinutes: src.retryIntervalMinutes,
      dailyAttemptCap: src.dailyAttemptCap,
      totalAttemptCap: src.totalAttemptCap,
      postCallIntervalSeconds: src.postCallIntervalSeconds,
      requireDispositionBeforeNext: src.requireDispositionBeforeNext,
      allowedDays: src.allowedDays as import("@prisma/client").Prisma.InputJsonValue,
      callingHoursStart: src.callingHoursStart,
      callingHoursEnd: src.callingHoursEnd,
      phoneFieldPriority: src.phoneFieldPriority as import("@prisma/client").Prisma.InputJsonValue,
      dialingMode: src.dialingMode,
      totalContacts: members,
    },
  });
}

export async function upsertCampaign(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    description?: string;
    listId: string;
    callerIdE164: string;
    timezone?: string;
    status?: string;
    configJson?: Record<string, unknown>;
  },
) {
  const prisma = getPrisma();
  const callerIdE164 = normalizeE164(input.callerIdE164);
  const parsed = input.configJson ? parseCampaignConfigPatch(input.configJson) : {};
  const ruleCols = campaignPatchToDbData(parsed);
  const members = await prisma.contactListMember.count({ where: { listId: input.listId } });
  const configJson = {
    ...(input.configJson || {}),
  } as import("@prisma/client").Prisma.InputJsonValue;

  if (input.id) {
    await prisma.powerDialerCampaign.updateMany({
      where: { id: input.id, workspaceId },
      data: {
        name: input.name,
        description: input.description,
        listId: input.listId,
        callerIdE164,
        timezone: input.timezone,
        status: input.status,
        totalContacts: members,
        configJson,
        ...ruleCols,
      },
    });
    return prisma.powerDialerCampaign.findFirst({ where: { id: input.id, workspaceId } });
  }

  return prisma.powerDialerCampaign.create({
    data: {
      workspaceId,
      name: input.name,
      description: input.description,
      listId: input.listId,
      callerIdE164,
      timezone: input.timezone || "America/Chicago",
      status: input.status || "draft",
      configJson,
      totalContacts: members,
      ...ruleCols,
      totalAttemptCap: (ruleCols.totalAttemptCap as number | undefined) ?? parsed.totalAttemptCap ?? 3,
      retryIntervalMinutes:
        (ruleCols.retryIntervalMinutes as number | undefined) ?? parsed.retryIntervalMinutes ?? 60,
    },
  });
}

export async function getCampaignHistory(workspaceId: string, campaignId: string) {
  const prisma = getPrisma();
  const sessions = await prisma.powerDialerSession.findMany({
    where: { workspaceId, campaignId },
    orderBy: { startedAt: "desc" },
    take: 50,
    include: {
      attempts: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          contact: { select: { firstName: true, lastName: true, phone: true } },
        },
      },
    },
  });
  return sessions.map((s) => ({
    id: s.id,
    status: s.status,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
    attemptCount: s.attempts.length,
    attempts: s.attempts.map((a) => ({
      id: a.id,
      disposition: a.disposition,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
      contactName: [a.contact.firstName, a.contact.lastName].filter(Boolean).join(" ") || "Unknown",
      contactPhone: a.contact.phone,
    })),
  }));
}

export async function getCampaignAnalytics(workspaceId: string, campaignId: string) {
  const prisma = getPrisma();
  const attempts = await prisma.powerDialerAttempt.findMany({
    where: { workspaceId, session: { campaignId } },
    select: {
      disposition: true,
      answerClassification: true,
      billableSeconds: true,
      status: true,
      contactId: true,
    },
  });
  let human = 0;
  let talkSec = 0;
  const dispositions: Record<string, number> = {};
  const contacts = new Set<string>();
  for (const a of attempts) {
    contacts.add(a.contactId);
    if (isHumanConversation(a.disposition, a.answerClassification)) human += 1;
    if (a.billableSeconds) talkSec += a.billableSeconds;
    if (a.disposition) dispositions[a.disposition] = (dispositions[a.disposition] || 0) + 1;
  }
  return {
    totalAttempts: attempts.length,
    uniqueContacts: contacts.size,
    humanConversations: human,
    talkSec,
    dispositions,
    answerRate: attempts.length ? Math.round((human / attempts.length) * 100) : 0,
  };
}
