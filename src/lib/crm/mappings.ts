import { createHash } from "crypto";
import { getPrisma } from "@/lib/db";
import type { CrmObjectType, CrmProviderId } from "./types";

export function fingerprintPhone(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return createHash("sha256").update(`phone:${digits}`).digest("hex").slice(0, 32);
}

export function fingerprintEmail(email?: string | null) {
  if (!email) return null;
  return createHash("sha256")
    .update(`email:${email.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
}

export async function getObjectMapping(input: {
  workspaceId: string;
  provider: CrmProviderId;
  objectType: CrmObjectType;
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

export async function upsertObjectMapping(input: {
  workspaceId: string;
  provider: CrmProviderId;
  objectType: CrmObjectType;
  internalId: string;
  externalId: string;
  externalUrl?: string | null;
  parentExternalId?: string | null;
  fingerprint?: string | null;
  syncDirection?: string;
  syncHash?: string | null;
  syncStatus?: string | null;
  lastCrmModifiedAt?: Date | null;
  lastInternalModifiedAt?: Date | null;
  externalDeletedAt?: Date | null;
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
      syncDirection: input.syncDirection || "bidirectional",
      lastCrmModifiedAt: input.lastCrmModifiedAt || null,
      lastInternalModifiedAt: input.lastInternalModifiedAt || null,
      externalDeletedAt: input.externalDeletedAt || null,
      metadataJson: (input.metadata || undefined) as object | undefined,
      lastSyncedAt: new Date(),
    },
    update: {
      externalId: input.externalId,
      externalUrl: input.externalUrl || null,
      fingerprint: input.fingerprint || null,
      lastSyncedAt: new Date(),
      syncVersion: { increment: 1 },
      ...(input.parentExternalId !== undefined
        ? { parentExternalId: input.parentExternalId }
        : {}),
      ...(input.syncHash !== undefined ? { syncHash: input.syncHash } : {}),
      ...(input.syncStatus !== undefined ? { syncStatus: input.syncStatus } : {}),
      ...(input.lastCrmModifiedAt !== undefined
        ? { lastCrmModifiedAt: input.lastCrmModifiedAt }
        : {}),
      ...(input.lastInternalModifiedAt !== undefined
        ? { lastInternalModifiedAt: input.lastInternalModifiedAt }
        : {}),
      ...(input.externalDeletedAt !== undefined
        ? { externalDeletedAt: input.externalDeletedAt }
        : {}),
      ...(input.metadata ? { metadataJson: input.metadata as object } : {}),
    },
  });
}

export async function listFieldMappings(workspaceId: string, provider: CrmProviderId) {
  return getPrisma().crmFieldMapping.findMany({
    where: { workspaceId, provider, active: true },
    orderBy: [{ objectType: "asc" }, { internalField: "asc" }],
  });
}

export async function upsertFieldMapping(input: {
  workspaceId: string;
  provider: CrmProviderId;
  objectType: string;
  internalField: string;
  externalField: string;
  transform?: string | null;
  direction?: string;
  active?: boolean;
}) {
  return getPrisma().crmFieldMapping.upsert({
    where: {
      workspaceId_provider_objectType_internalField_direction: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        objectType: input.objectType,
        internalField: input.internalField,
        direction: input.direction || "bidirectional",
      },
    },
    create: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      objectType: input.objectType,
      internalField: input.internalField,
      externalField: input.externalField,
      transform: input.transform || null,
      direction: input.direction || "bidirectional",
      active: input.active !== false,
    },
    update: {
      externalField: input.externalField,
      transform: input.transform || null,
      active: input.active !== false,
    },
  });
}

/** Apply stored field mappings onto a flat record (outbound: internal → external keys). */
export function applyFieldMappingsOutbound(
  record: Record<string, unknown>,
  mappings: Array<{ internalField: string; externalField: string; direction: string }>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...record };
  for (const m of mappings) {
    if (m.direction === "inbound") continue;
    if (record[m.internalField] !== undefined) {
      out[m.externalField] = record[m.internalField];
    }
  }
  return out;
}
