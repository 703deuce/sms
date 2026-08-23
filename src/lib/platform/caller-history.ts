import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type CallerHistoryEntry = {
  id: string;
  kind: string;
  label: string;
  at: string;
  href?: string;
};

export async function loadCallerHistory(
  workspaceId: string,
  callerE164: string,
): Promise<CallerHistoryEntry[]> {
  const prisma = getPrisma();
  const normalized = normalizeE164(callerE164) || callerE164;
  const entries: CallerHistoryEntry[] = [];

  const [sessions, missed, callbacks, voicemails, linkClicks] = await Promise.all([
    prisma.smartRoutingCallSession.findMany({
      where: { workspaceId, callerNumber: normalized },
      orderBy: { startedAt: "desc" },
      take: 30,
      select: { id: true, startedAt: true, finalOutcome: true },
    }),
    prisma.missedCallEvent.findMany({
      where: { workspaceId, callerE164: normalized },
      orderBy: { detectedAt: "desc" },
      take: 30,
      select: { id: true, detectedAt: true, status: true, smsSentAt: true },
    }),
    prisma.callbackRequest.findMany({
      where: { workspaceId, callerE164: normalized },
      orderBy: { requestedAt: "desc" },
      take: 20,
      select: { id: true, requestedAt: true, status: true, completedAt: true },
    }),
    prisma.voicemailMessage.findMany({
      where: { workspaceId, fromE164: normalized },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, createdAt: true, transcriptText: true },
    }),
    prisma.linkClickEvent.findMany({
      where: { workspaceId, phone: normalized },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, createdAt: true, destinationUrl: true },
    }),
  ]);

  for (const s of sessions) {
    entries.push({
      id: `sr:${s.id}`,
      kind: "smart_routing",
      label: `Inbound call · ${s.finalOutcome ?? "in progress"}`,
      at: s.startedAt.toISOString(),
      href: `/smart-routing/activity?session=${s.id}`,
    });
  }
  for (const m of missed) {
    entries.push({
      id: `mctb:${m.id}`,
      kind: "missed_call",
      label: m.smsSentAt ? `Missed call · text sent` : `Missed call · ${m.status}`,
      at: m.detectedAt.toISOString(),
      href: `/voice/missed-calls/${m.id}`,
    });
  }
  for (const c of callbacks) {
    entries.push({
      id: `cb:${c.id}`,
      kind: "callback",
      label: `Callback · ${c.status}`,
      at: c.requestedAt.toISOString(),
      href: "/voice/callback-requests",
    });
  }
  for (const v of voicemails) {
    entries.push({
      id: `vm:${v.id}`,
      kind: "voicemail",
      label: v.transcriptText ? `Voicemail · ${v.transcriptText.slice(0, 40)}…` : "Voicemail",
      at: v.createdAt.toISOString(),
      href: "/voice/voicemail",
    });
  }
  for (const l of linkClicks) {
    entries.push({
      id: `link:${l.id}`,
      kind: "link_click",
      label: `Link click · ${l.destinationUrl ?? "tracked link"}`,
      at: l.createdAt.toISOString(),
    });
  }

  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
