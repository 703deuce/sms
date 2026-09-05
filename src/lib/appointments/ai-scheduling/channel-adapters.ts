import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { mergeConversationState } from "./conversation-state";
import { handleAppointmentAIRequest } from "./service";
import type { AppointmentAiResult } from "./schema";

const APPOINTMENT_SIGNAL =
  /\b(appointment|book|booking|schedule|reschedule|cancel|confirm|availability|available|waitlist|slot|time|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

export function looksAppointmentRelated(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length <= 2) return false;
  return APPOINTMENT_SIGNAL.test(trimmed);
}

export async function tryHandleInboundAppointmentAi(input: {
  workspaceId: string;
  contactId: string;
  conversationId?: string;
  message: string;
  providerMessageId?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<{ handled: true; replyText: string; result: AppointmentAiResult } | { handled: false }> {
  if (!looksAppointmentRelated(input.message)) {
    const prisma = getPrisma();
    const upcoming = await prisma.voiceAppointment.count({
      where: {
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        startsAt: { gte: new Date() },
        status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
      },
    });
    if (!upcoming) return { handled: false };
  }

  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  if (platform.bookingEnabled === false) return { handled: false };

  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, workspaceId: input.workspaceId },
    select: { customFields: true },
  });

  const result = await handleAppointmentAIRequest({
    workspaceId: input.workspaceId,
    message: input.message,
    channel: input.conversationId ? "conversation" : "sms",
    customerId: input.contactId,
    conversationId: input.conversationId,
    conversationHistory: input.conversationHistory,
    contactCustomFields: contact?.customFields,
    requestId: input.providerMessageId,
  });

  const statePatch = result.data?.conversationState;
  if (statePatch && contact) {
    await prisma.contact.update({
      where: { id: input.contactId },
      data: {
        customFields: mergeConversationState(contact.customFields, statePatch) as object,
      },
    });
  }

  if (result.type === "OUT_OF_SCOPE") {
    return { handled: false };
  }

  return { handled: true, replyText: result.message, result };
}

export async function handleConversationAppointmentMessage(input: {
  workspaceId: string;
  contactId: string;
  conversationId: string;
  message: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<AppointmentAiResult> {
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, workspaceId: input.workspaceId },
    select: { customFields: true },
  });

  const result = await handleAppointmentAIRequest({
    workspaceId: input.workspaceId,
    message: input.message,
    channel: "conversation",
    customerId: input.contactId,
    conversationId: input.conversationId,
    conversationHistory: input.conversationHistory,
    contactCustomFields: contact?.customFields,
  });

  const statePatch = result.data?.conversationState;
  if (statePatch) {
    await prisma.contact.update({
      where: { id: input.contactId },
      data: {
        customFields: mergeConversationState(contact?.customFields, statePatch) as object,
      },
    });
  }

  return result;
}
