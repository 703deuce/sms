/**
 * Helpers to publish rich, idempotent CRM automation events from sync.
 */

import { createHash } from "crypto";
import { getObjectMapping } from "./mappings";
import { publishCrmAutomationEvent, type CrmNormalizedAutomationEvent } from "./automation-bridge";
import type { CrmProviderId } from "./types";

export function hashCrmPayload(parts: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
}

export function diffFields(
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
): string[] {
  const changed: string[] = [];
  const keys = new Set([...Object.keys(prev || {}), ...Object.keys(next)]);
  for (const k of keys) {
    const a = JSON.stringify((prev || {})[k] ?? null);
    const b = JSON.stringify(next[k] ?? null);
    if (a !== b) changed.push(k);
  }
  return changed;
}

/** Resolve Transovo contact id from a CRM contact external id. */
export async function resolveContactIdFromExternal(
  workspaceId: string,
  provider: CrmProviderId,
  contactExternalId?: string | null,
): Promise<string | null> {
  if (!contactExternalId) return null;
  const map = await getObjectMapping({
    workspaceId,
    provider,
    objectType: "contact",
    externalId: contactExternalId,
  });
  return map?.internalId || null;
}

export async function publishMappedCrmEvent(input: {
  workspaceId: string;
  provider: CrmProviderId;
  eventType: CrmNormalizedAutomationEvent;
  contactId: string | null;
  externalObjectType: string;
  externalObjectId: string;
  payload?: Record<string, unknown>;
  changedFields?: string[];
}) {
  if (!input.contactId) return { skipped: true as const, reason: "no_contact" };
  return publishCrmAutomationEvent({
    workspaceId: input.workspaceId,
    provider: input.provider,
    eventType: input.eventType,
    contactId: input.contactId,
    externalObjectType: input.externalObjectType,
    externalObjectId: input.externalObjectId,
    payload: {
      ...(input.payload || {}),
      changedFields: input.changedFields || [],
      eventTimestamp: new Date().toISOString(),
    },
  });
}
