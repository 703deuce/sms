import { getPrisma } from "@/lib/server/db";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { resolveCampaignRules } from "./campaign-config";
import {
  evaluateContactEligibility,
  dispositionIsTerminal,
  reasonToUserMessage,
} from "./eligibility";
import { applyDispositionEffects, isHumanConversation } from "./disposition-effects";
import { assertCampaignDialAccess } from "./campaign-access";
import { parseExtendedConfig } from "./campaign-extended-config";
import { parseCampaignAdvanced } from "./campaign-advanced";
import { checkWorkspacePhoneFrequency, getWorkspaceDialPolicy } from "./dial-policy";
import { sortCampaignQueueMembers } from "./queue-order";
import { resolveDispositionByLabel } from "./dispositions";
import type {
  AnswerClassification,
  AttemptSummary,
  EligibilityResult,
  ProgressionPhase,
} from "./types";

const LIVE_STATUSES = new Set(["pending", "dialing", "ringing", "answered"]);

async function resolveRulesForCampaign(
  workspaceId: string,
  campaign: Parameters<typeof resolveCampaignRules>[0],
) {
  const { getPowerDialerSettings } = await import("@/lib/server/phone/power-dialer");
  const ws = await getPowerDialerSettings(workspaceId);
  return resolveCampaignRules(campaign, ws);
}

export async function assertRepAuthorized(workspaceId: string): Promise<string> {
  const prisma = getPrisma();
  const userId = await resolveInternalUserId();
  const membership = await prisma.membership.findFirst({
    where: { workspaceId, userId },
    select: { id: true },
  });
  if (!membership) throw new Error("Not authorized for this workspace");
  return userId;
}

async function loadCampaignAttemptsMap(
  workspaceId: string,
  campaignId: string,
  contactIds: string[],
) {
  const prisma = getPrisma();
  if (!contactIds.length) return new Map();
  const attempts = await prisma.powerDialerAttempt.findMany({
    where: { workspaceId, contactId: { in: contactIds }, session: { campaignId } },
    select: {
      contactId: true,
      status: true,
      disposition: true,
      attemptNumber: true,
      createdAt: true,
      endedAt: true,
    },
  });
  const map = new Map<string, (typeof attempts)[number][]>();
  for (const a of attempts) {
    const list = map.get(a.contactId) || [];
    list.push(a);
    map.set(a.contactId, list);
  }
  return map;
}

export async function sweepPowerDialerTimeouts(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  const { enforceAcwTimeouts } = await import("./acw-enforcement");
  await enforceAcwTimeouts(workspaceId, sessionId);
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: { campaign: true },
  });
  if (!session || session.status === "completed") return;

  const rules = await resolveRulesForCampaign(workspaceId, session.campaign);
  const now = new Date();
  const staleMs = rules.ringTimeoutSeconds * 1000 + 120_000;

  const stale = await prisma.powerDialerAttempt.findMany({
    where: {
      sessionId,
      workspaceId,
      status: { in: ["dialing", "ringing", "pending"] },
      OR: [
        { ringTimeoutAt: { lt: now } },
        { dialedAt: { lt: new Date(now.getTime() - staleMs) } },
      ],
    },
  });

  for (const a of stale) {
    await prisma.powerDialerAttempt.update({
      where: { id: a.id },
      data: {
        status: "no_answer",
        answerClassification: "no_answer",
        endedAt: now,
        failureReason: a.ringTimeoutAt && a.ringTimeoutAt < now ? "ring_timeout" : "stale_dialing",
      },
    });
    if (session.currentAttemptId === a.id) {
      await prisma.powerDialerSession.update({
        where: { id: sessionId },
        data: {
          currentAttemptId: null,
          progressionPhase: rules.dialingMode === "power" ? "countdown" : "idle",
          nextCallAt: new Date(now.getTime() + rules.postCallIntervalSeconds * 1000),
        },
      });
    }
  }
}

