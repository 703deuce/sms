import "server-only";

import { getPrisma } from "@/lib/db";
import { getAppointment } from "@/lib/appointments/appointments-service";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import {
  resolveArCustomerResponseSummary,
  type ArCustomerResponseSummary,
} from "@/lib/appointment-reminders/ar-sms-customer-outcome";
import { resolveArAppointmentContactDisplay } from "@/lib/appointment-reminders/contact-display";

export type ArConversationListItem = {
  appointmentId: string;
  conversationId: string | null;
  customerName: string;
  customerPhone: string | null;
  appointmentTitle: string;
  startsAt: string;
  timezone: string | null;
  lastMessagePreview: string;
  lastActivityAt: string;
  unread: boolean;
  needsAttention: boolean;
  customerResponse: ArCustomerResponseSummary;
};

export type ArConversationThreadMessage = {
  id: string;
  direction: "inbound" | "outbound" | "system";
  body: string;
  createdAt: string;
  deliveryStatus?: string | null;
  label?: string | null;
  providerMessageId?: string | null;
};

const NEEDS_ATTENTION_KINDS = new Set([
  "cancel_pending",
  "reschedule_pending",
  "reschedule_requested",
  "awaiting_reply",
]);

/**
 * Recent AR SMS conversations for Overview (compact list).
 */
export async function loadArConversationInbox(
  workspaceId: string,
  limit = 8,
): Promise<ArConversationListItem[]> {
  const prisma = getPrisma();
  const sessions = await prisma.arSmsReplySession.findMany({
    where: { workspaceId },
    orderBy: { lastUsedAt: "desc" },
    take: Math.min(limit * 3, 60),
    select: {
      appointmentId: true,
      conversationId: true,
      lastUsedAt: true,
      conversation: { select: { unread: true, updatedAt: true } },
    },
  });

  const byAppointment = new Map<string, typeof sessions[number]>();
  for (const s of sessions) {
    if (!byAppointment.has(s.appointmentId)) byAppointment.set(s.appointmentId, s);
  }

  const appointmentIds = [...byAppointment.keys()].slice(0, limit * 2);
  if (!appointmentIds.length) return [];

  const appointments = (
    await Promise.all(appointmentIds.map((id) => getAppointment(workspaceId, id)))
  ).filter((a): a is NonNullable<typeof a> => Boolean(a));
  const apptMap = new Map(appointments.map((a) => [a.id, a]));

  const conversationIds = [...byAppointment.values()]
    .map((s) => s.conversationId)
    .filter((id): id is string => Boolean(id));

  const latestByConvo = new Map<string, { body: string; createdAt: Date; direction: string }>();
  if (conversationIds.length) {
    const messages = await prisma.conversationMessage.findMany({
      where: { conversationId: { in: conversationIds } },
      orderBy: { createdAt: "desc" },
      take: conversationIds.length * 3,
      select: { conversationId: true, body: true, createdAt: true, direction: true },
    });
    for (const m of messages) {
      if (!latestByConvo.has(m.conversationId)) {
        latestByConvo.set(m.conversationId, m);
      }
    }
  }

  const rows: ArConversationListItem[] = [];

  for (const [appointmentId, session] of byAppointment) {
    const appt = apptMap.get(appointmentId);
    if (!appt) continue;

    const meta = (appt.metadata || {}) as AppointmentMetadata;
    const customerResponse = resolveArCustomerResponseSummary({
      status: appt.status,
      startsAt: appt.startsAt,
      timezone: appt.timezone,
      metadata: meta,
    });

    const contact = resolveArAppointmentContactDisplay(
      meta,
      appt.inviteeName,
      appt.inviteePhone,
      appt.serviceName,
    );

    const latest = session.conversationId
      ? latestByConvo.get(session.conversationId)
      : undefined;

    const lastActivityAt =
      latest?.createdAt.toISOString() ||
      customerResponse.at ||
      session.lastUsedAt.toISOString();

    rows.push({
      appointmentId,
      conversationId: session.conversationId,
      customerName: contact.customerName,
      customerPhone: appt.inviteePhone || null,
      appointmentTitle: contact.appointmentTitle,
      startsAt: appt.startsAt,
      timezone: appt.timezone,
      lastMessagePreview: latest?.body?.trim() || customerResponse.detailLine || customerResponse.label,
      lastActivityAt,
      unread: session.conversation?.unread ?? false,
      needsAttention: NEEDS_ATTENTION_KINDS.has(customerResponse.kind),
      customerResponse,
    });
  }

  rows.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  return rows.slice(0, limit);
}

