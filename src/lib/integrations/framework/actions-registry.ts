import { buildAdapterContext } from "./context";
import { getAdapter } from "./registry";
import { getIntegrationPreferences } from "./settings";
import type { ExternalProviderId, FeatureSupport } from "./types";
import { writeIntegrationAudit } from "./audit";
import { upsertExternalMapping } from "./mappings";
import { ACTION_TO_CAPABILITY, getActionCapabilityTruth } from "./capability-truth";
import {
  buildActionPreview,
  classifyActionRisk,
  evaluateActionPolicy,
  hashActionPayload,
} from "./ai-policy";
import {
  completeIntegrationActionLog,
  createIntegrationActionLog,
} from "./action-log";
import { raiseIntegrationAlert } from "./alerts";
import { checkCommunicationConsent } from "./consent-gate";
import { persistTaskFromIntegration } from "./product-persist";

export type IntegrationActionId =
  | "contact.upsert"
  | "contact.add_tag"
  | "contact.remove_tag"
  | "contact.add_to_list"
  | "contact.remove_from_list"
  | "deal.upsert"
  | "deal.change_stage"
  | "task.create"
  | "note.create"
  | "ticket.create"
  | "ticket.update"
  | "ticket.add_private_note"
  | "ticket.add_public_reply"
  | "order.add_note"
  | "customer.upsert"
  | "appointment.get_scheduling_link"
  | "appointment.create_single_use_link"
  | "appointment.send_scheduling_link"
  | "appointment.retrieve"
  | "appointment.cancel"
  | "appointment.get_cancel_url"
  | "appointment.get_reschedule_url";

/** Calendly appointment actions that only read data (skip the writes gate). */
const READ_ONLY_ACTION_IDS = new Set<IntegrationActionId>([
  "appointment.get_scheduling_link",
  "appointment.retrieve",
  "appointment.get_cancel_url",
  "appointment.get_reschedule_url",
]);

export type IntegrationActionDef = {
  id: IntegrationActionId;
  label: string;
  providers: ExternalProviderId[];
  requiredCapability: string;
  inputFields: Array<{ key: string; label: string; required?: boolean }>;
  idempotency: "external_id" | "hash_payload" | "none";
};

