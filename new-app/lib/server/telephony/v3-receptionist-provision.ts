import "server-only";

import { getPrisma } from "@/lib/server/db";
import {
  ensureCanonicalV3SharedDispatchRule,
  pruneObsoleteDispatchRules,
} from "@/lib/server/receptionist/livekit/canonical-dispatch";
import { ensureInboundTrunkForNumber } from "@/lib/server/telephony/livekit-inbound";
import { applyTelnyxConnectionWithVerify } from "@/lib/server/telephony/telnyx-route-safe";
import {
  ensureTelnyxLiveKitFqdnConnection,
} from "@/lib/server/telephony/telnyx-livekit-fqdn";
import { readLiveTelnyxConnectionId } from "@/lib/server/telephony/telnyx-number";
import { writeTelephonyProvision } from "@/lib/server/telephony/telephony-record";

export type V3ReceptionistProvisionResult = {
  ok: boolean;
  phoneNumberId: string;
  e164: string;
  actions: string[];
  error?: string;
};

export type PreparedLiveKitDestination = {
  ok: boolean;
  connectionId: string;
  fqdnId: string;
  trunkId: string;
  dispatchRuleId: string;
  priorTelnyxConnectionId: string | null;
  providerNumberId: string;
  actions: string[];
  error?: string;
};

function buildPreparedLiveKitDestinationOk(input: {
  connectionId: string;
  fqdnId: string;
  trunkId: string;
  dispatchRuleId: string;
  priorTelnyxConnectionId: string | null;
  providerNumberId: string;
  actions: string[];
}): PreparedLiveKitDestination {
  return {
    ok: true,
    connectionId: input.connectionId,
    fqdnId: input.fqdnId,
    trunkId: input.trunkId,
    dispatchRuleId: input.dispatchRuleId,
    priorTelnyxConnectionId: input.priorTelnyxConnectionId,
    providerNumberId: input.providerNumberId,
    actions: input.actions,
  };
}

/**
 * LiveKit trunk + dispatch for Phone Call Control handoff — does not change Telnyx DID ingress.
 */
export async function prepareLiveKitHandoffResources(input: {
  workspaceId: string;
  phoneNumberId: string;
  agentId: string;
  publishedVersionId?: string | null;
}): Promise<PreparedLiveKitDestination> {
  return prepareVoiceV3LiveKitDestinationCore(input, { persistExclusiveIngress: false });
}

export async function prepareVoiceV3LiveKitDestination(input: {
  workspaceId: string;
  phoneNumberId: string;
  agentId: string;
  publishedVersionId?: string | null;
}): Promise<PreparedLiveKitDestination> {
  return prepareVoiceV3LiveKitDestinationCore(input, { persistExclusiveIngress: true });
}

/**
 * Steps 3–4 (prepare): LiveKit trunk + per-DID dispatch + FQDN connection record — no Telnyx number reroute yet.
 */
