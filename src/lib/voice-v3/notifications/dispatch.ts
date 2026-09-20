import "server-only";

import { getPrisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email/brevo";
import type { VoiceV3AfterHoursNotificationsConfig } from "./types";
import type { VoiceV3NotificationDispatchInput } from "./types";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Claim idempotency slot on VoiceCall metadata — returns false if already sent. */
export async function claimVoiceNotificationIdempotency(
  callId: string,
  idempotencyKey: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  if (!call) return false;
  const meta = asRecord(call.metadata);
  const sent = asRecord(meta.voiceV3NotificationsSent);
  if (sent[idempotencyKey]) return false;
  sent[idempotencyKey] = new Date().toISOString();
  meta.voiceV3NotificationsSent = sent;
  await prisma.voiceCall.update({
    where: { id: callId },
    data: { metadata: meta as object },
  });
  return true;
}

export async function dispatchVoiceV3Notification(
  config: VoiceV3AfterHoursNotificationsConfig,
  input: VoiceV3NotificationDispatchInput,
): Promise<{ smsAttempts: number; emailAttempts: number; skipped: boolean }> {
  const flags = config.events[input.event];
  if (!flags?.sms && !flags?.email) {
    return { smsAttempts: 0, emailAttempts: 0, skipped: true };
  }

  const claimed = await claimVoiceNotificationIdempotency(input.callId, input.idempotencyKey);
  if (!claimed) {
    console.log("VOICE_V3_NOTIFICATION_DUPLICATE_SKIPPED", {
      callId: input.callId,
      event: input.event,
      idempotencyKey: input.idempotencyKey,
    });
    return { smsAttempts: 0, emailAttempts: 0, skipped: true };
  }

  let smsAttempts = 0;
  let emailAttempts = 0;
  const recipients = config.recipients.filter((r) => r.enabled);

  for (const recipient of recipients) {
    if (flags.sms && recipient.smsEnabled && recipient.smsE164?.trim()) {
      try {
        const { sendQuickSms } = await import("@/lib/sms/send-quick");
        const body = `${input.smsBody}\n${input.callDetailHref}`;
        await sendQuickSms({
          workspaceId: input.workspaceId,
          to: recipient.smsE164.trim(),
          body,
        });
        smsAttempts += 1;
      } catch (err) {
        console.error("VOICE_V3_NOTIFICATION_SMS_FAILED", {
          callId: input.callId,
          event: input.event,
          recipientId: recipient.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (flags.email && recipient.emailEnabled && recipient.email?.trim()) {
      try {
        await sendTransactionalEmail({
          to: recipient.email.trim(),
          subject: input.emailSubject,
          htmlContent: input.emailHtml,
          textContent: input.emailText,
        });
        emailAttempts += 1;
      } catch (err) {
        console.error("VOICE_V3_NOTIFICATION_EMAIL_FAILED", {
          callId: input.callId,
          event: input.event,
          recipientId: recipient.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  console.log("VOICE_V3_NOTIFICATION_DISPATCHED", {
    callId: input.callId,
    event: input.event,
    smsAttempts,
    emailAttempts,
  });

  return { smsAttempts, emailAttempts, skipped: false };
}
