import { emitAutomationEvent } from "@/lib/automations/events";
import { enrollForTrigger } from "@/lib/automations/enroll";
import type { ExternalProviderId, NormalizedEventType } from "./types";

/**
 * Map normalized integration events → automation trigger block types.
 * Events without a contactId are stored but do not enroll flows.
 */
export const INTEGRATION_EVENT_TO_TRIGGER: Record<string, string> = {
  "contact.created": "integration_contact_created",
  "contact.updated": "integration_contact_updated",
  "contact.deleted": "integration_contact_updated",
  "appointment.scheduled": "integration_appointment_scheduled",
  "appointment.canceled": "integration_appointment_canceled",
  "appointment.rescheduled": "integration_appointment_rescheduled",
  "appointment.starting_soon": "integration_appointment_starting_soon",
  "appointment.completed": "integration_appointment_completed",
  "form.submitted": "integration_form_submitted",
  "lead.submitted": "integration_form_submitted",
  "lead.created": "integration_lead_created",
  "lead.updated": "integration_lead_updated",
  "audience.member_added": "integration_list_joined",
  "audience.member_updated": "integration_contact_updated",
  "tag.added": "integration_tag_added",
  "tag.removed": "integration_tag_removed",
  "order.created": "integration_order_created",
  "order.paid": "integration_order_paid",
  "order.status_changed": "integration_order_updated",
  "order.fulfilled": "integration_order_completed",
  "customer.updated": "integration_contact_updated",
  "deal.created": "integration_deal_created",
  "deal.stage_changed": "integration_deal_stage_changed",
  "deal.won": "integration_deal_won",
  "deal.lost": "integration_deal_lost",
  "task.created": "integration_task_created",
  "task.completed": "integration_task_completed",
  "support_ticket.created": "integration_ticket_created",
  "support_ticket.updated": "integration_ticket_updated",
  "support_ticket.solved": "integration_ticket_resolved",
  "profile.updated": "integration_contact_updated",
  "consent.changed": "integration_consent_changed",
};

/** Also map to legacy native triggers where useful. */
const LEGACY_ALIASES: Record<string, string> = {
  "form.submitted": "form_submitted",
  "appointment.scheduled": "call_appointment_booked",
  "contact.created": "customer_added",
  "tag.added": "tag_added",
};

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
  const contactId = payload.contactId;
  if (!contactId) {
    return { enrolled: [], skipped: true, reason: "no_contact" };
  }

  const trigger = INTEGRATION_EVENT_TO_TRIGGER[payload.eventType];
  const formSlugRaw = payload.payload?.formId ?? payload.payload?.formName;
  const filters = {
    provider: String(payload.provider),
    eventType: payload.eventType,
    tag: payload.payload?.tag != null ? String(payload.payload.tag) : undefined,
    formSlug: formSlugRaw != null && formSlugRaw !== "" ? String(formSlugRaw) : undefined,
    orderStatus: payload.payload?.status != null ? String(payload.payload.status) : undefined,
    eventTypeName:
      payload.payload?.eventType != null ? String(payload.payload.eventType) : undefined,
  };

  const results = [];
  if (trigger) {
    results.push(
      ...(await enrollForTrigger(payload.workspaceId, trigger, contactId, filters)),
    );
  }

  const legacy = LEGACY_ALIASES[payload.eventType];
  if (legacy) {
    // Prefer provider-scoped integration triggers; still fire legacy for forms/tags.
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
  return [
    {
      blockType: "integration_appointment_scheduled",
      label: "Appointment scheduled (integration)",
      description: "When Calendly/HighLevel books an appointment",
      defaultConfig: { provider: "", eventTypeName: "" },
    },
    {
      blockType: "integration_appointment_canceled",
      label: "Appointment canceled (integration)",
      description: "When an integrated appointment is canceled",
      defaultConfig: { provider: "calendly" },
    },
    {
      blockType: "integration_appointment_rescheduled",
      label: "Appointment rescheduled (integration)",
      description: "When an integrated appointment is rescheduled",
      defaultConfig: { provider: "calendly" },
    },
    {
      blockType: "integration_form_submitted",
      label: "Form submitted (integration)",
      description: "When Typeform or Jotform receives a submission",
      defaultConfig: { provider: "", formSlug: "" },
    },
    {
      blockType: "integration_tag_added",
      label: "Tag added (integration)",
      description: "When a tag is added in ActiveCampaign/Mailchimp/HighLevel",
      defaultConfig: { provider: "", tag: "" },
    },
    {
      blockType: "integration_tag_removed",
      label: "Tag removed (integration)",
      description: "When a tag is removed in a connected marketing/CRM app",
      defaultConfig: { provider: "", tag: "" },
    },
    {
      blockType: "integration_list_joined",
      label: "List/audience joined",
      description: "When a contact joins a Mailchimp/Klaviyo/AC list",
      defaultConfig: { provider: "" },
    },
    {
      blockType: "integration_order_created",
      label: "Order created",
      description: "When WooCommerce creates an order",
      defaultConfig: { provider: "woocommerce" },
    },
    {
      blockType: "integration_order_paid",
      label: "Order paid",
      description: "When an order is paid",
      defaultConfig: { provider: "woocommerce" },
    },
    {
      blockType: "integration_order_updated",
      label: "Order status changed",
      description: "When an order status changes",
      defaultConfig: { provider: "woocommerce", orderStatus: "" },
    },
    {
      blockType: "integration_order_completed",
      label: "Order completed/fulfilled",
      description: "When an order is completed",
      defaultConfig: { provider: "woocommerce" },
    },
    {
      blockType: "integration_deal_created",
      label: "Deal created (integration)",
      description: "When a deal/opportunity is created",
      defaultConfig: { provider: "" },
    },
    {
      blockType: "integration_deal_stage_changed",
      label: "Deal stage changed (integration)",
      description: "When a deal stage changes",
      defaultConfig: { provider: "" },
    },
    {
      blockType: "integration_ticket_created",
      label: "Support ticket created",
      description: "When Freshdesk creates a ticket",
      defaultConfig: { provider: "freshdesk" },
    },
    {
      blockType: "integration_ticket_updated",
      label: "Support ticket updated",
      description: "When a support ticket is updated",
      defaultConfig: { provider: "freshdesk" },
    },
    {
      blockType: "integration_ticket_resolved",
      label: "Support ticket resolved",
      description: "When a support ticket is solved/closed",
      defaultConfig: { provider: "freshdesk" },
    },
    {
      blockType: "integration_contact_created",
      label: "Contact created (integration)",
      description: "When a connected app creates a contact/profile",
      defaultConfig: { provider: "" },
    },
    {
      blockType: "integration_contact_updated",
      label: "Contact updated (integration)",
      description: "When a connected app updates a contact/profile",
      defaultConfig: { provider: "" },
    },
    {
      blockType: "integration_task_created",
      label: "Task created (integration)",
      description: "When Close/HighLevel creates a task",
      defaultConfig: { provider: "" },
    },
    {
      blockType: "integration_consent_changed",
      label: "Marketing consent changed",
      description: "When Mailchimp/Klaviyo consent changes",
      defaultConfig: { provider: "" },
    },
  ];
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
      label: "Connected app action",
      description: "Run a typed action on a connected integration",
      defaultConfig: {
        provider: "",
        actionId: "contact.upsert",
        params: {},
      },
    },
  ];
}

export type { NormalizedEventType };