async function prepareVoiceV3LiveKitDestinationCore(
  input: {
    workspaceId: string;
    phoneNumberId: string;
    agentId: string;
    publishedVersionId?: string | null;
  },
  options?: { persistExclusiveIngress?: boolean },
): Promise<PreparedLiveKitDestination> {
  const persistExclusiveIngress = options?.persistExclusiveIngress !== false;
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  const actions: string[] = [];
  if (!phone?.e164) {
    return {
      ok: false,
      connectionId: "",
      fqdnId: "",
      trunkId: "",
      dispatchRuleId: "",
      priorTelnyxConnectionId: null,
      providerNumberId: "",
      actions,
      error: "Phone number not found",
    };
  }
  if (String(phone.provider || "").toLowerCase() !== "telnyx") {
    return {
      ok: false,
      connectionId: "",
      fqdnId: "",
      trunkId: "",
      dispatchRuleId: "",
      priorTelnyxConnectionId: null,
      providerNumberId: "",
      actions,
      error: "Voice ingress requires a Telnyx-owned number",
    };
  }

  try {
    const live = await readLiveTelnyxConnectionId({
      e164: phone.e164,
      providerNumberId: phone.providerNumberId,
    });
    actions.push("read_live_telnyx_connection");

    const { connectionId, fqdnId, actions: fqdnActions } =
      await ensureTelnyxLiveKitFqdnConnection();
    actions.push(...fqdnActions);

    const { trunk, actions: trunkActions } = await ensureInboundTrunkForNumber(phone.e164);
    actions.push(...trunkActions);
    const trunkId = trunk.sipTrunkId || "";
    if (!trunkId) throw new Error("LiveKit inbound trunk id missing");

    const dispatch = await ensureCanonicalV3SharedDispatchRule({ trunkId });
    actions.push(...dispatch.actions);
    const pruned = await pruneObsoleteDispatchRules({
      keepRuleId: dispatch.ruleId,
      dryRun: false,
    });
    actions.push(...pruned.actions);

    if (persistExclusiveIngress) {
      await writeTelephonyProvision(phone.id, {
        routingMode: "livekit_sip",
        state: "provisioning",
        telnyxFqdnConnectionId: connectionId,
        telnyxFqdnId: fqdnId,
        livekitInboundTrunkId: trunkId,
        livekitDidDispatchRuleId: dispatch.ruleId,
        lastError: null,
      });
    } else {
      actions.push("skipped_exclusive_ingress_telephony_write");
    }

    return buildPreparedLiveKitDestinationOk({
      connectionId,
      fqdnId,
      trunkId,
      dispatchRuleId: dispatch.ruleId,
      priorTelnyxConnectionId: live.connectionId,
      providerNumberId: live.providerNumberId,
      actions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      connectionId: "",
      fqdnId: "",
      trunkId: "",
      dispatchRuleId: "",
      priorTelnyxConnectionId: null,
      providerNumberId: "",
      actions,
      error: message,
    };
  }
}

/**
 * Steps 5–6: Telnyx reroute + verify (rollback on failure). Step 7: commit active telephony record.
 */
export async function activateVoiceV3TelnyxIngress(input: {
  workspaceId: string;
  phoneNumberId: string;
  agentId: string;
  publishedVersionId?: string | null;
  prepared: PreparedLiveKitDestination;
  e164: string;
}): Promise<V3ReceptionistProvisionResult> {
  const actions = [...input.prepared.actions];
  if (!input.prepared.ok) {
    return {
      ok: false,
      phoneNumberId: input.phoneNumberId,
      e164: input.e164,
      actions,
      error: input.prepared.error || "prepare_failed",
    };
  }

  const routed = await applyTelnyxConnectionWithVerify({
    e164: input.e164,
    providerNumberId: input.prepared.providerNumberId,
    targetConnectionId: input.prepared.connectionId,
    priorConnectionId: input.prepared.priorTelnyxConnectionId,
  });
  actions.push(...routed.actions);

  if (!routed.ok) {
    await writeTelephonyProvision(input.phoneNumberId, {
      routingMode: "livekit_sip",
      state: "error",
      lastError: routed.error || "telnyx_route_failed",
    });
    return {
      ok: false,
      phoneNumberId: input.phoneNumberId,
      e164: input.e164,
      actions,
      error: routed.error,
    };
  }

  const prisma = getPrisma();
  if (routed.providerNumberId) {
    await prisma.phoneNumber.update({
      where: { id: input.phoneNumberId },
      data: { providerNumberId: routed.providerNumberId },
    });
  }

  await writeTelephonyProvision(input.phoneNumberId, {
    routingMode: "livekit_sip",
    state: "active",
    telnyxFqdnConnectionId: input.prepared.connectionId,
    telnyxFqdnId: input.prepared.fqdnId,
    telnyxConnectionId: input.prepared.connectionId,
    livekitInboundTrunkId: input.prepared.trunkId,
    livekitDidDispatchRuleId: input.prepared.dispatchRuleId,
    lastVerifiedAt: new Date().toISOString(),
    lastError: null,
  });

  return {
    ok: true,
    phoneNumberId: input.phoneNumberId,
    e164: input.e164,
    actions,
  };
}

/** Full golden-era Voice V3 ingress with safe Telnyx sequencing. */
export async function provisionVoiceV3ReceptionistIngress(input: {
  workspaceId: string;
  phoneNumberId: string;
  agentId: string;
  publishedVersionId?: string | null;
}): Promise<V3ReceptionistProvisionResult> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { e164: true },
  });
  if (!phone?.e164) {
    return {
      ok: false,
      phoneNumberId: input.phoneNumberId,
      e164: "",
      actions: [],
      error: "Phone number not found",
    };
  }

  const prepared = await prepareVoiceV3LiveKitDestination(input);
  return activateVoiceV3TelnyxIngress({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
    agentId: input.agentId,
    publishedVersionId: input.publishedVersionId,
    prepared,
    e164: phone.e164,
  });
}
