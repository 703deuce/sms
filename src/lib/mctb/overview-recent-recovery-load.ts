import "server-only";

import { getPrisma } from "@/lib/db";
import { appProductSourceToPrisma } from "@/lib/mass-texting/product-source";
import { loadLatestTeamBriefsForMissedCalls } from "@/lib/mctb/handoff/team-activity-brief";
import { mapMissedCallToOverviewRecoveryRow } from "@/lib/mctb/overview-recent-recovery-row";
import type { MctbOverviewRecentRecoveryRow } from "@/lib/mctb/overview-types";

type MissedEventRow = {
  id: string;
  callerE164: string;
  detectedAt: Date;
  status: string;
  suppressionReason: string | null;
  smsSentAt: Date | null;
  contactId: string | null;
};

export async function loadMctbOverviewRecentRecoveryRows(
  workspaceId: string,
  events: MissedEventRow[],
  aiRecoveryEnabled: boolean,
): Promise<MctbOverviewRecentRecoveryRow[]> {
  if (!events.length) return [];

  const ids = events.map((e) => e.id);
  const contactIds = [...new Set(events.map((e) => e.contactId).filter(Boolean))] as string[];

  const prisma = getPrisma();
  const productSource = appProductSourceToPrisma("mctb");

  const [briefs, contacts, conversations, voicemails] = await Promise.all([
    loadLatestTeamBriefsForMissedCalls(workspaceId, ids).catch(() => new Map()),
    contactIds.length
      ? prisma.contact.findMany({
          where: { workspaceId, id: { in: contactIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
    prisma.conversation.findMany({
      where: {
        workspaceId,
        productSource,
        missedCallEventId: { in: ids },
      },
      select: {
        id: true,
        missedCallEventId: true,
        _count: { select: { messages: true } },
        messages: {
          select: { direction: true },
        },
      },
    }),
    prisma.voicemailMessage.findMany({
      where: {
        workspaceId,
        OR: events.map((e) => ({
          fromE164: e.callerE164,
          createdAt: {
            gte: new Date(e.detectedAt.getTime() - 10 * 60 * 1000),
            lte: new Date(e.detectedAt.getTime() + 2 * 60 * 60 * 1000),
          },
        })),
      },
      select: { fromE164: true, createdAt: true },
    }),
  ]);

  const contactNameById = new Map<string, string>();
  for (const c of contacts) {
    const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
    if (name) contactNameById.set(c.id, name);
  }

  const conversationByEvent = new Map<
    string,
    { id: string; messageCount: number; outboundCount: number }
  >();
  for (const conv of conversations) {
    if (!conv.missedCallEventId) continue;
    const outboundCount = conv.messages.filter((m) => {
      const dir = String(m.direction || "").toLowerCase();
      return dir === "outbound" || dir === "out";
    }).length;
    conversationByEvent.set(conv.missedCallEventId, {
      id: conv.id,
      messageCount: conv._count.messages,
      outboundCount,
    });
  }

  const voicemailByCaller = new Set(voicemails.map((v) => v.fromE164));

  return events.map((event) => {
    const brief = briefs.get(event.id);
    const contactName = event.contactId ? contactNameById.get(event.contactId) ?? null : null;
    const conversation = conversationByEvent.get(event.id) ?? null;
    const hasVoicemail = voicemailByCaller.has(event.callerE164);

    return mapMissedCallToOverviewRecoveryRow({
      event,
      contactName,
      brief,
      conversation,
      hasVoicemail,
      aiRecoveryEnabled,
    });
  });
}
