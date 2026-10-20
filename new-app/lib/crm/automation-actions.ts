/**
 * Provider-neutral CRM actions for automations (Salesforce / Zoho / Pipedrive).
 * Uses existing connectors — no parallel CRM implementation. Every action maps
 * onto an existing CrmConnector method (upsert / create / update / find / log).
 */

import { getPrisma } from "@/lib/server/db";
import { buildContext } from "./sync-engine";
import { getConnector, CRM_PROVIDER_IDS } from "./registry";
import { isFeatureSupported, type ProviderFeature } from "./feature-matrix";
import { getObjectMapping, upsertObjectMapping } from "./mappings";
import { writeCrmAudit } from "./logging";
import type { UpsertResult } from "./connector";
import type {
  CrmCallActivity,
  CrmCompany,
  CrmContact,
  CrmDeal,
  CrmLead,
  CrmProviderId,
  CrmSmsActivity,
} from "./types";

export type CrmAutomationActionId =
  // Contact
  | "contact.find"
  | "contact.create"
  | "contact.update"
  | "contact.upsert"
  | "contact.link"
  | "contact.change_owner"
  | "contact.change_status"
  | "contact.add_tag"
  | "contact.remove_tag"
  | "contact.update_custom_field"
  | "note.create"
  // Lead (Salesforce / Zoho only)
  | "lead.create"
  | "lead.update"
  | "lead.upsert"
  | "lead.assign"
  | "lead.change_status"
  | "lead.change_source"
  | "lead.convert"
  | "lead.add_note"
  | "lead.update_custom_field"
  // Company
  | "company.create"
  | "company.update"
  | "company.link_contact"
  | "company.change_owner"
  | "company.add_note"
  | "company.update_custom_field"
  // Deal
  | "deal.create"
  | "deal.update"
  | "deal.upsert"
  | "deal.move_pipeline"
  | "deal.move_stage"
  | "deal.mark_won"
  | "deal.mark_lost"
  | "deal.reopen"
  | "deal.change_owner"
  | "deal.change_value"
  | "deal.change_close_date"
  | "deal.link_contact"
  | "deal.link_company"
  | "deal.add_note"
  | "deal.update_custom_field"
  // Task
  | "task.create"
  | "task.update"
  | "task.complete"
  | "task.assign"
  | "task.change_due"
  // Activity / communication
  | "activity.create"
  | "call.log"
  | "call.update"
  | "sms.log"
  | "mms.log"
  | "voicemail.log"
  | "call.attach_recording"
  | "call.attach_transcript"
  | "call.attach_summary"
  | "call.update_disposition"
  | "communication.add_note";

export type CrmActionDef = {
  id: CrmAutomationActionId;
  label: string;
  providers: CrmProviderId[];
  requiredFeature: ProviderFeature;
};

const ALL: CrmProviderId[] = ["salesforce", "zoho", "pipedrive"];
const LEAD_PROVIDERS: CrmProviderId[] = ["salesforce", "zoho"];

