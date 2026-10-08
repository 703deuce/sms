import "server-only";

import { getPrisma } from "@/lib/db";
import { verifyArReplySessionForInboundTurn } from "@/lib/appointment-reminders/messaging/verify-reply-session";
import { markArReplySessionLifecycle } from "@/lib/appointment-reminders/messaging/reply-session";
import { resolveAiReschedulerConfig, isAiReschedulerSmsEnabled } from "../types";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { buildArVoiceV3AgentConfig } from "./agent-config";
import { loadVerifiedExistingForArSession } from "./verified-existing";
import { ensureArRescheduleRuntime } from "./session-runtime";
import { runArRescheduleLunaTurn } from "./luna-turn";
import { loadArSmsConversationForLuna } from "./luna-conversation-context";
import { loadArCustomerAppointmentsSummaryForLuna } from "@/lib/appointment-reminders/messaging/persistent-conversation";
import { resolveArAppointmentDisplayTimezone } from "../display-time";

/**
 * Voice V3-equivalent reschedule turn for AR SMS (post-R follow-ups).
 */
export async function runArV3RescheduleSmsTurn(input: {
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

  if (
    verified.session.lifecycleState === "AWAITING_REPLY" ||
    verified.session.lifecycleState === "COMPLETED"
  ) {
    await markArReplySessionLifecycle({
      sessionId: input.replySessionId,
      workspaceId: input.workspaceId,
      lifecycleState: "RESCHEDULING",
    });
  }

  const existing = await loadVerifiedExistingForArSession({
    workspaceId: input.workspaceId,
    session: verified.session,
  });
  if (!existing.ok) {
    return {
      handled: true,
      replyText:
        "We couldn't verify this appointment on the calendar. The business will follow up to reschedule.",
    };
  }

  const config = await buildArVoiceV3AgentConfig({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
  });
  if (!config) {
    return {
      handled: true,
      replyText: "Online rescheduling isn't available right now. The business will contact you.",
    };
  }

  const { runtime } = await ensureArRescheduleRuntime({
    sessionId: input.replySessionId,
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    config,
    verifiedExisting: existing.appointment,
    lookupCompleted: true,
  });

  const apptRow = await getPrisma().voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
    select: { timezone: true, metadata: true },
  });
  const metaTz = (apptRow?.metadata as { timezone?: string } | null)?.timezone;
  const displayTimezone =
    resolveArAppointmentDisplayTimezone({
      appointmentTimezone: apptRow?.timezone,
      metadataTimezone: metaTz,
      platformTimezone: platform.timezone,
      agentConfigTimezone: config.timezone,
    });

  let conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (input.conversationId) {
    const loaded = await loadArSmsConversationForLuna({
      workspaceId: input.workspaceId,
      replySessionId: input.replySessionId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      currentMessage: input.message,
      currentProviderMessageId: input.providerMessageId,
    });
    if (!loaded.sessionOk) {
      return {
        handled: true,
        replyText:
          "We couldn't load this conversation safely. Please text R again from your latest reminder.",
      };
    }
    conversationHistory = loaded.messages;
  } else {
    const trimmed = (input.message || "").trim();
    if (trimmed) conversationHistory = [{ role: "user", content: trimmed }];
  }

  const relatedAppointmentsSummary = await loadArCustomerAppointmentsSummaryForLuna({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
  });

  const turn = await runArRescheduleLunaTurn({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    sessionId: input.replySessionId,
    config,
    runtime,
    message: input.message,
    conversationHistory,
    displayTimezone,
    relatedAppointmentsSummary,
  });

  if (turn.confirmed) {
    await markArReplySessionLifecycle({
      sessionId: input.replySessionId,
      workspaceId: input.workspaceId,
      lifecycleState: "COMPLETED",
    });
  }

  return { handled: true, replyText: turn.replyText };
}
