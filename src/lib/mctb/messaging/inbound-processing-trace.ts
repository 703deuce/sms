import { getPrisma } from "@/lib/db";

export type MctbInboundProcessingTraceKind =
  | "INBOUND_ACCEPTED"
  | "WORKER_CLAIMED"
  | "LR_STARTED"
  | "LR_COMPLETED"
  | "OUTBOUND_ENQUEUED"
  | "OUTBOUND_SENT"
  | "LR_FAILED"
  | "LR_FALLBACK_ENQUEUED"
  | "SMS_ROUTING_DECISION";

/** Structured decision trail for inbound MCTB SMS (console + conversation activity). */
export async function logMctbSmsRoutingDecision(input: {
  workspaceId: string;
  conversationId: string;
  providerMessageId?: string | null;
  processingJobId?: string | null;
  handler: "sms_pipeline" | "lead_recovery" | "skipped";
  branch: string;
  action?: string | null;
  primaryIntent?: string | null;
  grounded?: boolean | null;
  smsPipelinePrimary?: boolean | null;
  leadRecoveryEnabled?: boolean | null;
  extra?: Record<string, unknown>;
}) {
  await logMctbInboundProcessingEvent({
    kind: "SMS_ROUTING_DECISION",
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    providerMessageId: input.providerMessageId,
    processingJobId: input.processingJobId,
    meta: {
      handler: input.handler,
      branch: input.branch,
      action: input.action,
      primaryIntent: input.primaryIntent,
      grounded: input.grounded,
      smsPipelinePrimary: input.smsPipelinePrimary,
      leadRecoveryEnabled: input.leadRecoveryEnabled,
      ...input.extra,
    },
  });
}

export async function logMctbInboundProcessingEvent(input: {
  kind: MctbInboundProcessingTraceKind;
  workspaceId: string;
  conversationId?: string | null;
  providerMessageId?: string | null;
  processingJobId?: string | null;
  outboundJobId?: string | null;
  duplicate?: boolean;
  webhookAckAt?: string;
  workerClaimedAt?: string;
  error?: string | null;
  meta?: Record<string, unknown>;
}) {
  const line = JSON.stringify({
    event: "mctb_inbound_processing",
    ...input,
    at: new Date().toISOString(),
  });
  console.log(line);

  if (!input.conversationId) return;
  const prisma = getPrisma();
  if (!prisma.mctbConversationBookingActivity?.create) return;

  await prisma.mctbConversationBookingActivity
    .create({
      data: {
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        kind: `MCTB_INBOUND_${input.kind}`,
        payloadJson: {
          providerMessageId: input.providerMessageId,
          processingJobId: input.processingJobId,
          outboundJobId: input.outboundJobId,
          duplicate: input.duplicate,
          webhookAckAt: input.webhookAckAt,
          workerClaimedAt: input.workerClaimedAt,
          error: input.error,
          meta: input.meta,
        },
      },
    })
    .catch(() => undefined);
}
