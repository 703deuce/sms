import "server-only";

import { getPrisma } from "@/lib/db";
import { encryptSecret } from "@/lib/messaging/crypto";
import { assertSafeWebhookUrl } from "@/lib/voice/url-safety";
import {
  VOICE_WEBHOOK_SUBSCRIPTION_EVENT_TYPES,
  type VoiceWebhookEventType,
} from "./events";
import { generateWebhookSigningSecret } from "./signing";
import { queueVoiceWebhookDelivery } from "./delivery";

function parseLabel(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const label = (metadata as { label?: unknown }).label;
  return typeof label === "string" && label.trim() ? label.trim() : null;
}

export function serializeOutboundWebhook(row: {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  signingSecretPrefix: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    url: row.url,
    label: parseLabel(row.metadata) || row.url,
    events: row.events,
    active: row.active,
    signingSecretPrefix: row.signingSecretPrefix,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertVoiceSubscriptionEvents(events: string[]): VoiceWebhookEventType[] {
  if (!events.length) {
    throw new Error("Select at least one Voice event");
  }
  const allowed = new Set(VOICE_WEBHOOK_SUBSCRIPTION_EVENT_TYPES);
  const normalized: VoiceWebhookEventType[] = [];
  for (const e of events) {
    if (!allowed.has(e as VoiceWebhookEventType)) {
      throw new Error(`Unsupported Voice event: ${e}`);
    }
    normalized.push(e as VoiceWebhookEventType);
  }
  return normalized;
}

export async function listOutboundVoiceWebhooks(workspaceId: string) {
  const prisma = getPrisma();
  const rows = await prisma.webhook.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serializeOutboundWebhook);
}

export async function createOutboundVoiceWebhook(
  workspaceId: string,
  input: { url: string; label: string; events: string[]; active?: boolean },
) {
  const safeUrl = await assertSafeWebhookUrl(input.url.trim());
  const label = input.label.trim();
  if (!label) throw new Error("Label is required");
  const events = assertVoiceSubscriptionEvents(input.events);
  const { secret, prefix, hash } = generateWebhookSigningSecret();

  const prisma = getPrisma();
  const row = await prisma.webhook.create({
    data: {
      workspaceId,
      url: safeUrl,
      events,
      active: input.active ?? true,
      signingSecretPrefix: prefix,
      signingSecretHash: hash,
      metadata: {
        label,
        signingSecretEnc: encryptSecret(secret),
      },
    },
  });

  return {
    endpoint: serializeOutboundWebhook(row),
    signingSecret: secret,
  };
}

export async function updateOutboundVoiceWebhook(
  workspaceId: string,
  webhookId: string,
  input: { url?: string; label?: string; events?: string[]; active?: boolean },
) {
  const prisma = getPrisma();
  const existing = await prisma.webhook.findFirst({
    where: { id: webhookId, workspaceId },
  });
  if (!existing) throw new Error("Webhook endpoint not found");

  const data: {
    url?: string;
    events?: string[];
    active?: boolean;
    metadata?: Record<string, unknown>;
  } = {};

  if (input.url !== undefined) {
    data.url = await assertSafeWebhookUrl(input.url.trim());
  }
  if (input.events !== undefined) {
    data.events = assertVoiceSubscriptionEvents(input.events);
  }
  if (input.active !== undefined) {
    data.active = input.active;
  }
  if (input.label !== undefined) {
    const label = input.label.trim();
    if (!label) throw new Error("Label is required");
    const meta =
      existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {};
    meta.label = label;
    data.metadata = meta;
  }

  const row = await prisma.webhook.update({
    where: { id: webhookId },
    data,
  });
  return serializeOutboundWebhook(row);
}

export async function deleteOutboundVoiceWebhook(workspaceId: string, webhookId: string) {
  const prisma = getPrisma();
  const existing = await prisma.webhook.findFirst({
    where: { id: webhookId, workspaceId },
  });
  if (!existing) throw new Error("Webhook endpoint not found");
  await prisma.webhook.delete({ where: { id: webhookId } });
  return { ok: true };
}

export async function sendOutboundVoiceWebhookTest(workspaceId: string, webhookId: string) {
  const prisma = getPrisma();
  const hook = await prisma.webhook.findFirst({
    where: { id: webhookId, workspaceId, active: true },
  });
  if (!hook) throw new Error("Active webhook endpoint not found");

  const eventId = `evt_test_${webhookId}_${Date.now()}`;
  const createdAt = new Date().toISOString();
  const payload = {
    id: eventId,
    type: "voice.test" as const,
    createdAt,
    workspaceId,
    test: true,
    data: {
      message: "Transovo Voice webhook test delivery",
    },
  };

  await queueVoiceWebhookDelivery({
    workspaceId,
    webhookId: hook.id,
    eventId: `${eventId}:${hook.id}`,
    eventType: "voice.test",
    payload,
  });

  return { ok: true, eventId };
}