export async function buildEligibilityBreakdown(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: {
      campaign: {
        include: {
          list: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!session) throw new Error("Session not found");

  const rules = await resolveRulesForCampaign(workspaceId, session.campaign);
  const repOk = Boolean(session.repUserId);
  const advancedEarly = parseCampaignAdvanced(session.campaign.configJson);
  const { loadSessionQueueMembers, resolveWaterfallActiveList } = await import("./standby-queue");
  const { allMembers: queueMembers, listChain } = await loadSessionQueueMembers({
    primaryListId: session.campaign.listId,
    primaryListName: session.campaign.list.name,
    standbyListIds: advancedEarly.standbyListIds,
  });
  const contactIds = queueMembers.map((m) => m.contactId);
  const campaignMap = await loadCampaignAttemptsMap(workspaceId, session.campaignId, contactIds);

  const sessionAttempts = await prisma.powerDialerAttempt.findMany({
    where: { sessionId },
    select: {
      contactId: true,
      status: true,
      disposition: true,
      attemptNumber: true,
      createdAt: true,
      endedAt: true,
    },
  });
  const sessionByContact = new Map<string, (typeof sessionAttempts)[number][]>();
  for (const a of sessionAttempts) {
    const list = sessionByContact.get(a.contactId) || [];
    list.push(a);
    sessionByContact.set(a.contactId, list);
  }

  const openAttempt = await prisma.powerDialerAttempt.findFirst({
    where: {
      sessionId,
      status: { in: [...LIVE_STATUSES] },
    },
  });
  const anyLive = Boolean(openAttempt);
  const hasOpenDispositionBlock =
    rules.requireDispositionBeforeNext && session.progressionPhase === "awaiting_disposition";

  const counts: Record<string, number> = {
    eligible: 0,
    deferred: 0,
    completed: 0,
    suppressed: 0,
    failed: 0,
  };

  let nextEligible: {
    contact: (typeof session.campaign.list.members)[number]["contact"];
    attemptNumber: number;
    eligibility: EligibilityResult;
  } | null = null;

  let nextEligibleAt: string | null = null;

  const now = new Date();

  const progress =
    session.progressJson && typeof session.progressJson === "object"
      ? (session.progressJson as {
          focusContactId?: string;
          waterfallListIndex?: number;
        })
      : {};
  const advanced = advancedEarly;
  const dialPolicy = await getWorkspaceDialPolicy(workspaceId);
  const { loadBlockedContactIds, pickRoundRobinContactIds } = await import("./team-queue-claims");
  const blockedClaims = await loadBlockedContactIds(
    workspaceId,
    session.campaignId,
    sessionId,
  );
  const queueRows = sortCampaignQueueMembers(
    queueMembers.map((m) => ({
      member: m,
      contactId: m.contactId,
      dialPriority: m.dialPriority,
      queueSortOrder: m.queueSortOrder,
      createdAt: m.contact.createdAt,
    })),
    advanced,
  );
  let members = queueRows.map((r) => r.member).filter((m) => !blockedClaims.has(m.contactId));
  const { loadDueCallbackContactIds } = await import("./campaign-eligibility-helpers");
  const dueCallbackIds = await loadDueCallbackContactIds(
    session.workspaceId,
    session.campaignId,
    session.repUserId,
    now,
  );
  if (dueCallbackIds.length) {
    const dueSet = new Set(dueCallbackIds);
    members = [
      ...members.filter((m) => dueSet.has(m.contactId)),
      ...members.filter((m) => !dueSet.has(m.contactId)),
    ];
  }
  if (progress.focusContactId) {
    members = [
      ...members.filter((m) => m.contactId === progress.focusContactId),
      ...members.filter((m) => m.contactId !== progress.focusContactId),
    ];
  }

  const usageSnap = await import("./usage-limits").then((m) =>
    m.getPowerDialerUsageSnapshot(session.workspaceId),
  );
  const ext = parseExtendedConfig(session.campaign.configJson);
  const leadOwnerRouting = ext.leadOwnerRouting || advanced.leadOwnerRouting || "off";

  const eligibilityByContact = new Map<string, EligibilityResult>();

  for (const m of members) {
    const c = m.contact;
    const campaignAttempts = campaignMap.get(c.id) || [];
    const sessAttempts = sessionByContact.get(c.id) || [];
    const { e164 } = (await import("./phone-resolve")).resolveContactDialPhone(c, rules.phoneFieldPriority);
    const onInternalDnc = e164
      ? await (await import("./internal-dnc")).isOnInternalDnc(session.workspaceId, e164)
      : false;
    const freq = e164
      ? await checkWorkspacePhoneFrequency(session.workspaceId, e164, now, dialPolicy)
      : { ok: true as const };
    const eligibility = evaluateContactEligibility({
      contact: {
        ...c,
        phones: c.phones?.map((p) => ({
          e164: p.e164,
          priority: p.priority,
          isPreferred: p.isPreferred,
          outcome: p.outcome,
        })),
      },
      rules,
      campaignAttemptsForContact: campaignAttempts,
      sessionAttemptsForContact: sessAttempts,
      now,
      sessionActive: session.status === "active",
      sessionPaused: session.status === "paused",
      hasOpenDispositionBlock,
      anyLiveAttemptInSession: anyLive,
      repAuthorized: repOk,
      onInternalDnc,
      usageBlocked: usageSnap.blocked,
      sessionRepUserId: session.repUserId,
      leadOwnerRouting,
      advanced,
      workspaceDialPolicy: dialPolicy,
      workspaceFrequency: freq,
    });
    counts[eligibility.bucket] += 1;
    eligibilityByContact.set(c.id, eligibility);
    if (!eligibility.eligible && eligibility.retryEligibleAt) {
      const t = eligibility.retryEligibleAt;
      if (!nextEligibleAt || t < nextEligibleAt) nextEligibleAt = t;
    }
  }

  const waterfall = resolveWaterfallActiveList(
    listChain,
    queueMembers,
    (row) => eligibilityByContact.get(row.contactId)?.eligible === true,
    progress.waterfallListIndex ?? 0,
  );
  const activeList = listChain[waterfall.index] || listChain[0];
  if (waterfall.index !== (progress.waterfallListIndex ?? 0)) {
    const progressFull =
      session.progressJson && typeof session.progressJson === "object"
        ? { ...(session.progressJson as object) }
        : {};
    await prisma.powerDialerSession.update({
      where: { id: sessionId },
      data: {
        progressJson: {
          ...progressFull,
          waterfallListIndex: waterfall.index,
        } as import("@prisma/client").Prisma.InputJsonValue,
      },
    });
  }

  let dialMembers = members.filter((m) => m.sourceListId === activeList.id);
  const teamMode =
    advanced.teamQueueMode === "dynamic" ? "pull" : advanced.teamQueueMode || "shared";
  if (teamMode === "round_robin") {
    const eligibleIds = dialMembers
      .filter((m) => eligibilityByContact.get(m.contactId)?.eligible)
      .map((m) => m.contactId);
    const campaignFresh = await prisma.powerDialerCampaign.findFirst({
      where: { id: session.campaignId, workspaceId },
      select: { configJson: true },
    });
    const cfg =
      campaignFresh?.configJson && typeof campaignFresh.configJson === "object"
        ? (campaignFresh.configJson as { teamQueuePointer?: number })
        : {};
    const rotated = pickRoundRobinContactIds(
      eligibleIds,
      session.repUserId,
      ext.memberUserIds || [],
      cfg,
    );
    const order = new Map(rotated.map((id, i) => [id, i]));
    dialMembers = [...dialMembers].sort(
      (a, b) => (order.get(a.contactId) ?? 999) - (order.get(b.contactId) ?? 999),
    );
  }

  for (const m of dialMembers) {
    const c = m.contact;
    const eligibility = eligibilityByContact.get(c.id);
    if (!eligibility?.eligible) continue;
    const campaignAttempts = campaignMap.get(c.id) || [];
    const attemptNumber =
      campaignAttempts.filter((a: AttemptSummary) => a.disposition || a.endedAt).length + 1;
    const { resolveSessionDialPhone } = await import("@/lib/server/crm/native/phone-fallthrough");
    const dial = await resolveSessionDialPhone({
      workspaceId: session.workspaceId,
      sessionId: session.id,
      contact: {
        id: c.id,
        phone: c.phone,
        status: c.status,
        timezone: c.timezone,
        customFields: c.customFields,
        phones: c.phones?.map((p) => ({
          id: p.id,
          e164: p.e164,
          priority: p.priority,
          isPreferred: p.isPreferred,
          outcome: p.outcome,
        })),
      },
      priority: rules.phoneFieldPriority,
    });
    nextEligible = { contact: c, attemptNumber, eligibility, dialE164: dial.e164 };
    break;
  }

  const queueContext = {
    activeListId: activeList.id,
    activeListName: activeList.name,
    waterfallIndex: waterfall.index,
    waterfallReason: waterfall.reason,
    teamQueueMode: teamMode,
    listChain,
  };

  if (!nextEligible && counts.eligible === 0) {
    const { markCampaignCompletedIfExhausted } = await import("./campaign-admin");
    await markCampaignCompletedIfExhausted(workspaceId, session.campaignId, "no_eligible_contacts");
  }

  return { counts, nextEligible, nextEligibleAt, rules, session, queueContext };
}

export async function getSessionRuntime(workspaceId: string, sessionId: string) {
  await sweepPowerDialerTimeouts(workspaceId, sessionId);
  const { counts, nextEligible, nextEligibleAt, rules, session, queueContext } =
    await buildEligibilityBreakdown(workspaceId, sessionId);

  const prisma = getPrisma();
  const currentAttempt = session.currentAttemptId
    ? await prisma.powerDialerAttempt.findFirst({
        where: { id: session.currentAttemptId, workspaceId },
        include: { contact: true },
      })
    : null;

  const countdownSec =
    session.nextCallAt && session.progressionPhase === "countdown"
      ? Math.max(0, Math.ceil((session.nextCallAt.getTime() - Date.now()) / 1000))
      : 0;

  const dialReady =
    session.status === "active" &&
    session.progressionPhase === "countdown" &&
    countdownSec === 0 &&
    rules.dialingMode === "power" &&
    nextEligible &&
    !currentAttempt;

  return {
    session,
    rules,
    eligibilityCounts: counts,
    next: nextEligible
      ? {
          contact: nextEligible.contact,
          attemptNumber: nextEligible.attemptNumber,
          campaign: session.campaign,
          sessionId: session.id,
          dialE164: nextEligible.dialE164,
        }
      : null,
    progression: {
      phase: session.progressionPhase as ProgressionPhase,
      nextCallAt: session.nextCallAt?.toISOString() ?? null,
      countdownSeconds: countdownSec,
      autoDialReady: dialReady,
    },
    currentAttempt,
    ringTimeoutHangup:
      currentAttempt?.ringTimeoutAt && currentAttempt.ringTimeoutAt < new Date()
        ? currentAttempt.humanCallId
        : null,
    emptyReasons: nextEligible
      ? null
      : Object.entries(counts)
          .filter(([k, v]) => k !== "eligible" && v > 0)
          .map(([bucket, count]) => ({ bucket, count })),
    nextEligibleAt,
    queueContext,
  };
}

export async function createAttemptForSession(
  workspaceId: string,
  sessionId: string,
  input: { contactId: string; attemptNumber: number; idempotencyKey?: string },
) {
  const prisma = getPrisma();
  await sweepPowerDialerTimeouts(workspaceId, sessionId);

  const session = await prisma.powerDialerSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: { campaign: true },
  });
  if (!session) throw new Error("Session not found");
  if (session.status === "paused") throw new Error("Session is paused");
  if (session.status !== "active") throw new Error("Session is not active");

  const rules = await resolveRulesForCampaign(workspaceId, session.campaign);

  if (rules.requireDispositionBeforeNext) {
    const open = await prisma.powerDialerAttempt.findFirst({
      where: {
        sessionId,
        endedAt: { not: null },
        disposition: null,
        status: { in: ["answered", "no_answer"] },
      },
    });
    if (open) throw new Error("Disposition required before next call");
  }

  const { isMultiLineDialMode, normalizeDialingMode, parseDialModeSettings } = await import(
    "./dial-modes"
  );
  const { assertParallelOriginationAllowed, resolveLinesForSession } = await import(
    "./parallel-orchestrator"
  );
  const dialMode = normalizeDialingMode(rules.dialingMode);
  const multiLine = isMultiLineDialMode(dialMode);
  if (multiLine) {
    const entitlements = await assertParallelOriginationAllowed(workspaceId, dialMode);
    const liveCount = await prisma.powerDialerAttempt.count({
      where: { sessionId, status: { in: [...LIVE_STATUSES] } },
    });
    const maxLines = resolveLinesForSession(
      dialMode,
      session.campaign.configJson,
      entitlements,
    );
    if (liveCount >= maxLines) {
      throw new Error("Parallel line cap reached for this session — wait for a result or end active legs.");
    }
  } else {
    const live = await prisma.powerDialerAttempt.findFirst({
      where: { sessionId, status: { in: [...LIVE_STATUSES] } },
    });
    if (live) throw new Error("A call is already in progress for this session");
  }

  const { assertPowerDialerConcurrencyLimits } = await import("./usage-limits");
  await assertPowerDialerConcurrencyLimits(workspaceId, {
    sessionId,
    campaignId: session.campaignId,
    repUserId: session.repUserId,
  });

  if (input.idempotencyKey) {
    const existing = await prisma.powerDialerAttempt.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
  }

  const { nextEligible, session: sess } = await buildEligibilityBreakdown(workspaceId, sessionId);
  const focusId =
    sess.progressJson && typeof sess.progressJson === "object"
      ? (sess.progressJson as { focusContactId?: string }).focusContactId
      : undefined;
  const allowed =
    nextEligible?.contact.id === input.contactId ||
    (focusId && focusId === input.contactId);
  if (!allowed) {
    throw new Error("Contact is not eligible to dial");
  }

  const contactRow = await prisma.contact.findFirst({
    where: { id: input.contactId, workspaceId },
    include: { phones: { orderBy: { priority: "asc" } } },
  });
  if (!contactRow) throw new Error("Contact not found");
  const contactForDial = {
    id: contactRow.id,
    phone: contactRow.phone,
    status: contactRow.status,
    timezone: contactRow.timezone,
    customFields: contactRow.customFields,
    phones: contactRow.phones.map((p) => ({
      id: p.id,
      e164: p.e164,
      priority: p.priority,
      isPreferred: p.isPreferred,
      outcome: p.outcome,
    })),
  };
  const { resolveSessionDialPhone } = await import("@/lib/server/crm/native/phone-fallthrough");
  const { assertOutboundDialAllowed } = await import("@/lib/server/crm/native/dial-gates");
  const dial = await resolveSessionDialPhone({
    workspaceId,
    sessionId,
    contact: contactForDial,
    priority: rules.phoneFieldPriority,
  });
  await assertOutboundDialAllowed(workspaceId, dial.e164);

  const extDial = parseExtendedConfig(session.campaign.configJson);
  const pdSettings = await (await import("@/lib/server/phone/power-dialer")).getPowerDialerSettings(
    workspaceId,
  );
  const { checkDialCompliance, auditComplianceDecision } = await import("./compliance-gates");
  const compliance = await checkDialCompliance({
    workspaceId,
    contactId: input.contactId,
    phoneE164: dial.e164,
    requireExplicitConsent: Boolean(extDial.requireExplicitConsent),
    externalDncConnected: Boolean(pdSettings.externalDncScreeningConnected),
    campaignListId: session.campaign.listId,
  });
  if (!compliance.ok) {
    await auditComplianceDecision({
      workspaceId,
      action: "dial_blocked",
      detail: { contactId: input.contactId, reason: compliance.reason, phone: dial.e164 },
    });
    throw new Error(compliance.userMessage);
  }

  const wsSettings = pdSettings;
  if (wsSettings.skipDuplicateNumbers) {
    const dup = await prisma.powerDialerAttempt.findFirst({
      where: {
        sessionId,
        workspaceId,
        dialedPhoneE164: dial.e164,
        status: { not: "cancelled" },
      },
    });
    if (dup) throw new Error("Duplicate number already dialed in this session");
  }
  const seq = session.dialSequence + 1;
  const ringTimeoutAt = new Date(Date.now() + rules.ringTimeoutSeconds * 1000);

  const { claimContactForSession } = await import("./team-queue-claims");
  await claimContactForSession({
    workspaceId,
    campaignId: session.campaignId,
    contactId: input.contactId,
    sessionId,
    repUserId: session.repUserId,
  });

  try {
    const dialSettings = parseDialModeSettings(session.campaign.configJson);
    const attempt = await prisma.powerDialerAttempt.create({
      data: {
        workspaceId,
        sessionId,
        contactId: input.contactId,
        attemptNumber: input.attemptNumber,
        sequenceNumber: seq,
        idempotencyKey: input.idempotencyKey,
        status: "pending",
        dialedAt: new Date(),
        ringTimeoutAt,
        dialedPhoneE164: dial.e164,
        metadataJson: multiLine
          ? {
              parallelRoundId: `round-${sessionId}-${seq}`,
              dialMode,
              amdFilter: dialMode === "parallel_amd" ? dialSettings.amdFilterMachines : undefined,
            }
          : undefined,
      },
    });

    await prisma.powerDialerSession.update({
      where: { id: sessionId },
      data: {
        dialSequence: seq,
        currentAttemptId: attempt.id,
        progressionPhase: "dialing",
        nextCallAt: null,
      },
    });

    const { advanceTeamQueuePointer } = await import("./caller-id-pool");
    await advanceTeamQueuePointer(workspaceId, session.campaignId);

    const { pdWebhookCallStarted } = await import("./webhooks/lifecycle");
    pdWebhookCallStarted({
      workspaceId,
      attemptId: attempt.id,
      sessionId,
      contactId: input.contactId,
      phoneE164: dial.e164,
    });

    return attempt;
  } catch (e) {
    if (input.idempotencyKey) {
      const existing = await prisma.powerDialerAttempt.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }
    throw e;
  }
}

