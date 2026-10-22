import "server-only";

import { createId } from "@/lib/supabase/id";
import { getPrisma } from "@/lib/server/db";
import { phoneServerLog } from "@/lib/server/phone/phone-log";
import { executePhoneFoundationTransferHandoff } from "@/lib/server/phone/orchestration/phone-foundation-transfer";
import { hangupCall, speakOnCall } from "@/lib/server/phone/routing/telnyx-call-control";
import { logVoiceV3TransferEvent } from "./telemetry";
import { recordVoiceV3TransferOutcomeForNewApp } from "./record-transfer-outcome";
import type { VoiceV3AuthorizedTransferPlan } from "./types";
import {
  type VoiceV3TelnyxTransferOperation,
  V3_TRANSFER_CLIENT_KIND,
} from "./telnyx-transfer-types";

function readOperation(meta: Record<string, unknown>): VoiceV3TelnyxTransferOperation | null {
  const raw = meta.voiceV3TelnyxTransfer;
  if (!raw || typeof raw !== "object") return null;
  return raw as VoiceV3TelnyxTransferOperation;
}

async function persistOperation(
  humanCallId: string,
  operation: VoiceV3TelnyxTransferOperation,
): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findUnique({
    where: { id: humanCallId },
    select: { metadata: true },
  });
  const meta = (call?.metadata as Record<string, unknown>) || {};
  await prisma.humanCall.update({
    where: { id: humanCallId },
    data: {
      metadata: {
        ...meta,
        voiceV3TelnyxTransfer: operation,
      },
    },
  });
}

export async function getVoiceV3TelnyxTransferOperation(
  humanCallId: string,
): Promise<VoiceV3TelnyxTransferOperation | null> {
  const call = await getPrisma().humanCall.findUnique({
    where: { id: humanCallId },
    select: { metadata: true },
  });
  if (!call) return null;
  return readOperation((call.metadata as Record<string, unknown>) || {});
}

/**
 * Telnyx Call Control owns PSTN transfer: dial destination, bridge on answer/acceptance,
 * release LiveKit AI leg only after call.bridged.
 */
export async function startVoiceV3TelnyxTransfer(input: {
  workspaceId: string;
  humanCallId: string;
  inboundCallControlId: string;
  voiceCallId: string;
  liveSessionId: string;
  plan: VoiceV3AuthorizedTransferPlan;
  targetIndex?: number;
}): Promise<{ ok: true; operationId: string; status: VoiceV3TelnyxTransferOperation["status"] }> {
  const target = input.plan.targets[input.targetIndex ?? 0];
  if (!target) throw new Error("No transfer target");

  const existing = await getVoiceV3TelnyxTransferOperation(input.humanCallId);
  if (
    existing &&
    ["DIALING", "RINGING", "ANSWERED", "BRIDGING"].includes(existing.status)
  ) {
    throw new Error("Transfer already in progress for this call");
  }

  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call?.phoneNumberId) throw new Error("Human call missing");

  const meta = (call.metadata as Record<string, unknown>) || {};
  const orch = (meta.orchestration as Record<string, unknown>) || {};
  const aiLegControlId =
    typeof orch.aiLegControlId === "string" ? orch.aiLegControlId.trim() : null;

  const mode = (target.mode || "DIRECT").toUpperCase() === "WARM" ? "WARM" : "DIRECT";
  const now = new Date().toISOString();
  const operationId = `v3tx_${createId()}`;

  const operation: VoiceV3TelnyxTransferOperation = {
    id: operationId,
    transferRequestId: input.plan.transfer_request_id,
    routeId: input.plan.route_id,
    status: "AUTHORIZED",
    mode,
    voiceCallId: input.voiceCallId,
    liveSessionId: input.liveSessionId,
    inboundCallControlId: input.inboundCallControlId,
    aiLegControlId,
    outboundCallControlId: null,
    destinationE164: target.dial_target?.startsWith("phone_foundation:")
      ? null
      : target.dial_target,
    destinationId: target.destination_id,
    forwardingGroupId: target.forwarding_group_id ?? null,
    handoffInstructions: input.plan.handoff_instructions ?? null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
    bridgedAt: null,
  };

  await persistOperation(input.humanCallId, { ...operation, status: "DIALING" });

  logVoiceV3TransferEvent("VOICE_V3_TELNYX_TRANSFER_DIALING", {
    call_id: input.voiceCallId,
    live_session_id: input.liveSessionId,
    transfer_request_id: input.plan.transfer_request_id,
    operation_id: operationId,
    mode,
    destination_id: target.destination_id,
  });

  await speakOnCall(
    input.inboundCallControlId,
    "Please hold while I connect you.",
    {
      kind: V3_TRANSFER_CLIENT_KIND,
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      voiceV3TransferOperationId: operationId,
      transferRequestId: input.plan.transfer_request_id,
    },
  ).catch(() => undefined);

  const press1 = mode === "WARM";
  const screeningText =
    mode === "WARM" && input.plan.handoff_instructions?.trim()
      ? input.plan.handoff_instructions.trim().slice(0, 500)
      : undefined;

  await executePhoneFoundationTransferHandoff({
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    inboundCallControlId: input.inboundCallControlId,
    forwardingGroupId: target.forwarding_group_id,
    destinationE164:
      target.dial_target && !target.dial_target.startsWith("phone_foundation:")
        ? target.dial_target
        : null,
    destinationId: target.destination_id,
    press1,
    voiceV3Transfer: {
      operationId,
      transferRequestId: input.plan.transfer_request_id,
      routeId: input.plan.route_id,
      voiceCallId: input.voiceCallId,
      liveSessionId: input.liveSessionId,
      mode,
      screeningText,
      releaseAiLegOnBridge: true,
    },
  });

  phoneServerLog("voice-v3-telnyx-transfer", "dial_started", {
    humanCallId: input.humanCallId,
    operationId,
    mode,
  });

  return { ok: true, operationId, status: "DIALING" };
}

