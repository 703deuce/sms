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
  return getPrisma().crmObjectMapping.upsert({
    where: {
      workspaceId_provider_objectType_internalId: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        objectType: input.objectType,
        internalId: input.internalId,
      },
    },
    create: {
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
    update: {
      externalId: input.externalId,
      externalUrl: input.externalUrl || null,
      parentExternalId: input.parentExternalId || null,
      fingerprint: input.fingerprint || null,
      syncHash: input.syncHash || null,
      syncStatus: input.syncStatus || "synced",
      lastCrmModifiedAt: input.lastProviderModifiedAt || null,
      lastInternalModifiedAt: input.lastInternalModifiedAt || null,
      metadataJson: (input.metadata || undefined) as object | undefined,
      lastSyncedAt: new Date(),
    },
  });
}

export async function deleteMappingsForProvider(
  workspaceId: string,
  provider: ExternalProviderId,
) {
  await getPrisma().crmObjectMapping.deleteMany({ where: { workspaceId, provider } });
  await getPrisma().crmFieldMapping.deleteMany({ where: { workspaceId, provider } });
}
