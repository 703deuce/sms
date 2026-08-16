import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { AvailableSlot } from "./calendly-calendar";
import { SlotUnavailableError } from "./calendly-calendar";
import { peekEmailForFrontDeskCall, resolveFrontDeskAppointment } from "./appointment-lookup";
import { formatBookedTimeLabel } from "./booking-recovery";
import { resolveConfirmedEmail } from "./email-collection-tools";
import { calendarToolGuardFeedback } from "./booking-operation-guard";
import { syncFrontDeskBookingToCrm } from "@/lib/voice/crm/frontdesk-crm-sync";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import { buildBookingFailureLine, buildBookingSuccessLine } from "../booking-completion-messages";
import { writeRescheduleToProvider } from "./reschedule-provider-write";
import {
  formatToolFeedbackForModel,
  toolFeedbackBookingCompleteSpeakNow,
  toolFeedbackBookingCompleteSpoken,
  toolFeedbackFromBookingWriteError,
  toolFeedbackInvalidSlot,
  toolFeedbackMissingEmail,
  toolFeedbackRecoverable,
} from "../tool-feedback";
import { markBookingConfirmed, type FrontDeskUserData } from "./userdata";
import { sendBookingSmsAsync } from "./booking-sms";
import { speakBookingLine } from "./booking-speech";
import { tryConfirmationSpeech } from "./runtime-transaction";

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

      const blocked = calendarToolGuardFeedback(ud, "reschedule_appointment");
      if (blocked) return formatToolFeedbackForModel(blocked);

      if (!confirmed) {
        return formatToolFeedbackForModel(
          toolFeedbackRecoverable({
            tool: "reschedule_appointment",
            recovery_class: "MISSING_INFORMATION",
            reason: "confirmation_required",
            next_action: "continue_conversation",
            guidance: "Ask the caller to confirm the new time — one short question only.",
          }),
        );
      }

      const slot = slotsMap.get(slot_id);
      if (!slot) {
        return formatToolFeedbackForModel(toolFeedbackInvalidSlot("reschedule_appointment", slot_id));
      }

      let attendeeEmail: string | null = resolveConfirmedEmail(ud, inlineEmail);
      if (!attendeeEmail) {
        attendeeEmail = await peekEmailForFrontDeskCall(ud, appointment_id);
        if (attendeeEmail) ud.confirmedEmail = attendeeEmail;
      }
      if (!attendeeEmail) {
        return formatToolFeedbackForModel(
          toolFeedbackMissingEmail({ tool: "reschedule_appointment", slotId: slot_id }),
        );
      }
      ud.confirmedEmail = attendeeEmail;

      return withLiveKitToolTelemetry(
        ud,
        "reschedule_appointment",
        { slot_id, appointment_id, confirmed },
        async () => {
          try {
            const appointment = await resolveFrontDeskAppointment(ud, appointment_id, "reschedule");
            const oldEventUri = externalEventUri(appointment.externalId);
            const when = formatBookedTimeLabel(appointment.startsAt, ud.timezone);

            const { rescheduled, bookedTimeLabel: local } = await writeRescheduleToProvider({
              userData: ud,
              appointmentId: appointment.id,
              oldEventUri,
              slot,
              slotId: slot_id,
              attendeeEmail,
              existingMetadata: appointment.metadata,
            });

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

            sendBookingSmsAsync(ud, rescheduled.slot.startTime);

            const spoken = await tryConfirmationSpeech(
              session,
              "reschedule",
              buildBookingSuccessLine(local),
              speakBookingLine,
            );
            const base = spoken
              ? toolFeedbackBookingCompleteSpoken()
              : toolFeedbackBookingCompleteSpeakNow(local);
            return formatToolFeedbackForModel({
              ...base,
              guidance: `${base.guidance} (Rescheduled from ${when} to ${local}.)`,
            });
          } catch (err) {
            if (err instanceof SlotUnavailableError) {
              ud.slotUnavailableCount += 1;
              const heardFailure = await tryConfirmationSpeech(
                session,
                "reschedule",
                buildBookingFailureLine(
                  "That new time isn't available anymore — I can check what else is open.",
                ),
                speakBookingLine,
              );
              return formatToolFeedbackForModel(
                toolFeedbackFromBookingWriteError(err, {
                  tool: "reschedule_appointment",
                  slotId: slot_id,
                  callerAlreadyHeardFailure: heardFailure,
                }),
              );
            }

            console.warn(
              JSON.stringify({
                source: "frontdesk-reschedule",
                event: "reschedule_failed",
                callId: ud.callId,
                error: err instanceof Error ? err.message : String(err),
              }),
            );
            const heardFailure = await tryConfirmationSpeech(
              session,
              "reschedule",
              buildBookingFailureLine(),
              speakBookingLine,
            );
            return formatToolFeedbackForModel(
              toolFeedbackFromBookingWriteError(err, {
                tool: "reschedule_appointment",
                slotId: slot_id,
                callerAlreadyHeardFailure: heardFailure,
              }),
            );
          }
        },
      );
    },
  });
}
