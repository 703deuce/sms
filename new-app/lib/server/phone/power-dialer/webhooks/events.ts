export const POWER_DIALER_WEBHOOK_EVENTS = [
  "call.started",
  "call.answered",
  "call.ended",
  "disposition.saved",
  "callback.created",
  "contact.created",
  "contact.updated",
  "session.started",
  "session.ended",
  "campaign.completed",
  "dnc.added",
] as const;

export type PowerDialerWebhookEventType = (typeof POWER_DIALER_WEBHOOK_EVENTS)[number];

export type PowerDialerWebhookPayload = {
  id: string;
  type: PowerDialerWebhookEventType;
  createdAt: string;
  workspaceId: string;
  test?: boolean;
  data: Record<string, unknown>;
};
