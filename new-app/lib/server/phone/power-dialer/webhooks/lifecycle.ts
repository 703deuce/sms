import { emitPowerDialerWebhookEvent } from "./delivery";

/** Fire-and-forget customer webhook emissions for Power Dialer lifecycle. */
export function pdWebhookCallStarted(input: {
  workspaceId: string;
  attemptId: string;
  sessionId: string;
  contactId: string;
  phoneE164?: string | null;
}) {
  void emitPowerDialerWebhookEvent({
    workspaceId: input.workspaceId,
    eventType: "call.started",
    eventId: `call-started-${input.attemptId}`,
    data: {
      attemptId: input.attemptId,
      sessionId: input.sessionId,
      contactId: input.contactId,
      phoneE164: input.phoneE164,
    },
  }).catch(() => undefined);
}

export function pdWebhookCallAnswered(input: {
  workspaceId: string;
  attemptId: string;
  sessionId: string;
  contactId: string;
}) {
  void emitPowerDialerWebhookEvent({
    workspaceId: input.workspaceId,
    eventType: "call.answered",
    eventId: `call-answered-${input.attemptId}`,
    data: {
      attemptId: input.attemptId,
      sessionId: input.sessionId,
      contactId: input.contactId,
    },
  }).catch(() => undefined);
}

export function pdWebhookCallEnded(input: {
  workspaceId: string;
  attemptId: string;
  sessionId: string;
  contactId: string;
  wasAnswered: boolean;
}) {
  void emitPowerDialerWebhookEvent({
    workspaceId: input.workspaceId,
    eventType: "call.ended",
    eventId: `call-ended-${input.attemptId}`,
    data: {
      attemptId: input.attemptId,
      sessionId: input.sessionId,
      contactId: input.contactId,
      wasAnswered: input.wasAnswered,
    },
  }).catch(() => undefined);
}

export function pdWebhookSessionStarted(input: {
  workspaceId: string;
  sessionId: string;
  campaignId: string;
  repUserId: string;
}) {
  void emitPowerDialerWebhookEvent({
    workspaceId: input.workspaceId,
    eventType: "session.started",
    eventId: `session-started-${input.sessionId}`,
    data: input,
  }).catch(() => undefined);
}

export function pdWebhookSessionEnded(input: {
  workspaceId: string;
  sessionId: string;
  campaignId?: string | null;
}) {
  void emitPowerDialerWebhookEvent({
    workspaceId: input.workspaceId,
    eventType: "session.ended",
    eventId: `session-ended-${input.sessionId}`,
    data: input,
  }).catch(() => undefined);
}

export function pdWebhookCampaignCompleted(input: {
  workspaceId: string;
  campaignId: string;
}) {
  void emitPowerDialerWebhookEvent({
    workspaceId: input.workspaceId,
    eventType: "campaign.completed",
    eventId: `campaign-completed-${input.campaignId}-${Date.now()}`,
    data: input,
  }).catch(() => undefined);
}

export function pdWebhookCallbackCreated(input: {
  workspaceId: string;
  callbackId: string;
  contactId: string;
  assignedUserId?: string | null;
  dueAt?: string | null;
}) {
  void emitPowerDialerWebhookEvent({
    workspaceId: input.workspaceId,
    eventType: "callback.created",
    eventId: `callback-${input.callbackId}`,
    data: input,
  }).catch(() => undefined);
}

export function pdWebhookContactCreated(input: {
  workspaceId: string;
  contactId: string;
  source?: string;
}) {
  void emitPowerDialerWebhookEvent({
    workspaceId: input.workspaceId,
    eventType: "contact.created",
    eventId: `contact-created-${input.contactId}`,
    data: input,
  }).catch(() => undefined);
}

export function pdWebhookContactUpdated(input: {
  workspaceId: string;
  contactId: string;
}) {
  void emitPowerDialerWebhookEvent({
    workspaceId: input.workspaceId,
    eventType: "contact.updated",
    eventId: `contact-updated-${input.contactId}-${Date.now()}`,
    data: input,
  }).catch(() => undefined);
}

export function pdWebhookDncAdded(input: {
  workspaceId: string;
  phone: string;
  source?: string;
}) {
  void emitPowerDialerWebhookEvent({
    workspaceId: input.workspaceId,
    eventType: "dnc.added",
    eventId: `dnc-${input.workspaceId}-${input.phone}`,
    data: input,
  }).catch(() => undefined);
}
