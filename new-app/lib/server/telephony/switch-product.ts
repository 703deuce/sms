import "server-only";

import type { NumberProduct } from "@/lib/numbers";
import { getPrisma } from "@/lib/server/db";
import { ensureWorkspaceReceptionistAgent } from "@/lib/server/receptionist/agent-store";
import { detectNumberProductBindings } from "@/lib/server/telephony/bindings";
import { routeNumberToMctbTexml, routeNumberToPhoneCallControl } from "@/lib/server/telephony/product-routes";
import { provisionVoiceV3ReceptionistIngress } from "@/lib/server/telephony/v3-receptionist-provision";

export type SwitchNumberProductInput = {
  workspaceId: string;
  phoneNumberId: string;
  targetProduct: NumberProduct;
  confirmSwitch: boolean;
  agentId?: string | null;
};

export type SwitchNumberProductResult = {
  ok: boolean;
  phoneNumberId: string;
  targetProduct: NumberProduct;
  previousBindings: { product: NumberProduct; detail: string }[];
  actions: string[];
  error?: string;
  needsConfirmation?: boolean;
};

export async function switchNumberToProduct(
  input: SwitchNumberProductInput,
): Promise<SwitchNumberProductResult> {
  const previousBindings = await detectNumberProductBindings({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
  });

  const conflicts = previousBindings.filter((b) => b.product !== input.targetProduct);
  if (conflicts.length > 0 && !input.confirmSwitch) {
    return {
      ok: false,
      phoneNumberId: input.phoneNumberId,
      targetProduct: input.targetProduct,
      previousBindings: conflicts,
      actions: [],
      needsConfirmation: true,
      error: "confirm_switch_required",
    };
  }

  const actions: string[] = [];

  if (input.targetProduct === "sms") {
    return {
      ok: false,
      phoneNumberId: input.phoneNumberId,
      targetProduct: input.targetProduct,
      previousBindings: conflicts,
      actions,
      error: "SMS-only assignment does not change voice ingress — use Numbers settings",
    };
  }

  if (input.targetProduct === "receptionist") {
    const agent =
      input.agentId
        ? await getPrisma().voiceAgent.findFirst({
            where: { id: input.agentId, workspaceId: input.workspaceId },
            select: { id: true, publishedVersionId: true },
          })
        : await ensureWorkspaceReceptionistAgent(input.workspaceId);

    if (!agent?.id) {
      return {
        ok: false,
        phoneNumberId: input.phoneNumberId,
        targetProduct: input.targetProduct,
        previousBindings: conflicts,
        actions,
        error: "No AI Receptionist agent found for this workspace",
      };
    }

    const provision = await provisionVoiceV3ReceptionistIngress({
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
      agentId: agent.id,
      publishedVersionId: agent.publishedVersionId,
    });
    actions.push(...provision.actions);
    if (!provision.ok) {
      return {
        ok: false,
        phoneNumberId: input.phoneNumberId,
        targetProduct: input.targetProduct,
        previousBindings: conflicts,
        actions,
        error: provision.error || "receptionist_provision_failed",
      };
    }

    await getPrisma().voiceAgentPhoneNumber.upsert({
      where: { agentId_phoneNumberId: { agentId: agent.id, phoneNumberId: input.phoneNumberId } },
      create: {
        workspaceId: input.workspaceId,
        agentId: agent.id,
        phoneNumberId: input.phoneNumberId,
        inboundEnabled: true,
        outboundEnabled: false,
        isDefault: true,
      },
      update: { inboundEnabled: true, isDefault: true },
    });

    return {
      ok: true,
      phoneNumberId: input.phoneNumberId,
      targetProduct: input.targetProduct,
      previousBindings: conflicts,
      actions,
    };
  }

  if (input.targetProduct === "mctb") {
    const routed = await routeNumberToMctbTexml({
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
    });
    actions.push(...routed.actions);
    return {
      ok: routed.ok,
      phoneNumberId: input.phoneNumberId,
      targetProduct: input.targetProduct,
      previousBindings: conflicts,
      actions,
      error: routed.error,
    };
  }

  if (input.targetProduct === "phone") {
    const routed = await routeNumberToPhoneCallControl({
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
    });
    actions.push(...routed.actions);

    const routing = await getPrisma().workspaceCallRouting.findUnique({
      where: { workspaceId: input.workspaceId },
    });
    const policy =
      routing?.policyJson && typeof routing.policyJson === "object"
        ? { ...(routing.policyJson as Record<string, unknown>) }
        : {};
    policy.numberId = input.phoneNumberId;
    policy.updatedAt = new Date().toISOString();
    policy.updatedBy = "Numbers · product switch";

    const policyJson = policy as object;
    await getPrisma().workspaceCallRouting.upsert({
      where: { workspaceId: input.workspaceId },
      create: {
        workspaceId: input.workspaceId,
        policyJson,
        providerSyncStatus: routed.ok ? "synced" : "error",
        providerSyncError: routed.ok ? null : routed.error,
        revision: 1,
      },
      update: {
        policyJson,
        providerSyncStatus: routed.ok ? "synced" : "error",
        providerSyncError: routed.ok ? null : routed.error,
        revision: (routing?.revision ?? 0) + 1,
      },
    });

    return {
      ok: routed.ok,
      phoneNumberId: input.phoneNumberId,
      targetProduct: input.targetProduct,
      previousBindings: conflicts,
      actions,
      error: routed.error,
    };
  }

  return {
    ok: false,
    phoneNumberId: input.phoneNumberId,
    targetProduct: input.targetProduct,
    previousBindings: conflicts,
    actions,
    error: "unsupported_product",
  };
}
