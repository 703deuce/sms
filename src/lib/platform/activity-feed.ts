import { getPrisma } from "@/lib/db";

export type PlatformActivityItem = {
  id: string;
  type: string;
  label: string;
  at: string;
  href?: string;
  meta?: Record<string, unknown>;
};

export async function loadPlatformActivityFeed(
  workspaceId: string,
  limit = 40,
): Promise<PlatformActivityItem[]> {
  const prisma = getPrisma();
  const items: PlatformActivityItem[] = [];

  const [missed, srSessions, voicemails, callbacks] = await Promise.all([
    prisma.missedCallEvent.findMany({
      where: { workspaceId },
      orderBy: { detectedAt: "desc" },
      take: limit,
      select: {
        id: true,
        callerE164: true,
        status: true,
        suppressionReason: true,
        smsSentAt: true,
        detectedAt: true,
      },
    }),
    prisma.smartRoutingCallSession.findMany({
      where: { workspaceId },
      orderBy: { startedAt: "desc" },
      take: limit,
      select: { id: true, callerNumber: true, finalOutcome: true, startedAt: true, flowId: true },
    }),
    prisma.voicemailMessage.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, fromE164: true, createdAt: true, isRead: true },
    }),
    prisma.callbackRequest
      .findMany({
        where: { workspaceId },
        orderBy: { requestedAt: "desc" },
        take: limit,
        select: {
          id: true,
          callerE164: true,
          status: true,
          requestedAt: true,
          sourceRoute: true,
        },
      })
      .catch(() => []),
  ]);

  for (const e of missed) {
    const label =
      e.smsSentAt
        ? `Text sent to ${e.callerE164}`
        : e.status === "CUSTOMER_REPLIED"
          ? `Caller replied ${e.callerE164}`
          : e.status === "SUPPRESSED"
            ? `Missed call suppressed (${e.suppressionReason || "unknown"})`
            : `Missed call from ${e.callerE164}`;
    items.push({
      id: `mctb:${e.id}`,
      type: "mctb",
      label,
      at: e.detectedAt.toISOString(),
      href: `/voice/missed-calls/${e.id}`,
    });
  }

  for (const s of srSessions) {
    items.push({
      id: `sr:${s.id}`,
      type: "smart_routing",
      label: `Smart Routing call ${s.callerNumber || "unknown"} — ${s.finalOutcome || "in progress"}`,
      at: s.startedAt.toISOString(),
      href: s.flowId ? `/smart-routing/${s.flowId}/activity` : "/smart-routing",
    });
  }

  for (const v of voicemails) {
    items.push({
      id: `vm:${v.id}`,
      type: "voicemail",
      label: `Voicemail from ${v.fromE164 || "unknown"}`,
      at: v.createdAt.toISOString(),
      href: "/personal/voicemail",
      meta: { unread: !v.isRead },
    });
  }

  for (const c of callbacks) {
    items.push({
      id: `cb:${c.id}`,
      type: "callback",
      label: `Callback request ${c.callerE164}${c.sourceRoute ? ` (${c.sourceRoute})` : ""}`,
      at: c.requestedAt.toISOString(),
      href: "/voice/callback-requests",
      meta: { status: c.status },
    });
  }

  items.sort((a, b) => (a.at < b.at ? 1 : -1));
  return items.slice(0, limit);
}
