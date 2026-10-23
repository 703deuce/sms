import { getPrisma } from "@/lib/server/db";
import {
  buildEligibilityBreakdown,
  createAttemptForSession,
  sweepPowerDialerTimeouts,
} from "./session-runtime";
import { assertDialingWithinUsageLimits, assertPowerDialerConcurrencyLimits } from "./usage-limits";

const LIVE_STATUSES = ["pending", "dialing", "ringing", "answered"] as const;

export type UpcomingContactRow = {
  contactId: string;
  attemptNumber: number;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  company: string | null;
};

/** Server tick: advance countdown, enforce pause/preview gates; does not place Telnyx calls. */
export async function orchestratePowerDialerSession(workspaceId: string, sessionId: string) {
  await sweepPowerDialerTimeouts(workspaceId, sessionId);
  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: { campaign: true },
  });
  if (!session) throw new Error("Session not found");
  if (session.status === "completed") return { session, advanced: false };

  await assertDialingWithinUsageLimits(workspaceId);
  await assertPowerDialerConcurrencyLimits(workspaceId, {
    sessionId,
    campaignId: session.campaignId,
    repUserId: session.repUserId,
  });

  const progress =
    session.progressJson && typeof session.progressJson === "object"
      ? (session.progressJson as Record<string, unknown>)
      : {};

  const previewHeld = progress.previewHeld === true;
  const now = new Date();

  if (session.status === "active" && session.progressionPhase === "countdown" && session.nextCallAt) {
    if (session.nextCallAt <= now) {
      await prisma.powerDialerSession.update({
        where: { id: sessionId },
        data: { nextCallAt: now },
      });
    }
  }

  const { rules } = await buildEligibilityBreakdown(workspaceId, sessionId);
  const { normalizeDialingMode, isMultiLineDialMode } = await import("./dial-modes");
  const mode = normalizeDialingMode(rules.dialingMode);
  const progressiveAuto =
    mode === "power" || mode === "parallel" || mode === "parallel_amd" || mode === "predictive";
  const autoAdvanceAllowed =
    session.status === "active" &&
    progressiveAuto &&
    !previewHeld &&
    session.progressionPhase === "countdown" &&
    (!session.nextCallAt || session.nextCallAt <= now);

  return {
    session,
    advanced: autoAdvanceAllowed,
    previewHeld,
    rules,
  };
}

