import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { enrollContactInCampaign } from "@/lib/campaigns/enroll-campaign";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";

function newToken() {
  return randomBytes(24).toString("hex");
}

function readMapped(
  payload: Record<string, unknown>,
  fieldMap: Record<string, string> | null | undefined,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const mapped = fieldMap?.[key];
    const raw = mapped ? payload[mapped] : payload[key];
    if (raw != null && String(raw).trim()) return String(raw).trim();
  }
  return undefined;
}

export async function createIntegrationWebhook(input: {
  workspaceId: string;
  name: string;
  campaignId?: string;
  sendDelayMinutes?: number;
  fieldMap?: Prisma.InputJsonValue;
}) {
  const endpoint = await getPrisma().integrationWebhookEndpoint.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.name,
      token: newToken(),
      campaignId: input.campaignId,
      sendDelayMinutes: input.sendDelayMinutes ?? 0,
      fieldMap: input.fieldMap,
    },
  });
  return {
    ...endpoint,
    incomingUrl: `${getAppBaseUrl()}/api/integrations/webhooks/incoming/${endpoint.token}`,
  };
}

export async function rotateIntegrationWebhook(workspaceId: string, endpointId: string) {
  const existing = await getPrisma().integrationWebhookEndpoint.findFirst({
    where: { id: endpointId, workspaceId, revokedAt: null },
  });
  if (!existing) throw new Error("Webhook endpoint not found");
  const updated = await getPrisma().integrationWebhookEndpoint.update({
    where: { id: endpointId },
    data: { token: newToken(), rotatedAt: new Date(), active: true },
  });
  return {
    ...updated,
    incomingUrl: `${getAppBaseUrl()}/api/integrations/webhooks/incoming/${updated.token}`,
  };
}

export async function revokeIntegrationWebhook(workspaceId: string, endpointId: string) {
  const existing = await getPrisma().integrationWebhookEndpoint.findFirst({
    where: { id: endpointId, workspaceId },
  });
  if (!existing) throw new Error("Webhook endpoint not found");
  return getPrisma().integrationWebhookEndpoint.update({
    where: { id: endpointId },
    data: { active: false, revokedAt: new Date() },
  });
}

export async function listIntegrationWebhooks(workspaceId: string) {
  const rows = await getPrisma().integrationWebhookEndpoint.findMany({
    where: { workspaceId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const base = getAppBaseUrl();
  return rows.map((r) => ({
    ...r,
    incomingUrl: `${base}/api/integrations/webhooks/incoming/${r.token}`,
  }));
}

export async function processIncomingIntegrationWebhook(
  token: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
) {
  const prisma = getPrisma();
  const endpoint = await prisma.integrationWebhookEndpoint.findUnique({ where: { token } });
  if (!endpoint || !endpoint.active || endpoint.revokedAt) {
    throw new Error("Webhook endpoint not found or revoked");
  }
  if (!endpoint.campaignId) {
    throw new Error("Webhook endpoint has no campaignId configured");
  }

  const staleCutoff = new Date(Date.now() - 10 * 60 * 1000);
  let eventId: string | null = null;

  if (idempotencyKey) {
    const prior = await prisma.integrationWebhookEvent.findUnique({
      where: {
        endpointId_idempotencyKey: { endpointId: endpoint.id, idempotencyKey },
      },
    });
    if (prior) {
      if (prior.status === "processed") {
        return { duplicate: true, eventId: prior.id, status: prior.status };
      }
      // Retry failed or stale processing events
      if (
        prior.status === "failed" ||
        (prior.status === "processing" && prior.createdAt < staleCutoff)
      ) {
        await prisma.integrationWebhookEvent.update({
          where: { id: prior.id },
          data: { status: "processing", error: null, processedAt: null, payload: payload as Prisma.InputJsonValue },
        });
        eventId = prior.id;
      } else {
        return { duplicate: true, eventId: prior.id, status: prior.status };
      }
    }
  }

  if (!eventId) {
    try {
      const event = await prisma.integrationWebhookEvent.create({
        data: {
          workspaceId: endpoint.workspaceId,
          endpointId: endpoint.id,
          idempotencyKey: idempotencyKey || null,
          payload: payload as Prisma.InputJsonValue,
          status: "processing",
        },
      });
      eventId = event.id;
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002" && idempotencyKey) {
        const prior = await prisma.integrationWebhookEvent.findUnique({
          where: {
            endpointId_idempotencyKey: { endpointId: endpoint.id, idempotencyKey },
          },
        });
        if (prior) {
          return { duplicate: true, eventId: prior.id, status: prior.status };
        }
      }
      throw err;
    }
  }

  try {
    const fieldMap = (endpoint.fieldMap || null) as Record<string, string> | null;
    const phone = readMapped(payload, fieldMap, ["phone", "customerPhone", "Phone", "mobile"]);
    const email = readMapped(payload, fieldMap, ["email", "customerEmail", "Email"]);
    const displayName = readMapped(payload, fieldMap, [
      "name",
      "displayName",
      "customerName",
      "full_name",
    ]);

    if (!phone && !email) {
      throw new Error("Webhook payload must include phone or email");
    }

    const recipient = await enrollContactInCampaign({
      workspaceId: endpoint.workspaceId,
      campaignId: endpoint.campaignId,
      phone,
      email,
      displayName,
      sendDelayMinutes: endpoint.sendDelayMinutes,
      metadata: { source: "integration_webhook", eventId },
    });

    await prisma.integrationWebhookEvent.update({
      where: { id: eventId },
      data: { status: "processed", processedAt: new Date() },
    });

    return { duplicate: false, eventId, recipientId: recipient.id, status: "processed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.integrationWebhookEvent.update({
      where: { id: eventId! },
      data: { status: "failed", error: message, processedAt: new Date() },
    });
    throw err;
  }
}
