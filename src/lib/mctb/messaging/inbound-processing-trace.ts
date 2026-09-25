import { getPrisma } from "@/lib/db";

export type MctbInboundProcessingTraceKind =
  | "INBOUND_ACCEPTED"
  | "WORKER_CLAIMED"
  | "LR_STARTED"
  | "LR_COMPLETED"
  | "OUTBOUND_ENQUEUED"
  | "OUTBOUND_SENT"
  | "OUTBOUND_SUPPRESSED"
  | "LR_FAILED"
  | "LR_FALLBACK_ENQUEUED";

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
