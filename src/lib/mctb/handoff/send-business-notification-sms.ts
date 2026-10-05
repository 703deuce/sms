import "server-only";

import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { resolveMctbOutboundSmsRoute } from "@/lib/mctb/messaging/outbound-sms-route";

/**
 * Operational SMS to business notification recipients — not consumer recovery traffic.
 * Uses the same MCTB outbound provider route as customer recovery SMS, without
 * consumer conversation pairing or platform assignment lifecycle.
 */
export async function sendMctbBusinessHandoffNotificationSms(input: {
  workspaceId: string;
  toE164: string;
  body: string;
  idempotencyKey: string;
}) {
  const config = await loadMissedCallTextConfig(input.workspaceId);
  const route = await resolveMctbOutboundSmsRoute({
    workspaceId: input.workspaceId,
    config,
    demoMode: false,
  });
  if (!route.fromE164) {
    throw new Error("mctb_no_outbound_sms_route");
  }

  return sendQuickSms({
    workspaceId: input.workspaceId,
    to: input.toE164,
    body: input.body,
    from: route.fromE164,
    idempotencyKey: input.idempotencyKey,
    omitConsumerTrackingLink: true,
    senderRoute: {
      sendWorkspaceId: route.sendWorkspaceId,
      fromE164: route.fromE164,
      phoneNumberId: route.phoneNumberId,
    },
  });
}
