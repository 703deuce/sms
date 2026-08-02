/**
 * Provider-neutral CRM actions for automations (Salesforce / Zoho / Pipedrive).
 * Uses existing connectors — no parallel CRM implementation.
 */

import { getPrisma } from "@/lib/db";
import { buildContext } from "./sync-engine";
import { getConnector, CRM_PROVIDER_IDS } from "./registry";
import { isFeatureSupported, type ProviderFeature } from "./feature-matrix";
import { getObjectMapping, upsertObjectMapping } from "./mappings";
import { writeCrmAudit } from "./logging";
import type { CrmProviderId } from "./types";

export type CrmAutomationActionId =
  | "contact.upsert"
  | "lead.upsert"
  | "deal.upsert"
  | "task.create"
  | "note.create"
  | "call.log"
  | "sms.log";

export type CrmActionDef = {
  id: CrmAutomationActionId;
  label: string;
  providers: CrmProviderId[];
  requiredFeature: ProviderFeature;
};

export const CRM_AUTOMATION_ACTIONS: CrmActionDef[] = [
  {
    id: "contact.upsert",
    label: "Create/update CRM contact",
    providers: ["salesforce", "zoho", "pipedrive"],
    requiredFeature: "contacts",
  },
  {
    id: "lead.upsert",
    label: "Create/update CRM lead",
    providers: ["salesforce", "zoho"],
    requiredFeature: "leads",
  },
  {
    id: "deal.upsert",
    label: "Create/update CRM deal/opportunity",
    providers: ["salesforce", "zoho", "pipedrive"],
    requiredFeature: "deals",
  },
  {
    id: "task.create",
    label: "Create CRM task",
    providers: ["salesforce", "zoho", "pipedrive"],
    requiredFeature: "tasks",
  },
  {
    id: "note.create",
    label: "Add CRM note",
    providers: ["salesforce", "zoho", "pipedrive"],
    requiredFeature: "notes",
  },
  {
    id: "call.log",
    label: "Log call activity in CRM",
    providers: ["salesforce", "zoho", "pipedrive"],
    requiredFeature: "calls",
  },
  {
    id: "sms.log",
    label: "Log SMS activity in CRM",
    providers: ["salesforce", "zoho", "pipedrive"],
    requiredFeature: "sms",
  },
];

export function isCrmAutomationProvider(provider: string): provider is CrmProviderId {
  return (CRM_PROVIDER_IDS as readonly string[]).includes(provider);
}

export function crmActionsForProvider(provider: CrmProviderId): CrmActionDef[] {
  return CRM_AUTOMATION_ACTIONS.filter(
    (a) => a.providers.includes(provider) && isFeatureSupported(provider, a.requiredFeature),
  );
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
    let result: { externalId: string; created: boolean; externalUrl?: string | null };

    if (input.actionId === "contact.upsert") {
      result = await connector.upsertContact(ctx, {
        firstName: (params.firstName as string) || null,
        lastName: (params.lastName as string) || null,
        phone: (params.phone as string) || null,
        email: (params.email as string) || null,
        companyName: (params.company as string) || null,
        id: (params.externalId as string) || undefined,
      });
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
    } else if (input.actionId === "lead.upsert" && connector.upsertLead) {
      result = await connector.upsertLead(ctx, {
        firstName: (params.firstName as string) || null,
        lastName: (params.lastName as string) || null,
        phone: (params.phone as string) || null,
        email: (params.email as string) || null,
        companyName: (params.company as string) || null,
        status: (params.status as string) || null,
        source: (params.source as string) || null,
        id: (params.externalId as string) || undefined,
      });
    } else if (input.actionId === "deal.upsert" && connector.upsertDeal) {
      result = await connector.upsertDeal(ctx, {
        name: String(params.title || params.name || "Deal"),
        amount: params.value != null ? Number(params.value) : params.amount != null ? Number(params.amount) : null,
        currency: (params.currency as string) || null,
        stage: (params.stageId as string) || (params.stage as string) || null,
        pipeline: (params.pipelineId as string) || (params.pipeline as string) || null,
        contactExternalId: (params.contactExternalId as string) || null,
        status: (params.status as string) || null,
        id: (params.externalId as string) || undefined,
      });
    } else if (input.actionId === "task.create" && connector.createTask) {
      result = await connector.createTask(ctx, {
        subject: String(params.title || params.subject || "Follow up"),
        description: (params.description as string) || null,
        dueAt: params.dueAt ? String(params.dueAt) : null,
        contactExternalId: (params.contactExternalId as string) || null,
        status: "open",
      });
    } else if (input.actionId === "note.create" && connector.createNote) {
      let contactExternalId = (params.contactExternalId as string) || null;
      if (!contactExternalId && input.contactId) {
        const map = await getObjectMapping({
          workspaceId: input.workspaceId,
          provider: input.provider,
          objectType: "contact",
          internalId: input.contactId,
        });
        contactExternalId = map?.externalId || null;
      }
      result = await connector.createNote(ctx, {
        body: String(params.body || params.note || ""),
        contactExternalId,
      });
    } else if (input.actionId === "call.log" && connector.logCall) {
      result = await connector.logCall(ctx, {
        direction: (params.direction as "inbound" | "outbound" | "missed") || "outbound",
        from: (params.from as string) || null,
        to: (params.to as string) || null,
        durationSeconds: params.durationSeconds != null ? Number(params.durationSeconds) : null,
        disposition: (params.disposition as string) || null,
        notes: (params.notes as string) || null,
        contactExternalId: (params.contactExternalId as string) || null,
        recordingUrl: (params.recordingUrl as string) || null,
        startedAt: (params.startedAt as string) || new Date().toISOString(),
      });
    } else if (input.actionId === "sms.log" && connector.logSms) {
      result = await connector.logSms(ctx, {
        direction: (params.direction as "inbound" | "outbound") || "outbound",
        from: (params.from as string) || null,
        to: (params.to as string) || null,
        body: String(params.body || ""),
        contactExternalId: (params.contactExternalId as string) || null,
        sentAt: (params.occurredAt as string) || (params.sentAt as string) || new Date().toISOString(),
      });
    } else {
      return { ok: false, code: "UNSUPPORTED", message: `Action ${input.actionId} not available` };
    }

    await writeCrmAudit({
      workspaceId: input.workspaceId,
      provider: input.provider,
      category: "automation",
      action: String(input.actionId),
      message: `CRM automation action ${input.actionId}`,
      detail: {
        externalId: result.externalId,
        created: result.created,
        automationFlowId: input.automationFlowId,
        contactId: input.contactId,
      },
    });

    return {
      ok: true,
      externalId: result.externalId,
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