export async function handleVoiceV3TelnyxTransferBridged(input: {
  humanCallId: string;
  outboundCallControlId: string;
  clientState: Record<string, unknown>;
}): Promise<void> {
  const op = await getVoiceV3TelnyxTransferOperation(input.humanCallId);
  if (!op) return;

  const aiLeg = op.aiLegControlId;
  if (aiLeg) {
    phoneServerLog("voice-v3-telnyx-transfer", "release_ai_leg_after_bridge", {
      humanCallId: input.humanCallId,
      controlPrefix: aiLeg.slice(0, 8),
    });
    await hangupCall(aiLeg).catch(() => undefined);
  }

  const bridgedAt = new Date().toISOString();
  await persistOperation(input.humanCallId, {
    ...op,
    status: "BRIDGED",
    outboundCallControlId: input.outboundCallControlId,
    bridgedAt,
    updatedAt: bridgedAt,
  });

  if (op.voiceCallId) {
    const workspaceId = String(clientState.workspaceId || "");
    if (workspaceId) {
      await recordVoiceV3TransferOutcomeForNewApp({
        workspaceId,
        callId: op.voiceCallId,
        transferRequestId: op.transferRequestId,
        routeId: op.routeId,
        status: "transfer_connected",
        attempts: [
          {
            destination_id: op.destinationId || "unknown",
            mode: op.mode,
            outcome: "CONNECTED",
            attempt_index: 0,
          },
        ],
        connectedDestinationId: op.destinationId,
      });
    }
  }

  logVoiceV3TransferEvent("VOICE_V3_TELNYX_TRANSFER_BRIDGED", {
    call_id: op.voiceCallId,
    live_session_id: op.liveSessionId,
    transfer_request_id: op.transferRequestId,
    operation_id: op.id,
  });
}

export async function handleVoiceV3TelnyxTransferDestinationFailed(input: {
  humanCallId: string;
  reason: string;
  clientState: Record<string, unknown>;
}): Promise<void> {
  const op = await getVoiceV3TelnyxTransferOperation(input.humanCallId);
  if (!op || op.status === "BRIDGED") return;

  const updatedAt = new Date().toISOString();
  await persistOperation(input.humanCallId, {
    ...op,
    status: "FAILED",
    failureReason: input.reason,
    updatedAt,
  });

  if (op.voiceCallId && clientState.workspaceId) {
    await recordVoiceV3TransferOutcomeForNewApp({
      workspaceId: String(clientState.workspaceId),
      callId: op.voiceCallId,
      transferRequestId: op.transferRequestId,
      routeId: op.routeId,
      status: "transfer_exhausted",
      reason: input.reason,
      attempts: [
        {
          destination_id: op.destinationId || "unknown",
          mode: op.mode,
          outcome: input.reason,
          attempt_index: 0,
        },
      ],
    });
  }

  logVoiceV3TransferEvent("VOICE_V3_TELNYX_TRANSFER_FAILED", {
    call_id: op.voiceCallId,
    live_session_id: op.liveSessionId,
    transfer_request_id: op.transferRequestId,
    operation_id: op.id,
    reason: input.reason,
  });
}
