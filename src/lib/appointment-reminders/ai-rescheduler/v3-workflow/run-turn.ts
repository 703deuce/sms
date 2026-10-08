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
import { classifyArInboundBody, logArSmsPipeline } from "@/lib/appointment-reminders/messaging/pipeline-log";
import { resolveArAppointmentDisplayTimezone } from "../display-time";
import { buildArSmsSharedTurnSnapshot } from "../ar-sms-shared-snapshot";
import { runArSmsContextAgent } from "../context-agent/run-ar-sms-context-agent";
import { saveArSmsContextInterpretation } from "./persist";

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
  if (!verified.ok) {
    logArSmsPipeline({
      step: "luna_context_failed",
      workspaceId: input.workspaceId,
      replySessionId: input.replySessionId,
      appointmentId: input.appointmentId,
      providerMessageId: input.providerMessageId,
      error: verified.reason,
      handler: "session_verify",
    });
    return { handled: false };
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

  const snapshotResult = await buildArSmsSharedTurnSnapshot({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    appointmentId: input.appointmentId,
    replySessionId: input.replySessionId,
    conversationId: input.conversationId,
    message: input.message,
    providerMessageId: input.providerMessageId,
    sessionLifecycleState: verified.session.lifecycleState,
  });
  if (!snapshotResult.ok) {
    logArSmsPipeline({
      step: "luna_context_failed",
      workspaceId: input.workspaceId,
      replySessionId: input.replySessionId,
      appointmentId: input.appointmentId,
      conversationId: input.conversationId,
      providerMessageId: input.providerMessageId,
      error: snapshotResult.reason,
      handler: "conversation_load",
    });
    return {
      handled: true,
      replyText:
        "We couldn't load this conversation safely. Please text R again from your latest reminder.",
    };
  }
  const { snapshot } = snapshotResult;
  const { inboundKind, bodyLength } = classifyArInboundBody(input.message);
  logArSmsPipeline({
    step: "luna_context_loaded",
    workspaceId: input.workspaceId,
    replySessionId: input.replySessionId,
    appointmentId: input.appointmentId,
    conversationId: input.conversationId,
    providerMessageId: input.providerMessageId,
    inboundKind,
    bodyLength,
    meta: { historyTurns: snapshot.conversationHistory.length },
  });

  const contextInterpretation = await runArSmsContextAgent({ snapshot });
  await saveArSmsContextInterpretation({
    sessionId: input.replySessionId,
    providerMessageId: input.providerMessageId,
    interpretation: contextInterpretation,
  });

  logArSmsPipeline({
    step: "luna_turn_start",
    workspaceId: input.workspaceId,
    replySessionId: input.replySessionId,
    appointmentId: input.appointmentId,
    conversationId: input.conversationId,
    providerMessageId: input.providerMessageId,
    meta: {
      historyTurns: snapshot.conversationHistory.length,
      contextIntent: contextInterpretation.intent,
    },
  });

  const turn = await runArRescheduleLunaTurn({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    appointmentId: input.appointmentId,
    sessionId: input.replySessionId,
    replySessionId: input.replySessionId,
    conversationId: input.conversationId,
    config,
    runtime,
    message: input.message,
    conversationHistory: snapshot.conversationHistory,
    displayTimezone,
    relatedAppointmentsSummary: snapshot.relatedAppointmentsSummary,
    verifiedContextBlock: snapshot.verifiedContextBlock,
    sessionLifecycleState: snapshot.sessionLifecycleState,
    contextInterpretation,
  });

  if (turn.confirmed) {
    await markArReplySessionLifecycle({
      sessionId: input.replySessionId,
      workspaceId: input.workspaceId,
      lifecycleState: "COMPLETED",
    });
  }

  logArSmsPipeline({
    step: "luna_turn_completed",
    workspaceId: input.workspaceId,
    replySessionId: input.replySessionId,
    appointmentId: input.appointmentId,
    providerMessageId: input.providerMessageId,
    ok: true,
    meta: { confirmed: turn.confirmed, replyLength: turn.replyText.length },
  });

  return { handled: true, replyText: turn.replyText };
}
