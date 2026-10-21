import "server-only";

import { getPrisma } from "@/lib/server/db";
import { ensureWorkspaceReceptionistAgent } from "@/lib/server/receptionist/agent-store";
import { syncReceptionistDraftConnectionOnNumberSwitch } from "@/lib/server/receptionist/sync-draft-connection";
import {
  isPhoneFoundationIngress,
  mergeTelephonySettingsPatch,
} from "@/lib/server/telephony/integrated-phone-ingress";
import { prepareLiveKitHandoffResources } from "@/lib/server/telephony/v3-receptionist-provision";
import type { NumberProduct } from "@/lib/numbers";
import type { SwitchNumberProductResult } from "@/lib/server/telephony/switch-product";

async function mergeWorkspacePolicyForSharedVoice(input: {
  workspaceId: string;
  phoneNumberId: string;
  agentId: string;
}): Promise<{ actions: string[] }> {
  const prisma = getPrisma();
  const routing = await prisma.workspaceCallRouting.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  const policy =
    routing?.policyJson && typeof routing.policyJson === "object"
      ? { ...(routing.policyJson as Record<string, unknown>) }
      : {};

  const merged = {
    ...policy,
    numberId: input.phoneNumberId,
    receptionistAgentId: input.agentId,
    aiCoverage: policy.aiCoverage ?? "overflow",
    updatedAt: new Date().toISOString(),
    updatedBy: "Numbers · phone foundation",
  };

  const policyJson = merged as object;
  await prisma.workspaceCallRouting.upsert({
    where: { workspaceId: input.workspaceId },
    create: {
      workspaceId: input.workspaceId,
      policyJson,
      providerSyncStatus: "synced",
      revision: 1,
    },
    update: {
      policyJson,
      providerSyncStatus: "synced",
      providerSyncError: null,
      revision: (routing?.revision ?? 0) + 1,
    },
  });

  return { actions: ["workspace_policy_merged_phone_foundation"] };
}

async function assignReceptionistCapability(input: {
  workspaceId: string;
  phoneNumberId: string;
  agentId?: string | null;
  e164: string;
}): Promise<{ ok: boolean; actions: string[]; error?: string; agentId?: string }> {
  const prisma = getPrisma();
  const actions: string[] = [];

  const agent =
    input.agentId
      ? await prisma.voiceAgent.findFirst({
          where: { id: input.agentId, workspaceId: input.workspaceId },
          select: { id: true, publishedVersionId: true },
        })
      : await ensureWorkspaceReceptionistAgent(input.workspaceId);

  if (!agent?.id) {
    return { ok: false, actions, error: "No AI Receptionist agent found for this workspace" };
  }

  const prepared = await prepareLiveKitHandoffResources({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
    agentId: agent.id,
    publishedVersionId: agent.publishedVersionId,
  });
  actions.push(...prepared.actions);
  if (!prepared.ok) {
    return { ok: false, actions, error: prepared.error || "livekit_handoff_prepare_failed" };
  }

  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { settingsJson: true },
  });

  await prisma.phoneNumber.update({
    where: { id: input.phoneNumberId },
    data: {
      settingsJson: mergeTelephonySettingsPatch(phone?.settingsJson, {
        ingressModel: "phone_foundation",
        telephony: {
          routingMode: "telnyx_call_control",
          state: "active",
          livekitInboundTrunkId: prepared.trunkId,
          livekitDidDispatchRuleId: prepared.dispatchRuleId,
        },
        liveKitHandoff: {
          trunkId: prepared.trunkId,
          dispatchRuleId: prepared.dispatchRuleId,
          fqdnConnectionId: prepared.connectionId,
        },
      }) as object,
    },
  });
  actions.push("livekit_handoff_resources_persisted");

  const existingLink = await prisma.voiceAgentPhoneNumber.findFirst({
    where: { workspaceId: input.workspaceId, phoneNumberId: input.phoneNumberId },
  });
  if (existingLink) {
    await prisma.voiceAgentPhoneNumber.update({
      where: { id: existingLink.id },
      data: { agentId: agent.id, inboundEnabled: true },
    });
  } else {
    await prisma.voiceAgentPhoneNumber.create({
      data: {
        workspaceId: input.workspaceId,
        phoneNumberId: input.phoneNumberId,
        agentId: agent.id,
        inboundEnabled: true,
      },
    });
  }
  actions.push("voice_agent_phone_assignment");

  const merged = await mergeWorkspacePolicyForSharedVoice({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
    agentId: agent.id,
  });
  actions.push(...merged.actions);

  await syncReceptionistDraftConnectionOnNumberSwitch(
    input.workspaceId,
    agent.id,
    input.phoneNumberId,
  );
  actions.push("receptionist_draft_synced");

  return { ok: true, actions, agentId: agent.id };
}

