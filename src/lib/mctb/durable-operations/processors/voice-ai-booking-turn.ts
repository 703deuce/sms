import "server-only";

import type { MctbDurableOperationRecord } from "../types";
import { assertVoiceBookingWriteNotStale } from "../stale-action-gate";
import { MCTB_DURABLE_DEEPSEEK_ATTEMPT_TIMEOUT_MS } from "../constants";
import { appendOperationTrace } from "../store";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}_ATTEMPT_TIMED_OUT`));
    }, ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

export async function processVoiceAiBookingTurnOperation(
  operation: MctbDurableOperationRecord,
): Promise<Record<string, unknown>> {
  const input = operation.inputJson;
  const workspaceId = String(input.workspaceId || operation.workspaceId);
  const callId = String(input.callId || operation.voiceCallId || "");
  const agentId = input.agentId ? String(input.agentId) : null;
  const utterance = String(input.utterance || "");
  const confirmBooking = input.confirmBooking === true;
  const offeredSlotId = input.offeredSlotId ? String(input.offeredSlotId) : null;
  const expectedActionEpoch =
    input.actionEpochAtEnqueue != null ? Number(input.actionEpochAtEnqueue) : null;

  if (!callId) {
    throw new Error("voice_ai_booking_turn_missing_callId");
  }

  if (confirmBooking || offeredSlotId) {
    const gate = await assertVoiceBookingWriteNotStale({
      voiceCallId: callId,
      expectedActionEpoch,
      operationStatus: operation.status,
    });
    if (!gate.ok) {
      return {
        voice: {
          ok: false,
          speak: gate.customerMessage,
          error: gate.reason,
          data: { stale: true },
        },
      };
    }
  }

  await appendOperationTrace(operation.id, "PROCESSING", { callId, utteranceLen: utterance.length });

  const workerCert = (
    await import("../worker-cert-synthetic")
  ).resolveWorkerCertSynthetic(input, operation.idempotencyKey);
  if (workerCert) {
    await appendOperationTrace(operation.id, "WORKER_CERT_PROVIDER_EXEC", {
      delayMs: workerCert.delayMs,
      tag: workerCert.providerExecutionTag,
    });
    if (workerCert.failOnce && operation.attemptCount <= 1) {
      throw new Error("WORKER_CERT_TRANSIENT_PROVIDER_FAILURE");
    }
    if (workerCert.delayMs > 0) {
      await new Promise((r) => setTimeout(r, workerCert.delayMs));
    }
    return {
      voice: {
        ok: true,
        speak: "I have 1:00, 2:00, or 3:00 available for certification.",
        data: {
          slots: [
            { slot_id: "cert_s1", label: "1:00 PM" },
            { slot_id: "cert_s2", label: "2:00 PM" },
            { slot_id: "cert_s3", label: "3:00 PM" },
          ],
          worker_cert: true,
          delayMs: workerCert.delayMs,
        },
      },
      processedAt: new Date().toISOString(),
      workerCert: { providerExecutionTag: workerCert.providerExecutionTag },
    };
  }

  const certThrow = process.env.MCTB_CERT_VOICE_TURN_THROW?.trim();
  if (certThrow) {
    throw new Error(certThrow);
  }
  const certDelay = Number(process.env.MCTB_CERT_VOICE_TURN_DELAY_MS || 0);
  if (certDelay > 0) {
    await new Promise((r) => setTimeout(r, certDelay));
  }

  const certResult = process.env.MCTB_CERT_VOICE_TURN_RESULT?.trim();
  if (certResult) {
    const parsed = JSON.parse(certResult) as Record<string, unknown>;
    return {
      voice: parsed,
      processedAt: new Date().toISOString(),
    };
  }

  const { executeVoiceAiBookingTurn } = await import("@/lib/voice/ai-booking/voice-booking-turn");
  const result = await withTimeout(
    executeVoiceAiBookingTurn({
      workspaceId,
      agentId,
      callId,
      utterance,
      confirmBooking,
      offeredSlotId,
    }),
    MCTB_DURABLE_DEEPSEEK_ATTEMPT_TIMEOUT_MS,
    "deepseek_voice_booking_turn",
  );

  await appendOperationTrace(operation.id, "CUSTOMER_RESULT_DELIVERED", {
    ok: result.ok !== false,
    booked: Boolean((result.data as Record<string, unknown> | undefined)?.booked),
  });

  const data = (result.data || {}) as Record<string, unknown>;
  const slots = Array.isArray(data.slots) ? (data.slots as Array<Record<string, unknown>>) : [];
  const { persistVoiceAiBookingOperationAudit } = await import(
    "@/lib/voice/ai-booking/operation-audit"
  );
  const { resolveMctbMicrosoftConnectionId } = await import(
    "@/lib/mctb/ai-booking/microsoft-connection"
  );
  const conversationId = String(input.conversationId || `voice:${callId}`);
  await persistVoiceAiBookingOperationAudit({
    workspaceId,
    conversationId,
    callId,
    voiceAgentId: agentId,
    operationId: operation.id,
    microsoftConnectionId: await resolveMctbMicrosoftConnectionId(workspaceId),
    utterance,
    phase: data.booked ? "VOICE_BOOKING_SUCCEEDED" : "VOICE_TURN_COMPLETED",
    offeredSlotIds: slots.map((s) => String(s.slot_id || s.slotId || "")).filter(Boolean),
    spokenSlotLabels: slots.map((s) => String(s.label || "")).filter(Boolean),
    selectedSlotId: offeredSlotId,
    providerStartUtc: data.start_time ? String(data.start_time) : null,
    providerBookingId: data.provider_booking_id ? String(data.provider_booking_id) : null,
    spokenResult: typeof result.speak === "string" ? result.speak : null,
    status: result.ok === false ? "FAILED" : "SUCCEEDED",
  });

  return {
    voice: result,
    processedAt: new Date().toISOString(),
  };
}
