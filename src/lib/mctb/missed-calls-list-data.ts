import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { appProductSourceToPrisma } from "@/lib/mass-texting/product-source";
import {
  buildMissedCallsListWhere,
  filterEventsByConsentMode,
  missedCallsOrderBy,
  MISSED_CALLS_PAGE_SIZE_DEFAULT,
  type MissedCallsListQuery,
} from "@/lib/mctb/missed-calls-list-filters";
import { loadMissedCallsListSummary } from "@/lib/mctb/missed-calls-list-summary";
import { countCallerMissedEventsToday } from "@/lib/mctb/repeat-caller";
import type { MissedCallEvent } from "@prisma/client";

export type MctbMissedCallsListData = {
  timezone: string;
  summary: {
    missedCount: number;
    recoveryTextsCount: number;
    repliesCount: number;
    needsReplyCount: number;
    rangeLabel: string;
  };
  events: Array<{
    id: string;
    callerE164: string;
    contactName: string | null;
    contactId: string | null;
    conversationId: string | null;
    businessE164: string;
    status: string;
    suppressionReason: string | null;
    detectedAt: Date;
    smsSentAt: Date | null;
    classification: string | null;
    callsToday?: number;
    automationState?: string | null;
    followUpStatus?: string | null;
    hasVoicemail?: boolean;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export async function loadMctbMissedCallsListData(
  workspaceId: string,
  query: MissedCallsListQuery,
): Promise<MctbMissedCallsListData> {
  const prisma = getPrisma();
  const config = await loadMissedCallTextConfig(workspaceId);
  const where = buildMissedCallsListWhere(workspaceId, query);
  const orderBy = missedCallsOrderBy(query.sort);
  const take = query.pageSize ?? MISSED_CALLS_PAGE_SIZE_DEFAULT;
  const skip = ((query.page ?? 1) - 1) * take;

  const dateScope = query.date ?? "all";

  const [total, events, summary] = await Promise.all([
    prisma.missedCallEvent.count({ where }),
    prisma.missedCallEvent.findMany({
      where,
      orderBy,
      skip,
      take,
    }),
    loadMissedCallsListSummary(workspaceId, dateScope),
  ]);

  const contactIds = [
    ...new Set(events.map((e: MissedCallEvent) => e.contactId).filter(Boolean)),
  ] as string[];

  const conversations =
    contactIds.length > 0
      ? await prisma.conversation.findMany({
          where: {
            workspaceId,
            contactId: { in: contactIds },
            productSource: appProductSourceToPrisma("mctb"),
          },
          orderBy: { updatedAt: "desc" },
          select: { id: true, contactId: true },
        })
      : [];

  const conversationByContact = new Map<string, string>();
  const conversationIds: string[] = [];
  for (const c of conversations) {
    if (c.contactId && !conversationByContact.has(c.contactId)) {
      conversationByContact.set(c.contactId, c.id);
      conversationIds.push(c.id);
    }
  }

  const automationRows =
    conversationIds.length > 0
      ? await prisma.mctbConversationAutomationState.findMany({
          where: { conversationId: { in: conversationIds } },
          select: { conversationId: true, state: true, followUpStatus: true },
        })
      : [];
  const automationByConversation = new Map(
    automationRows.map((r) => [r.conversationId, r]),
  );

  const mapped = await Promise.all(
    events.map(async (e: MissedCallEvent) => {
      const repeat = await countCallerMissedEventsToday(workspaceId, e.callerE164);
      let contactName: string | null = null;
      if (e.contactId) {
        const contact = await prisma.contact.findFirst({
          where: { id: e.contactId, workspaceId },
          select: { firstName: true, lastName: true },
        });
        if (contact) {
          contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || null;
        }
      }
      const conversationId = e.contactId ? conversationByContact.get(e.contactId) ?? null : null;
      const automation = conversationId ? automationByConversation.get(conversationId) : null;
      return {
        id: e.id,
        callerE164: e.callerE164,
        contactName,
        contactId: e.contactId,
        conversationId,
        businessE164: e.businessE164,
        status: e.status,
        suppressionReason: e.suppressionReason,
        detectedAt: e.detectedAt,
        smsSentAt: e.smsSentAt,
        classification: e.disposition,
        callsToday: repeat.missedToday,
        automationState: automation?.state ?? null,
        followUpStatus: automation?.followUpStatus ?? null,
        hasVoicemail: e.disposition === "voicemail",
      };
    }),
  );

  const filtered = filterEventsByConsentMode(mapped, query.consentMode);
  const listTotal = query.consentMode ? filtered.length : total;

  return {
    timezone: config.timezone || "America/New_York",
    summary,
    events: filtered.map((e) => ({
      ...e,
      detectedAt: e.detectedAt,
    })),
    pagination: {
      page: query.page ?? 1,
      pageSize: take,
      total: listTotal,
      totalPages: Math.max(1, Math.ceil(listTotal / take)),
    },
  };
}
