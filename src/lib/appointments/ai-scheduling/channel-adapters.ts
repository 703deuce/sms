import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { handleUnifiedAiBooking } from "@/lib/appointments/ai-booking-orchestrator";
import { mergeConversationState, parseConversationState } from "./conversation-state";
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
  const prisma = getPrisma();
  const contactEarly = await prisma.contact.findFirst({
    where: { id: input.contactId, workspaceId: input.workspaceId },
    select: { customFields: true },
  });
  const activeReschedule = parseConversationState(contactEarly?.customFields);
  const inArRescheduleThread =
    activeReschedule?.activeIntent === "RESCHEDULE" && Boolean(activeReschedule.appointmentId);

  if (!inArRescheduleThread && !looksAppointmentRelated(input.message)) {
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
  const { resolveAiReschedulerConfig } = await import(
    "@/lib/appointment-reminders/ai-rescheduler/types"
  );
  const ar = resolveAiReschedulerConfig(platform);
  const arSmsActive = ar.mode === "ai" || ar.mode === "notify";
  if (platform.bookingEnabled === false && !arSmsActive) return { handled: false };

  const contact = contactEarly;

  const result = await handleUnifiedAiBooking({
    workspaceId: input.workspaceId,
    channel: "sms",
    message: input.message,
    contactId: input.contactId,
    conversationId: input.conversationId,
    requestId: input.providerMessageId,
    conversationHistory: input.conversationHistory,
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

  const result = await handleUnifiedAiBooking({
    workspaceId: input.workspaceId,
    channel: "sms",
    message: input.message,
    contactId: input.contactId,
    conversationId: input.conversationId,
    conversationHistory: input.conversationHistory,
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
