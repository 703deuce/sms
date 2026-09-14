import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { JOB_PRIORITY_MCTB_OUTBOUND_SMS } from "@/lib/jobs/job-priority";
import { MCTB_QUEUE_NAME } from "@/lib/mctb/messaging/inbound-sms-ingress";

export const MCTB_JOB_SEND_CUSTOMER_SMS = "mctb_send_customer_sms";

export async function enqueueMctbCustomerOutboundSmsJob(input: {
  workspaceId: string;
  conversationId: string;
  toE164: string;
  body: string;
  idempotencyKey: string;
  providerMessageId?: string | null;
  processingJobId?: string | null;
  action?: string;
}) {
  const key = input.idempotencyKey.trim();
  if (!key) throw new Error("mctb_outbound_missing_idempotency_key");

  const job = await enqueueJob({
    workspaceId: input.workspaceId,
    jobType: MCTB_JOB_SEND_CUSTOMER_SMS,
    queueName: MCTB_QUEUE_NAME,
    priority: JOB_PRIORITY_MCTB_OUTBOUND_SMS,
    maxAttempts: 12,
    idempotencyKey: key,
    payload: {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      toE164: input.toE164,
      body: input.body,
      idempotencyKey: key,
      providerMessageId: input.providerMessageId || null,
      processingJobId: input.processingJobId || null,
      action: input.action || null,
      enqueuedAt: new Date().toISOString(),
    },
    wake: true,
  });

  return job;
}
