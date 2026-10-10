import "server-only";

import { arReminderOutboundIdempotencyKey } from "./constants";
import {
  attachOutboundProofToArReplySession,
  claimArReplySessionForOutbound,
  ensureArConversation,
  selectArOutboundPlatformSender,
} from "./reply-session";
import { appendArConversationOutboundMessage } from "./persistent-conversation";
import { sendAppointmentSmsViaPlatformSender } from "./send-via-assigned-sender";
import { logArSmsPipeline } from "./pipeline-log";

export async function sendArReminderSmsWithSession(input: {
  workspaceId: string;
  appointmentId: string;
  contactId: string;
  phone: string;
  body: string;
  timelineType: string;
}): Promise<
  | { sent: true; sessionId: string; providerMessageId?: string; messageId?: string }
  | { sent: false; reason: string; pendingSendReason?: string }
> {
  logArSmsPipeline({
    step: "reminder_send_start",
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    contactId: input.contactId,
    meta: { timelineType: input.timelineType, bodyLength: input.body.length },
  });

  const selection = await selectArOutboundPlatformSender({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    consumerE164: input.phone,
  });
  if (!selection.ok) {
    logArSmsPipeline({
      step: "reminder_send_failed",
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      error: selection.reason,
      meta: { pendingSendReason: selection.pendingSendReason },
    });
    return {
      sent: false,
      reason: selection.reason,
      pendingSendReason: selection.pendingSendReason,
    };
  }

  const conversationId = await ensureArConversation({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    toE164: selection.e164,
    fromE164: input.phone,
    platformPhoneNumberId: selection.phoneNumberId,
    appointmentId: input.appointmentId,
  });

  logArSmsPipeline({
    step: "reminder_conversation_ready",
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    conversationId,
    platformPhoneNumberId: selection.phoneNumberId,
    meta: { senderE164: selection.e164 },
  });

  const claim = await claimArReplySessionForOutbound({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    appointmentId: input.appointmentId,
    consumerE164: input.phone,
    platformPhoneNumberId: selection.phoneNumberId,
    provider: selection.provider,
    timelineType: input.timelineType,
    conversationId,
  });

  if ("collision" in claim && claim.collision) {
    logArSmsPipeline({
      step: "reminder_send_failed",
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      error: "ar_reply_session_collision",
      meta: { ownerAppointmentId: claim.ownerAppointmentId },
    });
    return {
      sent: false,
      reason: "ar_reply_session_collision",
      pendingSendReason:
        "Another appointment already owns the reply session on this platform sender for this customer.",
    };
  }

  logArSmsPipeline({
    step: "reminder_session_claimed",
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    replySessionId: claim.sessionId,
    conversationId,
    platformPhoneNumberId: selection.phoneNumberId,
  });

  const idempotencyKey = arReminderOutboundIdempotencyKey({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    timelineType: input.timelineType,
  });

  const sendResult = await sendAppointmentSmsViaPlatformSender({
    workspaceId: input.workspaceId,
    customerWorkspaceId: input.workspaceId,
    to: input.phone,
    body: input.body,
    platformPhoneNumberId: selection.phoneNumberId,
    fromE164: selection.e164,
    provider: selection.provider,
    idempotencyKey,
  });

  await attachOutboundProofToArReplySession({
    sessionId: claim.sessionId,
    workspaceId: input.workspaceId,
    outboundMessageId: sendResult.messageId,
    outboundProviderMessageId: sendResult.providerMessageId,
  });

  await appendArConversationOutboundMessage({
    conversationId,
    body: input.body,
    providerMessageId: sendResult.providerMessageId,
  });

  logArSmsPipeline({
    step: "reminder_provider_sent",
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    replySessionId: claim.sessionId,
    conversationId,
    providerMessageId: sendResult.providerMessageId,
    meta: { messageId: sendResult.messageId },
  });
  logArSmsPipeline({
    step: "reminder_thread_appended",
    workspaceId: input.workspaceId,
    conversationId,
    appointmentId: input.appointmentId,
  });

  return {
    sent: true,
    sessionId: claim.sessionId,
    providerMessageId: sendResult.providerMessageId,
    messageId: sendResult.messageId,
  };
}