export async function listUpcomingEligibleContacts(
  workspaceId: string,
  sessionId: string,
  limit = 5,
): Promise<UpcomingContactRow[]> {
  await sweepPowerDialerTimeouts(workspaceId, sessionId);
  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: { campaign: { include: { list: { include: { members: { include: { contact: true } } } } } } },
  });
  if (!session) throw new Error("Session not found");

  const skipped = new Set<string>();
  const progress =
    session.progressJson && typeof session.progressJson === "object"
      ? (session.progressJson as { skippedContactIds?: string[] })
      : {};
  for (const id of progress.skippedContactIds || []) skipped.add(id);

  const {
    evaluateListMemberEligibility,
    loadCampaignEligibilityContext,
    loadDueCallbackContactIds,
  } = await import("./campaign-eligibility-helpers");
  const { parseCampaignAdvanced } = await import("./campaign-advanced");
  const { sortCampaignQueueMembers } = await import("./queue-order");
  const ctx = await loadCampaignEligibilityContext(session.campaign);
  const advanced = parseCampaignAdvanced(session.campaign.configJson);

  const rows: UpcomingContactRow[] = [];
  const now = new Date();

  const sorted = sortCampaignQueueMembers(
    session.campaign.list.members.map((m) => ({
      member: m,
      contactId: m.contactId,
      dialPriority: m.dialPriority,
      queueSortOrder: m.queueSortOrder,
      createdAt: m.contact.createdAt,
    })),
    advanced,
  );
  const dueIds = await loadDueCallbackContactIds(
    workspaceId,
    session.campaignId,
    session.repUserId,
    now,
  );
  const dueSet = new Set(dueIds);
  let ordered = sorted.map((r) => r.member);
  if (dueSet.size) {
    ordered = [
      ...ordered.filter((m) => dueSet.has(m.contactId)),
      ...ordered.filter((m) => !dueSet.has(m.contactId)),
    ];
  }

  for (const m of ordered) {
    if (skipped.has(m.contactId)) continue;
    const c = m.contact;
    const campaignAttempts = await prisma.powerDialerAttempt.findMany({
      where: { workspaceId, contactId: c.id, session: { campaignId: session.campaignId } },
      select: { status: true, disposition: true, attemptNumber: true, createdAt: true, endedAt: true },
    });
    const sessAttempts = await prisma.powerDialerAttempt.findMany({
      where: { sessionId, contactId: c.id },
      select: { status: true, disposition: true, attemptNumber: true, createdAt: true, endedAt: true },
    });
    const eligibility = await evaluateListMemberEligibility({
      workspaceId,
      campaign: session.campaign,
      contact: c,
      campaignAttempts: campaignAttempts,
      sessionAttempts: sessAttempts,
      now,
      ctx,
      sessionActive: session.status === "active",
      sessionPaused: session.status === "paused",
      sessionRepUserId: session.repUserId,
    });
    if (!eligibility.eligible) continue;
    const attemptNumber =
      campaignAttempts.filter((a) => a.disposition || a.endedAt).length + 1;
    rows.push({
      contactId: c.id,
      attemptNumber,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      company: c.company,
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

/** Reconcile after refresh: cancel duplicate live attempts, reattach currentAttemptId. */
export async function reconcilePowerDialerSession(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  const live = await prisma.powerDialerAttempt.findMany({
    where: { sessionId, workspaceId, status: { in: [...LIVE_STATUSES] } },
    orderBy: { createdAt: "asc" },
  });
  if (live.length <= 1) {
    const keep = live[0];
    if (keep) {
      await prisma.powerDialerSession.updateMany({
        where: { id: sessionId, workspaceId },
        data: { currentAttemptId: keep.id, progressionPhase: "dialing" },
      });
    }
    return { reconciled: live.length, cancelled: 0 };
  }
  const [keep, ...dupes] = live;
  const now = new Date();
  for (const d of dupes) {
    await prisma.powerDialerAttempt.update({
      where: { id: d.id },
      data: { status: "cancelled", endedAt: now, failureReason: "duplicate_live_reconcile" },
    });
  }
  await prisma.powerDialerSession.updateMany({
    where: { id: sessionId, workspaceId },
    data: { currentAttemptId: keep.id },
  });
  return { reconciled: live.length, cancelled: dupes.length };
}

export async function resumeOrAttachActiveSession(
  workspaceId: string,
  campaignId: string,
  repUserId: string,
) {
  const prisma = getPrisma();
  const existing = await prisma.powerDialerSession.findFirst({
    where: {
      workspaceId,
      campaignId,
      repUserId,
      status: { in: ["active", "paused"] },
    },
    orderBy: { startedAt: "desc" },
  });
  if (existing) {
    await reconcilePowerDialerSession(workspaceId, existing.id);
    return existing;
  }
  return null;
}

export async function skipContactInSession(
  workspaceId: string,
  sessionId: string,
  contactId: string,
) {
  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({ where: { id: sessionId, workspaceId } });
  if (!session) throw new Error("Session not found");
  const progress =
    session.progressJson && typeof session.progressJson === "object"
      ? { ...(session.progressJson as object) }
      : {};
  const skipped = new Set(
    Array.isArray((progress as { skippedContactIds?: string[] }).skippedContactIds)
      ? (progress as { skippedContactIds: string[] }).skippedContactIds
      : [],
  );
  skipped.add(contactId);
  await prisma.powerDialerSession.update({
    where: { id: sessionId },
    data: {
      progressJson: {
        ...progress,
        skippedContactIds: [...skipped],
      } as import("@prisma/client").Prisma.InputJsonValue,
      progressionPhase: session.status === "active" ? "countdown" : session.progressionPhase,
      nextCallAt: new Date(),
    },
  });
}

export async function setPreviewHeld(
  workspaceId: string,
  sessionId: string,
  held: boolean,
) {
  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({ where: { id: sessionId, workspaceId } });
  if (!session) throw new Error("Session not found");
  const progress =
    session.progressJson && typeof session.progressJson === "object"
      ? { ...(session.progressJson as object) }
      : {};
  await prisma.powerDialerSession.update({
    where: { id: sessionId },
    data: {
      progressJson: { ...progress, previewHeld: held } as import("@prisma/client").Prisma.InputJsonValue,
    },
  });
}

export { createAttemptForSession };
