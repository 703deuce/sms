import type { NormalizedPortEvent } from "./types";

export function buildTelnyxPortOutWebhookPayload(event: NormalizedPortEvent): Record<string, unknown> {
  const telnyx = event.telnyx ?? {};
  const portOutId = telnyx.portOutId || event.providerEventId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 36);
  const status = telnyx.rawStatus || mapPortOutStatusToTelnyx(event.portOutStatus);
  return {
    event_type: telnyx.eventType || "portout.status_changed",
    id: portOutId,
    status,
    phone_numbers: [event.phone],
    carrier_name: "Simulation Carrier",
    rejection_reason: telnyx.rejectionReason,
    foc_date: telnyx.focDate,
    messaging_status: telnyx.messagingStatus,
    ported_out_at: status === "ported" ? event.occurredAt : undefined,
  };
}

export function buildTwilioPortOutWebhookPayload(event: NormalizedPortEvent): Record<string, unknown> {
  const twilio = event.twilio ?? {};
  const eventType = twilio.eventType || "PortOutPhoneNumberCompleted";
  const status = twilio.rawStatus || (event.portOutStatus === "COMPLETED" ? "completed" : "pending");
  return {
    event_type: eventType,
    EventType: eventType,
    phone_number: event.phone,
    PhoneNumber: event.phone,
    status,
  };
}

function mapPortOutStatusToTelnyx(status?: string): string {
  switch (status) {
    case "REQUEST_RECEIVED":
      return "pending";
    case "AUTHORIZED":
      return "authorized";
    case "SCHEDULED":
      return "authorized";
    case "ACTION_REQUIRED":
      return "rejected-pending";
    case "COMPLETED":
      return "ported";
    case "CANCELED":
      return "canceled";
    default:
      return "pending";
  }
}
