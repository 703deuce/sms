import "server-only";

import { getPrisma } from "@/lib/db";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { listArEligiblePlatformSenders } from "./ar-platform-sender-pool";

/**
 * AR outbound on the collision-assigned platform sender (Telnyx 866 primary, Twilio overflow).
 */
export async function sendAppointmentSmsViaPlatformSender(input: {
  workspaceId: string;
  customerWorkspaceId: string;
  to: string;
  body: string;
  platformPhoneNumberId: string;
  fromE164: string;
  provider: string;
  idempotencyKey?: string;
}) {
  const senders = await listArEligiblePlatformSenders();
  const sender = senders.find(
    (s) => s.phoneNumberId === input.platformPhoneNumberId && s.e164 === input.fromE164,
  );
  if (!sender) {
    throw new Error("ar_platform_sender_not_in_eligible_pool");
  }

  const auth = await isPhoneAuthorizedForOutboundSms(sender.phoneNumberId);
  if (!auth.allowed) {
    throw new Error("ar_platform_sender_not_authorized_for_outbound");
  }

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: sender.phoneNumberId },
    select: { workspaceId: true },
  });
  if (!phone?.workspaceId) {
    throw new Error("ar_platform_sender_phone_not_found");
  }

  return sendQuickSms({
    workspaceId: input.workspaceId,
    to: input.to,
    body: input.body,
    from: sender.e164,
    idempotencyKey: input.idempotencyKey,
    omitConsumerTrackingLink: true,
    skipRecipientSuppressionGate: true,
    senderRoute: {
      sendWorkspaceId: phone.workspaceId,
      fromE164: sender.e164,
      phoneNumberId: sender.phoneNumberId,
    },
  });
}
