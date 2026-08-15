import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { getPrisma } from "@/lib/db";
import { calendarToolGuardFeedback } from "./booking-operation-guard";
import { markBookingOperationCancelled } from "./booking-operation";
import { markBookingCancelled, type FrontDeskUserData } from "./userdata";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import { runAsyncWorkWithBridge } from "../task-async-work-bridge";
import {
  cancelCalendlyEventResilient,
  formatBookedTimeLabel,
} from "./booking-recovery";
import {
  formatAppointmentResolveFailure,
  tryResolveFrontDeskAppointment,
} from "./appointment-lookup";
import { speakBookingLine } from "./booking-speech";
import { POST_CANCEL_FILLER } from "../booking-completion-messages";
import { syncFrontDeskCancelToCrm } from "@/lib/voice/crm/frontdesk-crm-sync";
import {
  formatToolFeedbackForModel,
  toolFeedbackFromBookingWriteError,
  toolFeedbackRecoverable,
  toolFeedbackSuccess,
} from "@/lib/voice/tool-feedback";

function externalEventUri(externalId: string | null | undefined): string | null {
  if (!externalId) return null;
  const raw = externalId.startsWith("calendly:") ? externalId.slice("calendly:".length) : externalId;
  return raw.trim() || null;
}

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
            next_action: "none",
            guidance: "Ask the caller to confirm before cancelling.",
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
          try {
            const when = formatBookedTimeLabel(appointment.startsAt, ud.timezone);
            const fromThisCall = appointment.callId === ud.callId;

            await runAsyncWorkWithBridge(session, POST_CANCEL_FILLER, async () => {
              const eventUri = externalEventUri(appointment.externalId);
              if (eventUri) {
                await cancelCalendlyEventResilient({
                  workspaceId: ud.workspaceId,
                  eventUri,
                  reason: "Canceled by caller on phone",
                });
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
            }).catch(() => undefined);

            if (fromThisCall) {
              return formatToolFeedbackForModel(
                toolFeedbackSuccess(
                  "Cancellation already spoken. Do not repeat. Ask if they need anything else or end_call.",
                  {
                    tool: "cancel_appointment",
                    caller_already_heard_success: true,
                    context: { appointment_id: appointment.id, when },
                  },
                ),
              );
            }
            return formatToolFeedbackForModel(
              toolFeedbackSuccess(
                `${line} That visit was from an earlier call, not the booking on this call.`,
                { tool: "cancel_appointment", context: { appointment_id: appointment.id } },
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
            await speakBookingLine(session, "I'm sorry — I couldn't cancel that on the calendar.");
            return formatToolFeedbackForModel(
              toolFeedbackFromBookingWriteError(err, {
                tool: "cancel_appointment",
                slotId: appointment.id,
                callerAlreadyHeardFailure: true,
              }),
            );
          }
        },
      );
    },
  });
}

export { resolveFrontDeskAppointment, tryResolveFrontDeskAppointment } from "./appointment-lookup";
