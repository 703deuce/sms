/**
 * Unified Transovo → integrations event bus.
 * Every business event enters here; CRM (and future integrations) subscribe.
 */

import { randomBytes } from "crypto";
import { getPrisma } from "@/lib/server/db";
import type { InputJsonValue } from "@/lib/domain";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { crmEventIdempotencyKey } from "../idempotency";
import { writeCrmAudit } from "../logging";
import { recordCrmMetric } from "../metrics";
import { CRM_PROVIDER_IDS } from "../registry";
import type { CrmPlatformEvent, CrmPlatformEventType, CrmProviderId } from "../types";
import { crmQueueName, priorityScoreForEvent } from "./priority";
import { providerAcceptsEvent } from "./subscriptions";

export type BusPublishResult = {
  eventId: string;
  enqueued: number;
  skipped: Array<{ provider: CrmProviderId; reason: string }>;
};

/**
 * Publish a platform event onto the bus.
 * CRM providers receive jobs only when they declare support for the event.
 */
export async function emitPlatformEvent(
  event: CrmPlatformEvent,
): Promise<BusPublishResult> {
  const eventId = event.eventId || randomBytes(12).toString("hex");
  const occurredAt = event.occurredAt || new Date().toISOString();
  const normalized: CrmPlatformEvent = { ...event, eventId, occurredAt };

  const connected = await getPrisma().integrationConnection.findMany({
    where: {
      workspaceId: event.workspaceId,
      provider: { in: [...CRM_PROVIDER_IDS] },
      status: { in: ["connected", "syncing"] },
    },
    select: { provider: true },
  });

  let enqueued = 0;
  const skipped: BusPublishResult["skipped"] = [];

  for (const row of connected) {
    const provider = row.provider as CrmProviderId;
    if (!providerAcceptsEvent(provider, normalized.type)) {
      skipped.push({ provider, reason: "unsupported_event" });
      continue;
    }

    try {
      const jobPayload = JSON.parse(
        JSON.stringify({
          workspaceId: normalized.workspaceId,
          provider,
          event: {
            type: normalized.type,
            workspaceId: normalized.workspaceId,
            contactId: normalized.contactId ?? null,
            occurredAt,
            eventId,
            payload: normalized.payload,
          },
        }),
      ) as InputJsonValue;

      await enqueueJob({
        jobType: "crm_push_event",
        queueName: crmQueueName(provider),
        workspaceId: normalized.workspaceId,
        priority: priorityScoreForEvent(normalized.type),
        payload: jobPayload,
        idempotencyKey: crmEventIdempotencyKey({
          workspaceId: normalized.workspaceId,
          provider,
          type: normalized.type,
          eventId,
          objectId: normalized.contactId,
        }),
      });
      enqueued += 1;
    } catch (err) {
      skipped.push({
        provider,
        reason: err instanceof Error ? err.message.slice(0, 120) : "enqueue_failed",
      });
    }
  }

  if (enqueued || skipped.length) {
    await writeCrmAudit({
      workspaceId: event.workspaceId,
      category: "push",
      action: normalized.type,
      message: `Event bus: ${normalized.type} → ${enqueued} job(s)`,
      detail: {
        eventId,
        enqueued,
        skipped,
        providers: connected.map((c: { provider: string }) => c.provider),
      },
    });
  }

  if (connected[0]?.provider) {
    await recordCrmMetric({
      workspaceId: event.workspaceId,
      provider: connected[0].provider as CrmProviderId,
      name: "event_bus_publish",
      ms: 0,
      ok: true,
    }).catch(() => undefined);
  }

  return { eventId, enqueued, skipped };
}

/** Convenience for typed emits from product code. */
export async function emitTypedEvent(
  type: CrmPlatformEventType,
  input: {
    workspaceId: string;
    contactId?: string | null;
    payload?: Record<string, unknown>;
    eventId?: string;
    occurredAt?: string;
  },
) {
  return emitPlatformEvent({
    type,
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    eventId: input.eventId,
    occurredAt: input.occurredAt,
    payload: input.payload || {},
  });
}
