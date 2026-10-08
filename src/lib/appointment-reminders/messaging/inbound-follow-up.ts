import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { mergeConversationState } from "@/lib/appointments/ai-scheduling/conversation-state";
import { handleAppointmentAIRequest } from "@/lib/appointments/ai-scheduling/service";
import { isAiReschedulerSmsEnabled, resolveAiReschedulerConfig } from "../ai-rescheduler/types";
import { verifyArReplySessionForInboundTurn } from "./verify-reply-session";
import { markArReplySessionLifecycle } from "./reply-session";

/**
 * Platform AR SMS follow-up — every turn bound to ArSmsReplySession (no contact heuristics).
 */
export async function tryHandleArReminderFollowUp(input: {
  workspaceId: string;
  contactId: string;
  appointmentId: string;
  replySessionId: string;
  conversationId?: string;
  message: string;
  providerMessageId?: string;
}): Promise<{ handled: true; replyText: string } | { handled: false }> {
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const ar = resolveAiReschedulerConfig(platform);
  if (!isAiReschedulerSmsEnabled(ar) || ar.mode !== "ai") {
    return { handled: false };
  }

  const verified = await verifyArReplySessionForInboundTurn({
    sessionId: input.replySessionId,
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    appointmentId: input.appointmentId,
  });
  if (!verified.ok) return { handled: false };

  if (verified.session.lifecycleState === "AWAITING_REPLY") {
    await markArReplySessionLifecycle({
      sessionId: input.replySessionId,
      workspaceId: input.workspaceId,
      lifecycleState: "RESCHEDULING",
    });
  }

  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, workspaceId: input.workspaceId },
    select: { customFields: true },
  });
  if (!contact) return { handled: false };

  const contactCustomFields = mergeConversationState(contact.customFields, {
    appointmentId: input.appointmentId,
    activeIntent: "RESCHEDULE",
  });

  const result = await handleAppointmentAIRequest({
    workspaceId: input.workspaceId,
    channel: "conversation",
    message: input.message,
    customerId: input.contactId,
    conversationId: input.conversationId,
    requestId: input.providerMessageId,
    contactCustomFields,
    lockedAppointmentId: input.appointmentId,
  });

  const statePatch = result.data?.conversationState;
  if (statePatch) {
    await prisma.contact.update({
      where: { id: input.contactId },
      data: {
        customFields: mergeConversationState(contactCustomFields, statePatch) as object,
      },
    });
  }

  if (result.type === "OUT_OF_SCOPE") {
    return { handled: false };
  }

  await markArReplySessionLifecycle({
    sessionId: input.replySessionId,
    workspaceId: input.workspaceId,
    lifecycleState: verified.session.lifecycleState === "AWAITING_STAFF_APPROVAL"
      ? "AWAITING_STAFF_APPROVAL"
      : "RESCHEDULING",
  });

  return { handled: true, replyText: result.message };
}