export const INTEGRATION_ACTIONS: IntegrationActionDef[] = [
  {
    id: "contact.upsert",
    label: "Create/update contact",
    providers: [
      "activecampaign",
      "mailchimp",
      "highlevel",
      "close",
      "freshdesk",
      "klaviyo",
      "woocommerce",
    ],
    requiredCapability: "upsertContact|upsertCustomer",
    inputFields: [
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "firstName", label: "First name" },
      { key: "lastName", label: "Last name" },
    ],
    idempotency: "external_id",
  },
  {
    id: "contact.add_tag",
    label: "Add tag",
    providers: ["activecampaign", "mailchimp", "highlevel"],
    requiredCapability: "addTag",
    inputFields: [
      { key: "externalContactId", label: "External contact ID", required: true },
      { key: "tag", label: "Tag", required: true },
    ],
    idempotency: "hash_payload",
  },
  {
    id: "contact.remove_tag",
    label: "Remove tag",
    providers: ["activecampaign", "mailchimp", "highlevel"],
    requiredCapability: "removeTag",
    inputFields: [
      { key: "externalContactId", label: "External contact ID", required: true },
      { key: "tag", label: "Tag", required: true },
    ],
    idempotency: "hash_payload",
  },
  {
    id: "contact.add_to_list",
    label: "Add to list/audience",
    providers: ["activecampaign", "mailchimp", "klaviyo"],
    requiredCapability: "addToList",
    inputFields: [
      { key: "externalContactId", label: "External contact ID", required: true },
      { key: "listId", label: "List ID", required: true },
    ],
    idempotency: "hash_payload",
  },
  {
    id: "contact.remove_from_list",
    label: "Remove from list/audience",
    providers: ["activecampaign", "mailchimp", "klaviyo"],
    requiredCapability: "removeFromList",
    inputFields: [
      { key: "externalContactId", label: "External contact ID", required: true },
      { key: "listId", label: "List ID", required: true },
    ],
    idempotency: "hash_payload",
  },
  {
    id: "deal.upsert",
    label: "Create/update deal",
    providers: ["activecampaign", "highlevel", "close"],
    requiredCapability: "upsertDeal",
    inputFields: [
      { key: "title", label: "Title", required: true },
      { key: "amount", label: "Amount" },
      { key: "stageId", label: "Stage ID" },
      { key: "contactId", label: "External contact ID" },
    ],
    idempotency: "external_id",
  },
  {
    id: "task.create",
    label: "Create task",
    providers: ["highlevel", "close"],
    requiredCapability: "createTask",
    inputFields: [
      { key: "title", label: "Title", required: true },
      { key: "description", label: "Description" },
      { key: "contactId", label: "External contact ID" },
      { key: "dueAt", label: "Due at" },
    ],
    idempotency: "hash_payload",
  },
  {
    id: "note.create",
    label: "Create note",
    providers: ["activecampaign", "highlevel", "close"],
    requiredCapability: "createNote",
    inputFields: [
      { key: "body", label: "Body", required: true },
      { key: "contactId", label: "External contact / parent ID" },
    ],
    idempotency: "hash_payload",
  },
  {
    id: "ticket.create",
    label: "Create support ticket",
    providers: ["freshdesk"],
    requiredCapability: "upsertTicket",
    inputFields: [
      { key: "subject", label: "Subject", required: true },
      { key: "requesterEmail", label: "Requester email", required: true },
      { key: "priority", label: "Priority" },
    ],
    idempotency: "hash_payload",
  },
  {
    id: "ticket.update",
    label: "Update support ticket",
    providers: ["freshdesk"],
    requiredCapability: "upsertTicket",
    inputFields: [
      { key: "id", label: "Ticket ID", required: true },
      { key: "subject", label: "Subject" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
    ],
    idempotency: "external_id",
  },
  {
    id: "ticket.add_private_note",
    label: "Add private ticket note",
    providers: ["freshdesk"],
    requiredCapability: "addTicketComment",
    inputFields: [
      { key: "ticketId", label: "Ticket ID", required: true },
      { key: "body", label: "Note", required: true },
    ],
    idempotency: "hash_payload",
  },
  {
    id: "ticket.add_public_reply",
    label: "Add public ticket reply",
    providers: ["freshdesk"],
    requiredCapability: "addTicketComment",
    inputFields: [
      { key: "ticketId", label: "Ticket ID", required: true },
      { key: "body", label: "Reply", required: true },
    ],
    idempotency: "hash_payload",
  },
  {
    id: "order.add_note",
    label: "Add order note",
    providers: ["woocommerce"],
    requiredCapability: "addOrderNote",
    inputFields: [
      { key: "orderId", label: "Order ID", required: true },
      { key: "note", label: "Note", required: true },
    ],
    idempotency: "hash_payload",
  },
  {
    id: "customer.upsert",
    label: "Create/update store customer",
    providers: ["woocommerce"],
    requiredCapability: "upsertCustomer",
    inputFields: [
      { key: "email", label: "Email", required: true },
      { key: "firstName", label: "First name" },
      { key: "lastName", label: "Last name" },
      { key: "phone", label: "Phone" },
    ],
    idempotency: "external_id",
  },
  // —— Calendly appointment actions ——
  {
    id: "appointment.get_scheduling_link",
    label: "Get scheduling link",
    providers: ["calendly"],
    requiredCapability: "get_scheduling_link",
    inputFields: [{ key: "eventTypeUri", label: "Event type URI (optional)" }],
    idempotency: "none",
  },
  {
    id: "appointment.create_single_use_link",
    label: "Create single-use scheduling link",
    providers: ["calendly"],
    requiredCapability: "create_single_use_link",
    inputFields: [
      { key: "eventTypeUri", label: "Event type URI (optional)" },
      { key: "ownerUri", label: "Owner URI (optional)" },
    ],
    idempotency: "none",
  },
  {
    id: "appointment.send_scheduling_link",
    label: "Send scheduling link (SMS)",
    providers: ["calendly"],
    requiredCapability: "get_scheduling_link",
    inputFields: [
      { key: "phone", label: "Phone (falls back to contact)" },
      { key: "message", label: "Message template" },
      { key: "eventTypeUri", label: "Event type URI (optional)" },
      { key: "singleUse", label: "Use single-use link" },
    ],
    idempotency: "hash_payload",
  },
  {
    id: "appointment.retrieve",
    label: "Retrieve appointment",
    providers: ["calendly"],
    requiredCapability: "retrieve_appointment",
    inputFields: [
      { key: "eventUri", label: "Scheduled event URI" },
      { key: "eventUuid", label: "Scheduled event UUID" },
    ],
    idempotency: "none",
  },
  {
    id: "appointment.cancel",
    label: "Cancel appointment",
    providers: ["calendly"],
    requiredCapability: "cancel_appointment",
    inputFields: [
      { key: "eventUri", label: "Scheduled event URI" },
      { key: "eventUuid", label: "Scheduled event UUID" },
      { key: "reason", label: "Cancellation reason" },
    ],
    idempotency: "hash_payload",
  },
  {
    id: "appointment.get_cancel_url",
    label: "Get cancel URL",
    providers: ["calendly"],
    requiredCapability: "retrieve_appointment",
    inputFields: [
      { key: "eventUri", label: "Scheduled event URI" },
      { key: "eventUuid", label: "Scheduled event UUID" },
    ],
    idempotency: "none",
  },
  {
    id: "appointment.get_reschedule_url",
    label: "Get reschedule URL",
    providers: ["calendly"],
    requiredCapability: "retrieve_appointment",
    inputFields: [
      { key: "eventUri", label: "Scheduled event URI" },
      { key: "eventUuid", label: "Scheduled event UUID" },
    ],
    idempotency: "none",
  },
];