const HANGUP_TERMINAL_STATUSES = new Set([
  "answered",
  "no_answer",
  "completed",
  "voicemail",
  "failed",
  "cancelled",
]);

export async function onPowerDialerCallEnded(
  workspaceId: string,
  attemptId: string,
  input: {
    wasAnswered: boolean;
    answerClassification?: AnswerClassification;
    billableSeconds?: number | null;
  },
) {
  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: attemptId, workspaceId },
    include: { session: { include: { campaign: true } } },
  });
  if (!attempt || attempt.session.status === "completed") return;

  const hangupAlreadyHandled =
    attempt.endedAt != null && HANGUP_TERMINAL_STATUSES.has(attempt.status);
  if (hangupAlreadyHandled) {
    if (input.billableSeconds != null && attempt.billableSeconds == null) {
      await prisma.powerDialerAttempt.update({
        where: { id: attemptId },
        data: { billableSeconds: input.billableSeconds },
      });
    }
    return;
  }

  const rules = await resolveRulesForCampaign(workspaceId, attempt.session.campaign);
  const classification: AnswerClassification =
    input.answerClassification ||
    (input.wasAnswered ? "uncertain" : "no_answer");

  const status = input.wasAnswered ? "answered" : "no_answer";
  const endedAt = attempt.endedAt || new Date();

  const { getPowerDialerSettings } = await import("@/lib/server/phone/power-dialer");
  const { computeAcwDeadline } = await import("./acw-enforcement");
  const pdSettings = await getPowerDialerSettings(workspaceId);
  const acwDeadlineAt =
    input.wasAnswered && rules.requireDispositionBeforeNext
      ? computeAcwDeadline(pdSettings.afterCallWorkTimeoutSec)
      : null;

  await prisma.powerDialerAttempt.update({
    where: { id: attemptId },
    data: {
      status,
      answerClassification: classification,
      answeredAt: input.wasAnswered ? attempt.answeredAt || new Date() : attempt.answeredAt,
      endedAt,
      billableSeconds: input.billableSeconds ?? attempt.billableSeconds,
      acwDeadlineAt,
    },
  });

  const { pdWebhookCallAnswered, pdWebhookCallEnded } = await import("./webhooks/lifecycle");
  if (input.wasAnswered) {
    pdWebhookCallAnswered({
      workspaceId,
      attemptId,
      sessionId: attempt.sessionId,
      contactId: attempt.contactId,
    });
  }
  pdWebhookCallEnded({
    workspaceId,
    attemptId,
    sessionId: attempt.sessionId,
    contactId: attempt.contactId,
    wasAnswered: input.wasAnswered,
  });

  await prisma.powerDialerSession.update({
    where: { id: attempt.sessionId },
    data: {
      progressionPhase: rules.requireDispositionBeforeNext ? "awaiting_disposition" : "countdown",
      currentAttemptId: rules.requireDispositionBeforeNext ? attemptId : null,
      nextCallAt: rules.requireDispositionBeforeNext
        ? null
        : new Date(Date.now() + rules.postCallIntervalSeconds * 1000),
    },
  });

  if (!rules.requireDispositionBeforeNext) {
    await prisma.powerDialerAttempt.update({
      where: { id: attemptId },
      data: {
        disposition: input.wasAnswered ? "Connected" : "No answer",
        dispositionEffectsAt: new Date(),
      },
    });
  }
}

