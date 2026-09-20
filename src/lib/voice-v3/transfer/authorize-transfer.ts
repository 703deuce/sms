import { createId } from "@/lib/supabase/id";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { buildWarmTransferHandoffInstructions } from "./build-handoff-summary";
import { logVoiceV3TransferBillingUsage, logVoiceV3TransferEvent } from "./telemetry";
import type {
  VoiceV3AuthorizedTransferPlan,
  VoiceV3AuthorizedTransferSkippedTarget,
  VoiceV3TransferPolicyCompiled,
  VoiceV3TransferToolSurfaceResult,
} from "./types";
import { voiceToolError, toolOk } from "../tools/types";
import type { VoiceToolResult } from "../tools/types";
import {
  eligibilityToAttemptOutcome,
  evaluateTransferDestinationEligibility,
} from "./evaluate-destination-eligibility";
const DEFAULT_BUSINESS_TIMEZONE = "America/New_York";

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
  now?: Date;
}): VoiceToolResult<{ execution: VoiceV3AuthorizedTransferPlan; surface: VoiceV3TransferToolSurfaceResult }> {
  const { policy, config, callContext, args } = input;
  const evaluatedAt = input.now ?? new Date();
  const businessTimezone = config.timezone?.trim() || DEFAULT_BUSINESS_TIMEZONE;

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
  const skippedTargets: VoiceV3AuthorizedTransferSkippedTarget[] = [];

  for (const t of targets) {
    const dest = destMap.get(t.destinationId);
    if (!dest?.enabled || !dest.phoneE164) continue;

    const eligibility = evaluateTransferDestinationEligibility({
      availability: dest.availability,
      enabled: dest.enabled,
      now: evaluatedAt,
      businessTimezone,
    });

    logVoiceV3TransferEvent("VOICE_V3_TRANSFER_DESTINATION_EVALUATED", {
      call_id: callContext.callId,
      destination_id: dest.id,
      eligible: eligibility.eligible,
      reason: eligibility.reason,
      timezone: dest.availability?.timezone ?? businessTimezone,
    });

    if (!eligibility.eligible) {
      const skipOutcome = eligibilityToAttemptOutcome(eligibility.reason);
      if (skipOutcome) {
        skippedTargets.push({
          destination_id: dest.id,
          destination_label: dest.label,
          mode: t.mode,
          outcome: skipOutcome,
          eligibility_reason: eligibility.reason,
        });
        logVoiceV3TransferEvent("VOICE_V3_TRANSFER_DESTINATION_SKIPPED", {
          call_id: callContext.callId,
          destination_id: dest.id,
          outcome: skipOutcome,
          reason: eligibility.reason,
        });
      }
      continue;
    }

    authorizedTargets.push({
      destination_id: dest.id,
      mode: t.mode,
      dial_target: dest.phoneE164,
      ringing_timeout_seconds: t.ringingTimeoutSeconds,
      destination_label: dest.label,
    });
  }

  const transferRequestId = `tr_${createId()}`;
  const handoff = buildWarmTransferHandoffInstructions({
    businessName: config.businessName,
    agentName: config.identity.agentName ?? "Amy",
    reason: args.reason ?? null,
    callContext,
    detectVoicemailOnTransfer: config.detectVoicemailOnTransfer === true,
  });

  if (!authorizedTargets.length) {
    const execution: VoiceV3AuthorizedTransferPlan = {
      transfer_request_id: transferRequestId,
      route_id: route.id,
      fallback: route.fallback,
      targets: [],
      skipped_targets: skippedTargets,
      route_outcome_hint: "NO_ELIGIBLE_DESTINATIONS",
      handoff_instructions: handoff,
      detect_voicemail_on_transfer: config.detectVoicemailOnTransfer === true,
      evaluation_timezone: businessTimezone,
      outbound_sip_trunk_id: policy.telephony.outboundSipTrunkId,
      outbound_caller_id_e164: policy.telephony.outboundCallerIdE164,
    };

    logVoiceV3TransferEvent("VOICE_V3_TRANSFER_NO_ELIGIBLE_DESTINATIONS", {
      call_id: callContext.callId,
      transfer_request_id: transferRequestId,
      route_id: route.id,
      skipped_count: skippedTargets.length,
    });

    const surface: VoiceV3TransferToolSurfaceResult = {
      transfer_request_id: transferRequestId,
      route_id: route.id,
      destination_id: destId,
      status: "no_eligible_destinations",
      fallback: route.fallback,
      attempts: skippedTargets.map((s) => ({
        destination_id: s.destination_id,
        mode: s.mode,
        outcome: s.outcome,
      })),
    };

    return toolOk("transfer_no_eligible_destinations", { execution, surface });
  }

  const execution: VoiceV3AuthorizedTransferPlan = {
    transfer_request_id: transferRequestId,
    route_id: route.id,
    fallback: route.fallback,
    targets: authorizedTargets,
    skipped_targets: skippedTargets.length ? skippedTargets : undefined,
    handoff_instructions: handoff,
    detect_voicemail_on_transfer: config.detectVoicemailOnTransfer === true,
    evaluation_timezone: businessTimezone,
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
    skipped_count: skippedTargets.length,
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