export const CRM_AUTOMATION_ACTIONS: CrmActionDef[] = [
  // ---- Contact ----
  { id: "contact.find", label: "Find CRM contact", providers: ALL, requiredFeature: "contacts" },
  { id: "contact.create", label: "Create CRM contact", providers: ALL, requiredFeature: "contacts" },
  { id: "contact.update", label: "Update CRM contact", providers: ALL, requiredFeature: "contacts" },
  { id: "contact.upsert", label: "Create/update CRM contact", providers: ALL, requiredFeature: "contacts" },
  { id: "contact.link", label: "Link Transovo contact to CRM record", providers: ALL, requiredFeature: "contacts" },
  { id: "contact.change_owner", label: "Change CRM contact owner", providers: ALL, requiredFeature: "contacts" },
  { id: "contact.change_status", label: "Change CRM contact status", providers: ALL, requiredFeature: "contacts" },
  { id: "contact.add_tag", label: "Add tag to CRM contact", providers: ALL, requiredFeature: "tags" },
  { id: "contact.remove_tag", label: "Remove tag from CRM contact", providers: ALL, requiredFeature: "tags" },
  { id: "contact.update_custom_field", label: "Update CRM contact custom field", providers: ALL, requiredFeature: "custom_fields" },
  { id: "note.create", label: "Add CRM note", providers: ALL, requiredFeature: "notes" },

  // ---- Lead (Salesforce / Zoho) ----
  { id: "lead.create", label: "Create CRM lead", providers: LEAD_PROVIDERS, requiredFeature: "leads" },
  { id: "lead.update", label: "Update CRM lead", providers: LEAD_PROVIDERS, requiredFeature: "leads" },
  { id: "lead.upsert", label: "Create/update CRM lead", providers: LEAD_PROVIDERS, requiredFeature: "leads" },
  { id: "lead.assign", label: "Assign CRM lead owner", providers: LEAD_PROVIDERS, requiredFeature: "leads" },
  { id: "lead.change_status", label: "Change CRM lead status", providers: LEAD_PROVIDERS, requiredFeature: "leads" },
  { id: "lead.change_source", label: "Change CRM lead source", providers: LEAD_PROVIDERS, requiredFeature: "leads" },
  { id: "lead.convert", label: "Convert CRM lead", providers: LEAD_PROVIDERS, requiredFeature: "leads" },
  { id: "lead.add_note", label: "Add note to CRM lead", providers: LEAD_PROVIDERS, requiredFeature: "leads" },
  { id: "lead.update_custom_field", label: "Update CRM lead custom field", providers: LEAD_PROVIDERS, requiredFeature: "leads" },

  // ---- Company ----
  { id: "company.create", label: "Create CRM company", providers: ALL, requiredFeature: "companies" },
  { id: "company.update", label: "Update CRM company", providers: ALL, requiredFeature: "companies" },
  { id: "company.link_contact", label: "Link contact to CRM company", providers: ALL, requiredFeature: "companies" },
  { id: "company.change_owner", label: "Change CRM company owner", providers: ALL, requiredFeature: "companies" },
  { id: "company.add_note", label: "Add note to CRM company", providers: ALL, requiredFeature: "companies" },
  { id: "company.update_custom_field", label: "Update CRM company custom field", providers: ALL, requiredFeature: "companies" },

  // ---- Deal ----
  { id: "deal.create", label: "Create CRM deal/opportunity", providers: ALL, requiredFeature: "deals" },
  { id: "deal.update", label: "Update CRM deal/opportunity", providers: ALL, requiredFeature: "deals" },
  { id: "deal.upsert", label: "Create/update CRM deal/opportunity", providers: ALL, requiredFeature: "deals" },
  { id: "deal.move_pipeline", label: "Move CRM deal to pipeline", providers: ALL, requiredFeature: "deals" },
  { id: "deal.move_stage", label: "Move CRM deal to stage", providers: ALL, requiredFeature: "deals" },
  { id: "deal.mark_won", label: "Mark CRM deal won", providers: ALL, requiredFeature: "deals" },
  { id: "deal.mark_lost", label: "Mark CRM deal lost", providers: ALL, requiredFeature: "deals" },
  { id: "deal.reopen", label: "Reopen CRM deal", providers: ALL, requiredFeature: "deals" },
  { id: "deal.change_owner", label: "Change CRM deal owner", providers: ALL, requiredFeature: "deals" },
  { id: "deal.change_value", label: "Change CRM deal value", providers: ALL, requiredFeature: "deals" },
  { id: "deal.change_close_date", label: "Change CRM deal close date", providers: ALL, requiredFeature: "deals" },
  { id: "deal.link_contact", label: "Link contact to CRM deal", providers: ALL, requiredFeature: "deals" },
  { id: "deal.link_company", label: "Link company to CRM deal", providers: ALL, requiredFeature: "deals" },
  { id: "deal.add_note", label: "Add note to CRM deal", providers: ALL, requiredFeature: "deals" },
  { id: "deal.update_custom_field", label: "Update CRM deal custom field", providers: ALL, requiredFeature: "deals" },

  // ---- Task ----
  { id: "task.create", label: "Create CRM task", providers: ALL, requiredFeature: "tasks" },
  { id: "task.update", label: "Update CRM task", providers: ALL, requiredFeature: "tasks" },
  { id: "task.complete", label: "Complete CRM task", providers: ALL, requiredFeature: "tasks" },
  { id: "task.assign", label: "Assign CRM task owner", providers: ALL, requiredFeature: "tasks" },
  { id: "task.change_due", label: "Change CRM task due date", providers: ALL, requiredFeature: "tasks" },

  // ---- Activity / communication ----
  { id: "activity.create", label: "Create CRM activity", providers: ALL, requiredFeature: "activities" },
  { id: "call.log", label: "Log call activity in CRM", providers: ALL, requiredFeature: "calls" },
  { id: "call.update", label: "Update logged call activity in CRM", providers: ALL, requiredFeature: "calls" },
  { id: "sms.log", label: "Log SMS activity in CRM", providers: ALL, requiredFeature: "sms" },
  { id: "mms.log", label: "Log MMS activity in CRM", providers: ALL, requiredFeature: "sms" },
  { id: "voicemail.log", label: "Log voicemail activity in CRM", providers: ALL, requiredFeature: "calls" },
  { id: "call.attach_recording", label: "Attach recording to logged call", providers: ALL, requiredFeature: "calls" },
  { id: "call.attach_transcript", label: "Attach transcript to logged call", providers: ALL, requiredFeature: "calls" },
  { id: "call.attach_summary", label: "Attach AI summary to logged call", providers: ALL, requiredFeature: "calls" },
  { id: "call.update_disposition", label: "Update logged call disposition", providers: ALL, requiredFeature: "calls" },
  { id: "communication.add_note", label: "Add communication note in CRM", providers: ALL, requiredFeature: "notes" },
];

