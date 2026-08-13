import type { AgentSession } from "@livekit/agents";
import type { FrontDeskUserData } from "./userdata";

function logBookingSmsResult(
  callId: string,
  sms: { sent: boolean; reason?: string },
  event: "booking_confirmation_sms" | "booking_confirmation_sms_failed",
  error?: string,
): void {
  console.log(
    JSON.stringify({
      source: "frontdesk-booking",
      event,
      callId,
      sent: sms.sent,
      reason: sms.reason || null,
      error: error || null,
    }),
  );
}

/** Queue booking confirmation SMS without blocking the caller audio path. */
export function sendBookingSmsAsync(
  session: AgentSession<FrontDeskUserData>,
  startsAt: Date,
): void {
  void sendBookingConfirmationSms(session, startsAt).catch((err) => {
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

/** Send (or skip) booking confirmation SMS before telling the caller it was sent. */
export async function sendBookingConfirmationSms(
  session: AgentSession<FrontDeskUserData>,
  startsAt: Date,
): Promise<{ sent: boolean; reason?: string }> {
  const ud = session.userData;
  if (ud.bookingConfirmationSmsSent) {
    return { sent: false, reason: "already_sent" };
  }
  ud.bookingConfirmationSmsSent = true;

  const { sendVoiceBookingConfirmationSms } = await import("@/lib/voice/booking-confirmation-sms");
  const sms = await sendVoiceBookingConfirmationSms({
    workspaceId: ud.workspaceId,
    agentId: ud.agentId,
    callId: ud.callId,
    startsAt,
    businessName: ud.businessName,
    timezone: ud.timezone,
  });
  logBookingSmsResult(ud.callId, sms, "booking_confirmation_sms");
  return sms;
}
