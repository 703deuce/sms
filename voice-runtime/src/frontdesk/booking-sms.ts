import type { FrontDeskUserData } from "./userdata";
import { durableCallWorkContextFromUserData } from "./runtime-transaction";

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

/** Queue booking confirmation SMS without blocking on AgentSession / TTS. */
export function sendBookingSmsAsync(userData: FrontDeskUserData, startsAt: Date): void {
  if (userData.bookingConfirmationSmsSent) return;
  userData.bookingConfirmationSmsSent = true;

  const durable = durableCallWorkContextFromUserData(userData);
  void sendBookingConfirmationSmsFromContext(durable, startsAt).catch((err) => {
    console.warn(
      JSON.stringify({
        source: "frontdesk-booking",
        event: "booking_confirmation_sms_failed",
        callId: durable.callId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  });
}

/** Send (or skip) booking confirmation SMS using durable call context (no live session). */
export async function sendBookingConfirmationSmsFromContext(
  ctx: ReturnType<typeof durableCallWorkContextFromUserData>,
  startsAt: Date,
): Promise<{ sent: boolean; reason?: string }> {
  const { sendVoiceBookingConfirmationSms } = await import("@/lib/voice/booking-confirmation-sms");
  const sms = await sendVoiceBookingConfirmationSms({
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    callId: ctx.callId,
    startsAt,
    businessName: ctx.businessName,
    timezone: ctx.timezone,
  });
  logBookingSmsResult(ctx.callId, sms, "booking_confirmation_sms");
  return sms;
}

/** @deprecated Prefer sendBookingSmsAsync(userData, startsAt) — session not required. */
export async function sendBookingConfirmationSms(
  session: { userData: FrontDeskUserData },
  startsAt: Date,
): Promise<{ sent: boolean; reason?: string }> {
  const ud = session.userData;
  if (ud.bookingConfirmationSmsSent) {
    return { sent: false, reason: "already_sent" };
  }
  ud.bookingConfirmationSmsSent = true;
  return sendBookingConfirmationSmsFromContext(durableCallWorkContextFromUserData(ud), startsAt);
}
