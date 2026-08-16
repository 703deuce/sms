import { getPrisma } from "@/lib/db";
import { syncFrontDeskCancelToCrm } from "@/lib/voice/crm/frontdesk-crm-sync";
import {
  cancelCalendlyEventResilient,
  formatBookedTimeLabel,
} from "../../../../voice-runtime/src/frontdesk/booking-recovery";
import {
  resolveVoiceAppointmentForBridge,
} from "@/lib/voice/frontdesk/resolve-voice-appointment";
import type { PythonRuntimeError } from "./types";

function externalEventUri(externalId: string | null | undefined): string | null {
  if (!externalId) return null;
  const raw = externalId.startsWith("calendly:") ? externalId.slice("calendly:".length) : externalId;
  return raw.trim() || null;
}

/** Cancel Calendly appointment + CRM event — no LiveKit / handlers.ts. */
export async function cancelBookingForPython(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
  timezone: string;
  callerE164?: string;
  appointmentId?: string;
  confirmed: boolean;
  bookingConfirmedOnCall?: boolean;
  pendingSlotId?: string;
}): Promise<
  | { ok: true; whenLabel: string; appointmentId: string; alreadyCancelled?: boolean; speech: string }
  | PythonRuntimeError
> {
  if (!input.confirmed) {
    return {
      ok: false,
      error: "Caller must confirm cancellation first",
      code: "CONFIRMATION_REQUIRED",
    };
  }

  const resolved = await resolveVoiceAppointmentForBridge({
    workspaceId: input.workspaceId,
    callId: input.callId,
    timezone: input.timezone,
    callerE164: input.callerE164,
    appointmentId: input.appointmentId,
    action: "cancel",
    bookingConfirmedOnCall: input.bookingConfirmedOnCall,
    pendingSlotId: input.pendingSlotId,
  });
  if (!resolved.ok) {
    return {
      ok: false,
      error: resolved.message,
      code: resolved.code,
      ...(resolved.appointmentOptions
        ? { appointmentOptions: resolved.appointmentOptions }
        : {}),
    };
  }

  const appointment = resolved.appointment;
  const whenLabel = formatBookedTimeLabel(appointment.startsAt, input.timezone);
  const fromThisCall = appointment.callId === input.callId;
  const prisma = getPrisma();

  const existing = await prisma.voiceAppointment.findFirst({
    where: { id: appointment.id, workspaceId: input.workspaceId },
    select: { status: true },
  });
  if (existing?.status === "cancelled" || existing?.status === "canceled") {
    return {
      ok: true,
      whenLabel,
      appointmentId: appointment.id,
      alreadyCancelled: true,
      speech: `Your appointment for ${whenLabel} was already cancelled.`,
    };
  }

  try {
    const eventUri = externalEventUri(appointment.externalId);
    if (eventUri) {
      await cancelCalendlyEventResilient({
        workspaceId: input.workspaceId,
        eventUri,
        reason: "Canceled by caller on phone",
      });
    }

    await prisma.voiceAppointment.update({
      where: { id: appointment.id },
      data: { status: "cancelled" },
    });

    if (fromThisCall) {
      await prisma.voiceCall
        .update({
          where: { id: input.callId },
          data: { appointmentBooked: false, outcome: "appointment_cancelled" },
        })
        .catch(() => undefined);
    }

    void syncFrontDeskCancelToCrm({
      workspaceId: input.workspaceId,
      callId: input.callId,
      appointmentId: appointment.id,
    }).catch(() => undefined);

    const speech = `Your appointment for ${whenLabel} has been cancelled.`;
    return {
      ok: true,
      whenLabel,
      appointmentId: appointment.id,
      speech,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: "CANCEL_FAILED",
    };
  }
}
