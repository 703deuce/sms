/**
 * Voice → Transovo CRM write helpers (note / task / contact update).
 * Never call Salesforce/Zoho/Pipedrive directly from Telnyx tool defs.
 */

import { getPrisma } from "@/lib/db";
import { CRM_PROVIDER_IDS, getConnector } from "@/lib/crm/registry";
import type { CrmProviderId } from "@/lib/crm/types";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

async function firstConnectedProvider(workspaceId: string): Promise<CrmProviderId | null> {
  const row = await getPrisma().integrationConnection.findFirst({
    where: {
      workspaceId,
      provider: { in: [...CRM_PROVIDER_IDS] },
      status: { in: ["connected", "syncing"] },
    },
    select: { provider: true },
    orderBy: { updatedAt: "desc" },
  });
  return (row?.provider as CrmProviderId) || null;
}

async function resolveContactExternalId(input: {
  workspaceId: string;
  provider: CrmProviderId;
  phone?: string;
  email?: string;
  contactExternalId?: string;
}): Promise<string | null> {
  if (input.contactExternalId) return input.contactExternalId;
  const { buildContext } = await import("@/lib/crm/sync-engine");
  const ctx = await buildContext(input.workspaceId, input.provider);
  const connector = getConnector(input.provider);
  if (input.phone && connector.findContactByPhone) {
    const found = await connector.findContactByPhone(ctx, input.phone).catch(() => null);
    if (found?.id) return found.id;
  }
  if (input.email && connector.findContactByEmail) {
    const found = await connector.findContactByEmail(ctx, input.email).catch(() => null);
    if (found?.id) return found.id;
  }
  return null;
}

export async function createCrmNoteForVoice(input: {
  workspaceId: string;
  subject?: string;
  body: string;
  phone?: string;
  email?: string;
  contactExternalId?: string;
  callId?: string;
}) {
  const provider = await firstConnectedProvider(input.workspaceId);
  if (!provider) {
    return { ok: false, error: "No CRM connected in this workspace." };
  }
  const phone = input.phone ? normalizeE164(input.phone) : "";
  const { buildContext } = await import("@/lib/crm/sync-engine");
  const ctx = await buildContext(input.workspaceId, provider);
  const connector = getConnector(provider);
  if (!connector.createNote) {
    return { ok: false, error: `${provider} does not support notes.` };
  }
  const contactExternalId = await resolveContactExternalId({
    workspaceId: input.workspaceId,
    provider,
    phone,
    email: input.email,
    contactExternalId: input.contactExternalId,
  });
  const noteBody = [
    input.subject ? `Subject: ${input.subject}` : "",
    input.body,
    input.callId ? `\n(Transovo call ${input.callId})` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const result = await connector.createNote(ctx, {
    body: noteBody || input.subject || "AI call note",
    contactExternalId,
  });
  return {
    ok: true,
    provider,
    noteId: result.externalId || null,
    contactExternalId,
  };
}

export async function createCrmTaskForVoice(input: {
  workspaceId: string;
  title: string;
  notes?: string;
  dueAt?: string;
  phone?: string;
  email?: string;
  contactExternalId?: string;
  callId?: string;
}) {
  const provider = await firstConnectedProvider(input.workspaceId);
  if (!provider) {
    return { ok: false, error: "No CRM connected in this workspace." };
  }
  const phone = input.phone ? normalizeE164(input.phone) : "";
  const { buildContext } = await import("@/lib/crm/sync-engine");
  const ctx = await buildContext(input.workspaceId, provider);
  const connector = getConnector(provider);
  if (!connector.createTask) {
    return { ok: false, error: `${provider} does not support tasks.` };
  }
  const contactExternalId = await resolveContactExternalId({
    workspaceId: input.workspaceId,
    provider,
    phone,
    email: input.email,
    contactExternalId: input.contactExternalId,
  });
  const result = await connector.createTask(ctx, {
    subject: input.title,
    description: [input.notes, input.callId ? `Call: ${input.callId}` : ""]
      .filter(Boolean)
      .join("\n"),
    dueAt: input.dueAt || null,
    contactExternalId,
    status: "Not Started",
  });
  return {
    ok: true,
    provider,
    taskId: result.externalId || null,
    contactExternalId,
  };
}

export async function upsertCrmContactForVoice(input: {
  workspaceId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  company?: string;
}) {
  const provider = await firstConnectedProvider(input.workspaceId);
  if (!provider) {
    return { ok: false, error: "No CRM connected in this workspace." };
  }
  const phone = input.phone ? normalizeE164(input.phone) : "";
  if (!phone && !input.email) {
    return { ok: false, error: "phone or email required" };
  }
  const { buildContext } = await import("@/lib/crm/sync-engine");
  const ctx = await buildContext(input.workspaceId, provider);
  const connector = getConnector(provider);
  let existingId: string | undefined;
  if (phone && connector.findContactByPhone) {
    const found = await connector.findContactByPhone(ctx, phone).catch(() => null);
    existingId = found?.id || undefined;
  }
  if (!existingId && input.email && connector.findContactByEmail) {
    const found = await connector.findContactByEmail(ctx, input.email).catch(() => null);
    existingId = found?.id || undefined;
  }
  const result = await connector.upsertContact(ctx, {
    id: existingId,
    firstName: input.firstName || null,
    lastName: input.lastName || null,
    phone: phone || null,
    email: input.email || null,
    companyName: input.company || null,
    source: "Transovo Voice AI",
  });
  return {
    ok: true,
    provider,
    contactId: result.externalId || existingId || null,
    created: result.created,
  };
}
