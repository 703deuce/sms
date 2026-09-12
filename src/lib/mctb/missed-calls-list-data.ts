import { getPrisma } from "@/lib/db";
import {
  buildMissedCallsListWhere,
  filterEventsByConsentMode,
  missedCallsOrderBy,
  MISSED_CALLS_PAGE_SIZE_DEFAULT,
  type MissedCallsListQuery,
} from "@/lib/mctb/missed-calls-list-filters";
import { countCallerMissedEventsToday } from "@/lib/mctb/repeat-caller";
import type { MissedCallEvent } from "@prisma/client";

export type MctbMissedCallsListData = {
  summary: { missedToday: number; sentToday: number; repliedToday: number };
  events: Array<{
    id: string;
    callerE164: string;
    contactName: string | null;
    businessE164: string;
    status: string;
    suppressionReason: string | null;
    detectedAt: Date;
    smsSentAt: Date | null;
    classification: string | null;
    callsToday?: number;
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
  const where = buildMissedCallsListWhere(workspaceId, query);
  const orderBy = missedCallsOrderBy(query.sort);
  const take = query.pageSize ?? MISSED_CALLS_PAGE_SIZE_DEFAULT;
  const skip = ((query.page ?? 1) - 1) * take;

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [total, events, missedToday, sentToday, repliedToday] = await Promise.all([
    prisma.missedCallEvent.count({ where }),
    prisma.missedCallEvent.findMany({
      where,
      orderBy,
      skip,
      take,
    }),
    prisma.missedCallEvent.count({
      where: { workspaceId, detectedAt: { gte: start } },
    }),
    prisma.missedCallEvent.count({
      where: { workspaceId, smsSentAt: { gte: start } },
    }),
    prisma.missedCallEvent.count({
      where: {
        workspaceId,
        status: "CUSTOMER_REPLIED",
        updatedAt: { gte: start },
      },
    }),
  ]);

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
      return {
        id: e.id,
        callerE164: e.callerE164,
        contactName,
        businessE164: e.businessE164,
        status: e.status,
        suppressionReason: e.suppressionReason,
        detectedAt: e.detectedAt,
        smsSentAt: e.smsSentAt,
        classification: e.disposition,
        callsToday: repeat.missedToday,
      };
    }),
  );

  const filtered = filterEventsByConsentMode(mapped, query.consentMode);
  const listTotal = query.consentMode ? filtered.length : total;

  return {
    summary: { missedToday, sentToday, repliedToday },
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
