/**
 * Bridge inbound CRM webhooks → automation triggers (realtime where possible).
 */

import { upsertExternalContact } from "@/lib/integrations/connections";
import { enqueueCrmSync } from "../sync-engine";
import {
  publishMappedCrmEvent,
  resolveContactIdFromExternal,
} from "../sync-publish";
import type { CrmNormalizedAutomationEvent } from "../automation-bridge";
import type { CrmProviderId } from "../types";

type PipedriveMeta = {
  action?: string;
  object?: string;
  id?: number | string;
};

function pipedriveObjectType(object?: string): string | null {
  const o = String(object || "").toLowerCase();
  if (o === "person") return "contact";
  if (o === "organization") return "company";
  if (o === "deal") return "deal";
  if (o === "activity") return "task";
  if (o === "note") return "note";
  return null;
}

function pipedriveEventType(
  object: string | undefined,
  action: string | undefined,
): CrmNormalizedAutomationEvent | null {
  const obj = pipedriveObjectType(object);
  const act = String(action || "").toLowerCase();
  if (!obj) return null;
  if (act === "deleted") {
    if (obj === "contact") return "contact.deleted";
    if (obj === "company") return "company.deleted";
    if (obj === "deal") return "deal.deleted";
    if (obj === "lead") return "lead.deleted";
    return null;
  }
  if (act === "added" || act === "create" || act === "created") {
    if (obj === "contact") return "contact.created";
    if (obj === "company") return "company.created";
    if (obj === "deal") return "deal.created";
    if (obj === "task") return "task.created";
    if (obj === "note") return "note.created";
    return null;
  }
  if (act === "updated" || act === "change" || act === "merged") {
    if (obj === "contact") return "contact.updated";
    if (obj === "company") return "company.updated";
    if (obj === "deal") return "deal.updated";
    if (obj === "task") return "task.updated";
    return null;
  }
  return null;
}

function extractPipedriveContactFields(current: Record<string, unknown>) {
  const emails = (current.email as Array<{ value?: string }> | undefined) || [];
  const phones = (current.phone as Array<{ value?: string }> | undefined) || [];
  return {
    email: emails[0]?.value || (current.primary_email as string) || null,
    phone: phones[0]?.value || (current.primary_phone as string) || null,
    firstName: (current.first_name as string) || (current.name as string) || null,
    lastName: (current.last_name as string) || null,
    ownerExternalId:
      current.owner_id != null
        ? String(current.owner_id)
        : current.user_id != null
          ? String(current.user_id)
          : null,
  };
}

function extractDealFields(current: Record<string, unknown>) {
  return {
    title: (current.title as string) || null,
    value: current.value != null ? Number(current.value) : null,
    stage: current.stage_id != null ? String(current.stage_id) : null,
    pipeline: current.pipeline_id != null ? String(current.pipeline_id) : null,
    status: (current.status as string) || null,
    ownerExternalId: current.user_id != null ? String(current.user_id) : null,
    contactExternalId:
      current.person_id != null
        ? String(current.person_id)
        : current.contact_id != null
          ? String(current.contact_id)
          : null,
  };
}

