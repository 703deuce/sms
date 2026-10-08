import "server-only";

/**
 * Structured server logs for Appointment Reminders SMS (inbound, Luna, outbound).
 * Search production logs: `ar_sms_pipeline` (filter by `providerMessageId` or `step`).
 */
export type ArSmsPipelineStep =
  | "webhook_dispatch_start"
  | "inbound_receipt_recorded"
  | "route_sessions_listed"
  | "route_matched"
  | "route_ambiguous_workspace"
  | "route_ambiguous_appointment"
  | "route_unmatched"
  | "ingress_accept_start"
  | "ingress_duplicate"
  | "ingress_conversation_bound"
  | "ingress_message_persisted"
  | "ingress_job_enqueued"
  | "ingress_accepted"
  | "inbound_job_process_start"
  | "inbound_job_session_verified"
  | "inbound_handler_branch"
  | "inbound_handler_unhandled"
  | "inbound_outbound_enqueued"
  | "inbound_job_completed"
  | "inbound_job_failed"
  | "luna_context_loaded"
  | "luna_context_failed"
  | "context_agent_start"
  | "context_agent_completed"
  | "luna_turn_start"
  | "luna_turn_completed"
  | "reminder_send_start"
  | "reminder_conversation_ready"
  | "reminder_session_claimed"
  | "reminder_provider_sent"
  | "reminder_thread_appended"
  | "reminder_send_failed"
  | "outbound_reply_job_start"
  | "outbound_reply_sent"
  | "outbound_reply_idempotent"
  | "outbound_reply_failed";

export type ArSmsPipelineLogInput = {
  step: ArSmsPipelineStep;
  workspaceId?: string | null;
  contactId?: string | null;
  appointmentId?: string | null;
  replySessionId?: string | null;
  conversationId?: string | null;
  providerMessageId?: string | null;
  platformPhoneNumberId?: string | null;
  processingJobId?: string | null;
  outboundJobId?: string | null;
  channel?: "twilio" | "telnyx";
  /** C/R/X, yes, natural, empty */
  inboundKind?: string;
  bodyLength?: number;
  lifecycleState?: string | null;
  routingResolution?: string;
  holdReason?: string;
  handler?: string;
  branch?: string;
  duplicate?: boolean;
  sessionCount?: number;
  primarySessionId?: string;
  workspaceIds?: string[];
  error?: string;
  ok?: boolean;
  meta?: Record<string, unknown>;
};

/** Never log full customer SMS bodies — length + kind only. */
export function classifyArInboundBody(body: string): { inboundKind: string; bodyLength: number } {
  const trimmed = (body || "").trim();
  const upper = trimmed.toUpperCase();
  if (!trimmed) return { inboundKind: "empty", bodyLength: 0 };
  if (upper === "C" || upper === "R" || upper === "X") return { inboundKind: upper, bodyLength: 1 };
  if (/^(yes|y)$/i.test(trimmed)) return { inboundKind: "yes", bodyLength: trimmed.length };
  return { inboundKind: "natural", bodyLength: trimmed.length };
}

export function logArSmsPipeline(input: ArSmsPipelineLogInput): void {
  const line = JSON.stringify({
    event: "ar_sms_pipeline",
    at: new Date().toISOString(),
    step: input.step,
    workspaceId: input.workspaceId ?? undefined,
    contactId: input.contactId ?? undefined,
    appointmentId: input.appointmentId ?? undefined,
    replySessionId: input.replySessionId ?? undefined,
    conversationId: input.conversationId ?? undefined,
    providerMessageId: input.providerMessageId ?? undefined,
    platformPhoneNumberId: input.platformPhoneNumberId ?? undefined,
    processingJobId: input.processingJobId ?? undefined,
    outboundJobId: input.outboundJobId ?? undefined,
    channel: input.channel ?? undefined,
    inboundKind: input.inboundKind ?? undefined,
    bodyLength: input.bodyLength ?? undefined,
    lifecycleState: input.lifecycleState ?? undefined,
    routingResolution: input.routingResolution ?? undefined,
    holdReason: input.holdReason ?? undefined,
    handler: input.handler ?? undefined,
    branch: input.branch ?? undefined,
    duplicate: input.duplicate ?? undefined,
    sessionCount: input.sessionCount ?? undefined,
    primarySessionId: input.primarySessionId ?? undefined,
    workspaceIds: input.workspaceIds ?? undefined,
    error: input.error ?? undefined,
    ok: input.ok ?? undefined,
    ...(input.meta && Object.keys(input.meta).length ? { meta: input.meta } : {}),
  });
  if (input.error || input.step.includes("failed") || input.holdReason) {
    console.warn(line);
  } else {
    console.log(line);
  }
}
