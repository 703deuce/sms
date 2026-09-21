import "server-only";

import { sendVoiceV3BookingLinkSms } from "../booking-link/send-voice-v3-booking-link-sms";
import { resolveVoiceV3OutboundSms } from "./resolve-voice-v3-outbound-sms";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { ConfirmedBooking } from "../calendar/booking-types";

export async function sendVoiceV3BookingConfirmationSms(input: {
  workspaceId: string;
  agentId?: string | null;
  config: VoiceV3AgentConfig;
  callId: string;
  callerE164: string;
  booking: ConfirmedBooking;
}): Promise<{ ok: boolean; skipped?: string }> {
  const behavior = input.config.scheduling?.bookingBehavior;
  if (!behavior?.sendSmsAfterBooking && !input.config.capabilities.sendSms) {
    return { ok: true, skipped: "disabled" };
  }

  const route = await resolveVoiceV3OutboundSms({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    config: input.config,
  });
  if (!route?.fromE164) {
    return { ok: false, skipped: "no_sender" };
  }

  const { booking: confirmed } = input;
  const brand = input.config.businessName?.trim() || "Your appointment";
  const when = confirmed.localStart?.trim() || confirmed.startUtc;
  const body = `${brand}: Your appointment is confirmed for ${when}. Reply STOP to opt out.`;

  const phoneNumberId = route.phoneNumberId?.trim();
  if (!phoneNumberId) {
    return { ok: false, skipped: "no_phone_number_id" };
  }
  await sendVoiceV3BookingLinkSms({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
    toE164: input.callerE164,
    fromE164: route.fromE164,
    phoneNumberId,
    body,
    idempotencyKey: `v3bookconfirm:${input.callId}:${confirmed.slotId}:${confirmed.bookingAttemptId}`,
  });

  console.log("VOICE_V3_BOOKING_CONFIRMATION_SMS_SENT", {
    call_id: input.callId,
    slot_id: confirmed.slotId,
  });
  return { ok: true };
}
