import { getPrisma } from "@/lib/server/db";
import { assertCrmRead, contactVisibleToUser } from "./permissions";

export type TimelineItem = {
  id: string;
  kind: string;
  title: string;
  body?: string | null;
  at: string;
  href?: string;
  sensitive?: boolean;
};

export async function buildUnifiedContactTimeline(
  workspaceId: string,
  contactId: string,
  opts: { includeRecordings?: boolean },
) {
  const { userId, isAdmin } = await assertCrmRead(workspaceId);
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({ where: { id: contactId, workspaceId } });
  if (!contact) throw new Error("Contact not found");
  if (!contactVisibleToUser(contact, userId, isAdmin)) throw new Error("Not allowed");

  const [events, calls, attempts, tasks, callbacks, messages] = await Promise.all([
    prisma.contactActivityEvent.findMany({
      where: { contactId },
      orderBy: { occurredAt: "desc" },
      take: 80,
    }),
    prisma.humanCall.findMany({
      where: { workspaceId, contactId },
      orderBy: { startedAt: "desc" },
      take: 30,
      select: {
        id: true,
        direction: true,
        status: true,
        disposition: true,
        startedAt: true,
        answeredAt: true,
        endedAt: true,
        recordingUrl: true,
        transcriptText: true,
      },
    }),
    prisma.powerDialerAttempt.findMany({
      where: { workspaceId, contactId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { session: { select: { campaign: { select: { name: true } } } } },
    }),
    prisma.crmTask.findMany({
      where: { contactId },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.powerDialerCallback.findMany({
      where: { workspaceId, contactId },
      orderBy: { scheduledAt: "desc" },
      take: 20,
    }),
    prisma.conversation.findMany({
      where: { workspaceId, contactId },
      take: 5,
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, body: true, direction: true, createdAt: true } },
      },
    }),
  ]);

  const items: TimelineItem[] = [];

  for (const e of events) {
    items.push({
      id: e.id,
      kind: e.kind,
      title: e.title,
      body: e.body,
      at: e.occurredAt.toISOString(),
    });
  }
  for (const c of calls) {
    items.push({
      id: `call-${c.id}`,
      kind: c.direction === "inbound" ? "inbound_call" : "outbound_call",
      title: c.direction === "inbound" ? "Inbound call" : "Outbound call",
      body: c.disposition || c.status,
      at: (c.answeredAt || c.startedAt).toISOString(),
      href: `/app/phone/call-history?call=${c.id}`,
      sensitive: Boolean(c.recordingUrl) && !opts.includeRecordings,
    });
    if (opts.includeRecordings && c.recordingUrl) {
      items.push({
        id: `rec-${c.id}`,
        kind: "recording",
        title: "Call recording",
        body: c.transcriptText ? "Transcript available" : "Recording available",
        at: (c.endedAt || c.startedAt).toISOString(),
        href: `/app/phone/call-history?call=${c.id}`,
      });
    }
  }
  for (const a of attempts) {
    items.push({
      id: `pd-${a.id}`,
      kind: "power_dialer_call",
      title: `Power Dialer · ${a.session.campaign.name}`,
      body: a.disposition || a.status,
      at: a.createdAt.toISOString(),
      href: `/app/power-dialer/call-history?attempt=${a.id}`,
    });
  }
  for (const t of tasks) {
    items.push({
      id: `task-${t.id}`,
      kind: "task",
      title: t.title,
      body: t.status,
      at: (t.dueAt || t.updatedAt).toISOString(),
    });
  }
  for (const cb of callbacks) {
    items.push({
      id: `cb-${cb.id}`,
      kind: "callback",
      title: "Scheduled callback",
      body: cb.status,
      at: cb.scheduledAt.toISOString(),
      href: `/app/power-dialer/callbacks`,
    });
  }
  for (const conv of messages) {
    for (const m of conv.messages) {
      items.push({
        id: `sms-${m.id}`,
        kind: "sms",
        title: m.direction === "inbound" ? "Inbound SMS" : "Outbound SMS",
        body: m.body,
        at: m.createdAt.toISOString(),
        href: `/conversations/${conv.id}`,
      });
    }
  }

  items.sort((a, b) => b.at.localeCompare(a.at));
  return items.slice(0, 120);
}
