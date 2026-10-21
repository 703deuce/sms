import "server-only";

import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/server/db";

export type VoiceRuntimeEnqueueInput = {
  jobType: string;
  queueName?: string;
  workspaceId?: string;
  payload: Prisma.InputJsonValue;
  idempotencyKey?: string;
  runAfter?: Date;
};

/**
 * Minimal job dispatch for Voice V3 post-call (new-app has no BullMQ worker).
 * Persists to job_queue for audit/retry and runs voice_webhook_deliver inline when due.
 */
export async function enqueueVoiceRuntimeJob(input: VoiceRuntimeEnqueueInput): Promise<void> {
  const prisma = getPrisma();
  const runAfter = input.runAfter ?? new Date();
  const queueName = input.queueName ?? "voice-calls";

  if (input.idempotencyKey) {
    await prisma.jobQueue.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: {
        jobType: input.jobType,
        queueName,
        workspaceId: input.workspaceId,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
        runAfter,
        maxAttempts: 8,
        priority: 50,
      },
      update: {
        status: "pending",
        runAfter,
        payload: input.payload,
        attempts: 0,
        lastError: null,
        lockedAt: null,
        completedAt: null,
      },
    });
  }

  if (input.jobType !== "voice_webhook_deliver") return;

  const payload = (input.payload || {}) as Record<string, unknown>;
  const delay = Math.max(0, runAfter.getTime() - Date.now());
  const run = async () => {
    const { executeVoiceWebhookDeliverJob } = await import(
      "@/lib/server/voice-v3/webhooks/delivery"
    );
    await executeVoiceWebhookDeliverJob(payload);
  };
  if (delay === 0) {
    await run().catch((err) => {
      console.error("VOICE_WEBHOOK_DELIVER_INLINE_FAILED", {
        message: err instanceof Error ? err.message : String(err),
      });
    });
  } else {
    setTimeout(() => {
      void run().catch((err) => {
        console.error("VOICE_WEBHOOK_DELIVER_RETRY_FAILED", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
    }, delay);
  }
}
