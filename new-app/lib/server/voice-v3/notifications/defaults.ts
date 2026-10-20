import type { VoiceV3AfterHoursNotificationsConfig } from "./types";

export const DEFAULT_VOICE_V3_AFTER_HOURS_NOTIFICATIONS: VoiceV3AfterHoursNotificationsConfig =
  {
    events: {
      "callback.requested": { sms: true, email: true },
      emergency: { sms: true, email: true },
      "transfer.failed": { sms: true, email: true },
      "transfer.connected": { sms: false, email: false },
      "appointment.booked": { sms: false, email: false },
      "appointment.changed": { sms: false, email: false },
      "call.completed": { sms: false, email: false },
    },
    recipients: [],
  };
