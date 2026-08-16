import { getPrisma } from "@/lib/db";
import { cancelCalendlyEventResilient, formatBookedTimeLabel } from "./booking-recovery";
import { markBookingOperationCancelled } from "./booking-operation";
import { markBookingCancelled, type FrontDeskUserData } from "./userdata";
import { logRuntimeTransaction, transactionContextFromUserData } from "./runtime-transaction";

const SOURCE = "cancel-provider-write";

function externalEventUri(externalId: string | null | undefined): string | null {
  if (!externalId) return null;
  const raw = externalId.startsWith("calendly:") ? externalId.slice("calendly:".length) : externalId;
  return raw.trim() || null;
}

export type CancelProviderWriteResult = {
  whenLabel: string;
  appointmentId: string;
  idempotencyKey: string;
  alreadyCancelled: boolean;
};

/**
 * Transaction-first Calendly cancel + DB receipt — no AgentSession, bridge speech, or TTS.
 * Idempotency: callId + appointmentId (already-cancelled rows short-circuit).
 */
export async function writeCancelToProvider(input: {
  userData: FrontDeskUserData;
  appointmentId: string;
  externalId: string | null;
  startsAt: Date;
  fromThisCall: boolean;
}): Promise<CancelProviderWriteResult> {
  const ctx = transactionContextFromUserData(input.userData);
  const idempotencyKey = `${input.userData.callId}:cancel:${input.appointmentId}`;
  const whenLabel = formatBookedTimeLabel(input.startsAt, input.userData.timezone);
  const startMs = Date.now();

  logRuntimeTransaction(SOURCE, "cancel_write_started", ctx, {
    appointmentId: input.appointmentId,
    idempotencyKey,
    fromThisCall: input.fromThisCall,
  });

  const prisma = getPrisma();
  const existing = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.userData.workspaceId },
    select: { status: true },
  });

  if (existing?.status === "cancelled" || existing?.status === "canceled") {
    logRuntimeTransaction(SOURCE, "cancel_write_succeeded", ctx, {
      appointmentId: input.appointmentId,
      idempotencyKey,
      durationMs: Date.now() - startMs,
      alreadyCancelled: true,
    });
    if (input.fromThisCall) {
      markBookingCancelled(input.userData);
      markBookingOperationCancelled(input.userData, "appointment_cancelled");
    }
    logRuntimeTransaction(SOURCE, "cancel_receipt_persisted", ctx, {
      appointmentId: input.appointmentId,
      idempotencyKey,
      whenLabel,
      alreadyCancelled: true,
    });
    return {
      whenLabel,
      appointmentId: input.appointmentId,
      idempotencyKey,
      alreadyCancelled: true,
    };
  }

  try {
    const eventUri = externalEventUri(input.externalId);
    if (eventUri) {
      await cancelCalendlyEventResilient({
        workspaceId: input.userData.workspaceId,
        eventUri,
        reason: "Canceled by caller on phone",
      });
    }

    await prisma.voiceAppointment.update({
      where: { id: input.appointmentId },
      data: { status: "cancelled" },
    });

    if (input.fromThisCall) {
      markBookingCancelled(input.userData);
      markBookingOperationCancelled(input.userData, "appointment_cancelled");
      await prisma.voiceCall
        .update({
          where: { id: input.userData.callId },
          data: { appointmentBooked: false, outcome: "appointment_cancelled" },
        })
        .catch(() => undefined);
    }

    logRuntimeTransaction(SOURCE, "cancel_write_succeeded", ctx, {
      appointmentId: input.appointmentId,
      idempotencyKey,
      durationMs: Date.now() - startMs,
      providerEventUri: eventUri,
    });
    logRuntimeTransaction(SOURCE, "cancel_receipt_persisted", ctx, {
      appointmentId: input.appointmentId,
      idempotencyKey,
      whenLabel,
    });

    return {
      whenLabel,
      appointmentId: input.appointmentId,
      idempotencyKey,
      alreadyCancelled: false,
    };
  } catch (err) {
    logRuntimeTransaction(SOURCE, "cancel_write_failed", ctx, {
      appointmentId: input.appointmentId,
      idempotencyKey,
      durationMs: Date.now() - startMs,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
