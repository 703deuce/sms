import { emitAutomationEvent } from "@/lib/automations/events";
import { enrollForTrigger } from "@/lib/automations/enroll";
import type { ExternalProviderId, NormalizedEventType } from "./types";

/**
 * Map normalized integration / CRM events → automation trigger block types.
 */
export const INTEGRATION_EVENT_TO_TRIGGER: Record<string, string> = {
  "contact.created": "integration_contact_created",
  "contact.updated": "integration_contact_updated",
  "contact.deleted": "integration_contact_deleted",
  "contact.owner_changed": "integration_contact_owner_changed",
  "contact.status_changed": "integration_contact_status_changed",
  "contact.phone_changed": "integration_contact_phone_changed",
  "contact.email_changed": "integration_contact_email_changed",
  "contact.tag_added": "integration_tag_added",
  "contact.tag_removed": "integration_tag_removed",
  "contact.custom_field_changed": "integration_contact_custom_field_changed",
  "lead.created": "integration_lead_created",
  "lead.updated": "integration_lead_updated",
  "lead.assigned": "integration_lead_assigned",
  "lead.status_changed": "integration_lead_status_changed",
  "lead.source_changed": "integration_lead_source_changed",
  "lead.converted": "integration_lead_converted",
  "lead.deleted": "integration_lead_deleted",
  "lead.custom_field_changed": "integration_lead_custom_field_changed",
  "company.created": "integration_company_created",
  "company.updated": "integration_company_updated",
  "company.owner_changed": "integration_company_owner_changed",
  "company.status_changed": "integration_company_status_changed",
  "company.deleted": "integration_company_deleted",
  "company.custom_field_changed": "integration_company_custom_field_changed",
  "deal.created": "integration_deal_created",
  "deal.updated": "integration_deal_updated",
  "deal.stage_changed": "integration_deal_stage_changed",
  "deal.pipeline_changed": "integration_deal_pipeline_changed",
  "deal.owner_changed": "integration_deal_owner_changed",
  "deal.value_changed": "integration_deal_value_changed",
  "deal.won": "integration_deal_won",
  "deal.lost": "integration_deal_lost",
  "deal.reopened": "integration_deal_reopened",
  "deal.deleted": "integration_deal_deleted",
  "deal.custom_field_changed": "integration_deal_custom_field_changed",
  "task.created": "integration_task_created",
  "task.updated": "integration_task_updated",
  "task.assigned": "integration_task_assigned",
  "task.completed": "integration_task_completed",
  "task.due": "integration_task_due",
  "task.overdue": "integration_task_overdue",
  "activity.created": "integration_activity_created",
  "activity.updated": "integration_activity_updated",
  "note.created": "integration_note_created",
  "call.activity_created": "integration_call_activity_created",
  "appointment.scheduled": "integration_appointment_scheduled",
  "appointment.canceled": "integration_appointment_canceled",
  "appointment.rescheduled": "integration_appointment_rescheduled",
  "appointment.starting_soon": "integration_appointment_starting_soon",
  "appointment.completed": "integration_appointment_completed",
  "appointment.no_show": "integration_appointment_no_show",
  "event_type.created": "integration_event_type_created",
  "event_type.updated": "integration_event_type_updated",
  "event_type.activated": "integration_event_type_activated",
  "event_type.deactivated": "integration_event_type_deactivated",
  "form.submitted": "integration_form_submitted",
  "lead.submitted": "integration_form_submitted",
  "audience.member_added": "integration_list_joined",
  "audience.member_updated": "integration_contact_updated",
  "tag.added": "integration_tag_added",
  "tag.removed": "integration_tag_removed",
  "order.created": "integration_order_created",
  "order.paid": "integration_order_paid",
  "order.status_changed": "integration_order_updated",
  "order.fulfilled": "integration_order_completed",
  "customer.updated": "integration_contact_updated",
  "support_ticket.created": "integration_ticket_created",
  "support_ticket.updated": "integration_ticket_updated",
  "support_ticket.solved": "integration_ticket_resolved",
  "profile.updated": "integration_contact_updated",
  "consent.changed": "integration_consent_changed",
};

const LEGACY_ALIASES: Record<string, string> = {
  "form.submitted": "form_submitted",
  "appointment.scheduled": "call_appointment_booked",
  "contact.created": "customer_added",
  "tag.added": "tag_added",
};

