import { ensureFreshCrmToken } from "@/lib/crm/oauth";
import { getConnector } from "@/lib/crm/registry";
import { getCrmSyncPreferences } from "@/lib/crm/settings";
import type { CrmContact, CrmProviderId } from "@/lib/crm/types";
import { getObjectMapping, upsertObjectMapping } from "@/lib/crm/mappings";
import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import type { ConnectorContext } from "@/lib/crm/connector";

export type CrmListSource = { id: string; label: string; objectType: "contact" | "lead" };

export function listCrmImportSources(provider: CrmProviderId): CrmListSource[] {
  const connector = getConnector(provider);
  const sources: CrmListSource[] = [{ id: "contacts", label: "Contacts", objectType: "contact" }];
  if (connector.listLeads) {
    sources.push({ id: "leads", label: "Leads", objectType: "lead" });
  }
  if (provider === "pipedrive") {
    return [{ id: "people", label: "People", objectType: "contact" }];
  }
  return sources;
}

async function buildCtx(workspaceId: string, provider: CrmProviderId): Promise<ConnectorContext> {
  const conn = await ensureFreshCrmToken(workspaceId, provider);
  if (!conn?.accessToken) throw new Error("CRM not connected");
  const preferences = await getCrmSyncPreferences(workspaceId, provider);
  return {
    workspaceId,
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken,
    meta: (conn.configJson || {}) as Record<string, unknown>,
    preferences,
  };
}

async function upsertContactFromCrm(
  workspaceId: string,
  provider: CrmProviderId,
  crm: CrmContact,
  externalId: string,
) {
  const prisma = getPrisma();
  const phone = crm.phone ? normalizeE164(crm.phone) : null;
  if (!phone) return { status: "rejected" as const, reason: "missing_phone" };

  const existingMap = await getObjectMapping({
    workspaceId,
    provider,
    objectType: "contact",
    externalId,
  });

  let contactId = existingMap?.internalId ?? null;
  let created = false;
  let updated = false;

  if (!contactId) {
    const byPhone = await prisma.contact.findUnique({
      where: { workspaceId_phone: { workspaceId, phone } },
    });
    if (byPhone) contactId = byPhone.id;
  }

  const customFields = {
    ...(crm.customFields || {}),
    crmProvider: provider,
    crmExternalId: externalId,
    crmSourceRecordUrl: null,
  };

  if (contactId) {
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        firstName: crm.firstName ?? undefined,
        lastName: crm.lastName ?? undefined,
        company: crm.companyName ?? undefined,
        customFields,
      },
    });
    updated = true;
  } else {
    const row = await prisma.contact.create({
      data: {
        workspaceId,
        phone,
        firstName: crm.firstName,
        lastName: crm.lastName,
        company: crm.companyName,
        customFields,
      },
    });
    contactId = row.id;
    created = true;
  }

  await upsertObjectMapping({
    workspaceId,
    provider,
    objectType: "contact",
    internalId: contactId,
    externalId,
    metadata: { source: "power_dialer_import", ownership: crm.ownerExternalId },
  });

  return { status: created ? "created" : updated ? "updated" : "skipped", contactId };
}

export async function importCrmListIntoCallingList(input: {
  workspaceId: string;
  provider: CrmProviderId;
  listId: string;
  sourceId: string;
  maxRecords?: number;
}) {
  const prisma = getPrisma();
  const list = await prisma.contactList.findFirst({
    where: { id: input.listId, workspaceId: input.workspaceId },
  });
  if (!list) throw new Error("List not found");

  const sources = listCrmImportSources(input.provider);
  const source = sources.find((s) => s.id === input.sourceId) || sources[0];
  const ctx = await buildCtx(input.workspaceId, input.provider);
  const connector = getConnector(input.provider);
  const max = Math.min(input.maxRecords ?? 250, 500);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let rejected = 0;
  let cursor: string | null = null;
  let fetched = 0;

  while (fetched < max) {
    const page =
      source.objectType === "lead" && connector.listLeads
        ? await connector.listLeads(ctx, cursor)
        : await connector.listContacts(ctx, cursor);

    for (const item of page.items) {
      if (fetched >= max) break;
      fetched += 1;
      const externalId = item.id || "";
      if (!externalId) {
        rejected += 1;
        continue;
      }
      const result = await upsertContactFromCrm(input.workspaceId, input.provider, item, externalId);
      if (result.status === "rejected") {
        rejected += 1;
        continue;
      }
      if (result.status === "created") created += 1;
      else if (result.status === "updated") updated += 1;
      else skipped += 1;

      if (result.contactId) {
        await prisma.contactListMember.upsert({
          where: { listId_contactId: { listId: input.listId, contactId: result.contactId } },
          create: { listId: input.listId, contactId: result.contactId },
          update: {},
        });
      }
    }
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }

  await prisma.contactList.update({
    where: { id: input.listId },
    data: { source: `crm:${input.provider}`, updatedAt: new Date() },
  });

  return { created, updated, skipped, rejected, fetched, source: source.label, provider: input.provider };
}
