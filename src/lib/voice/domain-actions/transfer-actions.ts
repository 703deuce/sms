import { initiateTransfer } from "@/lib/voice/transfers";
import { getPrisma } from "@/lib/db";
import { transferLiveKitSipParticipant } from "@/lib/voice/livekit/sip-transfer";
import {
  applyTransferEvent,
  initialTransferState,
  speakableTransferMessage,
  transferRequiresRecovery,
} from "@/lib/voice/transfer-state/machine";
import { setTransferState } from "@/lib/voice/session-runtime/state";
import { structuredFailure, structuredSuccess } from "@/lib/voice/tool-policy/structured-result";
import { guardToolInvocation } from "./guard";
import type { LiveKitCallContext } from "./session-bootstrap";
import type { DomainActionResult } from "./booking-actions";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function transferDestination(ctx: LiveKitCallContext): string | null {
  const meta = (ctx.workflowDefinition?.metadata || {}) as Record<string, unknown>;
  const dest = meta.transferDestination || meta.onCallDestination;
  if (typeof dest === "string" && dest.trim()) return dest.trim();
  return process.env.VOICE_TRANSFER_FALLBACK_E164 || null;
}

export async function domainRequestHuman(input: {
  ctx: LiveKitCallContext;
  reason?: string | null;
}): Promise<DomainActionResult> {
  const blocked = guardToolInvocation(input.ctx, "request_human");
  if (blocked) return blocked;

  const destination = transferDestination(input.ctx);
  if (!destination) {
    return structuredFailure({
      speak: "I can't transfer this call right now, but I can take a message for the team.",
      code: "TRANSFER_FAILED",
      workflowState: input.ctx.session.currentState,
      nextAllowedActions: ["take_message"],
    });
  }

  let transfer = input.ctx.session.runtime.session_runtime?.transfer || initialTransferState();
  transfer = applyTransferEvent(transfer, {
    type: "request",
    destination,
    destinationLabel: "on-call",
  });
  transfer = applyTransferEvent(transfer, { type: "dialing" });
  input.ctx.session = setTransferState(input.ctx.session, transfer);

  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: input.ctx.callId },
    select: { telnyxCallControlId: true, metadata: true },
  });
  const callMeta = asRecord(call?.metadata);
  const livekitRoomName =
    typeof callMeta.livekitRoomName === "string" ? callMeta.livekitRoomName : null;
  const livekitParticipantId =
    typeof callMeta.livekitParticipantId === "string"
      ? callMeta.livekitParticipantId
      : null;

  let transferOk = false;
  let failureReason = "no_telephony";

  if (call?.telnyxCallControlId) {
    try {
      await initiateTransfer({
        workspaceId: input.ctx.workspaceId,
        callId: input.ctx.callId,
        destination,
        transferType: "warm_transfer",
        summary: input.reason || "Caller requested human",
        timeoutSeconds: 25,
      });
      transferOk = true;
    } catch (err) {
      failureReason = err instanceof Error ? err.message : "transfer_error";
    }
  } else if (livekitRoomName && livekitParticipantId) {
    if (process.env.VOICE_TRANSFER_SIMULATE_NO_ANSWER === "1") {
      failureReason = "no_answer";
    } else if (process.env.VOICE_TRANSFER_SIMULATE_ANSWER === "1") {
      transferOk = true;
    } else {
      const xfer = await transferLiveKitSipParticipant({
        roomName: livekitRoomName,
        participantIdentity: livekitParticipantId,
        destinationE164: destination,
      });
      transferOk = xfer.ok;
      if (!xfer.ok) {
        failureReason = xfer.reason;
      }
    }
  }

  if (transferOk) {
    transfer = applyTransferEvent(transfer, { type: "answered" });
    transfer = applyTransferEvent(transfer, { type: "handoff_complete" });
    input.ctx.session = setTransferState(input.ctx.session, transfer);
    return structuredSuccess({
      speak: speakableTransferMessage(transfer),
      workflowState: "COMPLETE",
      data: { transfer },
    });
  }

  const failureType =
    failureReason === "no_answer" || failureReason === "busy" ? failureReason : "failed";
  transfer = applyTransferEvent(transfer, {
    type: failureType as "no_answer" | "busy" | "failed",
    reason: failureReason,
  });
  transfer = applyTransferEvent(transfer, {
    type: "returned_to_agent",
    fallbackAction: "take_message",
  });
  input.ctx.session = setTransferState(input.ctx.session, transfer);

  return structuredFailure({
    speak: `${speakableTransferMessage(transfer)} I can take a message for the team if you'd like.`,
    code: failureType === "no_answer" ? "TRANSFER_NO_ANSWER" : "TRANSFER_FAILED",
    workflowState: input.ctx.session.currentState,
    nextAllowedActions: ["take_message", "end_call"],
    data: { transfer, recovered: transferRequiresRecovery(transfer), autoFallback: "take_message" },
  });
}
