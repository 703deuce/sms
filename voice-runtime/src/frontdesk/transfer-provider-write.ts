import { getPrisma } from "@/lib/db";
import { transferLiveKitSipParticipant } from "@/lib/voice/livekit/sip-transfer";
import { initiateTransfer } from "@/lib/voice/transfers";
import type { FrontDeskUserData } from "./userdata";
import { logRuntimeTransaction, transactionContextFromUserData } from "./runtime-transaction";

const SOURCE = "transfer-provider-write";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function markVoiceCallTransferred(
  workspaceId: string,
  callId: string,
  destination: string,
  reason?: string,
): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: callId, workspaceId },
    select: { metadata: true },
  });
  const meta = asRecord(call?.metadata);
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      transferred: true,
      status: "TRANSFERRED",
      outcome: "transferred",
      metadata: {
        ...meta,
        transferDestination: destination,
        transferReason: reason || "Caller requested human",
        transferCompletedAt: new Date().toISOString(),
      },
    },
  });
}

export type TransferWriteSuccess = {
  ok: true;
  path: "telnyx" | "livekit";
  destination: string;
  idempotencyKey: string;
  alreadyTransferred: boolean;
};

export type TransferWriteFailure = {
  ok: false;
  reason: string;
  idempotencyKey: string;
};

export type TransferWriteResult = TransferWriteSuccess | TransferWriteFailure;

/**
 * Initiate transfer and persist receipt — independent of bridge speech / AgentSession.
 * Idempotency: callId (one successful transfer per call).
 */
export async function writeTransferToProvider(input: {
  userData: FrontDeskUserData;
  destination: string;
  reason?: string;
  transferType: "blind_transfer" | "warm_transfer";
}): Promise<TransferWriteResult> {
  const ctx = transactionContextFromUserData(input.userData);
  const idempotencyKey = `${input.userData.callId}:transfer`;
  const startMs = Date.now();
  const { userData, destination, reason, transferType } = input;

  logRuntimeTransaction(SOURCE, "transfer_write_started", ctx, {
    destination,
    transferType,
    idempotencyKey,
  });

  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: userData.callId },
    select: {
      telnyxCallControlId: true,
      metadata: true,
      transferred: true,
      status: true,
    },
  });

  if (call?.transferred || call?.status === "TRANSFERRED") {
    logRuntimeTransaction(SOURCE, "transfer_write_succeeded", ctx, {
      destination,
      idempotencyKey,
      durationMs: Date.now() - startMs,
      alreadyTransferred: true,
      path: "telnyx",
    });
    logRuntimeTransaction(SOURCE, "transfer_receipt_persisted", ctx, {
      destination,
      idempotencyKey,
      alreadyTransferred: true,
    });
    return {
      ok: true,
      path: "telnyx",
      destination,
      idempotencyKey,
      alreadyTransferred: true,
    };
  }

  const meta = asRecord(call?.metadata);
  const livekitRoomName =
    userData.livekitRoomName ||
    (typeof meta.livekitRoomName === "string" ? meta.livekitRoomName : null);
  const livekitParticipantId =
    userData.livekitParticipantId ||
    (typeof meta.livekitParticipantId === "string" ? meta.livekitParticipantId : null);

  try {
    if (call?.telnyxCallControlId) {
      await initiateTransfer({
        workspaceId: userData.workspaceId,
        callId: userData.callId,
        destination,
        transferType,
        summary: reason || "Caller requested human",
        timeoutSeconds: 25,
      });
      await markVoiceCallTransferred(userData.workspaceId, userData.callId, destination, reason);
      logRuntimeTransaction(SOURCE, "transfer_write_succeeded", ctx, {
        destination,
        idempotencyKey,
        durationMs: Date.now() - startMs,
        path: "telnyx",
      });
      logRuntimeTransaction(SOURCE, "transfer_receipt_persisted", ctx, {
        destination,
        idempotencyKey,
      });
      return {
        ok: true,
        path: "telnyx",
        destination,
        idempotencyKey,
        alreadyTransferred: false,
      };
    }

    if (livekitRoomName && livekitParticipantId) {
      const xfer = await transferLiveKitSipParticipant({
        roomName: livekitRoomName,
        participantIdentity: livekitParticipantId,
        destinationE164: destination,
      });
      if (!xfer.ok) {
        logRuntimeTransaction(SOURCE, "transfer_write_failed", ctx, {
          destination,
          idempotencyKey,
          durationMs: Date.now() - startMs,
          path: "livekit",
          error: xfer.reason || "transfer_failed",
        });
        return {
          ok: false,
          reason: xfer.reason || "transfer_failed",
          idempotencyKey,
        };
      }
      await markVoiceCallTransferred(userData.workspaceId, userData.callId, destination, reason);
      logRuntimeTransaction(SOURCE, "transfer_write_succeeded", ctx, {
        destination,
        idempotencyKey,
        durationMs: Date.now() - startMs,
        path: "livekit",
      });
      logRuntimeTransaction(SOURCE, "transfer_receipt_persisted", ctx, {
        destination,
        idempotencyKey,
      });
      return {
        ok: true,
        path: "livekit",
        destination,
        idempotencyKey,
        alreadyTransferred: false,
      };
    }

    logRuntimeTransaction(SOURCE, "transfer_write_failed", ctx, {
      destination,
      idempotencyKey,
      durationMs: Date.now() - startMs,
      error: "no_transfer_path",
    });
    return { ok: false, reason: "no_transfer_path", idempotencyKey };
  } catch (err) {
    logRuntimeTransaction(SOURCE, "transfer_write_failed", ctx, {
      destination,
      idempotencyKey,
      durationMs: Date.now() - startMs,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