/** Workspace-level triggers (e.g. Calendly event type changes) need a contact FK. */
async function ensureWorkspaceAutomationContact(workspaceId: string): Promise<string> {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  // Stable synthetic phone (unique per workspace) — Contact.phone is required.
  const phone = `+1555${workspaceId.replace(/\D/g, "").slice(-7).padStart(7, "0")}`;
  const existing = await prisma.contact.findFirst({
    where: { workspaceId, phone },
    select: { id: true },
  });
  if (existing) return existing.id;
  // Kept SUBSCRIBED so enrollForTrigger (which skips non-SUBSCRIBED contacts)
  // still fires event_type.* automations. It is flagged systemAutomationContact
  // so it is filtered out of contact lists, metrics, exports, and never has its
  // synthetic +1555 phone / placeholder email merged into provider actions.
  const created = await prisma.contact.create({
    data: {
      workspaceId,
      email: `automations+system@${workspaceId.slice(0, 12)}.transovo.local`,
      firstName: "System",
      lastName: "Automations",
      status: "SUBSCRIBED",
      phone,
      customFields: { systemAutomationContact: true },
    },
  });
  return created.id;
}

export async function dispatchIntegrationAutomationEvent(payload: {
  workspaceId: string;
  provider: ExternalProviderId | string;
  eventType: string;
  contactId?: string | null;
  phone?: string | null;
  email?: string | null;
  webhookEventId?: string | null;
  payload?: Record<string, unknown>;
}) {
  let contactId = payload.contactId;
  if (!contactId && String(payload.eventType || "").startsWith("event_type.")) {
    contactId = await ensureWorkspaceAutomationContact(payload.workspaceId);
  }
  if (!contactId) {
    return { enrolled: [], skipped: true, reason: "no_contact" };
  }

  const trigger = INTEGRATION_EVENT_TO_TRIGGER[payload.eventType];
  const formSlugRaw = payload.payload?.formId ?? payload.payload?.formName;
  const filters = {
    provider: String(payload.provider),
    connectedAccount:
      payload.payload?.connectedAccount != null
        ? String(payload.payload.connectedAccount)
        : payload.payload?.connectedAccountName != null
          ? String(payload.payload.connectedAccountName)
          : undefined,
    eventType: payload.eventType,
    tag: payload.payload?.tag != null ? String(payload.payload.tag) : undefined,
    formSlug: formSlugRaw != null && formSlugRaw !== "" ? String(formSlugRaw) : undefined,
    orderStatus: payload.payload?.status != null ? String(payload.payload.status) : undefined,
    eventTypeName:
      payload.payload?.eventTypeName != null
        ? String(payload.payload.eventTypeName)
        : payload.payload?.eventType != null
          ? String(payload.payload.eventType)
          : undefined,
    owner: payload.payload?.ownerExternalId != null ? String(payload.payload.ownerExternalId) : undefined,
    status: payload.payload?.status != null ? String(payload.payload.status) : undefined,
    stage: payload.payload?.stage != null ? String(payload.payload.stage) : undefined,
    previousStage:
      payload.payload?.previousStage != null ? String(payload.payload.previousStage) : undefined,
    pipeline: payload.payload?.pipeline != null ? String(payload.payload.pipeline) : undefined,
    source: payload.payload?.source != null ? String(payload.payload.source) : undefined,
    minutesBefore:
      payload.payload?.minutesBefore != null ? Number(payload.payload.minutesBefore) : undefined,
    changedField:
      Array.isArray(payload.payload?.changedFields) && payload.payload.changedFields[0]
        ? String((payload.payload.changedFields as string[])[0])
        : undefined,
    phoneExists: Boolean(payload.phone || payload.payload?.phone),
    emailExists: Boolean(payload.email || payload.payload?.email),
  };

  const results = [];
  if (trigger) {
    results.push(
      ...(await enrollForTrigger(payload.workspaceId, trigger, contactId, filters)),
    );
  }

  const legacy = LEGACY_ALIASES[payload.eventType];
  if (legacy) {
    if (legacy === "form_submitted" || legacy === "tag_added" || legacy === "customer_added") {
      results.push(
        ...(await emitAutomationEvent(payload.workspaceId, payload.eventType, contactId, {
          ...payload.payload,
          provider: payload.provider,
          formSlug: filters.formSlug,
          tag: filters.tag,
        })),
      );
    }
  }

  return { enrolled: results, skipped: false };
}

export function listIntegrationTriggerBlocks(): Array<{
  blockType: string;
  label: string;
  description: string;
  defaultConfig: Record<string, unknown>;
}> {
  return Object.entries(INTEGRATION_EVENT_TO_TRIGGER).map(([eventType, blockType]) => ({
    blockType,
    label: blockType.replace(/^integration_/, "").replace(/_/g, " "),
    description: `Normalized event ${eventType}`,
    defaultConfig: { provider: "" },
  }));
}

export function listIntegrationActionBlocks(): Array<{
  blockType: string;
  label: string;
  description: string;
  defaultConfig: Record<string, unknown>;
}> {
  return [
    {
      blockType: "integration_action",
      label: "CRM / connected app action",
      description: "Run a typed action on a connected CRM or app",
      defaultConfig: { provider: "", actionId: "contact.upsert", params: {} },
    },
  ];
}

export type { NormalizedEventType };
