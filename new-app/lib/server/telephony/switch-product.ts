import "server-only";

import type { NumberProduct } from "@/lib/numbers";
import { getPrisma } from "@/lib/server/db";
import { ensureWorkspaceReceptionistAgent } from "@/lib/server/receptionist/agent-store";
import { detectNumberProductBindings } from "@/lib/server/telephony/bindings";
import { parkCurrentIngressIfNeeded } from "@/lib/server/telephony/ingress-park";
import { routeNumberToMctbTexml, routeNumberToPhoneCallControl } from "@/lib/server/telephony/product-routes";
import { readLiveTelnyxConnectionId } from "@/lib/server/telephony/telnyx-number";
import {
  activateVoiceV3TelnyxIngress,
  prepareVoiceV3LiveKitDestination,
} from "@/lib/server/telephony/v3-receptionist-provision";
import { syncReceptionistDraftConnectionOnNumberSwitch } from "@/lib/server/receptionist/sync-draft-connection";
import {
  shouldUseIntegratedCapabilitySwitch,
  switchIntegratedPhoneCapabilities,
} from "@/lib/server/telephony/integrated-capabilities";

/** Carrier ingress change vs logical product binding (Phone + Ava can share one DID). */
export type IngressStrategy = "exclusive" | "shared_voice";

export type SwitchNumberProductInput = {
  workspaceId: string;
  phoneNumberId: string;
  targetProduct: NumberProduct;
  confirmSwitch: boolean;
  agentId?: string | null;
  /**
   * `shared_voice` (default): assign AI Receptionist on the number but preserve Phone
   * workspace routing fields (hours, ring group, overflow). Carrier ingress still moves
   * to LiveKit for Voice V3 when that is the active voice path.
   * `exclusive`: treat switch as single-product ingress ownership (MCTB TeXML, Call Control, etc.).
   */
  ingressStrategy?: IngressStrategy;
};

export type SwitchNumberProductResult = {
  ok: boolean;
  phoneNumberId: string;
  targetProduct: NumberProduct;
  ingressStrategy: IngressStrategy;
  previousBindings: { product: NumberProduct; detail: string }[];
  actions: string[];
  error?: string;
  needsConfirmation?: boolean;
  /** Set when targetProduct is receptionist and server draft/assignment were synced. */
  receptionist?: {
    agentId: string;
    phoneNumberId: string;
    e164: string;
  };
};

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
    updatedBy: "Numbers · shared voice assignment",
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

  return { actions: ["workspace_policy_merged_shared_voice"] };
}

/**
 * Safe switch sequence:
 * 1 read live Telnyx + bindings → 2 confirm → 3 park prior config → 4 prepare destination
 * → 5 Telnyx assign + verify (rollback on fail) → 6 commit DB bindings
 */
