import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { getPrisma } from "@/lib/db";
import { guardCalendarTool } from "./booking-operation-guard";
import { markBookingOperationCancelled } from "./booking-operation";
import { markBookingCancelled, type FrontDeskUserData } from "./userdata";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import { runAsyncWorkWithBridge } from "../task-async-work-bridge";
import {
  cancelCalendlyEventResilient,
  formatBookedTimeLabel,
} from "./booking-recovery";
import { resolveFrontDeskAppointment } from "./appointment-lookup";
import { speakBookingLine } from "./booking-speech";
import { POST_CANCEL_FILLER } from "../booking-completion-messages";
import { bookingFailureReason } from "../booking-error";
import { syncFrontDeskCancelToCrm } from "@/lib/voice/crm/frontdesk-crm-sync";

function externalEventUri(externalId: string | null | undefined): string | null {
  if (!externalId) return null;
  const raw = externalId.startsWith("calendly:") ? externalId.slice("calendly:".length) : externalId;
  return raw.trim() || null;
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

      guardCalendarTool(ud, "cancel_appointment");

      if (!confirmed) {
        return "Ask the caller to confirm before cancelling.";
      }

      return withLiveKitToolTelemetry(
        ud,
        "cancel_appointment",
        { appointment_id, confirmed },
        async () => {
          const appointment = await resolveFrontDeskAppointment(ud, appointment_id, "cancel");
          const when = formatBookedTimeLabel(appointment.startsAt, ud.timezone);
          const fromThisCall = appointment.callId === ud.callId;

          await runAsyncWorkWithBridge(session, POST_CANCEL_FILLER, async () => {
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
              markBookingOperationCancelled(ud, "appointment_cancelled");
              await prisma.voiceCall
                .update({
                  where: { id: ud.callId },
                  data: { appointmentBooked: false, outcome: "appointment_cancelled" },
                })
                .catch(() => undefined);
            }
          });

          const line = `Your appointment for ${when} has been cancelled.`;
          await speakBookingLine(session, line);

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

// Re-export for tests and reschedule tool.
export { resolveFrontDeskAppointment } from "./appointment-lookup";
