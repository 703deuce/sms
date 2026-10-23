import { getPrisma } from "@/lib/server/db";
import { encryptSecret, decryptSecret } from "@/lib/messaging/crypto";
import {
  generateWebhookSigningSecret,
  signWebhookPayload,
} from "@/lib/server/voice-v3/webhooks/signing";
import type { PowerDialerWebhookEventType, PowerDialerWebhookPayload } from "./events";

const RETRY_SECONDS = [0, 60, 300, 1800, 7200];

export async function createPowerDialerWebhookEndpoint(input: {
  workspaceId: string;
  name: string;
  url: string;
  events: PowerDialerWebhookEventType[];
}) {
  const { secret, prefix, hash } = generateWebhookSigningSecret();
  const prisma = getPrisma();
  const row = await prisma.powerDialerWebhookEndpoint.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.name,
      url: input.url,
      events: input.events,
      signingSecretHash: hash,
      signingSecretPrefix: prefix,
      signingSecretEnc: encryptSecret(secret),
    },
  });
  return { endpoint: row, signingSecret: secret };
}

export async function emitPowerDialerWebhookEvent(input: {
  workspaceId: string;
  eventType: PowerDialerWebhookEventType;
  eventId: string;
  data: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const endpoints = await prisma.powerDialerWebhookEndpoint.findMany({
    where: {
      workspaceId: input.workspaceId,
      active: true,
      events: { has: input.eventType },
    },
  });
  if (!endpoints.length) return;

  const payload: PowerDialerWebhookPayload = {
    id: input.eventId,
    type: input.eventType,
    createdAt: new Date().toISOString(),
    workspaceId: input.workspaceId,
    data: input.data,
  };

  for (const ep of endpoints) {
    await prisma.powerDialerWebhookDelivery.upsert({
      where: { eventId: `${input.eventId}:${ep.id}` },
      create: {
        workspaceId: input.workspaceId,
        endpointId: ep.id,
        eventId: `${input.eventId}:${ep.id}`,
        eventType: input.eventType,
        status: "pending",
        attempt: 0,
        nextRetryAt: new Date(),
        payloadJson: payload,
      },
      update: {},
    });
    const secret = secretForEndpoint(ep);
    if (secret) await deliverPowerDialerWebhook(`${input.eventId}:${ep.id}`, secret);
  }
}

function secretForEndpoint(ep: { signingSecretEnc: string | null }) {
  if (ep.signingSecretEnc) {
    try {
      return decryptSecret(ep.signingSecretEnc);
    } catch {
      return null;
    }
  }
  return process.env.POWER_DIALER_WEBHOOK_DEV_SECRET?.trim() || null;
}

export async function deliverPowerDialerWebhook(deliveryEventId: string, signingSecret: string) {
  const prisma = getPrisma();
  const delivery = await prisma.powerDialerWebhookDelivery.findUnique({
    where: { eventId: deliveryEventId },
    include: { endpoint: true },
  });
  if (!delivery || !delivery.endpoint.active) return { ok: false };
  const secret = signingSecret || secretForEndpoint(delivery.endpoint);
  if (!secret) {
    await prisma.powerDialerWebhookDelivery.update({
      where: { id: delivery.id },
      data: { status: "failed", errorMessage: "Missing signing secret" },
    });
    return { ok: false };
  }

  const body = delivery.payloadJson as PowerDialerWebhookPayload;
  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signWebhookPayload(secret, timestamp, rawBody);
  const attempt = delivery.attempt + 1;
  let httpStatus: number | null = null;
  let errorMessage: string | null = null;
  let responseExcerpt: string | null = null;
  let status = "delivered";

  try {
    const res = await fetch(delivery.endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Transovo-Timestamp": timestamp,
        "X-Transovo-Signature": signature,
        "X-Transovo-Event": delivery.eventType,
      },
      body: rawBody,
    });
    httpStatus = res.status;
    const text = await res.text().catch(() => "");
    responseExcerpt = text.slice(0, 500);
    if (!res.ok) {
      status = attempt >= RETRY_SECONDS.length ? "failed" : "pending";
      errorMessage = `HTTP ${res.status}`;
    }
  } catch (e) {
    status = attempt >= RETRY_SECONDS.length ? "failed" : "pending";
    errorMessage = e instanceof Error ? e.message : "delivery_error";
  }

  const nextRetry =
    status === "pending" && attempt < RETRY_SECONDS.length
      ? new Date(Date.now() + RETRY_SECONDS[attempt] * 1000)
      : null;

  await prisma.powerDialerWebhookDelivery.update({
    where: { id: delivery.id },
    data: {
      attempt,
      status,
      httpStatus,
      errorMessage,
      responseExcerpt,
      attemptedAt: new Date(),
      nextRetryAt: nextRetry,
    },
  });
  return { ok: status === "delivered" };
}

export async function replayPowerDialerWebhookDelivery(workspaceId: string, deliveryId: string) {
  const prisma = getPrisma();
  const delivery = await prisma.powerDialerWebhookDelivery.findFirst({
    where: { id: deliveryId, workspaceId },
    include: { endpoint: true },
  });
  if (!delivery) throw new Error("Delivery not found");
  return deliverPowerDialerWebhook(delivery.eventId, secretForEndpoint(delivery.endpoint));
}

export async function sendTestWebhook(workspaceId: string, endpointId: string) {
  const prisma = getPrisma();
  const ep = await prisma.powerDialerWebhookEndpoint.findFirst({
    where: { id: endpointId, workspaceId, active: true },
  });
  if (!ep) throw new Error("Webhook endpoint not found");
  const eventId = `test-${Date.now()}`;
  const payload: PowerDialerWebhookPayload = {
    id: eventId,
    type: "call.ended",
    createdAt: new Date().toISOString(),
    workspaceId,
    test: true,
    data: { test: true, message: "Test delivery from Transovo Power Dialer" },
  };
  await prisma.powerDialerWebhookDelivery.create({
    data: {
      workspaceId,
      endpointId: ep.id,
      eventId: `${eventId}:${ep.id}`,
      eventType: "call.ended",
      status: "pending",
      attempt: 0,
      nextRetryAt: new Date(),
      payloadJson: payload,
    },
  });
  const secret = secretForEndpoint(ep);
  if (!secret) throw new Error("Missing signing secret");
  return deliverPowerDialerWebhook(`${eventId}:${ep.id}`, secret);
}
