import "server-only";

import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { signWebhookPayload, verifyWebhookSigningSecret } from "./signing";
import type { VoiceWebhookEventType } from "./events";

const RETRY_SECONDS = [0, 60, 300, 1800, 7200];

export type VoiceWebhookPayload = {
  id: string;
  type: VoiceWebhookEventType;
  createdAt: string;
  workspaceId: string;
  test?: boolean;
  data: Record<string, unknown>;
};

export async function queueVoiceWebhookDelivery(input: {
  workspaceId: string;
  webhookId: string;
  eventId: string;
  eventType: VoiceWebhookEventType;
  payload: VoiceWebhookPayload;
}): Promise<void> {
  const prisma = getPrisma();
  await prisma.voiceWebhookDelivery.upsert({
    where: { eventId: input.eventId },
    create: {
      workspaceId: input.workspaceId,
      webhookId: input.webhookId,
      eventId: input.eventId,
      eventType: input.eventType,
      status: "pending",
      attempt: 0,
      nextRetryAt: new Date(),
    },
    update: {},
  });

  await enqueueJob({
    jobType: "voice_webhook_deliver",
    queueName: "voice-calls",
    workspaceId: input.workspaceId,
    payload: {
      deliveryEventId: input.eventId,
      webhookId: input.webhookId,
      body: input.payload,
    },
    idempotencyKey: `voice-webhook-deliver:${input.eventId}`,
    runAfter: new Date(),
  }).catch(() => undefined);
}

export async function executeVoiceWebhookDeliverJob(payload: Record<string, unknown>): Promise<{
  ok: boolean;
}> {
  const eventId = String(payload.deliveryEventId || "");
  const webhookId = String(payload.webhookId || "");
  const body = payload.body as VoiceWebhookPayload;
  if (!eventId || !webhookId || !body) return { ok: false };

  const prisma = getPrisma();
  const delivery = await prisma.voiceWebhookDelivery.findUnique({ where: { eventId } });
  const webhook = await prisma.webhook.findFirst({
    where: { id: webhookId, workspaceId: delivery?.workspaceId },
  });
  if (!delivery || !webhook || !webhook.active) return { ok: false };

  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const meta =
    webhook.metadata && typeof webhook.metadata === "object" && !Array.isArray(webhook.metadata)
      ? (webhook.metadata as Record<string, unknown>)
      : {};
  const storedSecret = typeof meta.signingSecret === "string" ? meta.signingSecret : null;
  const secret =
    storedSecret ||
    process.env.INTEGRATION_SECRET_KEY?.trim() ||
    "transovo-webhook-dev";
  const signature = signWebhookPayload(secret, timestamp, rawBody);

  const attempt = delivery.attempt + 1;
  let httpStatus: number | null = null;
  let errorMessage: string | null = null;
  let responseExcerpt: string | null = null;
  let status = "delivered";

  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Transovo-Event-Id": eventId,
        "X-Transovo-Event-Type": body.type,
        "X-Transovo-Timestamp": timestamp,
        "X-Transovo-Signature": signature,
      },
      body: rawBody,
    });
    httpStatus = res.status;
    const text = await res.text();
    responseExcerpt = text.slice(0, 500);
    if (!res.ok) {
      status = "failed";
      errorMessage = `HTTP ${res.status}`;
    }
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const retryIndex = Math.min(attempt, RETRY_SECONDS.length - 1);
  const nextRetryAt =
    status === "failed" && attempt < RETRY_SECONDS.length
      ? new Date(Date.now() + RETRY_SECONDS[retryIndex] * 1000)
      : null;

  await prisma.voiceWebhookDelivery.update({
    where: { id: delivery.id },
    data: {
      attempt,
      status,
      httpStatus,
      errorMessage,
      responseExcerpt,
      attemptedAt: new Date(),
      nextRetryAt,
    },
  });

  if (status === "failed" && nextRetryAt && attempt < RETRY_SECONDS.length) {
    await enqueueJob({
      jobType: "voice_webhook_deliver",
      queueName: "voice-calls",
      workspaceId: delivery.workspaceId,
      payload: { deliveryEventId: eventId, webhookId, body },
      idempotencyKey: `voice-webhook-deliver-retry:${eventId}:${attempt + 1}`,
      runAfter: nextRetryAt,
    }).catch(() => undefined);
  }

  return { ok: status === "delivered" };
}

export function verifyStoredWebhookSecret(provided: string, storedHash: string): boolean {
  return verifyWebhookSigningSecret(provided, storedHash);
}
