import "server-only";

import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import {
  mergeReminderContext,
  parseReminderContexts,
  type ArSmsReminderContext,
} from "./reminder-reply-context-store";

const REPLY_WINDOW_MS = 21 * 24 * 60 * 60 * 1000;

export type { ArSmsReminderContext };
export { parseReminderContexts, mergeReminderContext };

export async function recordReminderSmsContext(input: {
  workspaceId: string;
  contactId: string;
  appointmentId: string;
  reminderGeneration?: number;
  timelineType?: string;
  outboundProviderMessageId?: string;
}): Promise<void> {
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, workspaceId: input.workspaceId },
    select: { customFields: true },
  });
  if (!contact) return;
  await prisma.contact.update({
    where: { id: input.contactId },
    data: {
      customFields: mergeReminderContext(contact.customFields, {
        appointmentId: input.appointmentId,
        sentAt: new Date().toISOString(),
        reminderGeneration: input.reminderGeneration,
        timelineType: input.timelineType,
        outboundProviderMessageId: input.outboundProviderMessageId,
      }) as object,
    },
  });
}

export async function resolveReminderBoundAppointment(input: {
  workspaceId: string;
  contactId: string;
  inboundBody?: string;
  explicitAppointmentId?: string;
}): Promise<{ appointmentId: string } | { ambiguous: true; candidates: string[] } | null> {
  const prisma = getPrisma();
  const now = Date.now();
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, workspaceId: input.workspaceId },
    select: { customFields: true },
  });
  if (!contact) return null;

  if (input.explicitAppointmentId) {
    const row = await prisma.voiceAppointment.findFirst({
      where: {
        id: input.explicitAppointmentId,
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
      },
      select: { id: true },
    });
    if (row) return { appointmentId: row.id };
  }

  const contexts = parseReminderContexts(contact.customFields).filter(
    (c) => now - new Date(c.sentAt).getTime() <= REPLY_WINDOW_MS,
  );

  const upcoming = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      startsAt: { gte: new Date(now - 24 * 60 * 60 * 1000) },
      status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
    },
    orderBy: { startsAt: "asc" },
    take: 6,
    select: { id: true, metadata: true, startsAt: true },
  });

  if (!upcoming.length) return null;

  const sortedContexts = [...contexts].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
  );
  const contextIds = sortedContexts.map((c) => c.appointmentId);
  const fromContext = contextIds.filter((id) => upcoming.some((a) => a.id === id));
  if (fromContext.length === 1) return { appointmentId: fromContext[0]! };
  if (fromContext.length > 1) {
    const latestId = sortedContexts.find((c) => fromContext.includes(c.appointmentId))?.appointmentId;
    if (latestId) return { appointmentId: latestId };
    return { ambiguous: true, candidates: fromContext };
  }

  if (upcoming.length === 1) return { appointmentId: upcoming[0]!.id };

  const metaMatch = upcoming.filter((a) => {
    const meta = (a.metadata || {}) as AppointmentMetadata;
    return meta.lastReminderSmsAt && contextIds.includes(a.id);
  });
  if (metaMatch.length === 1) return { appointmentId: metaMatch[0]!.id };

  return { ambiguous: true, candidates: upcoming.map((a) => a.id) };
}
