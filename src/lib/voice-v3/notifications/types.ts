export type VoiceV3NotificationChannelFlags = {
  sms: boolean;
  email: boolean;
};

export type VoiceV3NotificationEventKey =
  | "callback.requested"
  | "emergency"
  | "transfer.failed"
  | "transfer.connected"
  | "appointment.booked"
  | "appointment.changed"
  | "call.completed";

export type VoiceV3AfterHoursNotificationRecipient = {
  id: string;
  label: string;
  smsE164?: string | null;
  email?: string | null;
  smsEnabled: boolean;
  emailEnabled: boolean;
  enabled: boolean;
};

export type VoiceV3AfterHoursNotificationsConfig = {
  events: Record<VoiceV3NotificationEventKey, VoiceV3NotificationChannelFlags>;
  recipients: VoiceV3AfterHoursNotificationRecipient[];
  dailyDigest?: {
    enabled: boolean;
    recipientEmail?: string | null;
  };
};

export type VoiceV3NotificationDispatchInput = {
  workspaceId: string;
  callId: string;
  event: VoiceV3NotificationEventKey;
  idempotencyKey: string;
  smsBody: string;
  emailSubject: string;
  emailHtml: string;
  emailText: string;
  callDetailHref: string;
};
