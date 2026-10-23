import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import {
  mergePowerDialerSettings,
  type PowerDialerWorkspaceSettings,
} from "@/lib/products/power-dialer";
import {
  campaignPatchToDbData,
  parseCampaignConfigPatch,
} from "@/lib/server/phone/power-dialer/campaign-config";
import {
  createAttemptForSession,
  endSessionHard,
  getSessionRuntime,
  saveAttemptOutcomeWithProgression,
  startSessionWithRep,
} from "@/lib/server/phone/power-dialer/session-runtime";
import { isHumanConversation } from "@/lib/server/phone/power-dialer/disposition-effects";

export async function listCampaigns(workspaceId: string, opts?: { viewerUserId?: string }) {
  const prisma = getPrisma();
  const settings = await getPowerDialerSettings(workspaceId);
  let viewerRole: string | null = null;
  if (opts?.viewerUserId) {
    const m = await prisma.membership.findFirst({
      where: { workspaceId, userId: opts.viewerUserId },
      select: { role: true },
    });
    viewerRole = m?.role ?? null;
  }
  const rows = await prisma.powerDialerCampaign.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    include: { list: { select: { name: true } } },
  });
  const { userCanAccessCampaign, isPowerDialerAdminRole } = await import(
    "./power-dialer/campaign-access"
  );
  const filtered =
    opts?.viewerUserId &&
    settings.teamActivityVisibility === "assigned_only" &&
    viewerRole &&
    !isPowerDialerAdminRole(viewerRole)
      ? rows.filter((c) => userCanAccessCampaign(viewerRole!, c.configJson, opts.viewerUserId!))
      : rows;
  return filtered.map((c) => ({
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
    maxAttempts: c.totalAttemptCap,
    dialingMode: c.dialingMode,
    config: c.configJson,
    rules: {
      ringTimeoutSeconds: c.ringTimeoutSeconds,
      retryIntervalMinutes: c.retryIntervalMinutes,
      dailyAttemptCap: c.dailyAttemptCap,
      totalAttemptCap: c.totalAttemptCap,
      postCallIntervalSeconds: c.postCallIntervalSeconds,
      requireDispositionBeforeNext: c.requireDispositionBeforeNext,
      dialingMode: c.dialingMode,
    },
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
  const parsed = input.configJson ? parseCampaignConfigPatch(input.configJson) : {};
  const ruleCols = campaignPatchToDbData(parsed);
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
      ...ruleCols,
      totalAttemptCap:
        (ruleCols.totalAttemptCap as number | undefined) ??
        parsed.totalAttemptCap ??
        parsed.maxAttempts ??
        3,
      retryIntervalMinutes:
        (ruleCols.retryIntervalMinutes as number | undefined) ??
        parsed.retryIntervalMinutes ??
        parsed.retryDelayMinutes ??
        60,
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
  }> &
    Record<string, unknown>,
) {
  const prisma = getPrisma();
  const { configJson, ...rest } = patch;
  const ruleCols = configJson
    ? campaignPatchToDbData(parseCampaignConfigPatch(configJson))
    : {};
  return prisma.powerDialerCampaign.updateMany({
    where: { id, workspaceId },
    data: {
      ...rest,
      ...ruleCols,
      ...(configJson !== undefined
        ? { configJson: configJson as import("@prisma/client").Prisma.InputJsonValue }
        : {}),
    },
  });
}

export async function startSession(
  workspaceId: string,
  campaignId: string,
  opts?: { focusContactId?: string },
) {
  return startSessionWithRep(workspaceId, campaignId, opts);
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
  return endSessionHard(workspaceId, sessionId);
}

export async function getNextEligibleContact(workspaceId: string, sessionId: string) {
  const runtime = await getSessionRuntime(workspaceId, sessionId);
  return runtime.next;
}

export async function createAttempt(
  workspaceId: string,
  sessionId: string,
  contactId: string,
  attemptNumber: number,
  idempotencyKey?: string,
) {
  return createAttemptForSession(workspaceId, sessionId, {
    contactId,
    attemptNumber,
    idempotencyKey,
  });
}

export { getSessionRuntime } from "@/lib/server/phone/power-dialer/session-runtime";

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
  return saveAttemptOutcomeWithProgression(workspaceId, attemptId, input);
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
  const { listPowerDialerCallbacksV2 } = await import(
    "@/lib/server/phone/power-dialer/callbacks-service"
  );
  return listPowerDialerCallbacksV2(workspaceId, tab);
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
      import("@/lib/server/phone/power-dialer/callbacks-service").then((m) =>
        m.countCallbacksDue(workspaceId),
      ),
      prisma.powerDialerSession.findFirst({
        where: { workspaceId, status: { in: ["active", "paused"] } },
        include: { campaign: { select: { id: true, name: true } } },
      }),
    ]);

  const attemptsTodayRows = await prisma.powerDialerAttempt.findMany({
    where: { workspaceId, createdAt: { gte: startOfDay } },
    select: {
      disposition: true,
      answerClassification: true,
      billableSeconds: true,
      status: true,
    },
  });

  let humanConversations = 0;
  let talkSec = 0;
  for (const a of attemptsTodayRows) {
    if (isHumanConversation(a.disposition, a.answerClassification)) {
      humanConversations += 1;
    }
    if (a.billableSeconds) talkSec += a.billableSeconds;
  }

  const attemptsCount = attemptsTodayRows.length;
  const answerRate = attemptsCount ? Math.round((humanConversations / attemptsCount) * 100) : 0;

  const attentionRequired: { code: string; message: string }[] = [];
  if (lists === 0) {
    attentionRequired.push({
      code: "no_lists",
      message: "Create a calling list before you can run a campaign.",
    });
  }
  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  if (campaigns.length > 0 && activeCampaigns.length === 0) {
    attentionRequired.push({
      code: "no_active_campaign",
      message: "No active campaigns — activate a campaign to dial.",
    });
  }
  const activeNumbers = await prisma.phoneNumber.count({
    where: { workspaceId, status: { in: ["active", "Active"] } },
  });
  if (activeNumbers === 0) {
    attentionRequired.push({
      code: "no_outbound_number",
      message: "No active outbound number — assign a caller ID before dialing.",
    });
  }

  if (activeCampaigns.length > 0) {
    const { isCallingWindowOpen } = await import("@/lib/server/phone/power-dialer/timezone-window");
    const { resolveCampaignRules } = await import("@/lib/server/phone/power-dialer/campaign-config");
    const anyWindowOpen = activeCampaigns.some((c) => {
      const rules = resolveCampaignRules(c);
      return isCallingWindowOpen(
        new Date(),
        rules.timezone,
        rules.allowedDays,
        rules.callingHoursStart,
        rules.callingHoursEnd,
      ).open;
    });
    if (!anyWindowOpen) {
      attentionRequired.push({
        code: "calling_window_closed",
        message: "Calling window is closed for active campaigns (schedule/timezone).",
      });
    }
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const crmFailures = await prisma.crmSyncRun.count({
    where: {
      workspaceId,
      status: { in: ["failed", "partial"] },
      createdAt: { gte: weekAgo },
    },
  });
  if (crmFailures > 0) {
    attentionRequired.push({
      code: "crm_sync_errors",
      message: `${crmFailures} CRM sync issue(s) in the last 7 days — review Integrations.`,
    });
  }

  const limitsRow = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const limitsRoot = (limitsRow?.limits || {}) as Record<string, unknown>;
  const pdLimits = limitsRoot.powerDialer as Record<string, unknown> | undefined;
  const usedMin = typeof pdLimits?.minutesUsed === "number" ? pdLimits.minutesUsed : null;
  const capMin = typeof pdLimits?.minutesIncluded === "number" ? pdLimits.minutesIncluded : null;
  if (usedMin != null && capMin != null && usedMin >= capMin) {
    attentionRequired.push({
      code: "usage_limit_reached",
      message: "Included dialing minutes are exhausted — upgrade or wait for the next cycle.",
    });
  }

  if (activeSession) {
    try {
      const runtime = await getSessionRuntime(workspaceId, activeSession.id);
      if ((runtime.eligibilityCounts?.eligible ?? 0) === 0) {
        attentionRequired.push({
          code: "no_eligible_contacts",
          message: "Active session has no eligible contacts right now.",
        });
      }
    } catch {
      // ignore runtime errors on overview
    }
  }

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
    attentionRequired,
  };
}
