import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { AvailableSlot } from "./calendly-calendar";
import { SlotUnavailableError } from "./calendly-calendar";
import {
  peekEmailForFrontDeskCall,
  resolveFrontDeskAppointment,
} from "./appointment-lookup";
import {
  formatBookedTimeLabel,
  rescheduleAppointmentResilient,
} from "./booking-recovery";
import {
  resolveConfirmedEmail,
} from "./email-collection-tools";
import { runEmailCollectionTask } from "./email-collection-task";
import {
  syncFrontDeskBookingToCrm,
} from "@/lib/voice/crm/frontdesk-crm-sync";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import {
  BOOKING_COMPLETE_TOOL_RESULT,
  BOOKING_FAILED_TOOL_RESULT,
  buildBookingCompleteToolResultFallback,
  buildBookingFailureLine,
  buildBookingSuccessLine,
  POST_EMAIL_BOOKING_FILLER,
} from "../booking-completion-messages";
import { bookingFailureReason } from "../booking-error";
import { markBookingConfirmed, type FrontDeskUserData } from "./userdata";
import { sendBookingSmsAsync } from "./booking-sms";
import { speakBookingLine } from "./booking-speech";

function externalEventUri(externalId: string | null | undefined): string | null {
  if (!externalId) return null;
  const raw = externalId.startsWith("calendly:") ? externalId.slice("calendly:".length) : externalId;
  return raw.trim() || null;
}

export function buildFrontDeskRescheduleAppointmentTool(
  slotsMap: Map<string, AvailableSlot>,
) {
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

      if (!confirmed) {
        return "Ask the caller to confirm the new time before rescheduling.";
      }

      const slot = slotsMap.get(slot_id);
      if (!slot) {
        throw new llm.ToolError(`Slot ${slot_id} was not found — call list_available_slots again.`);
      }

      let attendeeEmail: string | null = resolveConfirmedEmail(ud, inlineEmail);
      if (!attendeeEmail) {
        attendeeEmail = await peekEmailForFrontDeskCall(ud, appointment_id);
        if (attendeeEmail) ud.confirmedEmail = attendeeEmail;
      }
      if (!attendeeEmail) {
        const collected = await runEmailCollectionTask(session);
        if (collected.declined || !collected.email) {
          return "Email is required to reschedule. Offer to call back later.";
        }
        attendeeEmail = collected.email;
      }
      ud.confirmedEmail = attendeeEmail;

      await speakBookingLine(session, POST_EMAIL_BOOKING_FILLER, { runCtx: opts.ctx });

      return withLiveKitToolTelemetry(
        ud,
        "reschedule_appointment",
        { slot_id, appointment_id, confirmed },
        async () => {
          try {
            const appointment = await resolveFrontDeskAppointment(ud, appointment_id, "reschedule");
            const oldEventUri = externalEventUri(appointment.externalId);
            const when = formatBookedTimeLabel(appointment.startsAt, ud.timezone);

            const rescheduled = await rescheduleAppointmentResilient({
              session,
              appointmentId: appointment.id,
              oldEventUri,
              slot,
              attendeeEmail,
              existingMetadata: appointment.metadata,
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

            sendBookingSmsAsync(session, rescheduled.slot.startTime);

            const spoken = await speakBookingLine(session, buildBookingSuccessLine(local), {
              runCtx: opts.ctx,
            });

            const completion = spoken
              ? BOOKING_COMPLETE_TOOL_RESULT
              : buildBookingCompleteToolResultFallback(local);

            return (
              `${completion} ` +
              `(Rescheduled from ${when} to ${local}.)`
            );
          } catch (err) {
            if (err instanceof SlotUnavailableError) {
              ud.slotUnavailableCount += 1;
              await speakBookingLine(
                session,
                buildBookingFailureLine(
                  "That new time isn't available anymore — I can check what else is open.",
                ),
              );
              return BOOKING_FAILED_TOOL_RESULT;
            }

            console.warn(
              JSON.stringify({
                source: "frontdesk-reschedule",
                event: "reschedule_failed",
                callId: ud.callId,
                error: err instanceof Error ? err.message : String(err),
              }),
            );
            await speakBookingLine(session, buildBookingFailureLine(bookingFailureReason(err)));
            return BOOKING_FAILED_TOOL_RESULT;
          }
        },
      );
    },
  });
}
