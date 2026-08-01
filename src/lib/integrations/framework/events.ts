import { createHash } from "crypto";
import { getPrisma } from "@/lib/db";
import { upsertExternalContact } from "@/lib/integrations/connections";
import { writeIntegrationAudit } from "./audit";
import { upsertExternalMapping } from "./mappings";
import { getIntegrationPreferences } from "./settings";
import type { ExternalProviderId, NormalizedEvent } from "./types";

export function makeEventIdempotencyKey(
  provider: string,
  externalEventId: string,
  eventType: string,
) {
  return createHash("sha256")
    .update(`${provider}:${eventType}:${externalEventId}`)
    .digest("hex")
    .slice(0, 40);
}

/**
 * Persist a normalized event for automations. Does NOT send SMS.
 * Dedupes by workspace + provider + idempotency key via webhook event table.
 */
export async function publishNormalizedEvent(event: NormalizedEvent) {
  const prisma = getPrisma();
  const prefs = await getIntegrationPreferences(event.workspaceId, event.provider);

  const existing = await prisma.crmWebhookEvent.findFirst({
    where: {
      workspaceId: event.workspaceId,
      provider: event.provider,
      externalId: event.idempotencyKey,
    },
  });
  if (existing) {
    return { published: false, reason: "duplicate", eventId: existing.id };
  }

  let contactId = event.contactId || null;
  if (!contactId && prefs.autoCreateContacts && (event.phone || event.email)) {
    const matched = await upsertExternalContact({
      workspaceId: event.workspaceId,
      phone: prefs.matchByPhone ? event.phone : null,
      email: prefs.matchByEmail ? event.email : event.email,
      source: event.provider,
      overwrite: prefs.duplicatePolicy === "update",
    });
    contactId = matched?.contactId || null;
  }

  if (contactId && event.externalObjectId) {
    await upsertExternalMapping({
      workspaceId: event.workspaceId,
      provider: event.provider,
      objectType: event.externalObjectType,
      internalId: contactId,
      externalId: event.externalObjectId,
      metadata: { eventType: event.eventType },
    });
  }

  const row = await prisma.crmWebhookEvent.create({
    data: {
      workspaceId: event.workspaceId,
      provider: event.provider,
      status: "completed",
      eventType: event.eventType,
      externalId: event.idempotencyKey,
      payloadJson: {
        ...event,
        contactId,
        rawMeta: event.rawMeta || undefined,
      } as object,
      processedAt: new Date(),
    },
  });

  await writeIntegrationAudit({
    workspaceId: event.workspaceId,
    provider: event.provider,
    category: "webhook",
    action: "event_published",
    message: `${event.eventType} from ${event.provider}`,
    detail: {
      externalObjectId: event.externalObjectId,
      contactId,
      eventType: event.eventType,
    },
  });

  try {
    const { persistProductFromNormalizedEvent } = await import("./product-persist");
    await persistProductFromNormalizedEvent(event, contactId);
  } catch (err) {
    console.warn(
      "[integrations] product persist failed",
      err instanceof Error ? err.message : err,
    );
  }

  const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
  await enqueueJob({
    jobType: "integration_automation_event",
    queueName: "automations",
    workspaceId: event.workspaceId,
    priority: 15,
    payload: JSON.parse(
      JSON.stringify({
        workspaceId: event.workspaceId,
        provider: event.provider,
        eventType: event.eventType,
        webhookEventId: row.id,
        contactId,
        phone: event.phone ?? null,
        email: event.email ?? null,
        payload: event.payload,
      }),
    ),
    idempotencyKey: `int-evt-${event.idempotencyKey}`,
  });

  return { published: true, eventId: row.id, contactId };
}

export async function listRecentIntegrationEvents(
  workspaceId: string,
  provider?: ExternalProviderId,
  limit = 50,
) {
  return getPrisma().crmWebhookEvent.findMany({
    where: {
      workspaceId,
      ...(provider ? { provider } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });
}
