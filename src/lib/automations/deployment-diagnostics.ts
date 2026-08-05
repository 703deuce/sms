/**
 * Deployment diagnostics for agent primary workflows.
 * Surfaces whether failure is in flow generation, number, activation,
 * Telnyx routing, assistant launch, webhook correlation, or resume.
 *
 * Status meanings:
 * - ok: proven with real data (traffic, publish flag, etc.)
 * - ready: published path is configured but not yet proven by traffic
 * - unknown / missing / draft / error: not ready or failed
 */

import { getPrisma } from "@/lib/db";
import {
  extractTriggersFromDefinition,
  findTriggerConflicts,
} from "@/lib/automations/trigger-deployments";
import { parseAutomationDefinition } from "@/lib/automations/types";

export type LayerStatus =
  | "ok"
  | "ready"
  | "missing"
  | "error"
  | "draft"
  | "unknown";

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
    flowGeneration: LayerStatus;
    missingNumber: boolean;
    activationCompiler: LayerStatus;
    telnyxRouting: LayerStatus;
    assistantLaunch: LayerStatus;
    webhookCorrelation: LayerStatus;
    workflowResume: LayerStatus;
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

  const [deployment, agent, phoneFromTrigger, lastExec, lastInboundEvent, conflicts] =
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

  // Resolve phone: trigger id → agent DID → E164 on trigger config.
  let phone = phoneFromTrigger;
  if (!phone && agent?.phoneNumberId) {
    phone = await prisma.phoneNumber.findFirst({
      where: { id: agent.phoneNumberId, workspaceId },
      select: { id: true, e164: true },
    });
  }
  if (!phone) {
    const e164FromCfg = String(
      def.nodes.find((n) => n.data.blockType === "inbound_call")?.data.config
        ?.phoneNumberE164 || "",
    ).trim();
    if (e164FromCfg) {
      phone = await prisma.phoneNumber.findFirst({
        where: { workspaceId, e164: e164FromCfg },
        select: { id: true, e164: true },
      });
    }
  }

  const providerConfig = (deployment?.providerConfig || {}) as Record<
    string,
    unknown
  >;

  const cfgE164 = String(
    def.nodes.find((n) => n.data.blockType === "inbound_call")?.data.config
      ?.phoneNumberE164 || "",
  ).trim();

  const phoneReady = Boolean(phone?.id || phone?.e164 || cfgE164);
  const assistantReady = Boolean(agent?.telnyxAssistantId);
  const deploymentStatus = deployment?.status || null;
  const telnyxPublished = providerConfig.telnyxPublished === true;
  const liveDeploy =
    deploymentStatus === "live" || deploymentStatus === "test";
  const flowLive = flow.status === "ACTIVE";

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
    phoneNumberId:
      inbound?.phoneNumberId || phone?.id || agent?.phoneNumberId || null,
    phoneE164: phone?.e164 || cfgE164 || null,
    texmlApplicationOrConnection:
      (typeof providerConfig.providerResourceId === "string"
        ? providerConfig.providerResourceId
        : null) ||
      agent?.telnyxConnectionId ||
      null,
    publishedRoutingTarget:
      typeof providerConfig.publishedRoutingTarget === "string"
        ? providerConfig.publishedRoutingTarget
        : liveDeploy
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
      phoneNumberRequired: Boolean(inbound) && !phoneReady,
      phoneReady,
      assistantReady,
      triggerConfigured: Boolean(
        inbound?.phoneNumberId || cfgE164 || agent?.phoneNumberId,
      ),
      conflicts: conflicts.map((c) => ({ message: c.message })),
    },
    layers: {
      flowGeneration: def.nodes.length >= 3 ? "ok" : "missing",
      missingNumber: Boolean(inbound) && !phoneReady,
      activationCompiler:
        deploymentStatus === "error"
          ? "error"
          : liveDeploy
            ? "ok"
            : flowLive && !deployment
              ? "error"
              : flow.status === "DRAFT"
                ? "draft"
                : "unknown",
      telnyxRouting: telnyxPublished
        ? "ok"
        : liveDeploy && assistantReady
          ? "ready"
          : deploymentStatus === "error"
            ? "error"
            : "unknown",
      assistantLaunch: assistantReady
        ? "ok"
        : agentId
          ? "missing"
          : "unknown",
      // ok = real inbound enroll; ready = live path waiting for first call
      webhookCorrelation: lastInboundEvent
        ? "ok"
        : liveDeploy && assistantReady
          ? "ready"
          : "unknown",
      workflowResume: lastExec
        ? "ok"
        : liveDeploy && assistantReady
          ? "ready"
          : "unknown",
    },
  };
}
