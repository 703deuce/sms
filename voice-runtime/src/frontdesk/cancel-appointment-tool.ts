import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { getPrisma } from "@/lib/db";
import type { FrontDeskUserData } from "./userdata";
import { isBookingConfirmed, markBookingCancelled } from "./userdata";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import {
  cancelCalendlyEventResilient,
  formatBookedTimeLabel,
} from "./booking-recovery";
import { POST_CANCEL_FILLER } from "../booking-completion-messages";
import { bookingFailureReason } from "../booking-error";
import { syncFrontDeskCancelToCrm } from "@/lib/voice/crm/frontdesk-crm-sync";

function externalEventUri(externalId: string | null | undefined): string | null {
  if (!externalId) return null;
  const raw = externalId.startsWith("calendly:") ? externalId.slice("calendly:".length) : externalId;
  return raw.trim() || null;
}

type AppointmentRow = {
  id: string;
  callId: string | null;
  startsAt: Date;
  externalId: string | null;
};

async function activeFutureAppointmentsForCaller(
  workspaceId: string,
  callerE164: string,
): Promise<AppointmentRow[]> {
  const prisma = getPrisma();
  const calls = await prisma.voiceCall.findMany({
    where: { workspaceId, fromE164: callerE164 },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: { id: true },
  });
  const callIds = calls.map((c: { id: string }) => c.id);
  if (!callIds.length) return [];

  return prisma.voiceAppointment.findMany({
    where: {
      workspaceId,
      callId: { in: callIds },
      status: { in: ["active", "confirmed"] },
      startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, callId: true, startsAt: true, externalId: true },
  });
}

export async function resolveFrontDeskAppointment(
  ud: FrontDeskUserData,
  appointment_id?: string,
): Promise<AppointmentRow> {
  const prisma = getPrisma();
  let appointment: AppointmentRow | null = null;

  if (appointment_id) {
    appointment = await prisma.voiceAppointment.findFirst({
      where: {
        id: appointment_id,
        workspaceId: ud.workspaceId,
        status: { in: ["active", "confirmed"] },
      },
      select: { id: true, callId: true, startsAt: true, externalId: true },
    });
    if (!appointment) {
      throw new llm.ToolError(
        "I could not find that appointment — it may already be cancelled.",
      );
    }
    return appointment;
  }

  appointment = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId: ud.workspaceId,
      callId: ud.callId,
      status: { in: ["active", "confirmed"] },
      startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, callId: true, startsAt: true, externalId: true },
  });

  if (!appointment && ud.pendingSlotId && !isBookingConfirmed(ud)) {
    throw new llm.ToolError(
      "No appointment was booked on this call — the calendar booking did not complete. " +
        "Do not claim a cancellation succeeded. Offer to try booking again or check other visits on file.",
    );
  }

  if (!appointment && ud.callerE164) {
    const candidates = await activeFutureAppointmentsForCaller(ud.workspaceId, ud.callerE164);
    if (candidates.length === 0) {
      throw new llm.ToolError(
        "I could not find an upcoming appointment on file for this number.",
      );
    }
    if (candidates.length === 1) {
      return candidates[0]!;
    }
    const options = candidates
      .map((row) => {
        const when = formatBookedTimeLabel(row.startsAt, ud.timezone);
        return `${when} (id ${row.id})`;
      })
      .join("; ");
    throw new llm.ToolError(
      `Multiple upcoming appointments on this number: ${options}. ` +
        "Ask which one to cancel, then call cancel_appointment again with appointment_id.",
    );
  }

  if (!appointment) {
    throw new llm.ToolError(
      "I could not find an upcoming appointment on file for this number.",
    );
  }

  return appointment;
}

/**
 * Cancel the caller's upcoming appointment (Calendly + DB).
 * Prefers appointments booked on the current call; never silently cancels an older visit
 * when this call has no completed booking.
 */
export function buildFrontDeskCancelAppointmentTool() {
  return llm.tool({
    name: "cancel_appointment",
    description:
      "Cancel an upcoming appointment after the caller confirms. Prefers the booking from this call.",
    parameters: z.object({
      appointment_id: z
        .string()
        .optional()
        .describe("Internal appointment id when the caller picks from multiple options"),
      confirmed: z.boolean().describe("True only when the caller explicitly confirms cancellation"),
    }),
    execute: async ({ appointment_id, confirmed }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      const runCtx = opts.ctx;

      if (!confirmed) {
        return "Ask the caller to confirm before cancelling.";
      }

      await runCtx.update(POST_CANCEL_FILLER);
      runCtx.disallowInterruptions();

      return withLiveKitToolTelemetry(
        ud,
        "cancel_appointment",
        { appointment_id, confirmed },
        async () => {
          const appointment = await resolveFrontDeskAppointment(ud, appointment_id);
          const when = formatBookedTimeLabel(appointment.startsAt, ud.timezone);
          const fromThisCall = appointment.callId === ud.callId;

          const eventUri = externalEventUri(appointment.externalId);
          if (eventUri) {
            try {
              await cancelCalendlyEventResilient({
                workspaceId: ud.workspaceId,
                eventUri,
                reason: "Canceled by caller on phone",
              });
            } catch (err) {
              console.warn(
                JSON.stringify({
                  source: "frontdesk-cancel",
                  event: "calendly_cancel_failed",
                  callId: ud.callId,
                  appointmentId: appointment.id,
                  error: err instanceof Error ? err.message : String(err),
                }),
              );
              throw new llm.ToolError(bookingFailureReason(err));
            }
          }

          const prisma = getPrisma();
          await prisma.voiceAppointment.update({
            where: { id: appointment.id },
            data: { status: "cancelled" },
          });

          if (fromThisCall) {
            markBookingCancelled(ud);
            await prisma.voiceCall
              .update({
                where: { id: ud.callId },
                data: { appointmentBooked: false, outcome: "appointment_cancelled" },
              })
              .catch(() => undefined);
          }

          const line = `Your appointment for ${when} has been cancelled.`;
          await runCtx.update(line);

          void syncFrontDeskCancelToCrm({
            workspaceId: ud.workspaceId,
            callId: ud.callId,
            appointmentId: appointment.id,
          }).catch((err) => {
            console.warn(
              JSON.stringify({
                source: "frontdesk-cancel",
                event: "crm_sync_failed",
                callId: ud.callId,
                error: err instanceof Error ? err.message : String(err),
              }),
            );
          });

          if (fromThisCall) {
            return (
              "CANCEL_COMPLETE_ALREADY_SPOKEN: The cancellation was already spoken to the caller. " +
              "Do not repeat the details. Ask if they need anything else or call end_call."
            );
          }
          return (
            `${line} Note: that visit was from an earlier call, not the booking on this call.`
          );
        },
      );
    },
  });
}
