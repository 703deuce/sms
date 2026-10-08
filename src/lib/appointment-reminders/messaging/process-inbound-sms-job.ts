import "server-only";

import { getPrisma } from "@/lib/db";
import { JobDeferredError } from "@/lib/messaging/types";
import { AR_JOB_PROCESS_INBOUND_SMS } from "./constants";
import { handleAppointmentRemindersInboundBody } from "./handle-inbound-body";
import { enqueueArCustomerOutboundSmsJob } from "./enqueue-customer-outbound-sms";
import { classifyArInboundBody, logArSmsPipeline } from "./pipeline-log";

const RETRYABLE_REASONS = new Set(["sms_send_failed"]);

function inboundJobIdempotencyKey(workspaceId: string, providerMessageId: string) {
  return `ar-process-inbound:${workspaceId}:${providerMessageId}`;
}

export async function processArInboundSmsJob(payload: Record<string, unknown>) {
  const workspaceId = String(payload.workspaceId || "");
  const contactId = String(payload.contactId || "");
  const replySessionId = String(payload.replySessionId || "");
  const appointmentId = String(payload.appointmentId || "");
  const conversationId = String(payload.conversationId || "");
  const fromE164 = String(payload.fromE164 || "");
  const body = String(payload.body || "");
  const providerMessageId = String(payload.providerMessageId || "");
  const { inboundKind, bodyLength } = classifyArInboundBody(body);

  logArSmsPipeline({
    step: "inbound_job_process_start",
    workspaceId,
    contactId,
    appointmentId,
    replySessionId,
    conversationId,
    providerMessageId,
    inboundKind,
    bodyLength,
  });

  if (
    !workspaceId ||
    !contactId ||
    !replySessionId ||
    !appointmentId ||
    !conversationId ||
    !fromE164 ||
    !providerMessageId
  ) {
    logArSmsPipeline({
      step: "inbound_job_failed",
      workspaceId: workspaceId || undefined,
      providerMessageId: providerMessageId || undefined,
      error: "ar_process_inbound_sms_payload_incomplete",
    });
    throw new Error("ar_process_inbound_sms_payload_incomplete");
  }

  const { loadArReplySessionForWorkspace } = await import("./reply-session");
  const session = await loadArReplySessionForWorkspace({
    sessionId: replySessionId,
    workspaceId,
  });
  if (!session || session.appointmentId !== appointmentId || session.contactId !== contactId) {
    logArSmsPipeline({
      step: "inbound_job_failed",
      workspaceId,
      replySessionId,
      appointmentId,
      providerMessageId,
      error: "ar_inbound_session_identity_mismatch",
    });
    throw new Error("ar_inbound_session_identity_mismatch");
  }

  logArSmsPipeline({
    step: "inbound_job_session_verified",
    workspaceId,
    replySessionId,
    appointmentId,
    conversationId,
    providerMessageId,
    lifecycleState: session.lifecycleState,
  });

  const prisma = getPrisma();
  const idempotencyKey = inboundJobIdempotencyKey(workspaceId, providerMessageId);
  const queueJob = await prisma.jobQueue.findUnique({
    where: { idempotencyKey },
    select: { id: true, attempts: true, maxAttempts: true, jobType: true },
  });
  if (!queueJob || queueJob.jobType !== AR_JOB_PROCESS_INBOUND_SMS) {
    logArSmsPipeline({
      step: "inbound_job_failed",
      workspaceId,
      providerMessageId,
      processingJobId: queueJob?.id,
      error: "ar_inbound_job_row_missing",
    });
    throw new Error("ar_inbound_job_row_missing");
  }

  const handled = await handleAppointmentRemindersInboundBody({
    workspaceId,
    contactId,
    appointmentId,
    replySessionId,
    fromE164,
    body,
    providerMessageId,
    conversationId,
  });

  if (!handled.handled) {
    logArSmsPipeline({
      step: "inbound_handler_unhandled",
      workspaceId,
      replySessionId,
      appointmentId,
      conversationId,
      providerMessageId,
      inboundKind,
    });
    return { ok: true, handled: false, reason: "not_appointment_reminders_reply" };
  }

  const outboundIdempotencyKey = `ar-platform-reply:${conversationId}:${providerMessageId}`;
  try {
    const job = await enqueueArCustomerOutboundSmsJob({
      workspaceId,
      conversationId,
      replySessionId,
      toE164: fromE164,
      body: handled.replyText,
      idempotencyKey: outboundIdempotencyKey,
      providerMessageId,
      processingJobId: queueJob.id,
    });

    logArSmsPipeline({
      step: "inbound_outbound_enqueued",
      workspaceId,
      replySessionId,
      conversationId,
      providerMessageId,
      processingJobId: queueJob.id,
      outboundJobId: job.id,
      meta: { replyLength: handled.replyText.length },
    });

    logArSmsPipeline({
      step: "inbound_job_completed",
      workspaceId,
      providerMessageId,
      processingJobId: queueJob.id,
      ok: true,
    });

    return {
      ok: true,
      handled: true,
      outboundJobId: job.id,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "sms_send_failed";
    logArSmsPipeline({
      step: "inbound_job_failed",
      workspaceId,
      providerMessageId,
      processingJobId: queueJob.id,
      error: reason,
    });
    if (RETRYABLE_REASONS.has(reason) || reason.includes("send")) {
      throw new JobDeferredError(reason, 30_000);
    }
    throw err;
  }
}