export async function switchNumberToProduct(
  input: SwitchNumberProductInput,
): Promise<SwitchNumberProductResult> {
  const ingressStrategy = input.ingressStrategy ?? "shared_voice";
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
      ingressStrategy,
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
      ingressStrategy,
      previousBindings: conflicts,
      actions,
      error: "SMS-only assignment does not change voice ingress — use Numbers settings",
    };
  }

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!phone?.e164) {
    return {
      ok: false,
      phoneNumberId: input.phoneNumberId,
      targetProduct: input.targetProduct,
      ingressStrategy,
      previousBindings: conflicts,
      actions,
      error: "Phone number not found",
    };
  }

  if (shouldUseIntegratedCapabilitySwitch(phone.settingsJson)) {
    return switchIntegratedPhoneCapabilities({
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
      targetProduct: input.targetProduct,
      agentId: input.agentId,
      e164: phone.e164,
      previousBindings: conflicts,
      ingressStrategy,
    });
  }

  const live = await readLiveTelnyxConnectionId({
    e164: phone.e164,
    providerNumberId: phone.providerNumberId,
  });
  actions.push("read_live_telnyx_connection");

  const routing = await prisma.workspaceCallRouting.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  const policySnapshot =
    routing?.policyJson && typeof routing.policyJson === "object"
      ? { ...(routing.policyJson as Record<string, unknown>) }
      : undefined;

  const park = await parkCurrentIngressIfNeeded({
    phoneNumberId: input.phoneNumberId,
    telnyxConnectionId: live.connectionId,
    workspacePolicySnapshot: policySnapshot,
  });
  actions.push(...park.actions);

  if (input.targetProduct === "receptionist") {
    const agent =
      input.agentId
        ? await prisma.voiceAgent.findFirst({
            where: { id: input.agentId, workspaceId: input.workspaceId },
            select: { id: true, publishedVersionId: true },
          })
        : await ensureWorkspaceReceptionistAgent(input.workspaceId);

    if (!agent?.id) {
      return {
        ok: false,
        phoneNumberId: input.phoneNumberId,
        targetProduct: input.targetProduct,
        ingressStrategy,
        previousBindings: conflicts,
        actions,
        error: "No AI Receptionist agent found for this workspace",
      };
    }

    const prepared = await prepareVoiceV3LiveKitDestination({
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
      agentId: agent.id,
      publishedVersionId: agent.publishedVersionId,
    });
    actions.push(...prepared.actions);

    const activated = await activateVoiceV3TelnyxIngress({
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
      agentId: agent.id,
      publishedVersionId: agent.publishedVersionId,
      prepared,
      e164: phone.e164,
    });
    actions.push(...activated.actions);

    if (!activated.ok) {
      return {
        ok: false,
        phoneNumberId: input.phoneNumberId,
        targetProduct: input.targetProduct,
        ingressStrategy,
        previousBindings: conflicts,
        actions,
        error: activated.error || "receptionist_provision_failed",
      };
    }

    if (ingressStrategy === "shared_voice") {
      const merged = await mergeWorkspacePolicyForSharedVoice({
        workspaceId: input.workspaceId,
        phoneNumberId: input.phoneNumberId,
        agentId: agent.id,
      });
      actions.push(...merged.actions);
    }

    await syncReceptionistDraftConnectionOnNumberSwitch(
      input.workspaceId,
      agent.id,
      input.phoneNumberId,
    );
    actions.push("receptionist_draft_and_phone_assignment_synced");

    return {
      ok: true,
      phoneNumberId: input.phoneNumberId,
      targetProduct: input.targetProduct,
      ingressStrategy,
      previousBindings: conflicts,
      actions,
      receptionist: {
        agentId: agent.id,
        phoneNumberId: input.phoneNumberId,
        e164: phone.e164,
      },
    };
  }

  if (input.targetProduct === "mctb") {
    const routed = await routeNumberToMctbTexml({
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
      priorConnectionId: live.connectionId,
    });
    actions.push(...routed.actions);
    return {
      ok: routed.ok,
      phoneNumberId: input.phoneNumberId,
      targetProduct: input.targetProduct,
      ingressStrategy,
      previousBindings: conflicts,
      actions,
      error: routed.error,
    };
  }

  if (input.targetProduct === "phone") {
    const routed = await routeNumberToPhoneCallControl({
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
      priorConnectionId: live.connectionId,
    });
    actions.push(...routed.actions);

    if (routed.ok) {
      const policy =
        routing?.policyJson && typeof routing.policyJson === "object"
          ? { ...(routing.policyJson as Record<string, unknown>) }
          : {};
      policy.numberId = input.phoneNumberId;
      policy.updatedAt = new Date().toISOString();
      policy.updatedBy = "Numbers · product switch";
      const policyJson = policy as object;
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
      actions.push("workspace_phone_policy_updated");
    }

    return {
      ok: routed.ok,
      phoneNumberId: input.phoneNumberId,
      targetProduct: input.targetProduct,
      ingressStrategy,
      previousBindings: conflicts,
      actions,
      error: routed.error,
    };
  }

  return {
    ok: false,
    phoneNumberId: input.phoneNumberId,
    targetProduct: input.targetProduct,
    ingressStrategy,
    previousBindings: conflicts,
    actions,
    error: "unsupported_product",
  };
}
