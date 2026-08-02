import { getPrisma } from "@/lib/db";
import type { ExternalObjectType, ExternalProviderId } from "./types";

export async function getExternalMapping(input: {
  workspaceId: string;
  provider: ExternalProviderId;
  objectType: ExternalObjectType | string;
  internalId?: string;
  externalId?: string;
}) {
  const prisma = getPrisma();
  if (input.internalId) {
    return prisma.crmObjectMapping.findUnique({
      where: {
        workspaceId_provider_objectType_internalId: {
          workspaceId: input.workspaceId,
          provider: input.provider,
          objectType: input.objectType,
          internalId: input.internalId,
        },
      },
    });
  }
  if (input.externalId) {
    return prisma.crmObjectMapping.findUnique({
      where: {
        workspaceId_provider_objectType_externalId: {
          workspaceId: input.workspaceId,
          provider: input.provider,
          objectType: input.objectType,
          externalId: input.externalId,
        },
      },
    });
  }
  return null;
}

function isUniqueViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /unique constraint|duplicate key|crm_object_mappings_workspaceId_provider_objectType/i.test(
      msg,
    ) ||
    (typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002")
  );
}

/**
 * Upsert a mapping under dual unique keys:
 *   (workspace, provider, objectType, internalId)
 *   (workspace, provider, objectType, externalId)
 *
 * Prisma's single-key upsert races the other unique and throws
 * "duplicate key ... externa_key" when the external id is already bound
 * to a different internal id (e.g. contact wrongly stored as appointment).
 */
export async function upsertExternalMapping(input: {
  workspaceId: string;
  provider: ExternalProviderId;
  objectType: ExternalObjectType | string;
  internalId: string;
  externalId: string;
  externalUrl?: string | null;
  parentExternalId?: string | null;
  fingerprint?: string | null;
  syncHash?: string | null;
  syncStatus?: string | null;
  lastProviderModifiedAt?: Date | null;
  lastInternalModifiedAt?: Date | null;
  metadata?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const byInternal = await prisma.crmObjectMapping.findUnique({
    where: {
      workspaceId_provider_objectType_internalId: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        objectType: input.objectType,
        internalId: input.internalId,
      },
    },
  });
  const byExternal = await prisma.crmObjectMapping.findUnique({
    where: {
      workspaceId_provider_objectType_externalId: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        objectType: input.objectType,
        externalId: input.externalId,
      },
    },
  });

  const updateData = {
    externalId: input.externalId,
    internalId: input.internalId,
    externalUrl: input.externalUrl || null,
    parentExternalId: input.parentExternalId || null,
    fingerprint: input.fingerprint || null,
    syncHash: input.syncHash || null,
    syncStatus: input.syncStatus || "synced",
    lastCrmModifiedAt: input.lastProviderModifiedAt || null,
    lastInternalModifiedAt: input.lastInternalModifiedAt || null,
    metadataJson: (input.metadata || undefined) as object | undefined,
    lastSyncedAt: new Date(),
  };

  if (byInternal && byExternal && byInternal.id !== byExternal.id) {
    // Keep the external-id row (provider identity) and retarget internalId.
    await prisma.crmObjectMapping.delete({ where: { id: byInternal.id } });
    return prisma.crmObjectMapping.update({
      where: { id: byExternal.id },
      data: updateData,
    });
  }

  if (byInternal) {
    return prisma.crmObjectMapping.update({
      where: { id: byInternal.id },
      data: updateData,
    });
  }

  if (byExternal) {
    return prisma.crmObjectMapping.update({
      where: { id: byExternal.id },
      data: updateData,
    });
  }

  try {
    return await prisma.crmObjectMapping.create({
      data: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        objectType: input.objectType,
        internalId: input.internalId,
        externalId: input.externalId,
        externalUrl: input.externalUrl || null,
        parentExternalId: input.parentExternalId || null,
        fingerprint: input.fingerprint || null,
        syncHash: input.syncHash || null,
        syncStatus: input.syncStatus || "synced",
        syncDirection: "bidirectional",
        lastCrmModifiedAt: input.lastProviderModifiedAt || null,
        lastInternalModifiedAt: input.lastInternalModifiedAt || null,
        metadataJson: (input.metadata || undefined) as object | undefined,
        lastSyncedAt: new Date(),
      },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // Concurrent insert — resolve via the dual-key path once more.
    const againInternal = await prisma.crmObjectMapping.findUnique({
      where: {
        workspaceId_provider_objectType_internalId: {
          workspaceId: input.workspaceId,
          provider: input.provider,
          objectType: input.objectType,
          internalId: input.internalId,
        },
      },
    });
    const againExternal = await prisma.crmObjectMapping.findUnique({
      where: {
        workspaceId_provider_objectType_externalId: {
          workspaceId: input.workspaceId,
          provider: input.provider,
          objectType: input.objectType,
          externalId: input.externalId,
        },
      },
    });
    const row = againInternal || againExternal;
    if (!row) throw err;
    return prisma.crmObjectMapping.update({
      where: { id: row.id },
      data: updateData,
    });
  }
}

export async function deleteMappingsForProvider(
  workspaceId: string,
  provider: ExternalProviderId,
) {
  await getPrisma().crmObjectMapping.deleteMany({ where: { workspaceId, provider } });
  await getPrisma().crmFieldMapping.deleteMany({ where: { workspaceId, provider } });
}
