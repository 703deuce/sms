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
  const selection = await selectArOutboundPlatformSender({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    consumerE164: input.phone,
  });
  if (!selection.ok) {
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

  return {
    sent: true,
    sessionId: claim.sessionId,
    providerMessageId: sendResult.providerMessageId,
    messageId: sendResult.messageId,
  };
}