export async function loadArConversationThread(
  workspaceId: string,
  appointmentId: string,
  cursor?: string,
  pageSize = 40,
): Promise<{
  appointmentId: string;
  conversationId: string | null;
  customerName: string;
  appointmentTitle: string;
  startsAt: string;
  timezone: string | null;
  customerResponse: ArCustomerResponseSummary;
  messages: ArConversationThreadMessage[];
  nextCursor: string | null;
}> {
  const prisma = getPrisma();
  const appt = await getAppointment(workspaceId, appointmentId);
  if (!appt) {
    throw new Error("not_found");
  }

  const meta = (appt.metadata || {}) as AppointmentMetadata;
  const customerResponse = resolveArCustomerResponseSummary({
    status: appt.status,
    startsAt: appt.startsAt,
    timezone: appt.timezone,
    metadata: meta,
  });
  const contact = resolveArAppointmentContactDisplay(
    meta,
    appt.inviteeName,
    appt.inviteePhone,
    appt.serviceName,
  );

  const session = await prisma.arSmsReplySession.findFirst({
    where: { workspaceId, appointmentId },
    orderBy: { lastUsedAt: "desc" },
    select: { conversationId: true, id: true },
  });

  const conversationId = session?.conversationId ?? null;
  const messages: ArConversationThreadMessage[] = [];

  if (conversationId) {
    if (!cursor) {
      const { repairMissingArConversationOutboundFromLedger } = await import(
        "@/lib/appointment-reminders/ar-conversation-thread-hydration"
      );
      await repairMissingArConversationOutboundFromLedger({
        conversationId,
        workspaceId,
        appointmentId,
        replySessionId: session?.id ?? null,
      });
    }

    const take = Math.min(200, Math.max(10, pageSize));
    const rows = await prisma.conversationMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        body: true,
        direction: true,
        createdAt: true,
        providerMessageId: true,
      },
    });

    let nextCursor = rows.length >= take ? rows[rows.length - 1]?.id ?? null : null;

    for (const m of rows) {
      const dir = String(m.direction || "").toLowerCase();
      messages.push({
        id: m.id,
        direction: dir === "inbound" ? "inbound" : dir === "outbound" ? "outbound" : "system",
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        providerMessageId: m.providerMessageId,
        label:
          dir === "outbound"
            ? "Sent by Transovo"
            : dir === "inbound"
              ? "Customer"
              : "System",
      });
    }

    if (!cursor) {
      const { loadProvenArAppointmentOutboundLedger, mergeArConversationThreadMessages } =
        await import("@/lib/appointment-reminders/ar-conversation-thread-hydration");
      const ledger = await loadProvenArAppointmentOutboundLedger({
        workspaceId,
        appointmentId,
        replySessionId: session?.id ?? null,
      });
      const merged = mergeArConversationThreadMessages(messages, ledger);
      messages.length = 0;
      messages.push(...merged);
      nextCursor = null;
    }

    await prisma.conversation.updateMany({
      where: { id: conversationId, workspaceId },
      data: { unread: false },
    });

    return {
      appointmentId,
      conversationId,
      customerName: contact.customerName,
      appointmentTitle: contact.appointmentTitle,
      startsAt: appt.startsAt,
      timezone: appt.timezone,
      customerResponse,
      messages,
      nextCursor,
    };
  }

  return {
    appointmentId,
    conversationId: null,
    customerName: contact.customerName,
    appointmentTitle: contact.appointmentTitle,
    startsAt: appt.startsAt,
    timezone: appt.timezone,
    customerResponse,
    messages: [],
    nextCursor: null,
  };
}
