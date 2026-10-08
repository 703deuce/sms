import "server-only";

import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { JOB_PRIORITY_TRANSACTIONAL } from "@/lib/jobs/job-priority";
import { AR_QUEUE_NAME } from "./constants";

export const AR_JOB_SEND_CUSTOMER_SMS = "ar_send_customer_sms";

export async function enqueueArCustomerOutboundSmsJob(input: {
  workspaceId: string;
  conversationId: string;
  replySessionId: string;
  toE164: string;
  body: string;
  idempotencyKey: string;
  providerMessageId?: string | null;
  processingJobId?: string | null;
}) {
  return enqueueJob({
    workspaceId: input.workspaceId,
    jobType: AR_JOB_SEND_CUSTOMER_SMS,
    queueName: AR_QUEUE_NAME,
    priority: JOB_PRIORITY_TRANSACTIONAL,
    maxAttempts: 10,
    idempotencyKey: input.idempotencyKey,
    payload: {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      replySessionId: input.replySessionId,
      toE164: input.toE164,
      body: input.body,
      idempotencyKey: input.idempotencyKey,
      providerMessageId: input.providerMessageId ?? null,
      processingJobId: input.processingJobId ?? null,
    },
  });
}
