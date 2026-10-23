import { ensureFreshCrmToken } from "@/lib/crm/oauth";
import type { ConnectorContext } from "@/lib/crm/connector";
import { getConnector, CRM_PROVIDER_IDS } from "@/lib/crm/registry";
import { DEFAULT_SYNC_PREFERENCES, type CrmProviderId } from "@/lib/crm/types";
import { getObjectMapping, upsertObjectMapping } from "@/lib/crm/mappings";
import { listFieldMappings } from "@/lib/crm/mappings";
import { applyInboundCrmFieldsToContact } from "@/lib/server/crm/native/sync-field-apply";
import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";

export async function syncCrmContactsInbound(workspaceId: string, provider: CrmProviderId) {
  const conn = await ensureFreshCrmToken(workspaceId, provider);
  if (!conn?.accessToken) {
    return { ok: false, reason: "CRM not connected — connect under Integrations" };
  }
  const connector = getConnector(provider);
  const ctx: ConnectorContext = {
    workspaceId,
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken,
    meta: (conn.configJson || {}) as Record<string, unknown>,
    preferences: DEFAULT_SYNC_PREFERENCES,
  };
  const contactPage = await connector.listContacts?.(ctx, null);
  const contacts = contactPage?.items ?? [];
  if (!contacts.length) return { ok: true, synced: 0, reason: "no_contacts_returned" };

  const fieldMaps = await listFieldMappings(workspaceId, provider);
  const prisma = getPrisma();
  let synced = 0;
  for (const c of contacts) {
    const externalId = c.id ?? "";
    if (!externalId) continue;
    const phone = c.phone ? normalizeE164(c.phone) : null;
    if (!phone) continue;
    const map = await getObjectMapping({
      workspaceId,
      provider,
      objectType: "contact",
      externalId,
    });
    let contactId = map?.internalId;
    if (!contactId) {
      const existing = await prisma.contact.findUnique({
        where: { workspaceId_phone: { workspaceId, phone } },
      });
      contactId = existing?.id;
      if (!contactId) {
        const created = await prisma.contact.create({
          data: {
            workspaceId,
            phone,
            firstName: c.firstName || "Unknown",
            lastName: c.lastName || null,
            email: c.email || null,
            company: c.companyName || null,
            leadSource: `crm:${provider}`,
          },
        });
        contactId = created.id;
      }
      await upsertObjectMapping({
        workspaceId,
        provider,
        objectType: "contact",
        internalId: contactId,
        externalId,
      });
    }
    const updates = fieldMaps
      .filter((m) => m.direction !== "outbound_only")
      .map((m) => ({
        fieldKey: m.internalField,
        value: (c as Record<string, unknown>)[m.externalField],
      }))
      .filter((u) => u.value != null && u.value !== "");
    if (updates.length) {
      await applyInboundCrmFieldsToContact({
        workspaceId,
        contactId,
        provider,
        updates,
      });
    }
    synced += 1;
  }
  return { ok: true, synced, provider };
}

export async function listConnectedCrmProviders(workspaceId: string) {
  const prisma = getPrisma();
  const rows = await prisma.integrationConnection.findMany({
    where: {
      workspaceId,
      provider: { in: [...CRM_PROVIDER_IDS] },
      status: { in: ["connected", "syncing"] },
    },
    select: { provider: true },
  });
  return rows.map((r) => r.provider as CrmProviderId);
}
