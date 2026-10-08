import "server-only";

import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";
import { sendQuickSms } from "@/lib/sms/send-quick";

/**
 * AR outbound on the canonical Telnyx 866 platform sender (same as MCTB platform SMS).
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
  const platform = await resolveCanonicalMctbPlatformSender();
  if (!platform?.e164) {
    throw new Error("ar_canonical_platform_sender_not_configured");
  }
  if (platform.phoneNumberId !== input.platformPhoneNumberId) {
    throw new Error("ar_platform_sender_must_be_canonical_telnyx_866");
  }
  if (platform.e164 !== input.fromE164) {
    throw new Error("ar_platform_sender_e164_mismatch");
  }
  if (String(platform.provider || "").toLowerCase() !== "telnyx") {
    throw new Error("ar_platform_sender_must_be_telnyx");
  }

  const auth = await isPhoneAuthorizedForOutboundSms(platform.phoneNumberId);
  if (!auth.allowed) {
    throw new Error("ar_platform_sender_not_authorized_for_outbound");
  }

  return sendQuickSms({
    workspaceId: input.workspaceId,
    to: input.to,
    body: input.body,
    from: platform.e164,
    idempotencyKey: input.idempotencyKey,
    omitConsumerTrackingLink: true,
    senderRoute: {
      sendWorkspaceId: platform.workspaceId,
      fromE164: platform.e164,
      phoneNumberId: platform.phoneNumberId,
    },
  });
}
