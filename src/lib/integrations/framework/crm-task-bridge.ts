import { getPrisma } from "@/lib/db";
import { persistTaskFromIntegration } from "./product-persist";

/**
 * Pull CRM-framework task mappings (Zoho / Pipedrive) into IntegrationTask
 * so the unified tasks UI can show them without redesigning CRM adapters.
 */
export async function syncCrmTasksIntoUnifiedView(workspaceId: string) {
  const prisma = getPrisma();
  const mappings = (await prisma.crmObjectMapping.findMany({
    where: {
      workspaceId,
      provider: { in: ["zoho", "pipedrive", "salesforce"] },
      objectType: "task",
    },
    take: 500,
  })) as Array<{
    provider: string;
    externalId: string;
    internalId: string;
    externalUrl: string | null;
    metadataJson: unknown;
    lastSyncedAt: Date | null;
    syncStatus: string | null;
  }>;

  let upserted = 0;
  for (const m of mappings) {
    const meta = (m.metadataJson || {}) as Record<string, unknown>;
    await persistTaskFromIntegration({
      workspaceId,
      provider: m.provider,
      contactId: typeof meta.contactId === "string" ? meta.contactId : m.internalId || null,
      task: {
        externalId: m.externalId,
        title: String(meta.subject || meta.title || `Task ${m.externalId}`),
        description: (meta.description as string) || null,
        status: (meta.status as string) || "open",
        dueAt: (meta.dueAt as string) || null,
        ownerName: (meta.ownerName as string) || null,
        providerUrl: m.externalUrl,
        relatedDealId: (meta.dealId as string) || null,
        relatedCompanyId: (meta.companyId as string) || null,
        raw: meta,
      },
    });
    upserted += 1;
  }
  return { upserted };
}
