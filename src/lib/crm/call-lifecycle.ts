/**
 * One Transovo call → one CRM activity. Recording/transcript/summary update the same record.
 */

import { getObjectMapping, upsertObjectMapping } from "./mappings";
import type { CrmProviderId } from "./types";

export async function getMappedCallActivity(input: {
  workspaceId: string;
  provider: CrmProviderId;
  callId: string | null | undefined;
}) {
  if (!input.callId) return null;
  return getObjectMapping({
    workspaceId: input.workspaceId,
    provider: input.provider,
    objectType: "call",
    internalId: input.callId,
  });
}

export async function persistMappedCallActivity(input: {
  workspaceId: string;
  provider: CrmProviderId;
  callId: string;
  externalId: string;
  contactExternalId?: string | null;
  syncHash?: string | null;
}) {
  return upsertObjectMapping({
    workspaceId: input.workspaceId,
    provider: input.provider,
    objectType: "call",
    internalId: input.callId,
    externalId: input.externalId,
    parentExternalId: input.contactExternalId || null,
    syncHash: input.syncHash || null,
    syncStatus: "synced",
    metadata: { kind: "call_activity" },
  });
}

export async function getMappedSmsActivity(input: {
  workspaceId: string;
  provider: CrmProviderId;
  messageId: string | null | undefined;
}) {
  if (!input.messageId) return null;
  return getObjectMapping({
    workspaceId: input.workspaceId,
    provider: input.provider,
    objectType: "sms",
    internalId: input.messageId,
  });
}

export async function persistMappedSmsActivity(input: {
  workspaceId: string;
  provider: CrmProviderId;
  messageId: string;
  externalId: string;
  contactExternalId?: string | null;
}) {
  return upsertObjectMapping({
    workspaceId: input.workspaceId,
    provider: input.provider,
    objectType: "sms",
    internalId: input.messageId,
    externalId: input.externalId,
    parentExternalId: input.contactExternalId || null,
    syncStatus: "synced",
  });
}
