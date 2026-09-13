/**
 * Production-equivalent Telnyx webhook request builders for pre-production tests.
 */

export type TelnyxToolWebhookInput = {
  workspaceId: string;
  agentId: string;
  toolType: string;
  toolId?: string;
  body?: Record<string, unknown>;
  callControlId?: string;
  conversationId?: string;
  fromE164?: string;
  toE164?: string;
};

/** Matches live PSTN tool webhooks (minimal headers — no caller ANI). */
export function buildTelnyxMinimalToolWebhookRequest(input: {
  workspaceId: string;
  agentId: string;
  toolType: string;
  body?: Record<string, unknown>;
  callControlId: string;
}): Request {
  const headers = new Headers({
    "content-type": "application/json",
    "x-transovo-workspace-id": input.workspaceId,
    "x-transovo-agent-id": input.agentId,
    "x-transovo-tool-type": input.toolType,
    "x-telnyx-call-control-id": input.callControlId,
  });
  return new Request("http://test.internal/api/telnyx/voice/tools", {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...input.body,
      call_control_id: input.callControlId,
    }),
  });
}

export function buildTelnyxToolWebhookRequest(input: TelnyxToolWebhookInput): Request {
  const headers = new Headers({
    "content-type": "application/json",
    "x-transovo-workspace-id": input.workspaceId,
    "x-transovo-agent-id": input.agentId,
    "x-transovo-tool-type": input.toolType,
  });
  if (input.toolId) headers.set("x-transovo-tool-id", input.toolId);
  if (input.callControlId) headers.set("x-telnyx-call-control-id", input.callControlId);
  if (input.conversationId) headers.set("x-telnyx-conversation-id", input.conversationId);
  if (input.fromE164) {
    headers.set("x-telnyx-from", input.fromE164);
    headers.set("x-telnyx-caller-id", input.fromE164);
  }
  if (input.toE164) headers.set("x-telnyx-to", input.toE164);

  return new Request("http://test.internal/api/telnyx/voice/tools", {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...input.body,
      ...(input.callControlId ? { call_control_id: input.callControlId } : {}),
      ...(input.conversationId ? { conversation_id: input.conversationId } : {}),
    }),
  });
}

/** TeXML status_callback form body (completed hangup with real timing fields). */
export function buildTexmlHangupFormPayload(input: {
  callControlId: string;
  fromE164: string;
  toE164: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  /** When true, include AnsweredTime (live answered call). Omit for ring-outs. */
  answered?: boolean;
}): string {
  const params = new URLSearchParams({
    CallStatus: "completed",
    CallSid: input.callControlId,
    From: input.fromE164,
    To: input.toE164,
    StartTime: input.startTime,
    EndTime: input.endTime,
    CallDuration: String(input.durationSeconds),
    Direction: "inbound",
  });
  if (input.answered) {
    params.set("AnsweredTime", input.startTime);
  }
  return params.toString();
}

/** Telnyx live transcription webhook payload shape. */
export function buildTranscriptionEventPayload(input: {
  conversationId: string;
  callControlId: string;
  text: string;
  track?: string;
}): Record<string, unknown> {
  return {
    conversation_id: input.conversationId,
    call_control_id: input.callControlId,
    transcript: input.text,
    transcription_data: {
      transcript: input.text,
      track: input.track || "inbound",
      conversation_id: input.conversationId,
      start_ms: 0,
      end_ms: 1200,
      confidence: 0.95,
    },
  };
}