export function actionsForProvider(provider: ExternalProviderId): IntegrationActionDef[] {
  const adapter = getAdapter(provider);
  return INTEGRATION_ACTIONS.filter((a) => {
    if (!a.providers.includes(provider)) return false;
    // Gate by actual adapter methods, not just declaration
    if (a.id === "contact.upsert") return Boolean(adapter.upsertContact || adapter.upsertCustomer);
    if (a.id === "contact.add_tag") return Boolean(adapter.addTag);
    if (a.id === "contact.remove_tag") return Boolean(adapter.removeTag);
    if (a.id === "contact.add_to_list") return Boolean(adapter.addToList);
    if (a.id === "contact.remove_from_list") return Boolean(adapter.removeFromList);
    if (a.id.startsWith("deal.")) return Boolean(adapter.upsertDeal);
    if (a.id === "task.create") return Boolean(adapter.createTask);
    if (a.id === "note.create") return Boolean(adapter.createNote);
    if (a.id.startsWith("ticket.")) {
      return a.id.includes("note") || a.id.includes("reply")
        ? Boolean(adapter.addTicketComment)
        : Boolean(adapter.upsertTicket);
    }
    if (a.id === "order.add_note") return Boolean(adapter.addOrderNote);
    if (a.id === "customer.upsert") return Boolean(adapter.upsertCustomer);
    if (a.id.startsWith("appointment.")) {
      // Gate by declared capability support (Calendly actions live in a companion module).
      const cap = ACTION_TO_CAPABILITY[a.id];
      if (!cap) return false;
      const support = adapter.capabilities.actions[cap];
      return Boolean(support && support !== "unsupported");
    }
    return false;
  });
}

export function triggersForProvider(provider: ExternalProviderId): Array<{
  eventType: string;
  label: string;
  support: FeatureSupport;
}> {
  const caps = getAdapter(provider).capabilities.events;
  return Object.entries(caps)
    .filter(([, support]) => support && support !== "unsupported")
    .map(([eventType, support]) => ({
      eventType,
      label: eventType.replace(/\./g, " "),
      support: support as FeatureSupport,
    }));
}

export async function executeIntegrationAction(input: {
  workspaceId: string;
  provider: ExternalProviderId;
  actionId: IntegrationActionId;
  params: Record<string, unknown>;
  contactId?: string | null;
  actorUserId?: string | null;
  source?: "human" | "ai" | "automation" | "api";
  role?: string | null;
  approvalId?: string | null;
  payloadHash?: string | null;
  automationFlowId?: string | null;
  idempotencyKey?: string | null;
  connectionId?: string | null;
  recordCount?: number;
}): Promise<
  | {
      ok: true;
      externalId?: string;
      created?: boolean;
      actionLogId?: string;
      data?: Record<string, unknown>;
    }
  | {
      ok: false;
      code:
        | "UNSUPPORTED"
        | "PAUSED"
        | "WRITES_DISABLED"
        | "POLICY"
        | "CONSENT"
        | "ERROR";
      message: string;
      actionLogId?: string;
    }
