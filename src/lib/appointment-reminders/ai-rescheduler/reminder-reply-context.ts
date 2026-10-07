import "server-only";

import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";

const CONTEXT_KEY = "arSmsReminderContexts";
const MAX_CONTEXTS = 8;
const REPLY_WINDOW_MS = 21 * 24 * 60 * 60 * 1000;

export type ArSmsReminderContext = {
  appointmentId: string;
  sentAt: string;
  reminderGeneration?: number;
  timelineType?: string;
};

export function parseReminderContexts(customFields: unknown): ArSmsReminderContext[] {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) return [];
  const root = customFields as Record<string, unknown>;
  const raw = root[CONTEXT_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is ArSmsReminderContext =>
        Boolean(
          x &&
            typeof x === "object" &&
            typeof (x as ArSmsReminderContext).appointmentId === "string" &&
            typeof (x as ArSmsReminderContext).sentAt === "string",
        ),
    )
    .slice(0, MAX_CONTEXTS);
}

export function mergeReminderContext(
  customFields: unknown,
  entry: ArSmsReminderContext,
): Record<string, unknown> {
  const base =
    customFields && typeof customFields === "object" && !Array.isArray(customFields)
      ? { ...(customFields as Record<string, unknown>) }
      : {};
  const prev = parseReminderContexts(base);
  const next = [entry, ...prev.filter((c) => c.appointmentId !== entry.appointmentId)].slice(
    0,
    MAX_CONTEXTS,
  );
  return { ...base, [CONTEXT_KEY]: next };
}

export async function recordReminderSmsContext(input: {
  workspaceId: string;
  contactId: string;
  appointmentId: string;
  reminderGeneration?: number;
  timelineType?: string;
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

  const contextIds = contexts.map((c) => c.appointmentId);
  const fromContext = contextIds.filter((id) => upcoming.some((a) => a.id === id));
  if (fromContext.length === 1) return { appointmentId: fromContext[0]! };
  if (fromContext.length > 1) {
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
