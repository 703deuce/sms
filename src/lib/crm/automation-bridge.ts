/**
 * Bridge CRM inbound sync → normalized automation triggers.
 * Does not redesign CRM connectors — only publishes idempotent enrollments.
 */

import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { makeEventIdempotencyKey } from "@/lib/integrations/framework/events";
import type { CrmProviderId } from "./types";

export type CrmNormalizedAutomationEvent =
  | "contact.created"
  | "contact.updated"
  | "lead.created"
  | "lead.updated"
  | "deal.created"
  | "deal.stage_changed"
  | "task.created"
  | "appointment.scheduled"
  | "appointment.canceled"
  | "appointment.rescheduled";

/**
 * Enqueue automation enrollment for a CRM-originated change.
 * Deduped via job idempotency key derived from provider + external id + event type.
 */
export async function publishCrmAutomationEvent(input: {
  workspaceId: string;
  provider: CrmProviderId;
  eventType: CrmNormalizedAutomationEvent;
  contactId: string;
  externalObjectType: string;
  externalObjectId: string;
  payload?: Record<string, unknown>;
}) {
  const stableId = `${input.provider}:${input.externalObjectType}:${input.externalObjectId}:${input.eventType}`;
  const idempotencyKey = makeEventIdempotencyKey(
    input.provider,
    stableId,
    input.eventType,
  );

  await enqueueJob({
    jobType: "integration_automation_event",
    queueName: `crm-${input.provider}`,
    workspaceId: input.workspaceId,
    priority: 25,
    idempotencyKey: `crm-auto-${idempotencyKey}`,
    payload: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      eventType: input.eventType,
      contactId: input.contactId,
      payload: {
        ...(input.payload || {}),
        provider: input.provider,
        externalObjectType: input.externalObjectType,
        externalObjectId: input.externalObjectId,
        source: "crm_sync",
      },
    },
  });

  return { ok: true as const, idempotencyKey };
}