> {
  const source = input.source || "api";
  const def = INTEGRATION_ACTIONS.find((a) => a.id === input.actionId);
  if (!def || !def.providers.includes(input.provider)) {
    return { ok: false, code: "UNSUPPORTED", message: `Action ${input.actionId} unsupported` };
  }

  const truth = getActionCapabilityTruth(input.provider, input.actionId);
  if (!truth.supported) {
    return { ok: false, code: "UNSUPPORTED", message: truth.reason || "Unsupported" };
  }

  const riskLevel = classifyActionRisk(input.actionId, { recordCount: input.recordCount });
  const payloadHash =
    input.payloadHash ||
    hashActionPayload({
      provider: input.provider,
      actionId: input.actionId,
      params: input.params,
      contactId: input.contactId || null,
    });

  const policy = await evaluateActionPolicy({
    workspaceId: input.workspaceId,
    provider: input.provider,
    actionId: input.actionId,
    source,
    role: input.role,
    recordCount: input.recordCount || 1,
    approvalId: input.approvalId,
    payloadHash,
  });
  if (!policy.allowed) {
    const log = await createIntegrationActionLog({
      workspaceId: input.workspaceId,
      provider: input.provider,
      connectionId: input.connectionId,
      source,
      actorUserId: input.actorUserId,
      automationFlowId: input.automationFlowId,
      actionId: input.actionId,
      riskLevel,
      inputSummary: input.params,
      contactId: input.contactId,
      approvalId: input.approvalId,
      idempotencyKey: input.idempotencyKey || `reject-${payloadHash.slice(0, 24)}`,
      result: "rejected",
      policy: { code: policy.code, message: policy.message },
    });
    await completeIntegrationActionLog(log.id, {
      result: "rejected",
      failureReason: policy.message,
    });
    return {
      ok: false,
      code: "POLICY",
      message: policy.message,
      actionLogId: log.id,
    };
  }

  if (
    String(input.actionId).includes("sms") ||
    input.actionId === "appointment.send_scheduling_link"
  ) {
    const consent = await checkCommunicationConsent({
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      phone: (input.params.phone as string) || null,
      channel: "sms",
    });
    if (!consent.allowed) {
      return {
        ok: false,
        code: "CONSENT",
        message: `Communication blocked: ${consent.reason}`,
      };
    }
  }

  const prefs = await getIntegrationPreferences(input.workspaceId, input.provider);
  if (prefs.paused) return { ok: false, code: "PAUSED", message: "Connection paused" };
  if (!prefs.enableWrites && !READ_ONLY_ACTION_IDS.has(input.actionId)) {
    return { ok: false, code: "WRITES_DISABLED", message: "Writes disabled in settings" };
  }

  const preview = buildActionPreview({
    actionId: input.actionId,
    provider: input.provider,
    params: input.params,
    contactId: input.contactId,
    riskLevel,
  });

  const actionLog = await createIntegrationActionLog({
    workspaceId: input.workspaceId,
    provider: input.provider,
    connectionId: input.connectionId,
    source,
    actorUserId: input.actorUserId,
    automationFlowId: input.automationFlowId,
    actionId: input.actionId,
    riskLevel,
    inputSummary: { params: input.params, preview },
    objectType: input.actionId.split(".")[0],
    objectIds: input.contactId ? [input.contactId] : [],
    contactId: input.contactId,
    approvalId: input.approvalId,
    idempotencyKey: input.idempotencyKey || `exec-${payloadHash.slice(0, 40)}`,
    reversible: preview.reversible,
    undoJson: preview.reversible
      ? {
          actionId: input.actionId,
          params: input.params,
          note: "Compensation metadata captured at enqueue",
        }
      : { irreversible: true, message: "This cannot be automatically undone." },
    result: "running",
  });

  const adapter = getAdapter(input.provider);
  const ctx = await buildAdapterContext(input.workspaceId, input.provider);
  const p = input.params;

  try {
    let result: { externalId: string; created: boolean } | undefined;
    let data: Record<string, unknown> | undefined;
    let undoJson: Record<string, unknown> | null = preview.reversible
      ? { actionId: input.actionId, params: input.params }
      : { irreversible: true, message: "This cannot be automatically undone." };

    switch (input.actionId) {
      case "contact.upsert": {
        if (adapter.upsertContact) {
          result = await adapter.upsertContact(ctx, {
            email: (p.email as string) || null,
            phone: (p.phone as string) || null,
            firstName: (p.firstName as string) || null,
            lastName: (p.lastName as string) || null,
            id: (p.id as string) || null,
          });
        } else if (adapter.upsertCustomer) {
          result = await adapter.upsertCustomer(ctx, {
            email: (p.email as string) || null,
            phone: (p.phone as string) || null,
            firstName: (p.firstName as string) || null,
            lastName: (p.lastName as string) || null,
            id: (p.id as string) || null,
          });
        } else {
          return { ok: false, code: "UNSUPPORTED", message: "upsert not available" };
        }
        break;
      }
      case "customer.upsert": {
        if (!adapter.upsertCustomer) {
          return { ok: false, code: "UNSUPPORTED", message: "upsertCustomer unsupported" };
        }
        result = await adapter.upsertCustomer(ctx, {
          email: (p.email as string) || null,
          phone: (p.phone as string) || null,
          firstName: (p.firstName as string) || null,
          lastName: (p.lastName as string) || null,
          id: (p.id as string) || null,
        });
        break;
      }
      case "contact.add_tag":
        if (!adapter.addTag) {
          await completeIntegrationActionLog(actionLog.id, {
            result: "failed",
            failureReason: "addTag unsupported",
          });
          return { ok: false, code: "UNSUPPORTED", message: "addTag unsupported", actionLogId: actionLog.id };
        }
        await adapter.addTag(ctx, String(p.externalContactId), String(p.tag));
        undoJson = {
          actionId: "contact.remove_tag",
          params: { externalContactId: p.externalContactId, tag: p.tag },
          reversible: true,
        };
        break;
      case "contact.remove_tag":
        if (!adapter.removeTag) {
          await completeIntegrationActionLog(actionLog.id, {
            result: "failed",
            failureReason: "removeTag unsupported",
          });
          return { ok: false, code: "UNSUPPORTED", message: "removeTag unsupported", actionLogId: actionLog.id };
        }
        await adapter.removeTag(ctx, String(p.externalContactId), String(p.tag));
        undoJson = {
          actionId: "contact.add_tag",
          params: { externalContactId: p.externalContactId, tag: p.tag },
          reversible: true,
        };
        break;
      case "contact.add_to_list":
        if (!adapter.addToList) {
          return { ok: false, code: "UNSUPPORTED", message: "addToList unsupported" };
        }
        await adapter.addToList(ctx, String(p.externalContactId), String(p.listId));
        break;
      case "contact.remove_from_list":
        if (!adapter.removeFromList) {
          return { ok: false, code: "UNSUPPORTED", message: "removeFromList unsupported" };
        }
        await adapter.removeFromList(ctx, String(p.externalContactId), String(p.listId));
        break;
      case "deal.upsert":
      case "deal.change_stage":
        if (!adapter.upsertDeal) {
          return { ok: false, code: "UNSUPPORTED", message: "upsertDeal unsupported" };
        }
        result = await adapter.upsertDeal(ctx, {
          id: (p.id as string) || null,
          title: (p.title as string) || null,
          amount: p.amount != null ? Number(p.amount) : null,
          stageId: (p.stageId as string) || null,
          contactId: (p.contactId as string) || null,
          companyId: (p.companyId as string) || null,
        });
        break;
      case "task.create":
        if (!adapter.createTask) {
          await completeIntegrationActionLog(actionLog.id, {
            result: "failed",
            failureReason: "createTask unsupported",
          });
          return { ok: false, code: "UNSUPPORTED", message: "createTask unsupported", actionLogId: actionLog.id };
        }
        result = await adapter.createTask(ctx, {
          title: String(p.title || "Task"),
          description: (p.description as string) || undefined,
          dueAt: (p.dueAt as string) || undefined,
          contactId: (p.contactId as string) || undefined,
        });
        if (result?.externalId) {
          await persistTaskFromIntegration({
            workspaceId: input.workspaceId,
            provider: input.provider,
            contactId: input.contactId,
            task: {
              externalId: result.externalId,
              title: String(p.title || "Task"),
              description: (p.description as string) || null,
              dueAt: (p.dueAt as string) || null,
              status: "open",
            },
          });
          undoJson = {
            actionId: "task.create",
            externalId: result.externalId,
            compensation: "reopen_or_complete_externally",
            note: "Provider task created; mark complete in provider to compensate if needed",
          };
        }
        break;
      case "note.create":
        if (!adapter.createNote) {
          await completeIntegrationActionLog(actionLog.id, {
            result: "failed",
            failureReason: "createNote unsupported",
          });
          return { ok: false, code: "UNSUPPORTED", message: "createNote unsupported", actionLogId: actionLog.id };
        }
        result = await adapter.createNote(ctx, {
          body: String(p.body || ""),
          contactId: (p.contactId as string) || undefined,
          parentId: (p.parentId as string) || undefined,
        });
        break;
      case "ticket.create":
      case "ticket.update":
        if (!adapter.upsertTicket) {
          return { ok: false, code: "UNSUPPORTED", message: "upsertTicket unsupported" };
        }
        result = await adapter.upsertTicket(ctx, {
          id: (p.id as string) || null,
          subject: (p.subject as string) || null,
          status: (p.status as string) || null,
          priority: (p.priority as string) || null,
          requesterEmail: (p.requesterEmail as string) || null,
        });
        break;
      case "ticket.add_private_note":
      case "ticket.add_public_reply":
        if (!adapter.addTicketComment) {
          return { ok: false, code: "UNSUPPORTED", message: "addTicketComment unsupported" };
        }
        result = await adapter.addTicketComment(
          ctx,
          String(p.ticketId),
          String(p.body || ""),
          { private: input.actionId === "ticket.add_private_note" },
        );
        break;
      case "order.add_note":
        if (!adapter.addOrderNote) {
          return { ok: false, code: "UNSUPPORTED", message: "addOrderNote unsupported" };
        }
        result = await adapter.addOrderNote(ctx, String(p.orderId), String(p.note || ""));
        break;
      case "appointment.get_scheduling_link": {
        const { getSchedulingLink } = await import(
          "@/lib/integrations/adapters/calendly-actions"
        );
        const link = await getSchedulingLink(ctx, {
          eventTypeUri: (p.eventTypeUri as string) || undefined,
        });
        data = {
          schedulingUrl: link.schedulingUrl,
          source: link.source,
          ownerUri: link.ownerUri,
        };
        break;
      }
      case "appointment.create_single_use_link": {
        const { createSingleUseSchedulingLink } = await import(
          "@/lib/integrations/adapters/calendly-actions"
        );
        const link = await createSingleUseSchedulingLink(ctx, {
          eventTypeUri: (p.eventTypeUri as string) || undefined,
          ownerUri: (p.ownerUri as string) || undefined,
          ownerType: (p.ownerType as string) || undefined,
          maxEventCount: 1,
        });
        data = { bookingUrl: link.bookingUrl, owner: link.owner, ownerType: link.ownerType };
        break;
      }
      case "appointment.send_scheduling_link": {
        const { getSchedulingLink, createSingleUseSchedulingLink } = await import(
          "@/lib/integrations/adapters/calendly-actions"
        );
        const link = p.singleUse
          ? (
              await createSingleUseSchedulingLink(ctx, {
                eventTypeUri: (p.eventTypeUri as string) || undefined,
                ownerUri: (p.ownerUri as string) || undefined,
                maxEventCount: 1,
              })
            ).bookingUrl
          : (
              await getSchedulingLink(ctx, {
                eventTypeUri: (p.eventTypeUri as string) || undefined,
              })
            ).schedulingUrl;

        let phone = (p.phone as string) || null;
        if (!phone && input.contactId) {
          const { getPrisma } = await import("@/lib/db");
          const contact = await getPrisma().contact.findUnique({
            where: { id: input.contactId },
            select: { phone: true },
          });
          phone = contact?.phone || null;
        }
        if (!phone) {
          await completeIntegrationActionLog(actionLog.id, {
            result: "failed",
            failureReason: "No phone available to send scheduling link",
          });
          return {
            ok: false,
            code: "ERROR",
            message: "No phone available to send scheduling link",
            actionLogId: actionLog.id,
          };
        }
        const template =
          (p.message as string) ||
          "Hi {{customer_name}}, book a time here: {{scheduling_link}}";
        const body = template.includes("{{scheduling_link}}")
          ? template.replace(/\{\{scheduling_link\}\}/g, link)
          : `${template.trim()} ${link}`.trim();

        const { sendQuickSms } = await import("@/lib/sms/send-quick");
        const sms = await sendQuickSms({
          workspaceId: input.workspaceId,
          to: phone,
          body,
          idempotencyKey: input.idempotencyKey
            ? `calendly-link-${input.idempotencyKey}`
            : `calendly-link-${payloadHash.slice(0, 32)}`,
        });
        data = {
          schedulingUrl: link,
          messageId: sms.messageId,
          smsStatus: sms.status,
          to: phone,
        };
        break;
      }
      case "appointment.retrieve": {
        const { getAppointment } = await import(
          "@/lib/integrations/adapters/calendly-actions"
        );
        const appt = await getAppointment(ctx, {
          eventUri: (p.eventUri as string) || undefined,
          eventUuid: (p.eventUuid as string) || undefined,
        });
        data = {
          status: appt.status,
          startsAt: appt.startsAt,
          endsAt: appt.endsAt,
          cancelUrl: appt.cancelUrl,
          rescheduleUrl: appt.rescheduleUrl,
          event: appt.event,
          invitee: appt.invitee,
        };
        break;
      }
      case "appointment.get_cancel_url":
      case "appointment.get_reschedule_url": {
        const { getAppointment } = await import(
          "@/lib/integrations/adapters/calendly-actions"
        );
        const appt = await getAppointment(ctx, {
          eventUri: (p.eventUri as string) || undefined,
          eventUuid: (p.eventUuid as string) || undefined,
        });
        data =
          input.actionId === "appointment.get_cancel_url"
            ? { cancelUrl: appt.cancelUrl }
            : { rescheduleUrl: appt.rescheduleUrl };
        break;
      }
      case "appointment.cancel": {
        const { cancelAppointment } = await import(
          "@/lib/integrations/adapters/calendly-actions"
        );
        const canceled = await cancelAppointment(ctx, {
          eventUri: (p.eventUri as string) || undefined,
          eventUuid: (p.eventUuid as string) || undefined,
          reason: (p.reason as string) || undefined,
        });
        data = { canceled: canceled.canceled, eventUuid: canceled.eventUuid };
        undoJson = {
          irreversible: true,
          message: "Canceling a Calendly appointment cannot be automatically undone.",
        };
        break;
      }
      default:
        return { ok: false, code: "UNSUPPORTED", message: "Unknown action" };
    }

    if (result?.externalId && input.contactId) {
      await upsertExternalMapping({
        workspaceId: input.workspaceId,
        provider: input.provider,
        objectType: input.actionId.startsWith("ticket")
          ? "support_ticket"
          : input.actionId.startsWith("deal")
            ? "deal"
            : input.actionId.startsWith("order")
              ? "order"
              : "contact",
        internalId: input.contactId,
        externalId: result.externalId,
        metadata: { actionId: input.actionId },
      });
    }

    await writeIntegrationAudit({
      workspaceId: input.workspaceId,
      provider: input.provider,
      category: "push",
      action: input.actionId,
      message: `Executed ${input.actionId}`,
      detail: {
        externalId: result?.externalId,
        created: result?.created,
        source,
        riskLevel,
        actionLogId: actionLog.id,
      },
      actorUserId: input.actorUserId,
    });

    await completeIntegrationActionLog(actionLog.id, {
      result: "succeeded",
      providerRequestId: result?.externalId || null,
      undoJson,
    });

    return {
      ok: true,
      externalId: result?.externalId,
      created: result?.created,
      actionLogId: actionLog.id,
      data,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await completeIntegrationActionLog(actionLog.id, {
      result: "failed",
      failureReason: message,
    });
    await raiseIntegrationAlert({
      workspaceId: input.workspaceId,
      provider: input.provider,
      kind: "action_failure_repeated",
      severity: "warn",
      audience: "operator",
      message: `${input.actionId} failed: ${message.slice(0, 160)}`,
    });
    if (message.startsWith("UNSUPPORTED:")) {
      return { ok: false, code: "UNSUPPORTED", message, actionLogId: actionLog.id };
    }
    return { ok: false, code: "ERROR", message, actionLogId: actionLog.id };
  }
}
