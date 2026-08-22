import "server-only";

import { getPrisma } from "@/lib/db";
import { appendMctbTrace } from "@/lib/agents/missed-call-text-back/trace";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

const STATUS_TO_TRACE_KIND: Record<string, string> = {
  delivered: "sms.delivered",
  failed: "sms.send.failed",
  undelivered: "sms.send.failed",
  sent: "sms.send.accepted",
};

/**
 * Bridge Telnyx delivery webhooks into MCTB event traces when the outbound
 * message belongs to a missed-call recovery send.
 */
export async function appendMctbDeliveryTraceFromProviderStatus(input: {
  providerMessageId: string;
  status: string;
  errorDetail?: string | null;
}): Promise<{ matched: boolean; missedCallEventId?: string }> {
  const prisma = getPrisma();
  const message = await prisma.message.findFirst({
    where: { providerId: input.providerMessageId },
    select: { id: true, workspaceId: true, to: true, idempotencyKey: true },
  });
  if (!message?.idempotencyKey?.startsWith("mctb-recovery:")) {
    return { matched: false };
  }

  const missedCallEventId = message.idempotencyKey.replace(/^mctb-recovery:/, "");
  const event = await prisma.missedCallEvent.findFirst({
    where: { id: missedCallEventId, workspaceId: message.workspaceId },
    select: { id: true, traceId: true, workspaceId: true },
  });
  if (!event?.traceId) {
    return { matched: false };
  }

  const kind = STATUS_TO_TRACE_KIND[input.status] || `sms.status.${input.status}`;
  await appendMctbTrace({
    workspaceId: event.workspaceId,
    traceId: event.traceId,
    missedCallEventId: event.id,
    kind,
    detail: {
      providerMessageId: input.providerMessageId,
      status: input.status,
      messageId: message.id,
      error: input.errorDetail || null,
    },
  });

  if (input.status === "delivered") {
    await prisma.missedCallEvent.updateMany({
      where: { id: event.id },
      data: { status: "SENT" },
    });
  }

  return { matched: true, missedCallEventId: event.id };
}
