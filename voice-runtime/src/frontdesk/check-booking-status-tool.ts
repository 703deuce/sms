import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { getPrisma } from "@/lib/db";
import {
  formatBookedTimeLabel,
  lookupAppointmentIdForCall,
} from "./booking-recovery";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import { isBookingConfirmed, markBookingConfirmed, type FrontDeskUserData } from "./userdata";
import {
  formatToolFeedbackForModel,
  toolFeedbackRecoverable,
  toolFeedbackSuccess,
  toolFeedbackTerminal,
} from "@/lib/voice/tool-feedback";

async function appointmentOnThisCall(
  ud: FrontDeskUserData,
): Promise<{ id: string; startsAt: Date; externalId: string | null } | null> {
  const prisma = getPrisma();
  return prisma.voiceAppointment.findFirst({
    where: {
      workspaceId: ud.workspaceId,
      callId: ud.callId,
      status: { in: ["active", "confirmed"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, startsAt: true, externalId: true },
  });
}

export function buildFrontDeskCheckBookingStatusTool() {
  return llm.tool({
    name: "check_booking_status",
    description:
      "Check whether the caller's appointment is confirmed on the calendar. " +
      "Use ONLY when the caller explicitly asks if booking worked — never right after schedule_appointment succeeds.",
    parameters: z.object({}),
    execute: async (_args, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;

      return withLiveKitToolTelemetry(ud, "check_booking_status", {}, async () => {
        if (isBookingConfirmed(ud)) {
          const when =
            ud.booking?.bookedTimeLabel || ud.bookedTimeLabel || "the time you chose";
          return formatToolFeedbackForModel(
            toolFeedbackSuccess(
              `Appointment IS confirmed for ${when}. Tell the caller confidently they are all set. ` +
                "Do not call check_booking_status again.",
              {
                tool: "check_booking_status",
                caller_already_heard_success: true,
                next_action: "end_call",
              },
            ),
          );
        }

        if (ud.bookingInProgress) {
          return formatToolFeedbackForModel(
            toolFeedbackRecoverable({
              tool: "check_booking_status",
              recovery_class: "OPERATION_IN_PROGRESS",
              reason: "writing_calendar",
              next_action: "check_booking_status",
              guidance:
                "Calendar write still finishing. Tell the caller to hold one moment, then call check_booking_status again.",
            }),
          );
        }

        const opState = ud.bookingOperation?.state;
        if (opState === "collecting_email") {
          return formatToolFeedbackForModel(
            toolFeedbackRecoverable({
              tool: "check_booking_status",
              recovery_class: "MISSING_INFORMATION",
              reason: "missing_email",
              field_id: "email",
              next_action: "collect_email_then_retry",
              guidance:
                "Still need email for the invite. Ask for email and use record_booking_email.",
            }),
          );
        }
        if (opState === "failed") {
          return formatToolFeedbackForModel(
            toolFeedbackRecoverable({
              tool: "check_booking_status",
              recovery_class: "UNKNOWN_FAILURE",
              reason: ud.bookingOperation?.errorReason ?? "booking_failed",
              next_action: "list_slots_then_retry",
              guidance:
                "Booking did not complete. Do not claim they are booked. Offer list_available_slots or take_message.",
            }),
          );
        }

        const row = await appointmentOnThisCall(ud);
        if (row) {
          const when = formatBookedTimeLabel(row.startsAt, ud.timezone);
          markBookingConfirmed(ud, {
            appointmentId: row.id,
            providerEventId: row.externalId || undefined,
            bookedTimeLabel: when,
          });
          return formatToolFeedbackForModel(
            toolFeedbackSuccess(
              `Appointment is confirmed for ${when}. Tell the caller they're all set.`,
              { tool: "check_booking_status", context: { appointment_id: row.id } },
            ),
          );
        }

        const recoveredId = await lookupAppointmentIdForCall({
          workspaceId: ud.workspaceId,
          callId: ud.callId,
        });
        if (recoveredId) {
          const prisma = getPrisma();
          const appt = await prisma.voiceAppointment.findFirst({
            where: { id: recoveredId, workspaceId: ud.workspaceId },
            select: { id: true, startsAt: true, externalId: true },
          });
          if (appt?.startsAt) {
            const when = formatBookedTimeLabel(appt.startsAt, ud.timezone);
            markBookingConfirmed(ud, {
              appointmentId: appt.id,
              providerEventId: appt.externalId || undefined,
              bookedTimeLabel: when,
            });
            return formatToolFeedbackForModel(
              toolFeedbackSuccess(
                `Appointment is confirmed for ${when}. Tell the caller they're all set.`,
                { tool: "check_booking_status", context: { appointment_id: appt.id } },
              ),
            );
          }
        }

        if (ud.pendingSlotId && ud.confirmedEmail) {
          return formatToolFeedbackForModel(
            toolFeedbackRecoverable({
              tool: "check_booking_status",
              recovery_class: "OPERATION_IN_PROGRESS",
              reason: "pending_write",
              next_action: "check_booking_status",
              guidance:
                "Booking still processing. Ask caller to hold, then check_booking_status again shortly.",
            }),
          );
        }

        return formatToolFeedbackForModel(
          toolFeedbackTerminal({
            tool: "check_booking_status",
            recovery_class: "RESOURCE_UNAVAILABLE",
            reason: "not_found",
            next_action: "list_slots_then_retry",
            guidance:
              "No confirmed appointment on this call yet. Offer schedule_appointment or list_available_slots.",
          }),
        );
      });
    },
  });
}
