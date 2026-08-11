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

/**
 * Lets the agent verify whether a booking completed — for callers waiting during/after Calendly writes.
 */
export function buildFrontDeskCheckBookingStatusTool() {
  return llm.tool({
    name: "check_booking_status",
    description:
      "Check whether the caller's appointment is confirmed on the calendar. " +
      "Use when they ask if booking went through or while waiting.",
    parameters: z.object({}),
    execute: async (_args, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;

      return withLiveKitToolTelemetry(ud, "check_booking_status", {}, async () => {
        if (isBookingConfirmed(ud)) {
          const when =
            ud.booking?.bookedTimeLabel || ud.bookedTimeLabel || "the time you chose";
          return (
            `confirmed: The appointment is confirmed for ${when}. ` +
            "Tell the caller they're all set and a confirmation text was sent."
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
          return (
            `confirmed: The appointment is confirmed for ${when}. ` +
            "Tell the caller they're all set and a confirmation text was sent."
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
            return (
              `confirmed: The appointment is confirmed for ${when}. ` +
              "Tell the caller they're all set and a confirmation text was sent."
            );
          }
        }

        if (ud.pendingSlotId && ud.confirmedEmail) {
          return (
            "pending: The calendar booking is still processing. " +
            "Tell the caller you're still putting it on the calendar and to hold for a moment, " +
            "then call check_booking_status again in a few seconds."
          );
        }

        return (
          "not_found: No confirmed appointment on file for this call yet. " +
          "Do not claim a booking succeeded. Offer to try schedule_appointment again or list_available_slots."
        );
      });
    },
  });
}
