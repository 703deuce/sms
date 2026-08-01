import { getPrisma } from "@/lib/db";
import { redactSensitive } from "./redact";

export async function writeCrmAudit(input: {
  workspaceId: string;
  provider?: string | null;
  category: string;
  action: string;
  message: string;
  detail?: Record<string, unknown> | null;
  actorUserId?: string | null;
}) {
  try {
    const detail = input.detail ? redactSensitive(input.detail) : undefined;
    await getPrisma().crmAuditLog.create({
      data: {
        workspaceId: input.workspaceId,
        provider: input.provider || null,
        category: input.category,
        action: input.action,
        message: input.message,
        detailJson: (detail || undefined) as object | undefined,
        actorUserId: input.actorUserId || null,
      },
    });
  } catch (err) {
    console.warn("[crm] audit write failed", err instanceof Error ? err.message : err);
  }
}

export async function appendSyncEvent(input: {
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
  try {
    await getPrisma().crmSyncEvent.create({
      data: {
        workspaceId: input.workspaceId,
        syncRunId: input.syncRunId,
        provider: input.provider,
        level: input.level || "info",
        action: input.action,
        message: input.message,
        objectType: input.objectType || null,
        internalId: input.internalId || null,
        externalId: input.externalId || null,
        detailJson: (input.detail ? redactSensitive(input.detail) : undefined) as
          | object
          | undefined,
      },
    });
  } catch (err) {
    console.warn("[crm] sync event write failed", err instanceof Error ? err.message : err);
  }
}

export async function listCrmAuditLogs(
  workspaceId: string,
  opts?: { provider?: string; limit?: number },
) {
  return getPrisma().crmAuditLog.findMany({
    where: {
      workspaceId,
      ...(opts?.provider ? { provider: opts.provider } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts?.limit || 100, 500),
  });
}

export async function listCrmSyncRuns(
  workspaceId: string,
  opts?: { provider?: string; limit?: number },
) {
  return getPrisma().crmSyncRun.findMany({
    where: {
      workspaceId,
      ...(opts?.provider ? { provider: opts.provider } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts?.limit || 50, 200),
  });
}
