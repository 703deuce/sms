/**
 * CRM-facing publish helpers — all funnel through the unified event bus.
 */

import { emitPlatformEvent, emitTypedEvent } from "./runtime/event-bus";
import type { CrmPlatformEvent, CrmPlatformEventType } from "./types";

/** @deprecated Prefer emitPlatformEvent — kept as stable alias for call sites. */
export async function publishCrmEvent(event: CrmPlatformEvent) {
  return emitPlatformEvent(event);
}

export async function publishCallCompleted(input: {
  workspaceId: string;
  contactId?: string | null;
  callId: string;
  direction: "inbound" | "outbound" | "missed";
  from?: string | null;
  to?: string | null;
  durationSeconds?: number | null;
  disposition?: string | null;
  recordingUrl?: string | null;
  notes?: string | null;
}) {
  const type: CrmPlatformEventType =
    input.direction === "missed"
      ? "call.missed"
      : input.direction === "outbound"
        ? "call.outgoing"
        : "call.completed";
  return emitTypedEvent(type, {
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    eventId: `call-${input.callId}-${type}`,
    payload: { ...input },
  });
}

export async function publishCallIncoming(input: {
  workspaceId: string;
  contactId?: string | null;
  callId: string;
  from?: string | null;
  to?: string | null;
}) {
  return emitTypedEvent("call.incoming", {
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    eventId: `call-${input.callId}-incoming`,
    payload: { ...input, direction: "inbound" },
  });
}

export async function publishSmsEvent(input: {
  workspaceId: string;
  contactId?: string | null;
  direction: "inbound" | "outbound";
  from?: string | null;
  to?: string | null;
  body?: string | null;
  status?: string | null;
  messageId?: string | null;
}) {
  let type: CrmPlatformEventType =
    input.direction === "inbound" ? "sms.received" : "sms.sent";
  if (input.status === "delivered") type = "sms.delivered";
  if (input.status === "failed") type = "sms.failed";
  return emitTypedEvent(type, {
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    eventId: input.messageId ? `sms-${input.messageId}-${type}` : undefined,
    payload: { ...input },
  });
}

export async function publishRecordingReady(input: {
  workspaceId: string;
  contactId?: string | null;
  callId: string;
  recordingUrl: string;
  direction?: "inbound" | "outbound" | "missed";
}) {
  return emitTypedEvent("recording.ready", {
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    eventId: `rec-${input.callId}`,
    payload: { ...input },
  });
}

export async function publishTranscriptReady(input: {
  workspaceId: string;
  contactId?: string | null;
  callId: string;
  transcriptUrl?: string | null;
  transcriptText?: string | null;
  aiSummary?: string | null;
}) {
  return emitTypedEvent("transcript.ready", {
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    eventId: `tr-${input.callId}`,
    payload: { ...input },
  });
}

export async function publishAiSummaryReady(input: {
  workspaceId: string;
  contactId?: string | null;
  callId: string;
  aiSummary: string;
}) {
  return emitTypedEvent("ai_summary.ready", {
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    eventId: `ai-${input.callId}`,
    payload: { ...input },
  });
}

export async function publishVoicemailReceived(input: {
  workspaceId: string;
  contactId?: string | null;
  callId?: string | null;
  from?: string | null;
  to?: string | null;
  recordingUrl?: string | null;
}) {
  return emitTypedEvent("voicemail.received", {
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    eventId: input.callId ? `vm-${input.callId}` : undefined,
    payload: { ...input, direction: "missed" },
  });
}

export async function publishCallbackScheduled(input: {
  workspaceId: string;
  contactId?: string | null;
  callId?: string | null;
  phone?: string | null;
}) {
  return emitTypedEvent("callback.scheduled", {
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    eventId: input.callId ? `cb-${input.callId}` : undefined,
    payload: { ...input },
  });
}

export async function publishContactEvent(input: {
  workspaceId: string;
  contactId: string;
  type: "contact.created" | "contact.updated";
  payload?: Record<string, unknown>;
}) {
  return emitTypedEvent(input.type, {
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    eventId: `${input.type}-${input.contactId}`,
    payload: input.payload || {},
  });
}

export { emitPlatformEvent, emitTypedEvent };
