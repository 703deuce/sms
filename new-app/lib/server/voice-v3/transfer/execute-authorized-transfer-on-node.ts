import "server-only";

import { getLiveKitSipClient } from "@/lib/server/receptionist/livekit/client";
import { executePhoneFoundationTransferHandoff } from "@/lib/server/phone/orchestration/phone-foundation-transfer";
import { logVoiceV3TransferEvent } from "./telemetry";
import { recordVoiceV3TransferOutcomeForNewApp } from "./record-transfer-outcome";
import type { VoiceV3AuthorizedTransferPlan } from "./types";
import type { VoiceToolResult } from "../tools/types";
import type { VoiceV3CallRuntime } from "../state/call-runtime";

function normalizeTransferTo(destination: string): string {
  const dest = destination.trim();
  if (dest.startsWith("tel:") || dest.startsWith("sip:")) return dest;
  if (dest.startsWith("+") || (dest.length > 0 && /^\d/.test(dest))) return `tel:${dest}`;
  return dest;
}

type AttemptRow = {
  destination_id: string;
  mode: string;
  outcome: string;
  duration_ms: number;
  attempt_index: number;
};

/**
 * GPT-Live delegated tools run on Node (sideband). LiveKit SIP REFER must still execute here
 * using TransferSIPParticipant — same contract as Python `transfer_executor.py` for DIRECT legs.
 */
