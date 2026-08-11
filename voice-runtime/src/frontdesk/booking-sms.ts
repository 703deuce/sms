import type { AgentSession } from "@livekit/agents";
import type { FrontDeskUserData } from "./userdata";

export function sendBookingSmsAsync(
  session: AgentSession<FrontDeskUserData>,
  startsAt: Date,
): void {
  void import("@/lib/voice/booking-confirmation-sms")
    .then(({ sendVoiceBookingConfirmationSms }) =>
      sendVoiceBookingConfirmationSms({
        workspaceId: session.userData.workspaceId,
        agentId: session.userData.agentId,
        callId: session.userData.callId,
        startsAt,
        businessName: session.userData.businessName,
        timezone: session.userData.timezone,
      }),
    )
    .then((sms) => {
      console.log(
        JSON.stringify({
          source: "frontdesk-booking",
          event: "booking_confirmation_sms",
          callId: session.userData.callId,
          sent: sms.sent,
          reason: sms.reason || null,
        }),
      );
    })
    .catch((err) => {
      console.warn(
        JSON.stringify({
          source: "frontdesk-booking",
          event: "booking_confirmation_sms_failed",
          callId: session.userData.callId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    });
}
