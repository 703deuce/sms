import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { AvailableSlot } from "./calendly-calendar";
import { SlotUnavailableError } from "./calendly-calendar";
import { resolveFrontDeskAppointment } from "./cancel-appointment-tool";
import {
  formatBookedTimeLabel,
  lookupAppointmentIdForCall,
  rescheduleAppointmentResilient,
} from "./booking-recovery";
import {
  NEEDS_EMAIL_TOOL_RESULT,
  resolveConfirmedEmail,
} from "./email-collection-tools";
import { syncFrontDeskBookingToCrm } from "@/lib/voice/crm/frontdesk-crm-sync";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import {
  BOOKING_COMPLETE_TOOL_RESULT,
  BOOKING_FAILED_TOOL_RESULT,
  buildBookingFailureLine,
  buildBookingSuccessLine,
  POST_EMAIL_BOOKING_FILLER,
} from "../booking-completion-messages";
import { bookingFailureReason } from "../booking-error";
import { markBookingConfirmed, type FrontDeskUserData } from "./userdata";

function externalEventUri(externalId: string | null | undefined): string | null {
  if (!externalId) return null;
  const raw = externalId.startsWith("calendly:") ? externalId.slice("calendly:".length) : externalId;
  return raw.trim() || null;
}

export function buildFrontDeskRescheduleAppointmentTool(slotsMap: Map<string, AvailableSlot>) {
  return llm.tool({
    name: "reschedule_appointment",
    description:
      "Move an upcoming appointment to a new slot_id from list_available_slots after the caller confirms.",
    parameters: z.object({
      slot_id: z.string().describe("New slot id from list_available_slots"),
      appointment_id: z
        .string()
        .optional()
        .describe("Internal appointment id when multiple visits are on file"),
      confirmed: z.boolean().describe("True only when the caller explicitly confirms the new time"),
      email: z.string().optional().describe("Caller email if not already confirmed"),
    }),
    execute: async ({ slot_id, appointment_id, confirmed, email: inlineEmail }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      const runCtx = opts.ctx;

      if (!confirmed) {
        return "Ask the caller to confirm the new time before rescheduling.";
      }

      const slot = slotsMap.get(slot_id);
      if (!slot) {
        throw new llm.ToolError(`Slot ${slot_id} was not found — call list_available_slots again.`);
      }

      const attendeeEmail = resolveConfirmedEmail(ud, inlineEmail);
      if (!attendeeEmail) {
        return NEEDS_EMAIL_TOOL_RESULT;
      }
      ud.confirmedEmail = attendeeEmail;

      await runCtx.update(POST_EMAIL_BOOKING_FILLER);
      runCtx.disallowInterruptions();

      return withLiveKitToolTelemetry(
        ud,
        "reschedule_appointment",
        { slot_id, appointment_id, confirmed },
        async () => {
          try {
            const appointment = await resolveFrontDeskAppointment(ud, appointment_id);
            const oldEventUri = externalEventUri(appointment.externalId);
            const when = formatBookedTimeLabel(appointment.startsAt, ud.timezone);

            const rescheduled = await rescheduleAppointmentResilient({
              session,
              appointmentId: appointment.id,
              oldEventUri,
              slot,
              attendeeEmail,
            });

            const local = formatBookedTimeLabel(rescheduled.slot.startTime, ud.timezone);
            markBookingConfirmed(ud, {
              slotId: slot_id,
              providerEventId: rescheduled.eventUri,
              appointmentId: appointment.id,
              bookedTimeLabel: local,
            });

            void syncFrontDeskBookingToCrm({
              workspaceId: ud.workspaceId,
              callId: ud.callId,
              appointmentId: appointment.id,
              callerE164: ud.callerE164,
              email: attendeeEmail,
              businessName: ud.businessName,
            }).catch(() => undefined);

            await runCtx.update(buildBookingSuccessLine(local));

            return (
              `${BOOKING_COMPLETE_TOOL_RESULT} ` +
              `(Rescheduled from ${when} to ${local}.)`
            );
          } catch (err) {
            if (err instanceof SlotUnavailableError) {
              ud.slotUnavailableCount += 1;
              await runCtx.update(
                buildBookingFailureLine(
                  "That new time isn't available anymore — I can check what else is open.",
                ),
              );
              return BOOKING_FAILED_TOOL_RESULT;
            }

            const recoveredId = await lookupAppointmentIdForCall({
              workspaceId: ud.workspaceId,
              callId: ud.callId,
            });
            if (recoveredId) {
              const local = formatBookedTimeLabel(slot.startTime, ud.timezone);
              await runCtx.update(buildBookingSuccessLine(local));
              return BOOKING_COMPLETE_TOOL_RESULT;
            }

            console.warn(
              JSON.stringify({
                source: "frontdesk-reschedule",
                event: "reschedule_failed",
                callId: ud.callId,
                error: err instanceof Error ? err.message : String(err),
              }),
            );
            await runCtx.update(buildBookingFailureLine(bookingFailureReason(err)));
            return BOOKING_FAILED_TOOL_RESULT;
          }
        },
      );
    },
  });
}
