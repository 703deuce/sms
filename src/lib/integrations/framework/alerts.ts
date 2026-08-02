import { getPrisma } from "@/lib/db";

export type AlertKind =
  | "oauth_expired"
  | "credential_revoked"
  | "scope_missing"
  | "webhook_failing"
  | "polling_delayed"
  | "rate_limit_sustained"
  | "sync_checkpoint_stale"
  | "queue_backlog"
  | "dead_letter"
  | "reauth_required"
  | "provider_outage"
  | "action_failure_repeated";

export async function raiseIntegrationAlert(input: {
  workspaceId: string;
  provider?: string | null;
  connectionId?: string | null;
  kind: AlertKind | string;
  message: string;
  severity?: "info" | "warn" | "error" | "critical";
  audience?: "customer" | "operator" | "business";
  detail?: Record<string, unknown> | null;
}) {
  // Deduplicate recent identical alerts (1 hour)
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const existing = await getPrisma().integrationAlert.findFirst({
    where: {
      workspaceId: input.workspaceId,
      kind: input.kind,
      provider: input.provider || null,
      acknowledgedAt: null,
      createdAt: { gte: since },
      message: input.message,
    },
  });
  if (existing) return existing;

  return getPrisma().integrationAlert.create({
    data: {
      workspaceId: input.workspaceId,
      provider: input.provider || null,
      connectionId: input.connectionId || null,
      kind: input.kind,
      message: input.message,
      severity: input.severity || "warn",
      audience: input.audience || "customer",
      detailJson: (input.detail || undefined) as object | undefined,
    },
  });
}

export async function listIntegrationAlerts(
  workspaceId: string,
  opts?: { includeAcknowledged?: boolean; limit?: number },
) {
  return getPrisma().integrationAlert.findMany({
    where: {
      workspaceId,
      ...(opts?.includeAcknowledged ? {} : { acknowledgedAt: null }),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts?.limit || 50, 200),
  });
}

export async function acknowledgeIntegrationAlert(workspaceId: string, id: string) {
  return getPrisma().integrationAlert.updateMany({
    where: { id, workspaceId },
    data: { acknowledgedAt: new Date() },
  });
}

/** Scan connections + queues and raise operational alerts. */
export async function scanIntegrationHealth(workspaceId: string) {
  const prisma = getPrisma();
  const connections = await prisma.integrationConnection.findMany({
    where: { workspaceId },
  });
  const raised = [];

  for (const c of connections as Array<{
    id: string;
    provider: string;
    status: string;
    lastError: string | null;
    lastSyncAt: Date | null;
    syncStatus: string | null;
  }>) {
    if (c.status === "needs_reauth") {
      raised.push(
        await raiseIntegrationAlert({
          workspaceId,
          provider: c.provider,
          connectionId: c.id,
          kind: "reauth_required",
          severity: "error",
          message: `${c.provider} requires reauthorization`,
        }),
      );
    }
    if (c.status === "error" && c.lastError) {
      raised.push(
        await raiseIntegrationAlert({
          workspaceId,
          provider: c.provider,
          connectionId: c.id,
          kind: "provider_outage",
          severity: "error",
          message: c.lastError.slice(0, 200),
        }),
      );
    }
    if (c.lastSyncAt && Date.now() - c.lastSyncAt.getTime() > 24 * 60 * 60 * 1000) {
      raised.push(
        await raiseIntegrationAlert({
          workspaceId,
          provider: c.provider,
          connectionId: c.id,
          kind: "sync_checkpoint_stale",
          severity: "warn",
          message: `${c.provider} has not synced successfully in 24h`,
        }),
      );
    }
  }

  const dead = await prisma.crmDeadLetter.count({
    where: { workspaceId, resolvedAt: null },
  });
  if (dead > 0) {
    raised.push(
      await raiseIntegrationAlert({
        workspaceId,
        kind: "dead_letter",
        severity: "error",
        audience: "operator",
        message: `${dead} unresolved integration dead-letter(s)`,
        detail: { count: dead },
      }),
    );
  }

  const pending = await prisma.jobQueue.count({
    where: {
      workspaceId,
      status: { in: ["pending", "deferred"] },
      jobType: { startsWith: "integration_" },
    },
  });
  if (pending > 100) {
    raised.push(
      await raiseIntegrationAlert({
        workspaceId,
        kind: "queue_backlog",
        severity: "warn",
        audience: "operator",
        message: `Integration queue backlog is high (${pending})`,
      }),
    );
  }

  return raised;
}
