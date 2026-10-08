import "server-only";

import { getPrisma } from "@/lib/db";
import { AR_SMS_IDEMPOTENCY_PREFIX } from "./constants";
import { loadArReplySessionForWorkspace } from "./reply-session";
import { sendAppointmentSmsViaPlatformSender } from "./send-via-assigned-sender";

export async function executeArSendCustomerSmsJob(payload: Record<string, unknown>) {
  const workspaceId = String(payload.workspaceId || "");
  const toE164 = String(payload.toE164 || "");
  const body = String(payload.body || "");
  const idempotencyKey = String(payload.idempotencyKey || "");
  const replySessionId = String(payload.replySessionId || "");

  if (!workspaceId || !toE164 || !body.trim() || !idempotencyKey || !replySessionId) {
    throw new Error("ar_send_customer_sms_payload_incomplete");
  }

  const outboundKey = idempotencyKey.startsWith(AR_SMS_IDEMPOTENCY_PREFIX)
    ? idempotencyKey
    : `${AR_SMS_IDEMPOTENCY_PREFIX}reply:${idempotencyKey}`;

  const prisma = getPrisma();
  const existingMessage = await prisma.message.findFirst({
    where: { workspaceId, idempotencyKey: outboundKey },
    select: { id: true, providerId: true, status: true },
  });
  if (existingMessage?.providerId) {
    return {
      ok: true,
      providerMessageId: existingMessage.providerId,
      idempotentReplay: true,
    };
  }

  const session = await loadArReplySessionForWorkspace({ sessionId: replySessionId, workspaceId });
  if (!session) {
    throw new Error("ar_reply_session_missing_for_outbound");
  }

  const phone = await prisma.phoneNumber.findFirst({
    where: { id: session.platformPhoneNumberId },
    select: { e164: true, provider: true },
  });
  if (!phone?.e164) {
    throw new Error("ar_reply_session_sender_missing");
  }

  const result = await sendAppointmentSmsViaPlatformSender({
    workspaceId,
    customerWorkspaceId: workspaceId,
    to: toE164,
    body,
    platformPhoneNumberId: session.platformPhoneNumberId,
    fromE164: phone.e164,
    provider: String(session.provider || phone.provider || "telnyx"),
    idempotencyKey: outboundKey,
  });

  return {
    ok: true,
    providerMessageId: result?.providerId ?? result?.messageId ?? null,
    messageId: result?.messageId ?? null,
  };
}
