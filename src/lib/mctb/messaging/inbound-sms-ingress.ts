import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import {
  mctbCallerE164Variants,
  normalizeMctbCallerE164,
} from "@/lib/mctb/messaging/caller-e164";
import { logMctbInboundProcessingEvent } from "@/lib/mctb/messaging/inbound-processing-trace";

export const MCTB_JOB_PROCESS_INBOUND_SMS = "mctb_process_inbound_sms";
export const MCTB_QUEUE_NAME = "mctb";

export type AcceptMctbInboundSmsIngressInput = {
  workspaceId: string;
  from: string;
  to: string;
  body: string;
  provider: "telnyx" | "twilio";
  providerMessageId?: string | null;
  mediaUrls?: string[] | null;
};

export type AcceptMctbInboundSmsIngressResult = {
  ok: true;
  duplicate: boolean;
  conversationId: string;
  conversationMessageId: string | null;
  processingJobId: string | null;
  webhookAckAt: string;
};

function inboundJobIdempotencyKey(workspaceId: string, providerMessageId: string) {
  return `mctb-process-inbound:${workspaceId}:${providerMessageId}`;
}

function formatInboundMessageBody(body: string, mediaUrls?: string[] | null): string {
  const trimmed = (body || "").trim();
  const mediaCount = mediaUrls?.filter(Boolean).length || 0;
  if (trimmed) return trimmed;
  if (mediaCount > 0) return "";
  return "(empty)";
}

/**
 * Durable acceptance: persist inbound + enqueue processing job in one commit.
 * Webhook returns 2xx only after this succeeds.
 */
export async function acceptMctbInboundSmsIngress(
  input: AcceptMctbInboundSmsIngressInput,
): Promise<AcceptMctbInboundSmsIngressResult> {
  const providerMessageId = input.providerMessageId?.trim();
  if (!providerMessageId) {
    throw new Error("mctb_inbound_missing_provider_message_id");
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
        where: { workspaceId: input.workspaceId, phone: { in: callerVariants } },
      });
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

      const recentMissed = await tx.missedCallEvent.findFirst({
        where: {
          workspaceId: input.workspaceId,
          callerE164: { in: callerVariants },
          smsSentAt: { not: null },
        },
        orderBy: { smsSentAt: "desc" },
        select: { id: true },
      });

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
          productSource: "MCTB",
          ...(recentMissed ? { missedCallEventId: recentMissed.id } : {}),
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
          jobType: MCTB_JOB_PROCESS_INBOUND_SMS,
          queueName: MCTB_QUEUE_NAME,
          priority: 8,
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

  await logMctbInboundProcessingEvent({
    kind: "INBOUND_ACCEPTED",
    workspaceId: input.workspaceId,
    conversationId: result.conversationId,
    providerMessageId,
    processingJobId: result.processingJobId,
    duplicate: result.duplicate,
    webhookAckAt,
  });

  try {
    const { scheduleJobDrain } = await import("@/lib/jobs/inprocess-worker");
    scheduleJobDrain(25);
  } catch {
    // external worker poll will pick up
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
