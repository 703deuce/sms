import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { traceMctbDebug } from "@/lib/mctb/debug";
import {
  buildMissedCallsListWhere,
  filterEventsByConsentMode,
  missedCallsOrderBy,
  parseMissedCallsListQuery,
} from "@/lib/mctb/missed-calls-list-filters";
import type { MissedCallEvent } from "@prisma/client";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const prisma = getPrisma();
  const { searchParams } = new URL(req.url);
  const query = parseMissedCallsListQuery(searchParams);
  const where = buildMissedCallsListWhere(workspaceId, query);
  const orderBy = missedCallsOrderBy(query.sort);

  traceMctbDebug("missed-calls", "get_start", { workspaceId, query });

  const skip = ((query.page ?? 1) - 1) * (query.pageSize ?? 25);
  const take = query.pageSize ?? 25;

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const { countCallerMissedEventsToday } = await import("@/lib/mctb/repeat-caller");

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
      const meta =
        e.metadata && typeof e.metadata === "object"
          ? (e.metadata as Record<string, unknown>)
          : {};
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
        transovoNumberE164:
          typeof meta.transovoNumberE164 === "string" ? meta.transovoNumberE164 : null,
        status: e.status,
        suppressionReason: e.suppressionReason,
        detectedAt: e.detectedAt,
        scheduledSmsAt: e.scheduledSmsAt,
        smsSentAt: e.smsSentAt,
        classification: e.disposition,
        consentMode: typeof meta.consentMode === "string" ? meta.consentMode : null,
        eligibilityStatus:
          typeof meta.eligibilityStatus === "string" ? meta.eligibilityStatus : null,
        captureMode: typeof meta.captureMode === "string" ? meta.captureMode : null,
        voiceCaptureStatus:
          typeof meta.voiceCaptureStatus === "string" ? meta.voiceCaptureStatus : null,
        callsToday: repeat.missedToday,
        totalCalls: repeat.total,
      };
    }),
  );

  const filtered = filterEventsByConsentMode(mapped, query.consentMode);

  traceMctbDebug("missed-calls", "get_complete", {
    workspaceId,
    eventCount: filtered.length,
    total,
    summary: { missedToday, sentToday, repliedToday },
  });

  return NextResponse.json({
    data: {
      summary: { missedToday, sentToday, repliedToday },
      events: filtered,
      pagination: {
        page: query.page ?? 1,
        pageSize: take,
        total: query.consentMode ? filtered.length : total,
        totalPages: Math.max(1, Math.ceil((query.consentMode ? filtered.length : total) / take)),
      },
    },
  });
}
