import { getPrisma } from "@/lib/db";
import type { IntegrationActionSource } from "./execution-source";

export async function createIntegrationActionLog(input: {
  workspaceId: string;
  provider: string;
  connectionId?: string | null;
  source: IntegrationActionSource;
  actorUserId?: string | null;
  automationFlowId?: string | null;
  actionId: string;
  riskLevel: number;
  inputSummary?: Record<string, unknown> | null;
  objectType?: string | null;
  objectIds?: string[] | null;
  contactId?: string | null;
  approvalId?: string | null;
  policy?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
  reversible?: boolean;
  undoJson?: Record<string, unknown> | null;
  result?: string;
}) {
  if (input.idempotencyKey) {
    const existing = await getPrisma().integrationActionLog.findUnique({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId: input.workspaceId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return existing;
  }

  return getPrisma().integrationActionLog.create({
    data: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      connectionId: input.connectionId || null,
      source: input.source,
      actorUserId: input.actorUserId || null,
      automationFlowId: input.automationFlowId || null,
      actionId: input.actionId,
      riskLevel: input.riskLevel,
      inputSummaryJson: (input.inputSummary || undefined) as object | undefined,
      objectType: input.objectType || null,
      objectIdsJson: (input.objectIds || undefined) as object | undefined,
      contactId: input.contactId || null,
      approvalId: input.approvalId || null,
      policyJson: (input.policy || undefined) as object | undefined,
      idempotencyKey: input.idempotencyKey || null,
      reversible: Boolean(input.reversible),
      undoJson: (input.undoJson || undefined) as object | undefined,
      result: input.result || "queued",
    },
  });
}

export async function completeIntegrationActionLog(
  id: string,
  patch: {
    result: string;
    failureReason?: string | null;
    providerRequestId?: string | null;
    undoJson?: Record<string, unknown> | null;
    retryCount?: number;
  },
) {
  return getPrisma().integrationActionLog.update({
    where: { id },
    data: {
      result: patch.result,
      failureReason: patch.failureReason || null,
      providerRequestId: patch.providerRequestId || null,
      undoJson: (patch.undoJson || undefined) as object | undefined,
      retryCount: patch.retryCount,
      completedAt: new Date(),
    },
  });
}

export async function listIntegrationActionLogs(
  workspaceId: string,
  opts?: {
    provider?: string;
    source?: string;
    actionId?: string;
    status?: string;
    contactId?: string;
    limit?: number;
  },
) {
  return getPrisma().integrationActionLog.findMany({
    where: {
      workspaceId,
      ...(opts?.provider ? { provider: opts.provider } : {}),
      ...(opts?.source ? { source: opts.source } : {}),
      ...(opts?.actionId ? { actionId: opts.actionId } : {}),
      ...(opts?.status ? { result: opts.status } : {}),
      ...(opts?.contactId ? { contactId: opts.contactId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts?.limit || 100, 500),
  });
}