export async function executeAuthorizedTransferOnNodeAfterAuthorize(input: {
  runtime: VoiceV3CallRuntime;
  authorized: VoiceToolResult<{ execution: VoiceV3AuthorizedTransferPlan; surface: Record<string, unknown> }>;
}): Promise<VoiceToolResult> {
  if (!input.authorized.ok) return input.authorized;
  const data = input.authorized.data;
  if (!data?.execution) return input.authorized;

  const plan = data.execution;
  const snap = input.runtime.getSnapshot();
  const workspaceId = input.runtime.config.workspaceId?.trim();
  const agentId = input.runtime.config.agentId?.trim() ?? null;

  const attempts: AttemptRow[] = [];
  const started = Date.now();

  for (let index = 0; index < plan.targets.length; index++) {
    const target = plan.targets[index];
    const destId = target.destination_id;
    const mode = (target.mode || "DIRECT").toUpperCase();
    const executor = (target.executor || "livekit_sip").toLowerCase();
    const dialTarget = target.dial_target?.trim() ?? "";
    const timeoutSec = Math.max(5, target.ringing_timeout_seconds ?? 30);
    const attemptStarted = Date.now();

    logVoiceV3TransferEvent("VOICE_V3_TRANSFER_ATTEMPT_STARTED", {
      call_id: snap.callId,
      live_session_id: snap.liveSessionId,
      transfer_request_id: plan.transfer_request_id,
      route_id: plan.route_id,
      destination_id: destId,
      mode,
      attempt_index: index,
      executor,
    });

    let outcome = "PROVIDER_ERROR";

    try {
      if (executor === "phone_call_control") {
        if (!workspaceId) throw new Error("workspace missing");
        const humanCallId = target.human_call_id || snap.phoneFoundation?.humanCallId;
        const inboundCc =
          target.inbound_call_control_id || snap.phoneFoundation?.inboundCallControlId;
        if (!humanCallId || !inboundCc) {
          outcome = "CONFIGURATION_ERROR";
        } else {
          const handoff = await executePhoneFoundationTransferHandoff({
            workspaceId,
            humanCallId,
            inboundCallControlId: inboundCc,
            forwardingGroupId: target.forwarding_group_id,
            destinationE164: dialTarget && !dialTarget.startsWith("phone_foundation:")
              ? dialTarget
              : null,
          });
          outcome = handoff?.ok ? "PHONE_HANDOFF_STARTED" : "PROVIDER_ERROR";
        }
      } else if (mode === "WARM") {
        outcome = "CONFIGURATION_ERROR";
      } else {
        const lk = snap.telephony.liveKit;
        if (!lk?.roomName || !lk.sipParticipantIdentity) {
          outcome = "CONFIGURATION_ERROR";
        } else if (!dialTarget) {
          outcome = "CONFIGURATION_ERROR";
        } else {
          const client = getLiveKitSipClient();
          const transferTo = normalizeTransferTo(dialTarget);
          await client.transferSipParticipant(
            lk.roomName,
            lk.sipParticipantIdentity,
            transferTo,
            { ringingTimeout: timeoutSec },
          );
          outcome = "SIP_REFER_ACCEPTED";
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (msg.includes("timeout") || msg.includes("no answer") || msg.includes("deadline")) {
        outcome = "TIMEOUT";
      } else if (msg.includes("busy")) {
        outcome = "BUSY";
      } else {
        console.error("VOICE_V3_TRANSFER_NODE_EXECUTOR_FAILED", {
          call_id: snap.callId,
          live_session_id: snap.liveSessionId,
          err,
        });
        outcome = "PROVIDER_ERROR";
      }
    }

    const durationMs = Date.now() - attemptStarted;
    attempts.push({
      destination_id: destId,
      mode,
      outcome,
      duration_ms: durationMs,
      attempt_index: index,
    });

    logVoiceV3TransferEvent("VOICE_V3_TRANSFER_ATTEMPT_FINISHED", {
      call_id: snap.callId,
      live_session_id: snap.liveSessionId,
      transfer_request_id: plan.transfer_request_id,
      destination_id: destId,
      outcome,
      duration_ms: durationMs,
      attempt_index: index,
    });

    if (outcome === "SIP_REFER_ACCEPTED" || outcome === "PHONE_HANDOFF_STARTED" || outcome === "CONNECTED") {
      const isReferOnly = outcome === "SIP_REFER_ACCEPTED" || outcome === "PHONE_HANDOFF_STARTED";
      const surfaceStatus = outcome === "PHONE_HANDOFF_STARTED"
        ? "transfer_phone_handoff_started"
        : isReferOnly
          ? "transfer_refer_accepted"
          : "transfer_connected";
      const backendStatus = surfaceStatus as
        | "transfer_connected"
        | "transfer_refer_accepted"
        | "transfer_exhausted";

      logVoiceV3TransferEvent(
        isReferOnly ? "VOICE_V3_TRANSFER_REFER_ACCEPTED" : "VOICE_V3_TRANSFER_CONNECTED",
        {
          call_id: snap.callId,
          live_session_id: snap.liveSessionId,
          transfer_request_id: plan.transfer_request_id,
          route_id: plan.route_id,
          destination_id: destId,
          total_duration_ms: Date.now() - started,
        },
      );

      if (workspaceId) {
        await recordVoiceV3TransferOutcomeForNewApp({
          workspaceId,
          callId: snap.callId,
          agentId,
          transferRequestId: plan.transfer_request_id,
          routeId: plan.route_id,
          status: isReferOnly ? "transfer_refer_accepted" : "transfer_connected",
          reason: typeof data.surface?.reason === "string" ? data.surface.reason : null,
          attempts,
          connectedDestinationId: isReferOnly ? null : destId,
        });
      }

      const surface = {
        ...(data.surface ?? {}),
        status: surfaceStatus,
        attempts,
        human_answered: !isReferOnly,
      };

      return {
        ok: true,
        status: surfaceStatus,
        data: { surface, attempts },
      };
    }
  }

  logVoiceV3TransferEvent("VOICE_V3_TRANSFER_EXHAUSTED", {
    call_id: snap.callId,
    live_session_id: snap.liveSessionId,
    transfer_request_id: plan.transfer_request_id,
    route_id: plan.route_id,
    attempt_count: attempts.length,
  });

  if (workspaceId) {
    await recordVoiceV3TransferOutcomeForNewApp({
      workspaceId,
      callId: snap.callId,
      agentId,
      transferRequestId: plan.transfer_request_id,
      routeId: plan.route_id,
      status: "transfer_exhausted",
      reason: typeof data.surface?.reason === "string" ? data.surface.reason : null,
      attempts,
      connectedDestinationId: null,
    });
  }

  return {
    ok: true,
    status: "transfer_exhausted",
    data: {
      surface: {
        ...(data.surface ?? {}),
        status: "transfer_exhausted",
        fallback: plan.fallback,
        attempts,
      },
      attempts,
    },
  };
}

export async function maybeExecuteDelegatedTransferCallResult(input: {
  toolName: string;
  runtime: VoiceV3CallRuntime;
  result: VoiceToolResult;
}): Promise<VoiceToolResult> {
  if (input.toolName !== "transfer_call") return input.result;
  if (!input.result.ok || input.result.status !== "transfer_authorized") return input.result;
  return executeAuthorizedTransferOnNodeAfterAuthorize({
    runtime: input.runtime,
    authorized: input.result as VoiceToolResult<{
      execution: VoiceV3AuthorizedTransferPlan;
      surface: Record<string, unknown>;
    }>,
  });
}
