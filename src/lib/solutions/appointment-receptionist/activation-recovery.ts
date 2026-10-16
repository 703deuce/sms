import "server-only";

import { getPrisma } from "@/lib/db";
import { parseAutomationDefinition } from "@/lib/automations/types";
import { extractTriggersFromDefinition } from "@/lib/automations/trigger-deployments";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { isAppointmentReceptionistAgent } from "@/lib/voice-v3/config/from-published-agent";
import { reconcileAppointmentReceptionistLiveKit } from "@/lib/voice-v3/receptionist-livekit-provisioning";

export type ReceptionistActivationRecoveryResult = {
  recovered: boolean;
  steps: string[];
  error?: string;
  triggerDeployments?: Array<{ id: string; triggerNodeId: string; status: string }>;
};

/**
 * Finish activation when publish/LiveKit already succeeded but workflow or call-handling
 * steps failed (retry-safe; reuses reconcile + setActiveCallHandler).
 */
export async function recoverIncompleteReceptionistActivation(input: {
  workspaceId: string;
  agentId: string;
  primaryFlowId: string;
  phoneNumberId: string;
  userId?: string | null;
}): Promise<ReceptionistActivationRecoveryResult> {
  const steps: string[] = [];
  const prisma = getPrisma();

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: {
      id: true,
      status: true,
      publishedVersionId: true,
      draftConfig: true,
    },
  });
  if (!agent?.publishedVersionId || agent.status !== "ACTIVE") {
    return { recovered: false, steps, error: "agent_not_active_published" };
  }

  const flow = await prisma.automationFlow.findFirst({
    where: { id: input.primaryFlowId, workspaceId: input.workspaceId },
    select: { id: true, status: true, definition: true, version: true },
  });
  if (!flow) {
    return { recovered: false, steps, error: "flow_not_found" };
  }
  if (flow.status === "ACTIVE") {
    return { recovered: true, steps: ["workflow_already_active"] };
  }

  const versionRow = await prisma.voiceAgentVersion.findFirst({
    where: { id: agent.publishedVersionId, workspaceId: input.workspaceId },
    select: { config: true },
  });
  const publishedConfig = versionRow?.config
    ? parseVoiceAgentConfig(versionRow.config)
    : parseVoiceAgentConfig(agent.draftConfig);
  if (!isAppointmentReceptionistAgent(publishedConfig)) {
    return { recovered: false, steps, error: "not_receptionist_agent" };
  }

  const def = parseAutomationDefinition(flow.definition);
  const triggers = extractTriggersFromDefinition(def);
  const inbound =
    triggers.find(
      (t) =>
        t.blockType === "inbound_call" &&
        t.phoneNumberId &&
        t.phoneNumberId === input.phoneNumberId,
    ) ||
    triggers.find((t) => t.blockType === "inbound_call" && t.phoneNumberId);
  if (!inbound?.phoneNumberId) {
    return { recovered: false, steps, error: "inbound_trigger_missing" };
  }
  const routingPhoneNumberId = input.phoneNumberId || inbound.phoneNumberId;

  const deployment = await prisma.triggerDeployment.findFirst({
    where: { flowId: input.primaryFlowId, triggerNodeId: inbound.nodeId },
    select: { id: true, status: true, providerConfig: true, errorMessage: true },
  });

  const providerConfig = (deployment?.providerConfig || {}) as Record<string, unknown>;
  const publishProof =
    deployment?.status === "live" ||
    providerConfig.telnyxPublished === true ||
    (agent.status === "ACTIVE" && Boolean(agent.publishedVersionId));

  if (!publishProof) {
    return { recovered: false, steps, error: "publish_not_proven" };
  }

  steps.push("reconcile_livekit");
  const lk = await reconcileAppointmentReceptionistLiveKit({
    workspaceId: input.workspaceId,
    phoneNumberId: routingPhoneNumberId,
    agentId: input.agentId,
    publishedVersionId: agent.publishedVersionId,
    publishedConfig,
    configOnly: false,
  });
  if (!lk.ok) {
    return {
      recovered: false,
      steps,
      error: lk.error || "livekit_reconcile_failed",
    };
  }

  steps.push("set_active_call_handler");
  const { setActiveCallHandler } = await import("@/lib/call-handling/set-active-call-handler");
  await setActiveCallHandler({
    workspaceId: input.workspaceId,
    voiceIngressPhoneNumberId: routingPhoneNumberId,
    handler: "ai_receptionist",
    userId: input.userId ?? null,
  });

  if (deployment && deployment.status !== "live") {
    steps.push("repair_trigger_deployment");
    const livekitProvision = { ok: true, provision: lk.provision };
    const publishedConfigHash = [
      inbound.phoneNumberId,
      input.agentId,
      lk.provision?.livekitInboundTrunkId || "livekit_sip",
      inbound.eventType,
    ].join(":");

    await prisma.triggerDeployment.update({
      where: { id: deployment.id },
      data: {
        status: "live",
        errorMessage: null,
        deployedAt: deployment.status === "live" ? undefined : new Date(),
        providerConfig: {
          ...providerConfig,
          provider: "livekit",
          channel: "voice",
          telnyxPublished: true,
          voiceAgentId: input.agentId,
          providerResourceId:
            lk.provision?.livekitInboundTrunkId || "livekit_sip",
          publishedConfigHash,
          publishedRoutingTarget: "livekit_sip",
          lastRecoveredAt: new Date().toISOString(),
          livekitProvision,
        } as object,
        updatedAt: new Date(),
      },
    });
  }

  steps.push("activate_workflow");
  const newVersion = Math.max(1, (flow.version || 0) + 1);
  await prisma.automationFlow.update({
    where: { id: input.primaryFlowId },
    data: {
      status: "ACTIVE",
      version: newVersion,
      publishedDefinition: flow.definition as object,
      publishedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const { VOICE_AGENT_HEALTH_OK } = await import("@/lib/voice/agent-health-status");
  await prisma.voiceAgent.update({
    where: { id: input.agentId },
    data: { healthStatus: VOICE_AGENT_HEALTH_OK, healthMessage: null },
  });

  const deployments = deployment
    ? [{ id: deployment.id, triggerNodeId: inbound.nodeId, status: "live" }]
    : [];

  return { recovered: true, steps, triggerDeployments: deployments };
}
