import { getPrisma } from "@/lib/server/db";
import { evaluateListMemberEligibility, loadCampaignEligibilityContext } from "./campaign-eligibility-helpers";
import { buildEligibilityBreakdown } from "./session-runtime";

/** M11 — add contact to active campaign list / session queue with eligibility feedback. */
export async function addContactToActiveSessionQueue(
  workspaceId: string,
  sessionId: string,
  contactId: string,
) {
  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: { campaign: { include: { list: true } } },
  });
  if (!session) throw new Error("Session not found");
  if (!["active", "paused"].includes(session.status)) {
    return { ok: false, reason: "session_not_active", message: "Session is not active" };
  }

  const contact = await prisma.contact.findFirst({ where: { id: contactId, workspaceId } });
  if (!contact) return { ok: false, reason: "contact_not_found", message: "Contact not found" };

  const listId = session.campaign.listId;
  const existing = await prisma.contactListMember.findFirst({
    where: { listId, contactId },
  });
  const ws = await (await import("@/lib/server/phone/power-dialer")).getPowerDialerSettings(workspaceId);
  if (ws.preventDuplicatePerContact && existing) {
    return {
      ok: false,
      reason: "already_on_list",
      message: "Contact is already on this campaign list",
    };
  }

  if (!existing) {
    const maxSort = await prisma.contactListMember.aggregate({
      where: { listId },
      _max: { queueSortOrder: true },
    });
    await prisma.contactListMember.create({
      data: {
        listId,
        contactId,
        queueSortOrder: (maxSort._max.queueSortOrder ?? 0) + 1,
        dialPriority: 0,
      },
    });
  }

  const ctx = await loadCampaignEligibilityContext(session.campaign);
  const campaignAttempts = await prisma.powerDialerAttempt.findMany({
    where: { workspaceId, contactId, session: { campaignId: session.campaignId } },
    select: { status: true, disposition: true, attemptNumber: true, createdAt: true, endedAt: true },
  });
  const sessAttempts = await prisma.powerDialerAttempt.findMany({
    where: { sessionId, contactId },
    select: { status: true, disposition: true, attemptNumber: true, createdAt: true, endedAt: true },
  });
  const eligibility = await evaluateListMemberEligibility({
    workspaceId,
    campaign: session.campaign,
    contact,
    campaignAttempts,
    sessionAttempts: sessAttempts,
    now: new Date(),
    ctx,
    sessionActive: session.status === "active",
    sessionPaused: session.status === "paused",
    sessionRepUserId: session.repUserId,
  });

  const progress =
    session.progressJson && typeof session.progressJson === "object"
      ? { ...(session.progressJson as object) }
      : {};
  const focusIds = Array.isArray((progress as { liveAddedContactIds?: string[] }).liveAddedContactIds)
    ? (progress as { liveAddedContactIds: string[] }).liveAddedContactIds
    : [];
  if (!focusIds.includes(contactId)) {
    await prisma.powerDialerSession.update({
      where: { id: sessionId },
      data: {
        progressJson: {
          ...progress,
          liveAddedContactIds: [...focusIds, contactId],
          focusContactId: contactId,
        } as import("@prisma/client").Prisma.InputJsonValue,
      },
    });
  }

  if (!eligibility.eligible) {
    const { reasonToUserMessage } = await import("./session-runtime");
    return {
      ok: true,
      added: true,
      eligible: false,
      reason: eligibility.reason,
      message: reasonToUserMessage(eligibility.reason),
    };
  }

  await buildEligibilityBreakdown(workspaceId, sessionId);
  return {
    ok: true,
    added: true,
    eligible: true,
    message: "Contact added to queue and eligible to dial",
  };
}