export function isCrmAutomationProvider(provider: string): provider is CrmProviderId {
  return (CRM_PROVIDER_IDS as readonly string[]).includes(provider);
}

export function crmActionsForProvider(provider: CrmProviderId): CrmActionDef[] {
  return CRM_AUTOMATION_ACTIONS.filter(
    (a) => a.providers.includes(provider) && isFeatureSupported(provider, a.requiredFeature),
  );
}

type ActionResult = { externalId: string; created: boolean; externalUrl?: string | null };

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return s === "" ? null : s;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function customFieldsFrom(params: Record<string, unknown>): Record<string, unknown> | undefined {
  if (params.customFields && typeof params.customFields === "object") {
    return params.customFields as Record<string, unknown>;
  }
  const field = str(params.field) ?? str(params.fieldName);
  if (field) return { [field]: params.value ?? null };
  return undefined;
}

function tagsFrom(params: Record<string, unknown>): string[] {
  if (Array.isArray(params.tags)) return params.tags.map((t) => String(t));
  const single = str(params.tag);
  return single ? [single] : [];
}

export async function executeCrmAutomationAction(input: {
  workspaceId: string;
  provider: CrmProviderId;
  actionId: CrmAutomationActionId | string;
  params: Record<string, unknown>;
  contactId?: string | null;
  automationFlowId?: string | null;
}): Promise<
  | { ok: true; externalId?: string; created?: boolean; externalUrl?: string | null }
  | { ok: false; code: "UNSUPPORTED" | "ERROR"; message: string }
