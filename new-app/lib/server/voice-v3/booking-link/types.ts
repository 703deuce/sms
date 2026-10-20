export type BookingLinkConsentState =
  | "NOT_REQUESTED"
  | "REQUESTED"
  | "GRANTED"
  | "DECLINED";

export type SmsDestinationSource = "INBOUND_ANI" | "CALLER_PROVIDED";

export type SendBookingLinkResultStatus =
  | "sent"
  | "already_sent"
  | "consent_required"
  | "declined"
  | "not_configured"
  | "provider_rejected"
  | "failed";

export interface VoiceV3BookingLinkCallState {
  consent: BookingLinkConsentState;
  smsDestination: {
    source: SmsDestinationSource;
    e164: string;
    confirmed: boolean;
  } | null;
  lastSend: {
    attemptId: string;
    status: SendBookingLinkResultStatus;
    providerMessageId?: string;
    providerInitialStatus?: string;
    sentAt: string;
  } | null;
}
