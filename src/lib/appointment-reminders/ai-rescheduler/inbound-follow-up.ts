import "server-only";

import { getPrisma } from "@/lib/db";
import { isAiReschedulerSmsEnabled, resolveAiReschedulerConfig } from "./types";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { hasActiveArReminderSmsSession } from "./ar-sms-session";

/**
 * Route natural-language follow-ups (after R) into Appointment AI before MCTB/inbox AI.
 */
export async function tryHandleArReminderFollowUp(input: {
  workspaceId: string;
  contactId: string;
  message: string;
  providerMessageId?: string;
}): Promise<{ handled: true; replyText: string } | { handled: false }> {
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const ar = resolveAiReschedulerConfig(platform);
  if (!isAiReschedulerSmsEnabled(ar)) return { handled: false };

  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, workspaceId: input.workspaceId },
    select: { customFields: true },
  });
  if (!contact || !hasActiveArReminderSmsSession(contact.customFields)) {
    return { handled: false };
  }

  const { tryHandleInboundAppointmentAi } = await import(
    "@/lib/appointments/ai-scheduling/channel-adapters"
  );
  const result = await tryHandleInboundAppointmentAi({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    message: input.message,
    providerMessageId: input.providerMessageId,
  });
  if (!result.handled) return { handled: false };
  return { handled: true, replyText: result.replyText };
}
