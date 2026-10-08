import "server-only";

import { sendQuickSms } from "@/lib/sms/send-quick";
import { resolveAppointmentOutboundSmsRoute } from "@/lib/appointments/sms-sender";

/**
 * AR outbound on an explicitly selected platform sender (Telnyx primary or Twilio secondary).
 * Does not use MCTB assignment gates or MCTB outbound jobs.
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
  const route = await resolveAppointmentOutboundSmsRoute(input.customerWorkspaceId, input.to);
  if (!route) {
    throw new Error("ar_platform_sender_route_unavailable");
  }

  if (route.phoneNumberId !== input.platformPhoneNumberId) {
    throw new Error("ar_selected_sender_does_not_match_platform_route");
  }

  return sendQuickSms({
    workspaceId: input.workspaceId,
    to: input.to,
    body: input.body,
    from: input.fromE164,
    idempotencyKey: input.idempotencyKey,
    omitConsumerTrackingLink: true,
    senderRoute: {
      sendWorkspaceId: route.sendWorkspaceId,
      fromE164: input.fromE164,
      phoneNumberId: input.platformPhoneNumberId,
    },
  });
}