export async function saveAttemptOutcomeWithProgression(
  workspaceId: string,
  attemptId: string,
  input: {
    disposition: string;
    notes?: string;
    callbackAt?: string | null;
    callRating?: number | null;
  },
) {
  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: attemptId, workspaceId },
    include: { session: { include: { campaign: true } } },
  });
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.session.status === "completed") throw new Error("Session ended");

  const rules = await resolveRulesForCampaign(workspaceId, attempt.session.campaign);
  const ext = parseExtendedConfig(attempt.session.campaign.configJson);
  const liveContext =
    attempt.status === "answered" || attempt.answerClassification === "human"
      ? "live"
      : "no_answer";
  const setId =
    liveContext === "live" && ext.liveAnswerDispositionSetId
      ? ext.liveAnswerDispositionSetId
      : liveContext === "no_answer" && ext.noAnswerDispositionSetId
        ? ext.noAnswerDispositionSetId
        : ext.dispositionSetId;
  const dispositionDef = await resolveDispositionByLabel(workspaceId, setId, input.disposition);
  if (dispositionDef?.requireNotes && !(input.notes && input.notes.trim())) {
    throw new Error("Notes are required for this disposition");
  }
  const { getPowerDialerSettings } = await import("@/lib/server/phone/power-dialer");
  const pdSettings = await getPowerDialerSettings(workspaceId);
  if (pdSettings.callRatingsEnabled) {
    const rating = input.callRating;
    if (rating == null || rating < 1 || rating > 5) {
      throw new Error("Call rating (1–5) is required");
    }
  }
  const callbackAt = input.callbackAt ? new Date(input.callbackAt) : null;
  const classification = attempt.answerClassification;
  const human = isHumanConversation(input.disposition, classification);

  await prisma.powerDialerAttempt.update({
    where: { id: attemptId },
    data: {
      disposition: input.disposition,
      notes: input.notes,
      callbackAt: input.disposition.toLowerCase() === "callback" ? callbackAt : callbackAt,
      status: "completed",
      endedAt: attempt.endedAt || new Date(),
      callRating: input.callRating ?? attempt.callRating,
      acwDeadlineAt: null,
    },
  });

  await applyDispositionEffects(prisma, {
    workspaceId,
    attemptId,
    contactId: attempt.contactId,
    campaignId: attempt.session.campaignId,
    disposition: input.disposition,
    dispositionDef,
    notes: input.notes,
    callbackAt,
    timezone: attempt.session.campaign.timezone,
    assignedUserId: attempt.session.repUserId,
    alreadyApplied: Boolean(attempt.dispositionEffectsAt),
  });

  if (dispositionDef) {
    await prisma.powerDialerAttempt.update({
      where: { id: attemptId },
      data: { dispositionId: dispositionDef.id },
    });
  }

  if (!attempt.dispositionEffectsAt) {
    await prisma.powerDialerAttempt.update({
      where: { id: attemptId },
      data: { dispositionEffectsAt: new Date() },
    });
  }

  const campaign = attempt.session.campaign;
  await prisma.powerDialerCampaign.update({
    where: { id: campaign.id },
    data: {
      attemptedCount: { increment: 1 },
      connectedCount: human ? { increment: 1 } : undefined,
      completedCount: dispositionIsTerminal(input.disposition) ? { increment: 1 } : undefined,
    },
  });

  const sessionEnded = attempt.session.status === "completed";
  if (!sessionEnded) {
    await prisma.powerDialerSession.update({
      where: { id: attempt.sessionId },
      data: {
        currentAttemptId: null,
        progressionPhase:
          attempt.session.status === "active" && rules.dialingMode === "power"
            ? "countdown"
            : "idle",
        nextCallAt:
          attempt.session.status === "active" && rules.dialingMode === "power"
            ? new Date(Date.now() + rules.postCallIntervalSeconds * 1000)
            : null,
      },
    });
  }

  const { applyPhoneFallthroughAfterAttempt } = await import("@/lib/server/crm/native/phone-fallthrough");
  await applyPhoneFallthroughAfterAttempt({
    workspaceId,
    sessionId: attempt.sessionId,
    contactId: attempt.contactId,
    disposition: input.disposition,
    dialedPhoneE164: attempt.dialedPhoneE164,
    phoneFieldPriority: rules.phoneFieldPriority,
  });

  return attempt;
}

