/**
 * Bridge CRM inbound sync → normalized automation triggers.
 */

import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { makeEventIdempotencyKey } from "@/lib/integrations/framework/events";
import type { CrmProviderId } from "./types";

export type CrmNormalizedAutomationEvent =
  | "contact.created"
  | "contact.updated"
  | "contact.deleted"
  | "contact.owner_changed"
  | "contact.status_changed"
  | "contact.phone_changed"
  | "contact.email_changed"
  | "contact.tag_added"
  | "contact.tag_removed"
  | "contact.custom_field_changed"
  | "lead.created"
  | "lead.updated"
  | "lead.assigned"
  | "lead.status_changed"
  | "lead.source_changed"
  | "lead.converted"
  | "lead.deleted"
  | "lead.custom_field_changed"
  | "company.created"
  | "company.updated"
  | "company.owner_changed"
  | "company.status_changed"
  | "company.deleted"
  | "company.custom_field_changed"
  | "deal.created"
  | "deal.updated"
  | "deal.stage_changed"
  | "deal.pipeline_changed"
  | "deal.owner_changed"
  | "deal.value_changed"
  | "deal.won"
  | "deal.lost"
  | "deal.reopened"
  | "deal.deleted"
  | "deal.custom_field_changed"
  | "task.created"
  | "task.updated"
  | "task.assigned"
  | "task.completed"
  | "task.due"
  | "task.overdue"
  | "activity.created"
  | "activity.updated"
  | "note.created"
  | "call.activity_created"
  | "appointment.scheduled"
  | "appointment.canceled"
  | "appointment.rescheduled"
  | "appointment.starting_soon"
  | "appointment.completed";

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

  let connectionId: string | null = null;
  try {
    const { getPrisma } = await import("@/lib/server/db");
    const conn = await getPrisma().integrationConnection.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId: input.workspaceId,
          provider: input.provider,
        },
      },
      select: { id: true },
    });
    connectionId = conn?.id || null;
  } catch {
    connectionId = null;
  }

  const p = input.payload || {};
  const ownerExternalId =
    p.ownerExternalId != null
      ? String(p.ownerExternalId)
      : p.owner != null
        ? String(p.owner)
        : null;
  const pipeline =
    p.pipeline != null
      ? String(p.pipeline)
      : p.pipelineId != null
        ? String(p.pipelineId)
        : null;
  const stage =
    p.stage != null ? String(p.stage) : p.stageId != null ? String(p.stageId) : null;
  const status = p.status != null ? String(p.status) : null;
  await enqueueJob({
    jobType: "integration_automation_event",
    queueName: `crm-${input.provider}`,
    workspaceId: input.workspaceId,
    priority: 25,
    idempotencyKey: `crm-auto-${idempotencyKey}`,
    payload: JSON.parse(
      JSON.stringify({
        workspaceId: input.workspaceId,
        provider: input.provider,
        eventType: input.eventType,
        contactId: input.contactId,
        payload: {
          ...p,
          provider: input.provider,
          connectionId,
          connectionProvider: input.provider,
          connectedAccount: connectionId,
          workspaceId: input.workspaceId,
          externalObjectType: input.externalObjectType,
          externalObjectId: input.externalObjectId,
          externalRecordType: input.externalObjectType,
          externalRecordId: input.externalObjectId,
          transovoRecordId: input.contactId,
          ownerExternalId,
          pipeline,
          stage,
          status,
          changedFields: p.changedFields || [],
          source: "crm_sync",
          eventTimestamp: (p.eventTimestamp as string) || new Date().toISOString(),
          stableEventId: idempotencyKey,
          normalized: p,
        },
      }),
    ),
  });

  return { ok: true as const, idempotencyKey };
}
