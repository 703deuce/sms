import "server-only";

import { getPrisma } from "@/lib/db";
import { decryptSecret } from "@/lib/messaging/crypto";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { signWebhookPayload } from "./webhooks";

const MAX_ATTEMPTS = 6;
const BACKOFF_SECONDS = [30, 60, 300, 900, 3600, 7200];

function endpointSigningSecret(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const enc = (metadata as { signingSecretEnc?: string }).signingSecretEnc;
  if (!enc) return null;
  try {
    return decryptSecret(enc);
  } catch {
    return null;
  }
}

export async function enqueueWebhookDelivery(deliveryId: string, workspaceId: string) {
  await enqueueJob({
    jobType: "appointment_webhook_deliver",
    workspaceId,
    payload: { deliveryId },
    idempotencyKey: `appointment-webhook:${deliveryId}`,
    maxAttempts: MAX_ATTEMPTS,
  });
}

export async function deliverAppointmentWebhook(deliveryId: string) {
  const prisma = getPrisma();
  const delivery = await prisma.appointmentWebhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });
  if (!delivery) return { ok: false, error: "delivery_not_found" };
  if (delivery.status === "delivered") return { ok: true, skipped: true };
  if (delivery.status === "failed" && delivery.attemptCount >= MAX_ATTEMPTS) {
    return { ok: false, terminal: true };
  }

  const secret = endpointSigningSecret(delivery.endpoint.metadata);
  if (!secret) {
    await prisma.appointmentWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "failed",
        errorMessage: "Missing signing secret — recreate webhook endpoint",
        attemptCount: { increment: 1 },
      },
    });
    return { ok: false, error: "missing_signing_secret" };
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    id: delivery.id,
    type: delivery.eventType,
    created_at: delivery.createdAt.toISOString(),
    data: delivery.payload,
  });
  const signature = signWebhookPayload(secret, body, timestamp);

  try {
    const response = await fetch(delivery.endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Transovo-Appointments-Webhooks/1.0",
        "X-Transovo-Timestamp": timestamp,
        "X-Transovo-Signature": signature,
        "X-Transovo-Event": delivery.eventType,
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    const attemptCount = delivery.attemptCount + 1;
    if (response.ok) {
      await prisma.appointmentWebhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "delivered",
          attemptCount,
          responseCode: response.status,
          deliveredAt: new Date(),
          errorMessage: null,
        },
      });
      return { ok: true, status: response.status };
    }

    const errorMessage = `HTTP ${response.status}`;
    const terminal = attemptCount >= MAX_ATTEMPTS;
    await prisma.appointmentWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: terminal ? "failed" : "pending",
        attemptCount,
        responseCode: response.status,
        errorMessage,
      },
    });

    if (!terminal) {
      const delaySec = BACKOFF_SECONDS[Math.min(attemptCount - 1, BACKOFF_SECONDS.length - 1)];
      await enqueueJob({
        jobType: "appointment_webhook_deliver",
        workspaceId: delivery.endpoint.workspaceId,
        payload: { deliveryId },
        idempotencyKey: `appointment-webhook-retry:${deliveryId}:${attemptCount}`,
        runAfter: new Date(Date.now() + delaySec * 1000),
        maxAttempts: MAX_ATTEMPTS,
      });
    }

    return { ok: false, status: response.status, retrying: !terminal };
  } catch (err) {
    const attemptCount = delivery.attemptCount + 1;
    const errorMessage = err instanceof Error ? err.message : "delivery_failed";
    const terminal = attemptCount >= MAX_ATTEMPTS;
    await prisma.appointmentWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: terminal ? "failed" : "pending",
        attemptCount,
        errorMessage,
      },
    });

    if (!terminal) {
      const delaySec = BACKOFF_SECONDS[Math.min(attemptCount - 1, BACKOFF_SECONDS.length - 1)];
      await enqueueJob({
        jobType: "appointment_webhook_deliver",
        workspaceId: delivery.endpoint.workspaceId,
        payload: { deliveryId },
        idempotencyKey: `appointment-webhook-retry:${deliveryId}:${attemptCount}`,
        runAfter: new Date(Date.now() + delaySec * 1000),
        maxAttempts: MAX_ATTEMPTS,
      });
    }

    return { ok: false, error: errorMessage, retrying: !terminal };
  }
}

/** Sweep stale pending deliveries (worker safety net). */
export async function sweepPendingWebhookDeliveries(limit = 25) {
  const prisma = getPrisma();
  const pending = await prisma.appointmentWebhookDelivery.findMany({
    where: { status: "pending", attemptCount: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { endpoint: true },
  });

  let enqueued = 0;
  for (const row of pending) {
    await enqueueWebhookDelivery(row.id, row.endpoint.workspaceId);
    enqueued += 1;
  }
  return { enqueued };
}