export async function startSessionWithRep(
  workspaceId: string,
  campaignId: string,
  opts?: { focusContactId?: string },
) {
  const prisma = getPrisma();
  const repUserId = await assertRepAuthorized(workspaceId);
  await assertCampaignDialAccess(workspaceId, campaignId, repUserId);
  const { getPowerDialerSettings } = await import("@/lib/server/phone/power-dialer");
  const settings = await getPowerDialerSettings(workspaceId);
  if (!settings.complianceAcknowledgedAt) {
    throw new Error(
      "Compliance acknowledgement required — an admin must accept calling responsibilities under Settings → Compliance before the first dial session.",
    );
  }
  const { assertDialingWithinUsageLimits, assertPowerDialerConcurrencyLimits } = await import(
    "./usage-limits"
  );
  await assertDialingWithinUsageLimits(workspaceId);
  await assertPowerDialerConcurrencyLimits(workspaceId, { campaignId, repUserId });
  const campaign = await prisma.powerDialerCampaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) throw new Error("Campaign not found");

  const { resumeOrAttachActiveSession } = await import("./session-orchestration");
  const resumed = await resumeOrAttachActiveSession(workspaceId, campaignId, repUserId);
  if (resumed) return resumed;

  const active = await prisma.powerDialerSession.findFirst({
    where: { campaignId, status: { in: ["active", "paused"] } },
  });
  if (active) return active;

  const created = await prisma.powerDialerSession.create({
    data: {
      workspaceId,
      campaignId,
      status: "active",
      repUserId,
      progressionPhase: "idle",
      progressJson: opts?.focusContactId
        ? ({ focusContactId: opts.focusContactId } as import("@prisma/client").Prisma.InputJsonValue)
        : undefined,
    },
  });
  const { pdWebhookSessionStarted } = await import("./webhooks/lifecycle");
  pdWebhookSessionStarted({
    workspaceId,
    sessionId: created.id,
    campaignId,
    repUserId,
  });
  return created;
}

export async function endSessionHard(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: sessionId, workspaceId },
    select: { campaignId: true },
  });
  const { releaseSessionClaims } = await import("./team-queue-claims");
  await releaseSessionClaims(workspaceId, sessionId);
  await prisma.powerDialerAttempt.updateMany({
    where: {
      sessionId,
      workspaceId,
      status: { in: [...LIVE_STATUSES] },
    },
    data: { status: "cancelled", endedAt: new Date(), failureReason: "session_ended" },
  });
  const updated = await prisma.powerDialerSession.updateMany({
    where: { id: sessionId, workspaceId },
    data: {
      status: "completed",
      endedAt: new Date(),
      progressionPhase: "ended",
      nextCallAt: null,
      currentAttemptId: null,
    },
  });
  if (session?.campaignId) {
    const { markCampaignCompletedIfExhausted } = await import("./campaign-admin");
    await markCampaignCompletedIfExhausted(workspaceId, session.campaignId, "session_ended");
  }
  const { pdWebhookSessionEnded } = await import("./webhooks/lifecycle");
  pdWebhookSessionEnded({
    workspaceId,
    sessionId,
    campaignId: session?.campaignId,
  });
  return updated;
}

export { reasonToUserMessage };