> {
  if (!isCrmAutomationProvider(input.provider)) {
    return { ok: false, code: "UNSUPPORTED", message: "Not a CRM provider" };
  }
  const def = CRM_AUTOMATION_ACTIONS.find((a) => a.id === input.actionId);
  if (!def || !def.providers.includes(input.provider)) {
    return { ok: false, code: "UNSUPPORTED", message: `CRM action ${input.actionId} unsupported` };
  }
  if (!isFeatureSupported(input.provider, def.requiredFeature)) {
    return {
      ok: false,
      code: "UNSUPPORTED",
      message: `${def.requiredFeature} not supported for ${input.provider}`,
    };
  }

  try {
    const connector = getConnector(input.provider);
    const ctx = await buildContext(input.workspaceId, input.provider);
    const params = input.params;
    const actionId = String(input.actionId);

    const externalId = () => str(params.externalId) ?? str(params.id);
    const ownerId = () => str(params.ownerExternalId) ?? str(params.ownerId) ?? str(params.owner);

    // Guard helpers so provider gaps surface as clear errors.
    const need = <T>(method: T | undefined, name: string): T => {
      if (!method) throw new Error(`${input.provider} does not support ${name}`);
      return method;
    };
    const requireExternalId = (): string => {
      const id = externalId();
      if (!id) throw new Error(`${actionId} requires an externalId`);
      return id;
    };

    const resolveContactExternalId = async (): Promise<string | null> => {
      const explicit = str(params.contactExternalId);
      if (explicit) return explicit;
      if (input.contactId) {
        const map = await getObjectMapping({
          workspaceId: input.workspaceId,
          provider: input.provider,
          objectType: "contact",
          internalId: input.contactId,
        });
        return map?.externalId || null;
      }
      return null;
    };

    let result: ActionResult;

    switch (actionId) {
      // -------------------- Contact --------------------
      case "contact.find": {
        const phone = str(params.phone);
        const email = str(params.email);
        let found: CrmContact | null = null;
        if (phone && connector.findContactByPhone) {
          found = await connector.findContactByPhone(ctx, phone);
        }
        if (!found && email && connector.findContactByEmail) {
          found = await connector.findContactByEmail(ctx, email);
        }
        result = { externalId: found?.id || "", created: false, externalUrl: null };
        break;
      }

      case "contact.create":
      case "contact.update":
      case "contact.upsert": {
        const contact: CrmContact = {
          firstName: str(params.firstName),
          lastName: str(params.lastName),
          phone: str(params.phone),
          email: str(params.email),
          companyName: str(params.company) ?? str(params.companyName),
          companyExternalId: str(params.companyExternalId),
          ownerExternalId: ownerId(),
          status: str(params.status),
          source: str(params.source),
          customFields: customFieldsFrom(params),
        };
        if (isFeatureSupported(input.provider, "tags")) {
          const tags = tagsFrom(params);
          if (tags.length) contact.tags = tags;
        }
        if (actionId === "contact.update") {
          contact.id = requireExternalId();
        } else {
          const id = externalId();
          if (id) contact.id = id;
        }
        result = await connector.upsertContact(ctx, contact);
        if (input.contactId && result.externalId) {
          await upsertObjectMapping({
            workspaceId: input.workspaceId,
            provider: input.provider,
            objectType: "contact",
            internalId: input.contactId,
            externalId: result.externalId,
            externalUrl: result.externalUrl || null,
            syncStatus: "synced",
          });
        }
        break;
      }

      case "contact.link": {
        const id = externalId() ?? str(params.contactExternalId);
        if (!id) throw new Error("contact.link requires an externalId");
        if (!input.contactId) throw new Error("contact.link requires a Transovo contactId");
        const externalUrl = str(params.externalUrl);
        await upsertObjectMapping({
          workspaceId: input.workspaceId,
          provider: input.provider,
          objectType: "contact",
          internalId: input.contactId,
          externalId: id,
          externalUrl,
          syncStatus: "synced",
        });
        result = { externalId: id, created: false, externalUrl };
        break;
      }

      case "contact.change_owner": {
        result = await connector.upsertContact(ctx, {
          id: requireExternalId(),
          ownerExternalId: ownerId(),
        });
        break;
      }

      case "contact.change_status": {
        result = await connector.upsertContact(ctx, {
          id: requireExternalId(),
          status: str(params.status),
        });
        break;
      }

      case "contact.add_tag":
      case "contact.remove_tag": {
        const incoming = tagsFrom(params);
        const extId = requireExternalId();
        const map = await getObjectMapping({
          workspaceId: input.workspaceId,
          provider: input.provider,
          objectType: "contact",
          externalId: extId,
        });
        const current = Array.isArray((map?.metadataJson as { tags?: unknown } | null)?.tags)
          ? ((map!.metadataJson as { tags: string[] }).tags || []).map(String)
          : [];
        const next =
          actionId === "contact.add_tag"
            ? Array.from(new Set([...current, ...incoming]))
            : current.filter((t) => !incoming.includes(t));
        result = await connector.upsertContact(ctx, {
          id: extId,
          tags: next,
        });
        break;
      }

      case "contact.update_custom_field": {
        result = await connector.upsertContact(ctx, {
          id: requireExternalId(),
          customFields: customFieldsFrom(params) || {},
        });
        break;
      }

      // -------------------- Lead --------------------
      case "lead.create":
      case "lead.update":
      case "lead.upsert":
      case "lead.convert": {
        const upsertLead = need(connector.upsertLead, "leads");
        const lead: CrmLead = {
          firstName: str(params.firstName),
          lastName: str(params.lastName),
          phone: str(params.phone),
          email: str(params.email),
          companyName: str(params.company) ?? str(params.companyName),
          status: actionId === "lead.convert" ? "Converted" : str(params.status),
          source: str(params.source),
          ownerExternalId: ownerId(),
          customFields: customFieldsFrom(params),
        };
        if (actionId === "lead.update" || actionId === "lead.convert") {
          lead.id = requireExternalId();
        } else {
          const id = externalId();
          if (id) lead.id = id;
        }
        result = await upsertLead(ctx, lead);
        break;
      }

      case "lead.assign": {
        const upsertLead = need(connector.upsertLead, "leads");
        result = await upsertLead(ctx, { id: requireExternalId(), ownerExternalId: ownerId() });
        break;
      }

      case "lead.change_status": {
        const upsertLead = need(connector.upsertLead, "leads");
        result = await upsertLead(ctx, { id: requireExternalId(), status: str(params.status) });
        break;
      }

      case "lead.change_source": {
        const upsertLead = need(connector.upsertLead, "leads");
        result = await upsertLead(ctx, { id: requireExternalId(), source: str(params.source) });
        break;
      }

      case "lead.update_custom_field": {
        const upsertLead = need(connector.upsertLead, "leads");
        result = await upsertLead(ctx, {
          id: requireExternalId(),
          customFields: customFieldsFrom(params) || {},
        });
        break;
      }

      case "lead.add_note": {
        const createNote = need(connector.createNote, "notes");
        result = await createNote(ctx, {
          body: String(params.body || params.note || ""),
          relatedType: "lead",
          relatedExternalId: str(params.leadExternalId) ?? externalId(),
          contactExternalId: await resolveContactExternalId(),
        });
        break;
      }

      // -------------------- Company --------------------
      case "company.create":
      case "company.update": {
        const upsertCompany = need(connector.upsertCompany, "companies");
        const company: CrmCompany = {
          name: String(params.name || params.company || params.companyName || "Company"),
          phone: str(params.phone),
          website: str(params.website),
          ownerExternalId: ownerId(),
          customFields: customFieldsFrom(params),
        };
        if (actionId === "company.update") {
          company.id = requireExternalId();
        } else {
          const id = externalId();
          if (id) company.id = id;
        }
        result = await upsertCompany(ctx, company);
        break;
      }

      case "company.change_owner": {
        const upsertCompany = need(connector.upsertCompany, "companies");
        result = await upsertCompany(ctx, {
          id: requireExternalId(),
          name: String(params.name || params.company || params.companyName || ""),
          ownerExternalId: ownerId(),
        });
        break;
      }

      case "company.update_custom_field": {
        const upsertCompany = need(connector.upsertCompany, "companies");
        result = await upsertCompany(ctx, {
          id: requireExternalId(),
          name: String(params.name || params.company || params.companyName || ""),
          customFields: customFieldsFrom(params) || {},
        });
        break;
      }

      case "company.link_contact": {
        // Associate a contact with a company via the contact's companyExternalId.
        const companyExternalId = str(params.companyExternalId) ?? externalId();
        if (!companyExternalId) throw new Error("company.link_contact requires companyExternalId");
        const contactExternalId = await resolveContactExternalId();
        if (!contactExternalId) throw new Error("company.link_contact requires contactExternalId");
        result = await connector.upsertContact(ctx, {
          id: contactExternalId,
          companyExternalId,
        });
        break;
      }

      case "company.add_note": {
        const createNote = need(connector.createNote, "notes");
        result = await createNote(ctx, {
          body: String(params.body || params.note || ""),
          relatedType: "company",
          relatedExternalId: str(params.companyExternalId) ?? externalId(),
        });
        break;
      }

      // -------------------- Deal --------------------
      case "deal.create":
      case "deal.update":
      case "deal.upsert": {
        const upsertDeal = need(connector.upsertDeal, "deals");
        const deal: CrmDeal = {
          name: String(params.title || params.name || "Deal"),
          amount: num(params.value) ?? num(params.amount),
          currency: str(params.currency),
          stage: str(params.stageId) ?? str(params.stage),
          pipeline: str(params.pipelineId) ?? str(params.pipeline),
          contactExternalId: str(params.contactExternalId) ?? (await resolveContactExternalId()),
          companyExternalId: str(params.companyExternalId),
          ownerExternalId: ownerId(),
          status: str(params.status),
          closeDate: str(params.closeDate),
          customFields: customFieldsFrom(params),
        };
        if (actionId === "deal.update") {
          deal.id = requireExternalId();
        } else {
          const id = externalId();
          if (id) deal.id = id;
        }
        result = await upsertDeal(ctx, deal);
        break;
      }

      case "deal.move_pipeline": {
        const upsertDeal = need(connector.upsertDeal, "deals");
        // Empty name ⇒ adapters omit Name/title on PATCH (do not invent "Deal").
        result = await upsertDeal(ctx, {
          id: requireExternalId(),
          name: String(params.name || params.title || ""),
          pipeline: str(params.pipelineId) ?? str(params.pipeline),
          stage: str(params.stageId) ?? str(params.stage),
        });
        break;
      }

      case "deal.move_stage": {
        const upsertDeal = need(connector.upsertDeal, "deals");
        result = await upsertDeal(ctx, {
          id: requireExternalId(),
          name: String(params.name || params.title || ""),
          stage: str(params.stageId) ?? str(params.stage),
        });
        break;
      }

      case "deal.mark_won":
      case "deal.mark_lost":
      case "deal.reopen": {
        const upsertDeal = need(connector.upsertDeal, "deals");
        const status =
          actionId === "deal.mark_won" ? "won" : actionId === "deal.mark_lost" ? "lost" : "open";
        // Adapters map status → provider stage (Closed Won / Closed Lost / open).
        result = await upsertDeal(ctx, {
          id: requireExternalId(),
          name: String(params.name || params.title || ""),
          status,
          stage: str(params.stageId) ?? str(params.stage),
        });
        break;
      }

      case "deal.change_owner": {
        const upsertDeal = need(connector.upsertDeal, "deals");
        result = await upsertDeal(ctx, {
          id: requireExternalId(),
          name: String(params.name || params.title || ""),
          ownerExternalId: ownerId(),
        });
        break;
      }

      case "deal.change_value": {
        const upsertDeal = need(connector.upsertDeal, "deals");
        result = await upsertDeal(ctx, {
          id: requireExternalId(),
          name: String(params.name || params.title || ""),
          amount: num(params.value) ?? num(params.amount),
          currency: str(params.currency),
        });
        break;
      }

      case "deal.change_close_date": {
        const upsertDeal = need(connector.upsertDeal, "deals");
        result = await upsertDeal(ctx, {
          id: requireExternalId(),
          name: String(params.name || params.title || ""),
          closeDate: str(params.closeDate),
        });
        break;
      }

      case "deal.link_contact": {
        const upsertDeal = need(connector.upsertDeal, "deals");
        result = await upsertDeal(ctx, {
          id: requireExternalId(),
          name: String(params.name || params.title || ""),
          contactExternalId: str(params.contactExternalId) ?? (await resolveContactExternalId()),
        });
        break;
      }

      case "deal.link_company": {
        const upsertDeal = need(connector.upsertDeal, "deals");
        result = await upsertDeal(ctx, {
          id: requireExternalId(),
          name: String(params.name || params.title || ""),
          companyExternalId: str(params.companyExternalId),
        });
        break;
      }

      case "deal.add_note": {
        const createNote = need(connector.createNote, "notes");
        result = await createNote(ctx, {
          body: String(params.body || params.note || ""),
          relatedType: "deal",
          relatedExternalId: str(params.dealExternalId) ?? externalId(),
          contactExternalId: await resolveContactExternalId(),
        });
        break;
      }

      case "deal.update_custom_field": {
        const upsertDeal = need(connector.upsertDeal, "deals");
        result = await upsertDeal(ctx, {
          id: requireExternalId(),
          name: String(params.name || params.title || ""),
          customFields: customFieldsFrom(params) || {},
        });
        break;
      }

      // -------------------- Task --------------------
      case "task.create": {
        const createTask = need(connector.createTask, "tasks");
        result = await createTask(ctx, {
          subject: String(params.title || params.subject || "Follow up"),
          description: str(params.description),
          dueAt: str(params.dueAt) ?? str(params.dueDate),
          contactExternalId: str(params.contactExternalId) ?? (await resolveContactExternalId()),
          ownerExternalId: ownerId(),
          status: str(params.status) ?? "open",
        });
        break;
      }

      case "task.update": {
        const updateTask = need(connector.updateTask, "tasks");
        result = await updateTask(ctx, {
          id: requireExternalId(),
          subject: String(params.title || params.subject || "Follow up"),
          description: str(params.description),
          dueAt: str(params.dueAt) ?? str(params.dueDate),
          status: str(params.status),
          ownerExternalId: ownerId(),
        });
        break;
      }

      case "task.complete": {
        const updateTask = need(connector.updateTask, "tasks");
        // Adapters normalize "Completed" / done:1 per provider.
        result = await updateTask(ctx, {
          id: requireExternalId(),
          subject: String(params.title || params.subject || ""),
          status: "Completed",
        });
        break;
      }

      case "task.assign": {
        const updateTask = need(connector.updateTask, "tasks");
        result = await updateTask(ctx, {
          id: requireExternalId(),
          subject: String(params.title || params.subject || ""),
          ownerExternalId: ownerId(),
        });
        break;
      }

      case "task.change_due": {
        const updateTask = need(connector.updateTask, "tasks");
        result = await updateTask(ctx, {
          id: requireExternalId(),
          subject: String(params.title || params.subject || "Task"),
          dueAt: str(params.dueAt) ?? str(params.dueDate),
        });
        break;
      }

      // -------------------- Notes --------------------
      case "note.create":
      case "communication.add_note": {
        const createNote = need(connector.createNote, "notes");
        result = await createNote(ctx, {
          body: String(params.body || params.note || ""),
          contactExternalId: str(params.contactExternalId) ?? (await resolveContactExternalId()),
          relatedType: str(params.relatedType),
          relatedExternalId: str(params.relatedExternalId),
        });
        break;
      }

      // -------------------- Activity --------------------
      case "activity.create": {
        const type = (str(params.type) || "task").toLowerCase();
        const contactExternalId = str(params.contactExternalId) ?? (await resolveContactExternalId());
        if (type === "note") {
          const createNote = need(connector.createNote, "notes");
          result = await createNote(ctx, {
            body: String(params.body || params.note || ""),
            contactExternalId,
          });
        } else {
          const createTask = need(connector.createTask, "tasks");
          result = await createTask(ctx, {
            subject: String(params.subject || params.title || "Activity"),
            description: str(params.description) ?? str(params.body),
            dueAt: str(params.dueAt) ?? str(params.dueDate),
            contactExternalId,
            ownerExternalId: ownerId(),
            status: str(params.status) ?? "open",
          });
        }
        break;
      }

      // -------------------- Calls --------------------
      case "call.log":
      case "call.update":
      case "voicemail.log":
      case "call.attach_recording":
      case "call.attach_transcript":
      case "call.attach_summary":
      case "call.update_disposition": {
        const logCall = need(connector.logCall, "calls");
        const isVoicemail = actionId === "voicemail.log";
        const call: CrmCallActivity = {
          direction:
            (str(params.direction) as "inbound" | "outbound" | "missed") ||
            (isVoicemail ? "inbound" : "outbound"),
          from: str(params.from),
          to: str(params.to),
          durationSeconds: num(params.durationSeconds),
          disposition: str(params.disposition) ?? (isVoicemail ? "voicemail" : null),
          notes: str(params.notes),
          contactExternalId: str(params.contactExternalId) ?? (await resolveContactExternalId()),
          recordingUrl: str(params.recordingUrl),
          transcriptUrl: str(params.transcriptUrl),
          transcriptText: str(params.transcriptText),
          aiSummary: str(params.aiSummary) ?? str(params.summary),
          subject: str(params.subject) ?? (isVoicemail ? "Voicemail" : null),
          startedAt: str(params.startedAt) ?? new Date().toISOString(),
        };
        // Attach/update variants must update the same activity — id is required.
        if (
          actionId === "call.update" ||
          actionId === "call.attach_recording" ||
          actionId === "call.attach_transcript" ||
          actionId === "call.attach_summary" ||
          actionId === "call.update_disposition"
        ) {
          call.id = requireExternalId();
        } else {
          const id = externalId();
          if (id) call.id = id;
        }
        result = await logCall(ctx, call);
        break;
      }

      // -------------------- SMS / MMS --------------------
      case "sms.log":
      case "mms.log": {
        const logSms = need(connector.logSms, "sms");
        const sms: CrmSmsActivity = {
          direction: (str(params.direction) as "inbound" | "outbound") || "outbound",
          from: str(params.from),
          to: str(params.to),
          body: String(params.body || ""),
          contactExternalId: str(params.contactExternalId) ?? (await resolveContactExternalId()),
          sentAt: str(params.occurredAt) ?? str(params.sentAt) ?? new Date().toISOString(),
        };
        const media = Array.isArray(params.mediaUrls)
          ? params.mediaUrls.map((m) => String(m))
          : str(params.mediaUrl)
            ? [String(params.mediaUrl)]
            : [];
        if (media.length) sms.mediaUrls = media;
        if (str(params.id)) sms.id = String(params.id);
        result = await logSms(ctx, sms);
        break;
      }

      default:
        return { ok: false, code: "UNSUPPORTED", message: `Action ${actionId} not available` };
    }

    await writeCrmAudit({
      workspaceId: input.workspaceId,
      provider: input.provider,
      category: "automation",
      action: actionId,
      message: `CRM automation action ${actionId}`,
      detail: {
        externalId: result.externalId,
        created: result.created,
        automationFlowId: input.automationFlowId,
        contactId: input.contactId,
      },
    });

    return {
      ok: true,
      externalId: result.externalId || undefined,
      created: result.created,
      externalUrl: result.externalUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeCrmAudit({
      workspaceId: input.workspaceId,
      provider: input.provider,
      category: "automation",
      action: String(input.actionId),
      message: `CRM automation action failed: ${message.slice(0, 180)}`,
      detail: { contactId: input.contactId },
    }).catch(() => undefined);
    return { ok: false, code: "ERROR", message };
  }
}

export async function listCrmLinksForWorkspaceContact(
  workspaceId: string,
  contactId: string,
) {
  return getPrisma().crmObjectMapping.findMany({
    where: {
      workspaceId,
      internalId: contactId,
      provider: { in: [...CRM_PROVIDER_IDS] },
    },
    orderBy: { lastSyncedAt: "desc" },
    take: 50,
  });
}

// Ensure UpsertResult is treated as the connector's contract for action results.
export type CrmActionExecutionResult = UpsertResult;
