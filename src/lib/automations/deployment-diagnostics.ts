/**
 * Deployment diagnostics for agent primary workflows.
 * Surfaces whether failure is in flow generation, number, activation,
 * Telnyx routing, assistant launch, webhook correlation, or resume.
 */

import { getPrisma } from "@/lib/db";
import {
  extractTriggersFromDefinition,
  findTriggerConflicts,
} from "@/lib/automations/trigger-deployments";
import { parseAutomationDefinition } from "@/lib/automations/types";

export type DeploymentDiagnostics = {
  workflowId: string;
  workflowName: string;
  workflowStatus: string;
  ownershipKind: string | null;
  ownerAgentId: string | null;
  triggerNodeId: string | null;
  agentId: string | null;
  agentName: string | null;
  telnyxAssistantId: string | null;
  telnyxConnectionId: string | null;
  phoneNumberId: string | null;
  phoneE164: string | null;
  texmlApplicationOrConnection: string | null;
  publishedRoutingTarget: string | null;
  deploymentStatus: string | null;
  deploymentId: string | null;
  publishedConfigHash: string | null;
  lastPublishTime: string | null;
  lastProviderVerification: string | null;
  lastInboundTrigger: string | null;
  lastExecutionId: string | null;
  lastExecutionStatus: string | null;
  lastError: string | null;
  readiness: {
    phoneNumberRequired: boolean;
    phoneReady: boolean;
    assistantReady: boolean;
    triggerConfigured: boolean;
    conflicts: Array<{ message: string }>;
  };
  layers: {
    flowGeneration: "ok" | "missing" | "error";
    missingNumber: boolean;
    activationCompiler: "ok" | "draft" | "error" | "unknown";
    telnyxRouting: "ok" | "error" | "unknown";
    assistantLaunch: "ok" | "missing" | "unknown";
    webhookCorrelation: "ok" | "unknown";
    workflowResume: "ok" | "unknown";
  };
};

export async function getFlowDeploymentDiagnostics(
  workspaceId: string,
  flowId: string,
): Promise<DeploymentDiagnostics | null> {
  const prisma = getPrisma();
  const flow = await prisma.automationFlow.findFirst({
    where: { id: flowId, workspaceId },
  });
  if (!flow) return null;

  const def = parseAutomationDefinition(
    flow.publishedDefinition ?? flow.definition,
  );
  const triggers = extractTriggersFromDefinition(def);
  const inbound = triggers.find((t) => t.blockType === "inbound_call") || null;

  const runVoice = def.nodes.find(
    (n) => n.data.blockType === "run_voice_agent",
  );
  const agentId =
    String(runVoice?.data.config?.agentId || flow.ownerAgentId || "").trim() ||
    null;

  const [deployment, agent, phone, lastExec, lastInboundEvent, conflicts] =
    await Promise.all([
      inbound
        ? prisma.triggerDeployment.findFirst({
            where: { flowId, triggerNodeId: inbound.nodeId },
          })
        : null,
      agentId
        ? prisma.voiceAgent.findFirst({
            where: { id: agentId, workspaceId },
            select: {
              id: true,
              name: true,
              telnyxAssistantId: true,
              telnyxConnectionId: true,
              phoneNumberId: true,
              healthStatus: true,
              healthMessage: true,
            },
          })
        : null,
      inbound?.phoneNumberId
        ? prisma.phoneNumber.findFirst({
            where: { id: inbound.phoneNumberId, workspaceId },
            select: { id: true, e164: true },
          })
        : null,
      prisma.automationExecution.findFirst({
        where: { flowId, workspaceId },
        orderBy: { startedAt: "desc" },
        select: { id: true, status: true, error: true, startedAt: true },
      }),
      prisma.voiceCallEvent
        .findFirst({
          where: {
            workspaceId,
            eventType: "inbound.workflow_enrolled",
          },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, callId: true, payload: true },
        })
        .then((row: { createdAt: Date; callId: string; payload: unknown } | null) => {
          if (!row) return null;
          const payload = (row.payload || {}) as {
            enrollments?: Array<{ flowId?: string }>;
          };
          const match = (payload.enrollments || []).some(
            (e) => e.flowId === flowId,
          );
          return match || !payload.enrollments?.length
            ? { createdAt: row.createdAt, callId: row.callId }
            : null;
        })
        .catch(() => null),
      findTriggerConflicts(workspaceId, triggers, flowId),
    ]);

  const providerConfig = (deployment?.providerConfig || {}) as Record<
    string,
    unknown
  >;

  const phoneReady = Boolean(phone?.id);
  const assistantReady = Boolean(agent?.telnyxAssistantId);
  const deploymentStatus = deployment?.status || null;

  return {
    workflowId: flow.id,
    workflowName: flow.name,
    workflowStatus: flow.status,
    ownershipKind: flow.ownershipKind || null,
    ownerAgentId: flow.ownerAgentId || null,
    triggerNodeId: inbound?.nodeId || null,
    agentId: agent?.id || agentId,
    agentName: agent?.name || null,
    telnyxAssistantId: agent?.telnyxAssistantId || null,
    telnyxConnectionId: agent?.telnyxConnectionId || null,
    phoneNumberId: inbound?.phoneNumberId || phone?.id || null,
    phoneE164: phone?.e164 || null,
    texmlApplicationOrConnection:
      (typeof providerConfig.providerResourceId === "string"
        ? providerConfig.providerResourceId
        : null) ||
      agent?.telnyxConnectionId ||
      null,
    publishedRoutingTarget:
      typeof providerConfig.publishedRoutingTarget === "string"
        ? providerConfig.publishedRoutingTarget
        : deploymentStatus === "live"
          ? "texml_assistant"
          : null,
    deploymentStatus,
    deploymentId: deployment?.id || null,
    publishedConfigHash:
      typeof providerConfig.publishedConfigHash === "string"
        ? providerConfig.publishedConfigHash
        : null,
    lastPublishTime: deployment?.deployedAt?.toISOString() || null,
    lastProviderVerification:
      typeof providerConfig.lastVerifiedAt === "string"
        ? providerConfig.lastVerifiedAt
        : null,
    lastInboundTrigger: lastInboundEvent?.createdAt
      ? new Date(lastInboundEvent.createdAt).toISOString()
      : null,
    lastExecutionId: lastExec?.id || null,
    lastExecutionStatus: lastExec?.status || null,
    lastError:
      deployment?.errorMessage ||
      lastExec?.error ||
      agent?.healthMessage ||
      null,
    readiness: {
      phoneNumberRequired: Boolean(inbound) && !inbound?.phoneNumberId,
      phoneReady,
      assistantReady,
      triggerConfigured: Boolean(inbound?.phoneNumberId),
      conflicts: conflicts.map((c) => ({ message: c.message })),
    },
    layers: {
      flowGeneration: flow.id ? "ok" : "missing",
      missingNumber: Boolean(inbound) && !phoneReady,
      activationCompiler:
        deploymentStatus === "error"
          ? "error"
          : deploymentStatus === "live" || deploymentStatus === "test"
            ? "ok"
            : flow.status === "DRAFT"
              ? "draft"
              : "unknown",
      telnyxRouting:
        providerConfig.telnyxPublished === true
          ? "ok"
          : deploymentStatus === "error"
            ? "error"
            : "unknown",
      assistantLaunch: assistantReady
        ? "ok"
        : agentId
          ? "missing"
          : "unknown",
      webhookCorrelation: lastInboundEvent ? "ok" : "unknown",
      workflowResume: lastExec ? "ok" : "unknown",
    },
  };
}
