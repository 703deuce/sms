import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import type { IntegrationActionId } from "./actions-registry";
import { getActionCapabilityTruth } from "./capability-truth";
import {
  buildActionPreview,
  classifyActionRisk,
  evaluateActionPolicy,
  hashActionPayload,
  type ActionPreview,
} from "./ai-policy";
import type { ExternalProviderId } from "./types";
import { isExternalProvider } from "./registry";

const APPROVAL_TTL_MS = 15 * 60 * 1000;

/**
 * AI must never call provider adapters directly.
 * Path: intent → capability → permission → policy → preview → approval → queue → adapter → audit.
 */
export async function requestAiIntegrationAction(input: {
  workspaceId: string;
  userId: string;
  role?: string | null;
  provider: string;
  actionId: IntegrationActionId | string;
  params: Record<string, unknown>;
  contactId?: string | null;
  contactLabel?: string | null;
  connectionId?: string | null;
  connectedAccount?: string | null;
  recordCount?: number;
}): Promise<
  | {
      status: "preview";
      requiresApproval: true;
      riskLevel: number;
      preview: ActionPreview;
      approvalId: string;
      payloadHash: string;
      expiresAt: string;
    }
  | {
      status: "queued";
      requiresApproval: false;
      riskLevel: number;
      preview: ActionPreview;
      jobEnqueued: true;
      payloadHash: string;
    }
  | { status: "rejected"; code: string; message: string; riskLevel: number; preview?: ActionPreview }
> {
  if (!isExternalProvider(input.provider)) {
    return {
      status: "rejected",
      code: "UNKNOWN_PROVIDER",
      message: `Provider ${input.provider} is not a native integration`,
      riskLevel: 3,
    };
  }

  const provider = input.provider as ExternalProviderId;
  const actionId = input.actionId as IntegrationActionId;
  const truth = getActionCapabilityTruth(provider, actionId);
  const riskLevel = classifyActionRisk(actionId, { recordCount: input.recordCount });
  const payloadHash = hashActionPayload({
    provider,
    actionId,
    params: input.params,
    contactId: input.contactId || null,
  });
  const preview = buildActionPreview({
    actionId,
    provider,
    connectedAccount: input.connectedAccount,
    params: input.params,
    contactId: input.contactId,
    contactLabel: input.contactLabel,
    riskLevel,
  });

  if (!truth.supported) {
    return {
      status: "rejected",
      code: "CAPABILITY",
      message: truth.reason || "Unsupported",
      riskLevel,
      preview: {
        ...preview,
        limitations: [truth.reason || "Unsupported", truth.reconnectHint || ""].filter(Boolean),
      },
    };
  }

  const policy = await evaluateActionPolicy({
    workspaceId: input.workspaceId,
    provider,
    actionId,
    source: "ai",
    role: input.role,
    recordCount: input.recordCount || 1,
  });

  if (!policy.allowed) {
    if (policy.code === "APPROVAL_REQUIRED") {
      const approval = await getPrisma().aiActionApproval.create({
        data: {
          workspaceId: input.workspaceId,
          requestedByUserId: input.userId,
          provider,
          connectionId: input.connectionId || null,
          actionId,
          payloadHash,
          payloadJson: {
            params: input.params,
            contactId: input.contactId || null,
          } as object,
          riskLevel,
          status: "pending",
          expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
          previewJson: preview as object,
        },
      });
      return {
        status: "preview",
        requiresApproval: true,
        riskLevel,
        preview,
        approvalId: approval.id,
        payloadHash,
        expiresAt: approval.expiresAt.toISOString(),
      };
    }
    return {
      status: "rejected",
      code: policy.code,
      message: policy.message,
      riskLevel: policy.riskLevel,
      preview,
    };
  }

  if (policy.requiresApproval) {
    const approval = await getPrisma().aiActionApproval.create({
      data: {
        workspaceId: input.workspaceId,
        requestedByUserId: input.userId,
        provider,
        connectionId: input.connectionId || null,
        actionId,
        payloadHash,
        payloadJson: {
          params: input.params,
          contactId: input.contactId || null,
        } as object,
        riskLevel,
        status: "pending",
        expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
        previewJson: preview as object,
      },
    });
    return {
      status: "preview",
      requiresApproval: true,
      riskLevel,
      preview,
      approvalId: approval.id,
      payloadHash,
      expiresAt: approval.expiresAt.toISOString(),
    };
  }

  await enqueueJob({
    jobType: "integration_action",
    queueName: `ext-${provider}`,
    workspaceId: input.workspaceId,
    priority: 20,
    payload: JSON.parse(
      JSON.stringify({
        workspaceId: input.workspaceId,
        provider,
        actionId,
        params: input.params,
        contactId: input.contactId || null,
        actorUserId: input.userId,
        source: "ai",
        payloadHash,
      }),
    ),
    idempotencyKey: `ai-act-${payloadHash.slice(0, 32)}`,
  });

  return {
    status: "queued",
    requiresApproval: false,
    riskLevel,
    preview,
    jobEnqueued: true,
    payloadHash,
  };
}

export async function approveAiIntegrationAction(input: {
  workspaceId: string;
  approvalId: string;
  approverUserId: string;
  decision: "approved" | "rejected";
}) {
  const prisma = getPrisma();
  const approval = await prisma.aiActionApproval.findFirst({
    where: { id: input.approvalId, workspaceId: input.workspaceId },
  });
  if (!approval) return { ok: false as const, code: "NOT_FOUND", message: "Approval not found" };
  if (approval.status !== "pending") {
    return { ok: false as const, code: "INVALID_STATUS", message: `Status is ${approval.status}` };
  }
  if (approval.expiresAt.getTime() < Date.now()) {
    await prisma.aiActionApproval.update({
      where: { id: approval.id },
      data: { status: "expired" },
    });
    return { ok: false as const, code: "APPROVAL_EXPIRED", message: "Approval expired" };
  }

  if (input.decision === "rejected") {
    await prisma.aiActionApproval.update({
      where: { id: approval.id },
      data: { status: "rejected", approverUserId: input.approverUserId, approvedAt: new Date() },
    });
    return { ok: true as const, status: "rejected" as const };
  }

  await prisma.aiActionApproval.update({
    where: { id: approval.id },
    data: { status: "approved", approverUserId: input.approverUserId, approvedAt: new Date() },
  });

  const payload = (approval.payloadJson || {}) as {
    params?: Record<string, unknown>;
    contactId?: string | null;
  };

  await enqueueJob({
    jobType: "integration_action",
    queueName: `ext-${approval.provider}`,
    workspaceId: input.workspaceId,
    priority: 20,
    payload: JSON.parse(
      JSON.stringify({
        workspaceId: input.workspaceId,
        provider: approval.provider,
        actionId: approval.actionId,
        params: payload.params || {},
        contactId: payload.contactId || null,
        actorUserId: input.approverUserId,
        source: "ai",
        approvalId: approval.id,
        payloadHash: approval.payloadHash,
      }),
    ),
    idempotencyKey: `ai-act-appr-${approval.id}`,
  });

  await prisma.aiActionApproval.update({
    where: { id: approval.id },
    data: { status: "consumed" },
  });

  return { ok: true as const, status: "queued" as const };
}
