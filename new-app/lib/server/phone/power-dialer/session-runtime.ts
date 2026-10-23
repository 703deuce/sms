import { getPrisma } from "@/lib/server/db";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { resolveCampaignRules } from "./campaign-config";
import {
  evaluateContactEligibility,
  dispositionIsTerminal,
  reasonToUserMessage,
} from "./eligibility";
import { applyDispositionEffects, isHumanConversation } from "./disposition-effects";
import { resolveContactDialPhone } from "./phone-resolve";
import type {
  AnswerClassification,
  AttemptSummary,
  EligibilityResult,
  ProgressionPhase,
} from "./types";

const LIVE_STATUSES = new Set(["pending", "dialing", "ringing", "answered"]);

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
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: { campaign: true },
  });
  if (!session || session.status === "completed") return;

  const rules = resolveCampaignRules(session.campaign);
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
    include: { campaign: { include: { list: { include: { members: { include: { contact: true } } } } } } },
  });
  if (!session) throw new Error("Session not found");

  const rules = resolveCampaignRules(session.campaign);
  const repOk = Boolean(session.repUserId);
  const contactIds = session.campaign.list.members.map((m) => m.contactId);
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

  for (const m of session.campaign.list.members) {
    const c = m.contact;
    const campaignAttempts = campaignMap.get(c.id) || [];
    const sessAttempts = sessionByContact.get(c.id) || [];
    const eligibility = evaluateContactEligibility({
      contact: c,
      rules,
      campaignAttemptsForContact: campaignAttempts,
      sessionAttemptsForContact: sessAttempts,
      now,
      sessionActive: session.status === "active",
      sessionPaused: session.status === "paused",
      hasOpenDispositionBlock,
      anyLiveAttemptInSession: anyLive,
      repAuthorized: repOk,
    });
    counts[eligibility.bucket] += 1;
    if (!nextEligible && eligibility.eligible) {
      const attemptNumber =
        campaignAttempts.filter((a: AttemptSummary) => a.disposition || a.endedAt).length + 1;
      nextEligible = { contact: c, attemptNumber, eligibility };
    }
    if (!eligibility.eligible && eligibility.retryEligibleAt) {
      const t = eligibility.retryEligibleAt;
      if (!nextEligibleAt || t < nextEligibleAt) nextEligibleAt = t;
    }
  }

  return { counts, nextEligible, nextEligibleAt, rules, session };
}

export async function getSessionRuntime(workspaceId: string, sessionId: string) {
  await sweepPowerDialerTimeouts(workspaceId, sessionId);
  const { counts, nextEligible, nextEligibleAt, rules, session } =
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

  const rules = resolveCampaignRules(session.campaign);

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

  const live = await prisma.powerDialerAttempt.findFirst({
    where: { sessionId, status: { in: [...LIVE_STATUSES] } },
  });
  if (live) throw new Error("A call is already in progress for this session");

  if (input.idempotencyKey) {
    const existing = await prisma.powerDialerAttempt.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
  }

  const { nextEligible } = await buildEligibilityBreakdown(workspaceId, sessionId);
  if (!nextEligible || nextEligible.contact.id !== input.contactId) {
    throw new Error("Contact is not eligible to dial");
  }

  const seq = session.dialSequence + 1;
  const ringTimeoutAt = new Date(Date.now() + rules.ringTimeoutSeconds * 1000);

  try {
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

  const rules = resolveCampaignRules(attempt.session.campaign);
  const classification: AnswerClassification =
    input.answerClassification ||
    (input.wasAnswered ? "uncertain" : "no_answer");

  const status = input.wasAnswered ? "answered" : "no_answer";
  const endedAt = attempt.endedAt || new Date();

  await prisma.powerDialerAttempt.update({
    where: { id: attemptId },
    data: {
      status,
      answerClassification: classification,
      answeredAt: input.wasAnswered ? attempt.answeredAt || new Date() : attempt.answeredAt,
      endedAt,
      billableSeconds: input.billableSeconds ?? attempt.billableSeconds,
    },
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
  input: { disposition: string; notes?: string; callbackAt?: string | null },
) {
  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: attemptId, workspaceId },
    include: { session: { include: { campaign: true } } },
  });
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.session.status === "completed") throw new Error("Session ended");

  const rules = resolveCampaignRules(attempt.session.campaign);
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
    },
  });

  await applyDispositionEffects(prisma, {
    workspaceId,
    attemptId,
    contactId: attempt.contactId,
    disposition: input.disposition,
    notes: input.notes,
    callbackAt,
    alreadyApplied: Boolean(attempt.dispositionEffectsAt),
  });

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

  return attempt;
}

export async function startSessionWithRep(workspaceId: string, campaignId: string) {
  const prisma = getPrisma();
  const repUserId = await assertRepAuthorized(workspaceId);
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
      repUserId,
      progressionPhase: "idle",
    },
  });
}

export async function endSessionHard(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  await prisma.powerDialerAttempt.updateMany({
    where: {
      sessionId,
      workspaceId,
      status: { in: [...LIVE_STATUSES] },
    },
    data: { status: "cancelled", endedAt: new Date(), failureReason: "session_ended" },
  });
  return prisma.powerDialerSession.updateMany({
    where: { id: sessionId, workspaceId },
    data: {
      status: "completed",
      endedAt: new Date(),
      progressionPhase: "ended",
      nextCallAt: null,
      currentAttemptId: null,
    },
  });
}

export { reasonToUserMessage };
