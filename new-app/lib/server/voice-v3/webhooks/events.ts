export const VOICE_WEBHOOK_EVENT_TYPES = [
  "voice.call.completed",
  "voice.callback.requested",
  "voice.message.received",
  "voice.appointment.booked",
  "voice.appointment.rescheduled",
  "voice.appointment.cancelled",
  "voice.transfer.connected",
  "voice.transfer.failed",
  "voice.emergency.escalated",
  "voice.test",
] as const;

export type VoiceWebhookEventType = (typeof VOICE_WEBHOOK_EVENT_TYPES)[number];

/** Customer-selectable subscription events (excludes internal test-only). */
export const VOICE_WEBHOOK_SUBSCRIPTION_EVENT_TYPES = VOICE_WEBHOOK_EVENT_TYPES.filter(
  (t) => t !== "voice.test",
);

export const VOICE_WEBHOOK_EVENT_LABELS: Record<VoiceWebhookEventType, string> = {
  "voice.call.completed": "Call completed",
  "voice.callback.requested": "Callback requested",
  "voice.message.received": "Message received",
  "voice.appointment.booked": "Appointment booked",
  "voice.appointment.rescheduled": "Appointment rescheduled",
  "voice.appointment.cancelled": "Appointment cancelled",
  "voice.transfer.connected": "Transfer connected",
  "voice.transfer.failed": "Transfer failed",
  "voice.emergency.escalated": "Emergency escalated",
  "voice.test": "Test event",
};

export function mapSummaryOutcomeToWebhookType(outcome: string): VoiceWebhookEventType {
  switch (outcome) {
    case "APPOINTMENT_BOOKED":
      return "voice.appointment.booked";
    case "CALLBACK_REQUESTED":
      return "voice.callback.requested";
    case "MESSAGE_TAKEN":
      return "voice.message.received";
    case "TRANSFER_CONNECTED":
      return "voice.transfer.connected";
    case "TRANSFER_FAILED":
      return "voice.transfer.failed";
    case "EMERGENCY_ESCALATED":
      return "voice.emergency.escalated";
    default:
      return "voice.call.completed";
  }
}
