import { getPrisma } from "@/lib/db";
import { JobDeferredError } from "@/lib/messaging/types";
import { handleMctbCustomerSmsReply } from "@/lib/agents/missed-call-text-back/customer-sms";
import { loadLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";
import { logMctbInboundProcessingEvent } from "@/lib/mctb/messaging/inbound-processing-trace";
import { enqueueMctbCustomerOutboundSmsJob } from "@/lib/mctb/messaging/enqueue-customer-outbound-sms";
import { MCTB_JOB_PROCESS_INBOUND_SMS } from "@/lib/mctb/messaging/inbound-sms-ingress";

const RETRYABLE_REASONS = new Set([
  "lead_recovery_not_handled",
  "sms_send_failed",
  "lead_recovery_busy",
  "lead_recovery_lock_timeout",
]);

function inboundJobIdempotencyKey(workspaceId: string, providerMessageId: string) {
  return `mctb-process-inbound:${workspaceId}:${providerMessageId}`;
}

async function enqueueTerminalSafeFallback(payload: Record<string, unknown>, processingJobId: string | null) {
  const workspaceId = String(payload.workspaceId || "");
  const conversationId = String(payload.conversationId || "");
  const fromE164 = String(payload.fromE164 || "");
  const providerMessageId = String(payload.providerMessageId || "");
  if (!workspaceId || !conversationId || !fromE164 || !providerMessageId) return;

  const config = await loadLeadRecoveryConfig(workspaceId);
  const body =
    config.fallbackPolicy?.customerMessage?.trim() ||
    "Thanks — we got your message. Someone will follow up shortly.";

  const idempotencyKey = `mctb-lr-fallback:${conversationId}:${providerMessageId}`;
  const job = await enqueueMctbCustomerOutboundSmsJob({
    workspaceId,
    conversationId,
    toE164: fromE164,
    body,
    idempotencyKey,
    providerMessageId,
    processingJobId,
    action: "lead_recovery_terminal_fallback",
  });

  await logMctbInboundProcessingEvent({
    kind: "LR_FALLBACK_ENQUEUED",
    workspaceId,
    conversationId,
    providerMessageId,
    processingJobId,
    outboundJobId: job.id,
    meta: { bodyPreview: body.slice(0, 80) },
  });
}

export async function processMctbInboundSmsJob(payload: Record<string, unknown>) {
  const workspaceId = String(payload.workspaceId || "");
  const conversationId = String(payload.conversationId || "");
  const fromE164 = String(payload.fromE164 || "");
  const toE164 = String(payload.toE164 || "");
  const body = String(payload.body || "");
  const providerMessageId = String(payload.providerMessageId || "");

  if (!workspaceId || !conversationId || !fromE164 || !providerMessageId) {
    throw new Error("mctb_process_inbound_sms_payload_incomplete");
  }

  const prisma = getPrisma();
  const idempotencyKey = inboundJobIdempotencyKey(workspaceId, providerMessageId);
  const queueJob = await prisma.jobQueue.findUnique({
    where: { idempotencyKey },
    select: { id: true, attempts: true, maxAttempts: true, jobType: true },
  });
  if (!queueJob || queueJob.jobType !== MCTB_JOB_PROCESS_INBOUND_SMS) {
    throw new Error("mctb_inbound_job_row_missing");
  }

  const workerClaimedAt = new Date().toISOString();
  await logMctbInboundProcessingEvent({
    kind: "WORKER_CLAIMED",
    workspaceId,
    conversationId,
    providerMessageId,
    processingJobId: queueJob.id,
    workerClaimedAt,
  });

  await logMctbInboundProcessingEvent({
    kind: "LR_STARTED",
    workspaceId,
    conversationId,
    providerMessageId,
    processingJobId: queueJob.id,
  });

  try {
    const result = await handleMctbCustomerSmsReply({
      workspaceId,
      fromE164,
      toE164,
      body,
      conversationId,
      providerMessageId,
      outboundDelivery: "durable",
      processingJobId: queueJob.id,
    });

    if (!result.handled) {
      const reason = result.reason || "not_handled";
      if (RETRYABLE_REASONS.has(reason) && queueJob.attempts < queueJob.maxAttempts) {
        throw new JobDeferredError(`mctb_lr_retry:${reason}`, 45_000);
      }
      if (RETRYABLE_REASONS.has(reason)) {
        await enqueueTerminalSafeFallback(payload, queueJob.id);
        return { ok: true, handled: false, reason, fallback: true };
      }
      return { ok: true, handled: false, reason };
    }

    await logMctbInboundProcessingEvent({
      kind: "LR_COMPLETED",
      workspaceId,
      conversationId,
      providerMessageId,
      processingJobId: queueJob.id,
      meta: {
        action: result.action,
        outboundQueued: Boolean(result.outboundJobId),
        outboundJobId: result.outboundJobId,
      },
    });

    return {
      ok: true,
      handled: true,
      action: result.action,
      outboundJobId: result.outboundJobId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logMctbInboundProcessingEvent({
      kind: "LR_FAILED",
      workspaceId,
      conversationId,
      providerMessageId,
      processingJobId: queueJob.id,
      error: message,
    });

    if (err instanceof JobDeferredError) {
      throw err;
    }

    if (queueJob.attempts >= queueJob.maxAttempts) {
      await enqueueTerminalSafeFallback(payload, queueJob.id);
      return { ok: true, fallback: true, error: message };
    }

    throw new JobDeferredError(`mctb_lr_error:${message}`, 60_000);
  }
}
