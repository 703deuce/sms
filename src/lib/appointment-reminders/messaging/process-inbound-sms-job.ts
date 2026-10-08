import "server-only";

import { getPrisma } from "@/lib/db";
import { JobDeferredError } from "@/lib/messaging/types";
import { AR_JOB_PROCESS_INBOUND_SMS } from "./constants";
import { handleAppointmentRemindersInboundBody } from "./handle-inbound-body";
import { enqueueArCustomerOutboundSmsJob } from "./enqueue-customer-outbound-sms";

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

  if (
    !workspaceId ||
    !contactId ||
    !replySessionId ||
    !appointmentId ||
    !conversationId ||
    !fromE164 ||
    !providerMessageId
  ) {
    throw new Error("ar_process_inbound_sms_payload_incomplete");
  }

  const { loadArReplySessionForWorkspace } = await import("./reply-session");
  const session = await loadArReplySessionForWorkspace({
    sessionId: replySessionId,
    workspaceId,
  });
  if (!session || session.appointmentId !== appointmentId || session.contactId !== contactId) {
    throw new Error("ar_inbound_session_identity_mismatch");
  }

  const prisma = getPrisma();
  const idempotencyKey = inboundJobIdempotencyKey(workspaceId, providerMessageId);
  const queueJob = await prisma.jobQueue.findUnique({
    where: { idempotencyKey },
    select: { id: true, attempts: true, maxAttempts: true, jobType: true },
  });
  if (!queueJob || queueJob.jobType !== AR_JOB_PROCESS_INBOUND_SMS) {
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

    return {
      ok: true,
      handled: true,
      outboundJobId: job.id,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "sms_send_failed";
    if (RETRYABLE_REASONS.has(reason) || reason.includes("send")) {
      throw new JobDeferredError(reason, 30_000);
    }
    throw err;
  }
}
