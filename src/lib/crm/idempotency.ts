/**
 * Deterministic idempotency for CRM writes — retries must not create duplicates.
 */

import { createHash } from "crypto";
import type { CrmPlatformEventType, CrmProviderId } from "./types";

export function crmWriteIdempotencyKey(input: {
  workspaceId: string;
  provider: CrmProviderId;
  action: string;
  objectType: string;
  internalId: string;
  version?: string | number | null;
}): string {
  const raw = [
    input.workspaceId,
    input.provider,
    input.action,
    input.objectType,
    input.internalId,
    String(input.version ?? "1"),
  ].join(":");
  return `crm-w-${createHash("sha256").update(raw).digest("hex").slice(0, 40)}`;
}

export function crmEventIdempotencyKey(input: {
  workspaceId: string;
  provider: CrmProviderId;
  type: CrmPlatformEventType;
  eventId?: string | null;
  objectId?: string | null;
}): string {
  const anchor = input.eventId || input.objectId || "na";
  return `crm-e-${input.provider}-${input.type}-${anchor}`.slice(0, 180);
}

export function payloadSyncHash(payload: Record<string, unknown>): string {
  const stable = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash("sha256").update(stable).digest("hex").slice(0, 32);
}
