import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { calendarToolGuardFeedback } from "./booking-operation-guard";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import {
  formatAppointmentResolveFailure,
  tryResolveFrontDeskAppointment,
} from "./appointment-lookup";
import { speakBookingLine } from "./booking-speech";
import { writeCancelToProvider } from "./cancel-provider-write";
import { syncFrontDeskCancelToCrm } from "@/lib/voice/crm/frontdesk-crm-sync";
import { tryConfirmationSpeech } from "./runtime-transaction";
import {
  formatToolFeedbackForModel,
  toolFeedbackFromBookingWriteError,
  toolFeedbackRecoverable,
  toolFeedbackSuccess,
} from "@/lib/voice/tool-feedback";
import type { FrontDeskUserData } from "./userdata";

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

      const blocked = calendarToolGuardFeedback(ud, "cancel_appointment");
      if (blocked) return formatToolFeedbackForModel(blocked);

      if (!confirmed) {
        return formatToolFeedbackForModel(
          toolFeedbackRecoverable({
            tool: "cancel_appointment",
            recovery_class: "MISSING_INFORMATION",
            reason: "confirmation_required",
            next_action: "continue_conversation",
            guidance: "Ask the caller to confirm before cancelling — one short question only.",
          }),
        );
      }

      const resolved = await tryResolveFrontDeskAppointment(ud, appointment_id, "cancel");
      if (!resolved.ok) {
        return formatAppointmentResolveFailure(resolved);
      }
      const appointment = resolved.appointment;

      return withLiveKitToolTelemetry(
        ud,
        "cancel_appointment",
        { appointment_id, confirmed },
        async () => {
          const fromThisCall = appointment.callId === ud.callId;
          try {
            const result = await writeCancelToProvider({
              userData: ud,
              appointmentId: appointment.id,
              externalId: appointment.externalId,
              startsAt: appointment.startsAt,
              fromThisCall,
            });

            const line = `Your appointment for ${result.whenLabel} has been cancelled.`;
            const heard = await tryConfirmationSpeech(session, "cancel", line, speakBookingLine);

            void syncFrontDeskCancelToCrm({
              workspaceId: ud.workspaceId,
              callId: ud.callId,
              appointmentId: appointment.id,
            }).catch(() => undefined);

            if (fromThisCall) {
              return formatToolFeedbackForModel(
                toolFeedbackSuccess(
                  heard
                    ? "Cancellation already spoken. Do not repeat. Ask if they need anything else or end_call."
                    : line,
                  {
                    tool: "cancel_appointment",
                    next_action: "continue_conversation",
                    caller_already_heard_success: heard,
                    context: { appointment_id: appointment.id, when: result.whenLabel },
                  },
                ),
              );
            }
            return formatToolFeedbackForModel(
              toolFeedbackSuccess(
                `${line} That visit was from an earlier call, not the booking on this call.`,
                {
                  tool: "cancel_appointment",
                  next_action: "continue_conversation",
                  context: { appointment_id: appointment.id },
                },
              ),
            );
          } catch (err) {
            console.warn(
              JSON.stringify({
                source: "frontdesk-cancel",
                event: "cancel_failed",
                callId: ud.callId,
                error: err instanceof Error ? err.message : String(err),
              }),
            );
            const heardFailure = await tryConfirmationSpeech(
              session,
              "cancel",
              "I'm sorry — I couldn't cancel that on the calendar.",
              speakBookingLine,
            );
            return formatToolFeedbackForModel(
              toolFeedbackFromBookingWriteError(err, {
                tool: "cancel_appointment",
                slotId: appointment.id,
                callerAlreadyHeardFailure: heardFailure,
              }),
            );
          }
        },
      );
    },
  });
}

export { resolveFrontDeskAppointment, tryResolveFrontDeskAppointment } from "./appointment-lookup";
