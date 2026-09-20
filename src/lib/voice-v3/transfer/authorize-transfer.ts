import { createId } from "@/lib/supabase/id";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { buildWarmTransferHandoffInstructions } from "./build-handoff-summary";
import { logVoiceV3TransferBillingUsage, logVoiceV3TransferEvent } from "./telemetry";
import type {
  VoiceV3AuthorizedTransferPlan,
  VoiceV3TransferPolicyCompiled,
  VoiceV3TransferToolSurfaceResult,
} from "./types";
import { voiceToolError, toolOk } from "../tools/types";
import type { VoiceToolResult } from "../tools/types";

export type TransferCallArgs = {
  route_id?: string | null;
  destination_id?: string | null;
  /** @deprecated use destination_id */
  destination?: string | null;
  reason?: string | null;
};

function resolveRoute(
  policy: VoiceV3TransferPolicyCompiled,
  routeId: string | null | undefined,
): (typeof policy.routes)[0] | null {
  const routes = policy.routes;
  if (!routes.length) return null;
  const id = routeId?.trim();
  if (id) {
    return routes.find((r) => r.id === id) ?? null;
  }
  return routes[0] ?? null;
}

export function authorizeVoiceV3Transfer(input: {
  config: VoiceV3AgentConfig;
  policy: VoiceV3TransferPolicyCompiled;
  callContext: VoiceV3CallContext;
  args: TransferCallArgs;
}): VoiceToolResult<{ execution: VoiceV3AuthorizedTransferPlan; surface: VoiceV3TransferToolSurfaceResult }> {
  const { policy, config, callContext, args } = input;
  if (!policy.enabled) {
    return voiceToolError(
      "TRANSFER_NOT_CONFIGURED",
      "Call transfer is not enabled for this business.",
      {},
      "not_ready",
    );
  }

  const destId = (args.destination_id ?? args.destination)?.trim() || null;
  const route = resolveRoute(policy, args.route_id);
  if (!route) {
    return voiceToolError(
      "INVALID_ROUTE",
      "Transfer route is not configured.",
      { route_id: args.route_id ?? null },
    );
  }

  const destMap = new Map(policy.destinations.map((d) => [d.id, d]));
  let targets = route.targets;

  if (destId) {
    const row = destMap.get(destId);
    if (!row || !row.enabled) {
      return voiceToolError(
        "INVALID_DESTINATION",
        "Transfer destination is not configured.",
        { destination_id: destId },
      );
    }
    const match = route.targets.find((t) => t.destinationId === destId);
    targets = [
      match ?? {
        destinationId: destId,
        mode: row.defaultMode,
        ringingTimeoutSeconds: row.ringingTimeoutSeconds,
      },
    ];
  }

  const authorizedTargets: VoiceV3AuthorizedTransferPlan["targets"] = [];
  for (const t of targets) {
    const dest = destMap.get(t.destinationId);
    if (!dest?.enabled || !dest.phoneE164) continue;
    authorizedTargets.push({
      destination_id: dest.id,
      mode: t.mode,
      dial_target: dest.phoneE164,
      ringing_timeout_seconds: t.ringingTimeoutSeconds,
    });
  }

  if (!authorizedTargets.length) {
    return voiceToolError(
      "TRANSFER_NOT_CONFIGURED",
      "No authorized transfer targets are available.",
      { route_id: route.id },
      "not_ready",
    );
  }

  const transferRequestId = `tr_${createId()}`;
  const handoff = buildWarmTransferHandoffInstructions({
    businessName: config.businessName,
    agentName: config.identity.agentName ?? "Amy",
    reason: args.reason ?? null,
    callContext,
  });

  const execution: VoiceV3AuthorizedTransferPlan = {
    transfer_request_id: transferRequestId,
    route_id: route.id,
    fallback: route.fallback,
    targets: authorizedTargets,
    handoff_instructions: handoff,
    outbound_sip_trunk_id: policy.telephony.outboundSipTrunkId,
    outbound_caller_id_e164: policy.telephony.outboundCallerIdE164,
  };

  logVoiceV3TransferEvent("VOICE_V3_TRANSFER_AUTHORIZED", {
    call_id: callContext.callId,
    live_session_id: callContext.liveSessionId,
    transfer_request_id: transferRequestId,
    route_id: route.id,
    destination_id: destId,
    target_count: authorizedTargets.length,
    modes: authorizedTargets.map((t) => t.mode),
    waterfall: policy.routing === "waterfall",
  });
  logVoiceV3TransferBillingUsage({
    transfer_request_id: transferRequestId,
    route_id: route.id,
    provider: "livekit",
    routing: policy.routing,
    outcome: "AUTHORIZED",
    waterfall_attempt_count: authorizedTargets.length,
    destination_ids: authorizedTargets.map((t) => t.destination_id),
    modes: authorizedTargets.map((t) => t.mode),
  });

  const surface: VoiceV3TransferToolSurfaceResult = {
    transfer_request_id: transferRequestId,
    route_id: route.id,
    destination_id: destId,
    status: "transfer_authorized",
    fallback: route.fallback,
  };

  return toolOk("transfer_authorized", { execution, surface });
}
