import "server-only";

import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import {
  mctbCallerE164Variants,
  normalizeMctbCallerE164,
} from "@/lib/mctb/messaging/caller-e164";
import { JOB_PRIORITY_TRANSACTIONAL } from "@/lib/jobs/job-priority";
import { AR_JOB_PROCESS_INBOUND_SMS, AR_QUEUE_NAME } from "./constants";

export type AcceptArInboundSmsIngressInput = {
  workspaceId: string;
  contactId: string;
  replySessionId: string;
  appointmentId: string;
  from: string;
  to: string;
  body: string;
  provider: "telnyx" | "twilio";
  providerMessageId?: string | null;
  mediaUrls?: string[] | null;
};

export type AcceptArInboundSmsIngressResult = {
  ok: true;
  duplicate: boolean;
  conversationId: string;
  conversationMessageId: string | null;
  processingJobId: string | null;
  webhookAckAt: string;
};

function inboundJobIdempotencyKey(workspaceId: string, providerMessageId: string) {
  return `ar-process-inbound:${workspaceId}:${providerMessageId}`;
}

function formatInboundMessageBody(body: string, mediaUrls?: string[] | null): string {
  const trimmed = (body || "").trim();
  const mediaCount = mediaUrls?.filter(Boolean).length || 0;
  if (trimmed) return trimmed;
  if (mediaCount > 0) return "";
  return "(empty)";
}

export async function acceptArInboundSmsIngress(
  input: AcceptArInboundSmsIngressInput,
): Promise<AcceptArInboundSmsIngressResult> {
  const providerMessageId = input.providerMessageId?.trim();
  if (!providerMessageId) {
    throw new Error("ar_inbound_missing_provider_message_id");
  }

  const prisma = getPrisma();
  const from = normalizeMctbCallerE164(input.from);
  const callerVariants = mctbCallerE164Variants(input.from);
  const body = (input.body || "").trim();
  const webhookAckAt = new Date().toISOString();
  const idempotencyKey = inboundJobIdempotencyKey(input.workspaceId, providerMessageId);

  const result = await prisma.$transaction(async (tx) => {
    const existingJob = await tx.jobQueue.findUnique({
      where: { idempotencyKey },
      select: { id: true, status: true },
    });
    if (existingJob?.status === "completed") {
      const existingMsg = await tx.conversationMessage.findFirst({
        where: { providerMessageId },
        select: { id: true, conversationId: true },
      });
      return {
        duplicate: true,
        conversationId: existingMsg?.conversationId || "",
        conversationMessageId: existingMsg?.id || null,
        processingJobId: existingJob.id,
      };
    }

    const existingMsg = await tx.conversationMessage.findFirst({
      where: { providerMessageId },
      select: { id: true, conversationId: true },
    });

    let conversationId = existingMsg?.conversationId || "";
    let conversationMessageId = existingMsg?.id || null;

    if (!existingMsg) {
      let contact = await tx.contact.findFirst({
        where: { id: input.contactId, workspaceId: input.workspaceId },
      });
      if (!contact) {
        contact = await tx.contact.findFirst({
          where: { workspaceId: input.workspaceId, phone: { in: callerVariants } },
        });
      }
      if (!contact) {
        contact = await tx.contact.create({
          data: { workspaceId: input.workspaceId, phone: from, lastReply: new Date() },
        });
      } else {
        await tx.contact.update({
          where: { id: contact.id },
          data: { lastReply: new Date() },
        });
      }

      const { resolveInboundConversation } = await import("@/lib/mass-texting/conversation-context");
      const inboundCtx = await resolveInboundConversation({
        workspaceId: input.workspaceId,
        contactId: contact.id,
        toE164: input.to,
        fromE164: from,
      });

      const conversation = await tx.conversation.update({
        where: { id: inboundCtx.conversationId },
        data: {
          unread: true,
          updatedAt: new Date(),
          productSource: "APPOINTMENT_REMINDERS",
          tags: ["appointment_reminders"],
        },
      });
      conversationId = conversation.id;

      const displayBody = formatInboundMessageBody(body, input.mediaUrls);
      const inboundMedia = input.mediaUrls?.filter(Boolean) ?? [];
      try {
        const created = await tx.conversationMessage.create({
          data: {
            conversationId: conversation.id,
            direction: "inbound",
            body: displayBody,
            mediaUrls: inboundMedia,
            providerMessageId,
          },
          select: { id: true },
        });
        conversationMessageId = created.id;
      } catch (err) {
        if (!(err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002")) {
          throw err;
        }
        const raced = await tx.conversationMessage.findFirst({
          where: { providerMessageId },
          select: { id: true, conversationId: true },
        });
        conversationMessageId = raced?.id || null;
        conversationId = raced?.conversationId || conversationId;
      }
    }

    const jobPayload = {
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      replySessionId: input.replySessionId,
      appointmentId: input.appointmentId,
      conversationId,
      conversationMessageId,
      fromE164: from,
      toE164: input.to,
      body,
      provider: input.provider,
      providerMessageId,
      acceptedAt: webhookAckAt,
    } satisfies Record<string, unknown>;

    let processingJobId = existingJob?.id || null;
    if (!existingJob) {
      const job = await tx.jobQueue.create({
        data: {
          workspaceId: input.workspaceId,
          jobType: AR_JOB_PROCESS_INBOUND_SMS,
          queueName: AR_QUEUE_NAME,
          priority: JOB_PRIORITY_TRANSACTIONAL,
          maxAttempts: 10,
          idempotencyKey,
          payload: jobPayload as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      processingJobId = job.id;
    } else if (existingJob.status === "failed") {
      const job = await tx.jobQueue.update({
        where: { id: existingJob.id },
        data: {
          status: "pending",
          attempts: 0,
          runAfter: new Date(),
          lastError: null,
          lockedAt: null,
          completedAt: null,
          payload: jobPayload as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      processingJobId = job.id;
    }

    const duplicateWebhook =
      Boolean(existingJob) &&
      existingJob!.status !== "failed" &&
      Boolean(existingMsg || conversationMessageId);

    return {
      duplicate: duplicateWebhook,
      conversationId,
      conversationMessageId,
      processingJobId,
    };
  });

  if (!result.duplicate && result.processingJobId && providerMessageId) {
    const { wakeDurableJobQueueRowToBullmq } = await import("@/lib/jobs/bullmq");
    await wakeDurableJobQueueRowToBullmq({
      queueName: AR_QUEUE_NAME,
      jobType: AR_JOB_PROCESS_INBOUND_SMS,
      idempotencyKey: inboundJobIdempotencyKey(input.workspaceId, providerMessageId),
      payload: {
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        replySessionId: input.replySessionId,
        appointmentId: input.appointmentId,
        conversationId: result.conversationId,
        conversationMessageId: result.conversationMessageId,
        fromE164: from,
        toE164: input.to,
        body,
        provider: input.provider,
        providerMessageId,
        acceptedAt: webhookAckAt,
      },
    });
  }

  try {
    const { scheduleJobDrain } = await import("@/lib/jobs/inprocess-worker");
    scheduleJobDrain(25);
  } catch {
    // optional
  }

  return {
    ok: true,
    duplicate: result.duplicate,
    conversationId: result.conversationId,
    conversationMessageId: result.conversationMessageId,
    processingJobId: result.processingJobId,
    webhookAckAt,
  };
}