async function resolveOrCreateContact(input: {
  workspaceId: string;
  provider: CrmProviderId;
  externalId: string;
  phone?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<string | null> {
  const mapped = await resolveContactIdFromExternal(
    input.workspaceId,
    input.provider,
    input.externalId,
  );
  if (mapped) return mapped;
  if (!input.phone && !input.email) return null;
  const upserted = await upsertExternalContact({
    workspaceId: input.workspaceId,
    phone: input.phone,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    source: input.provider,
    createIfMissing: true,
    overwrite: true,
  });
  return upserted?.contactId || null;
}

async function publishPipedriveWebhookEvent(input: {
  workspaceId: string;
  provider: CrmProviderId;
  body: Record<string, unknown>;
}) {
  const meta = (input.body.meta || {}) as PipedriveMeta;
  const current = (input.body.current || input.body) as Record<string, unknown>;
  const previous = (input.body.previous || {}) as Record<string, unknown>;
  const eventType = pipedriveEventType(meta.object, meta.action);
  if (!eventType) return { published: 0 };

  const externalId = meta.id != null ? String(meta.id) : null;
  if (!externalId) return { published: 0 };

  const objectType = pipedriveObjectType(meta.object) || "contact";
  let contactId: string | null = null;
  let payload: Record<string, unknown> = {};

  if (objectType === "contact") {
    const fields = extractPipedriveContactFields(current);
    contactId = await resolveOrCreateContact({
      workspaceId: input.workspaceId,
      provider: input.provider,
      externalId,
      ...fields,
    });
    payload = { ...fields, ownerExternalId: fields.ownerExternalId };
  } else if (objectType === "deal") {
    const deal = extractDealFields(current);
    payload = deal;
    if (deal.contactExternalId) {
      contactId = await resolveContactIdFromExternal(
        input.workspaceId,
        input.provider,
        deal.contactExternalId,
      );
    }
  } else if (objectType === "company") {
    payload = {
      name: current.name,
      ownerExternalId: current.owner_id != null ? String(current.owner_id) : null,
    };
    contactId = await resolveContactIdFromExternal(
      input.workspaceId,
      input.provider,
      externalId,
    );
  } else if (objectType === "task") {
    const personId = current.person_id != null ? String(current.person_id) : null;
    if (personId) {
      contactId = await resolveContactIdFromExternal(
        input.workspaceId,
        input.provider,
        personId,
      );
    }
    payload = {
      subject: current.subject,
      ownerExternalId: current.user_id != null ? String(current.user_id) : null,
      status: current.done === 1 || current.done === true ? "completed" : "open",
    };
    if (meta.action === "updated" && (current.done === 1 || current.done === true)) {
      await publishMappedCrmEvent({
        workspaceId: input.workspaceId,
        provider: input.provider,
        eventType: "task.completed",
        contactId,
        externalObjectType: "task",
        externalObjectId: externalId,
        payload,
      });
    }
  }

  let published = 0;
  const base = await publishMappedCrmEvent({
    workspaceId: input.workspaceId,
    provider: input.provider,
    eventType,
    contactId,
    externalObjectType: objectType,
    externalObjectId: externalId,
    payload,
  });
  if (!base.skipped) published += 1;

  if (objectType === "deal" && meta.action === "updated" && contactId) {
    const prevStage =
      previous.stage_id != null ? String(previous.stage_id) : null;
    const nextStage = current.stage_id != null ? String(current.stage_id) : null;
    if (prevStage && nextStage && prevStage !== nextStage) {
      await publishMappedCrmEvent({
        workspaceId: input.workspaceId,
        provider: input.provider,
        eventType: "deal.stage_changed",
        contactId,
        externalObjectType: "deal",
        externalObjectId: externalId,
        payload: { ...payload, stage: nextStage, previousStage: prevStage },
        changedFields: ["stage"],
      });
      published += 1;
    }
    const status = String(current.status || "").toLowerCase();
    const prevStatus = String(previous.status || "").toLowerCase();
    if (status === "won" && prevStatus !== "won") {
      await publishMappedCrmEvent({
        workspaceId: input.workspaceId,
        provider: input.provider,
        eventType: "deal.won",
        contactId,
        externalObjectType: "deal",
        externalObjectId: externalId,
        payload,
      });
      published += 1;
    }
    if (status === "lost" && prevStatus !== "lost") {
      await publishMappedCrmEvent({
        workspaceId: input.workspaceId,
        provider: input.provider,
        eventType: "deal.lost",
        contactId,
        externalObjectType: "deal",
        externalObjectId: externalId,
        payload,
      });
      published += 1;
    }
  }

  return { published };
}

function zohoModuleToObjectType(module: string): string | null {
  const m = module.toLowerCase();
  if (m.includes("contact")) return "contact";
  if (m.includes("lead")) return "lead";
  if (m.includes("account") || m.includes("compan")) return "company";
  if (m.includes("deal") || m.includes("pipeline")) return "deal";
  if (m.includes("task")) return "task";
  return null;
}

function zohoOperationToEvent(
  objectType: string,
  operation: string,
): CrmNormalizedAutomationEvent | null {
  const op = operation.toLowerCase();
  if (op.includes("delete")) {
    if (objectType === "contact") return "contact.deleted";
    if (objectType === "lead") return "lead.deleted";
    if (objectType === "company") return "company.deleted";
    if (objectType === "deal") return "deal.deleted";
    return null;
  }
  if (op.includes("insert") || op.includes("create")) {
    if (objectType === "contact") return "contact.created";
    if (objectType === "lead") return "lead.created";
    if (objectType === "company") return "company.created";
    if (objectType === "deal") return "deal.created";
    return null;
  }
  if (op.includes("update") || op.includes("edit")) {
    if (objectType === "contact") return "contact.updated";
    if (objectType === "lead") return "lead.updated";
    if (objectType === "company") return "company.updated";
    if (objectType === "deal") return "deal.updated";
    return null;
  }
  return null;
}

/**
 * Process CRM webhook payload for automation triggers.
 * Always enqueues incremental sync; publishes immediately when payload has enough data.
 */
export async function processCrmWebhookAutomation(input: {
  workspaceId: string;
  provider: CrmProviderId;
  eventType: string;
  payload: unknown;
}) {
  const body = (input.payload || {}) as Record<string, unknown>;

  await enqueueCrmSync({
    workspaceId: input.workspaceId,
    provider: input.provider,
    kind: "webhook",
    triggeredBy: "webhook",
  });

  if (input.provider === "pipedrive") {
    return publishPipedriveWebhookEvent({
      workspaceId: input.workspaceId,
      provider: input.provider,
      body,
    });
  }

  if (input.provider === "zoho") {
    const module = String(body.module || body.Module || "");
    const operation = String(body.operation || body.Operation || input.eventType || "");
    const objectType = zohoModuleToObjectType(module);
    if (!objectType) return { published: 0, syncEnqueued: true };
    const event = zohoOperationToEvent(objectType, operation);
    const ids = Array.isArray(body.ids) ? body.ids : body.IDs ? (body.IDs as string[]) : [];
    const externalId = ids[0] != null ? String(ids[0]) : null;
    if (!event || !externalId) return { published: 0, syncEnqueued: true };
    const contactId =
      objectType === "contact" || objectType === "lead"
        ? await resolveContactIdFromExternal(input.workspaceId, input.provider, externalId)
        : null;
    const result = await publishMappedCrmEvent({
      workspaceId: input.workspaceId,
      provider: input.provider,
      eventType: event,
      contactId,
      externalObjectType: objectType,
      externalObjectId: externalId,
      payload: { module, operation, source: "crm_webhook" },
    });
    return { published: result.skipped ? 0 : 1, syncEnqueued: true };
  }

  return { published: 0, syncEnqueued: true };
}
