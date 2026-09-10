import "server-only";

import { createHmac } from "crypto";
import { getPrisma } from "@/lib/db";
import { encryptSecret } from "@/lib/messaging/crypto";
import { generateSecureToken, hashToken } from "./crypto";
import type { AppointmentWebhookEvent } from "./types";
import { enqueueWebhookDelivery } from "./webhook-delivery";

export async function listWebhookEndpoints(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.appointmentWebhookEndpoint.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
}

export async function listWebhookDeliveries(workspaceId: string, limit = 50) {
  const prisma = getPrisma();
  return prisma.appointmentWebhookDelivery.findMany({
    where: { endpoint: { workspaceId } },
    include: { endpoint: { select: { url: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function createWebhookEndpoint(
  workspaceId: string,
  input: { url: string; events: AppointmentWebhookEvent[] },
) {
  const prisma = getPrisma();
  const secret = generateSecureToken(24);
  const endpoint = await prisma.appointmentWebhookEndpoint.create({
    data: {
      workspaceId,
      url: input.url,
      secretHash: hashToken(secret),
      events: input.events,
      active: true,
      metadata: { signingSecretEnc: encryptSecret(secret) },
    },
  });
  return { endpoint, signingSecret: secret };
}

export function signWebhookPayload(secret: string, body: string, timestamp: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export async function dispatchAppointmentWebhook(
  workspaceId: string,
  eventType: AppointmentWebhookEvent,
  payload: Record<string, unknown>,
) {
  const prisma = getPrisma();
  const endpoints = await prisma.appointmentWebhookEndpoint.findMany({
    where: { workspaceId, active: true, events: { has: eventType } },
  });

  const deliveries = [];
  for (const endpoint of endpoints) {
    const delivery = await prisma.appointmentWebhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        eventType,
        payload,
        status: "pending",
      },
    });
    deliveries.push(delivery);
    await enqueueWebhookDelivery(delivery.id, workspaceId);
  }
  return deliveries;
}
