import { writeCrmAudit, appendSyncEvent } from "@/lib/crm/logging";

export async function writeIntegrationAudit(input: {
  workspaceId: string;
  provider?: string | null;
  category: string;
  action: string;
  message: string;
  detail?: Record<string, unknown> | null;
  actorUserId?: string | null;
}) {
  return writeCrmAudit(input);
}

export async function appendIntegrationSyncEvent(input: {
  workspaceId: string;
  syncRunId: string;
  provider: string;
  level?: "info" | "warn" | "error";
  action: string;
  message: string;
  objectType?: string | null;
  internalId?: string | null;
  externalId?: string | null;
  detail?: Record<string, unknown> | null;
}) {
  return appendSyncEvent(input);
}
