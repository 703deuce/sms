import "server-only";

import { getPrisma } from "@/lib/server/db";
import { syncReceptionistDidDispatchRule } from "@/lib/server/receptionist/livekit/dispatch-sync";
import {
  ensureInboundTrunkForNumber,
} from "@/lib/server/telephony/livekit-inbound";
import {
  ensureTelnyxLiveKitFqdnConnection,
  routeTelnyxNumberToConnection,
} from "@/lib/server/telephony/telnyx-livekit-fqdn";
import { writeTelephonyProvision } from "@/lib/server/telephony/telephony-record";

export type V3ReceptionistProvisionResult = {
  ok: boolean;
  phoneNumberId: string;
  e164: string;
  actions: string[];
  error?: string;
};

/**
 * Golden-era Voice V3 ingress: Telnyx FQDN → LiveKit shared inbound trunk → per-DID dispatch → DB.
 */
export async function provisionVoiceV3ReceptionistIngress(input: {
  workspaceId: string;
  phoneNumberId: string;
  agentId: string;
  publishedVersionId?: string | null;
}): Promise<V3ReceptionistProvisionResult> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
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
  if (String(phone.provider || "").toLowerCase() !== "telnyx") {
    return {
      ok: false,
      phoneNumberId: phone.id,
      e164: phone.e164,
      actions: [],
      error: "Voice ingress requires a Telnyx-owned number",
    };
  }

  const actions: string[] = [];
  try {
    const { connectionId, fqdnId, actions: fqdnActions } =
      await ensureTelnyxLiveKitFqdnConnection();
    actions.push(...fqdnActions);

    const route = await routeTelnyxNumberToConnection({
      e164: phone.e164,
      providerNumberId: phone.providerNumberId,
      connectionId,
    });
    if (route.providerNumberId !== phone.providerNumberId) {
      await prisma.phoneNumber.update({
        where: { id: phone.id },
        data: { providerNumberId: route.providerNumberId },
      });
      actions.push("telnyx_provider_number_id_refreshed");
    }
    if (route.previousConnectionId && route.previousConnectionId !== connectionId) {
      actions.push(`telnyx_rerouted:${route.previousConnectionId}->${connectionId}`);
    } else {
      actions.push("telnyx_route_ok");
    }

    const { trunk, actions: trunkActions } = await ensureInboundTrunkForNumber(phone.e164);
    actions.push(...trunkActions);
    const trunkId = trunk.sipTrunkId || "";
    if (!trunkId) throw new Error("LiveKit inbound trunk id missing");

    const synced = await syncReceptionistDidDispatchRule({
      e164: phone.e164,
      trunkId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      publishedVersionId: input.publishedVersionId,
    });
    actions.push(...synced.actions);

    await writeTelephonyProvision(phone.id, {
      routingMode: "livekit_sip",
      state: "active",
      telnyxFqdnConnectionId: connectionId,
      telnyxFqdnId: fqdnId,
      livekitInboundTrunkId: trunkId,
      livekitDidDispatchRuleId: synced.ruleId,
      lastError: null,
      explicitDispatch: {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        publishedVersionId: input.publishedVersionId || undefined,
        toE164: phone.e164,
        dispatchSource: "phone_provision",
      },
    });

    return {
      ok: true,
      phoneNumberId: phone.id,
      e164: phone.e164,
      actions,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeTelephonyProvision(phone.id, {
      routingMode: "livekit_sip",
      state: "error",
      lastError: message,
    });
    return {
      ok: false,
      phoneNumberId: phone.id,
      e164: phone.e164,
      actions,
      error: message,
    };
  }
}