async function assignMctbCapability(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<{ ok: boolean; actions: string[] }> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { settingsJson: true },
  });
  if (!phone) return { ok: false, actions: [] };

  await prisma.phoneNumber.update({
    where: { id: input.phoneNumberId },
    data: {
      settingsJson: mergeTelephonySettingsPatch(phone.settingsJson, {
        ingressModel: "phone_foundation",
        mctbInbound: { enabled: true },
      }) as object,
    },
  });

  const routing = await prisma.workspaceCallRouting.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  const policy =
    routing?.policyJson && typeof routing.policyJson === "object"
      ? { ...(routing.policyJson as Record<string, unknown>) }
      : {};
  policy.numberId = input.phoneNumberId;
  policy.mctbEnabled = true;
  policy.updatedAt = new Date().toISOString();
  await prisma.workspaceCallRouting.upsert({
    where: { workspaceId: input.workspaceId },
    create: {
      workspaceId: input.workspaceId,
      policyJson: policy as object,
      providerSyncStatus: "synced",
      revision: 1,
    },
    update: {
      policyJson: policy as object,
      providerSyncStatus: "synced",
      revision: (routing?.revision ?? 0) + 1,
    },
  });

  return { ok: true, actions: ["mctb_capability_enabled_no_carrier_change"] };
}

/**
 * Feature toggles on phone_foundation numbers — never repoint Telnyx connection_id.
 */
export async function switchIntegratedPhoneCapabilities(input: {
  workspaceId: string;
  phoneNumberId: string;
  targetProduct: NumberProduct;
  agentId?: string | null;
  e164: string;
  previousBindings: SwitchNumberProductResult["previousBindings"];
  ingressStrategy: SwitchNumberProductResult["ingressStrategy"];
}): Promise<SwitchNumberProductResult> {
  const actions: string[] = ["integrated_capability_switch"];
  actions.push("telnyx_connection_unchanged");

  if (input.targetProduct === "receptionist") {
    const assigned = await assignReceptionistCapability({
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
      agentId: input.agentId,
      e164: input.e164,
    });
    actions.push(...assigned.actions);
    if (!assigned.ok || !assigned.agentId) {
      return {
        ok: false,
        phoneNumberId: input.phoneNumberId,
        targetProduct: input.targetProduct,
        ingressStrategy: input.ingressStrategy,
        previousBindings: input.previousBindings,
        actions,
        error: assigned.error,
      };
    }
    return {
      ok: true,
      phoneNumberId: input.phoneNumberId,
      targetProduct: input.targetProduct,
      ingressStrategy: input.ingressStrategy,
      previousBindings: input.previousBindings,
      actions,
      receptionist: {
        agentId: assigned.agentId,
        phoneNumberId: input.phoneNumberId,
        e164: input.e164,
      },
    };
  }

  if (input.targetProduct === "mctb") {
    const mctb = await assignMctbCapability({
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
    });
    actions.push(...mctb.actions);
    return {
      ok: mctb.ok,
      phoneNumberId: input.phoneNumberId,
      targetProduct: input.targetProduct,
      ingressStrategy: input.ingressStrategy,
      previousBindings: input.previousBindings,
      actions,
    };
  }

  if (input.targetProduct === "phone") {
    actions.push("phone_capability_already_on_call_control");
    return {
      ok: true,
      phoneNumberId: input.phoneNumberId,
      targetProduct: input.targetProduct,
      ingressStrategy: input.ingressStrategy,
      previousBindings: input.previousBindings,
      actions,
    };
  }

  return {
    ok: false,
    phoneNumberId: input.phoneNumberId,
    targetProduct: input.targetProduct,
    ingressStrategy: input.ingressStrategy,
    previousBindings: input.previousBindings,
    actions,
    error: "unsupported_product",
  };
}

export function shouldUseIntegratedCapabilitySwitch(settingsJson: unknown): boolean {
  return isPhoneFoundationIngress(settingsJson);
}
