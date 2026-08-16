import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { AvailableSlot } from "./calendly-calendar";
import {
  alreadyBookedToolMessage,
} from "./booking-recovery";
import { resolveConfirmedEmail } from "./email-collection-tools";
import {
  buildDeclineBookingEmailTool,
  buildRecordBookingEmailTool,
} from "./booking-email-inline";
import { findBookingPrerequisiteGaps } from "./booking-prerequisites";
import { prefillReceptionistFieldsForBooking } from "./booking-prefill";
import { executeScheduleAppointmentForSession } from "./runtime-schedule-appointment";
import { calendarToolGuardFeedback } from "./booking-operation-guard";
import { buildFrontDeskEndCallToolset } from "./end-frontdesk-call";
import { buildFrontDeskRescheduleAppointmentTool } from "./reschedule-appointment-tool";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import {
  formatToolFeedbackForModel,
  toolFeedbackBookingInProgress,
  toolFeedbackInvalidSlot,
  toolFeedbackMissingEmail,
  toolFeedbackMissingField,
  toolFeedbackFromError,
  toolFeedbackSuccess,
} from "../tool-feedback";
import { buildFrontDeskBusinessAnswerTool } from "./knowledge-tool";
import { buildFrontDeskCancelAppointmentTool } from "./cancel-appointment-tool";
import { buildFrontDeskTransferTool } from "./transfer-tool";
import { buildFrontDeskCheckBookingStatusTool } from "./check-booking-status-tool";
import { type FrontDeskUserData } from "./userdata";

export type FrontDeskBookingTools = {
  slotsMap: Map<string, AvailableSlot>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolDefs: any[];
};

export function buildFrontDeskBookingTools(input: {
  timezone: string;
  includeBooking?: boolean;
}): FrontDeskBookingTools {
  const includeBooking = input.includeBooking !== false;
  const slotsMap = new Map<string, AvailableSlot>();

  const getCurrentTime = llm.tool({
    name: "get_current_time",
    description:
      "Get the current date and time. Call whenever you need to reason about dates.",
    parameters: z.object({}),
    execute: async (_args, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      return withLiveKitToolTelemetry(session.userData, "get_current_time", {}, async () => {
        const now = session.userData.cal.now();
        const formatted = now.toLocaleString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: session.userData.timezone,
        });
        return formatToolFeedbackForModel(
          toolFeedbackSuccess(`The current date and time is ${formatted}.`, {
            tool: "get_current_time",
            next_action: "continue_conversation",
            guidance:
              "Use this clock for relative dates. Continue the caller's request — one thought at a time.",
          }),
        );
      });
    },
  });

  const listAvailableSlots = llm.tool({
    name: "list_available_slots",
    description:
      "Return available appointment slots as plain text. Call when checking the calendar.",
    parameters: z.object({
      range: z
        .enum(["+2week", "+1month", "+3month", "default"])
        .describe("How far ahead to search"),
    }),
    execute: async ({ range }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const blocked = calendarToolGuardFeedback(session.userData, "list_available_slots");
      if (blocked) return formatToolFeedbackForModel(blocked);

      return withLiveKitToolTelemetry(session.userData, "list_available_slots", { range }, async () => {
        const cal = session.userData.cal;
        const rangeDays = range === "+1month" || range === "+3month" ? 14 : 14;
        try {
          const slots = await cal.listAvailableSlots({ daysAhead: rangeDays });
          slotsMap.clear();
          for (const slot of slots) {
            slotsMap.set(slot.slotId, slot);
          }
          const lines = cal.formatSlotsForModel(slots);
          const slotText = lines || "No slots available at the moment.";
          const offerGuidance = lines
            ? "Offer up to two or three times from the list above. When the caller picks one, call schedule_appointment with that slot_id. Ask only one question — which time works?"
            : "No openings right now. Tell the caller briefly, then offer to check again later or take a message.";
          return formatToolFeedbackForModel(
            toolFeedbackSuccess(`${slotText}\n\n${offerGuidance}`, {
              tool: "list_available_slots",
              next_action: lines ? "offer_slots_and_confirm" : "continue_conversation",
              context: { slot_count: slots.length },
              guidance: `${slotText}\n\n${offerGuidance}`,
            }),
          );
        } catch (err) {
          return formatToolFeedbackForModel(
            toolFeedbackFromError(err, {
              tool: "list_available_slots",
              runtimeHandledRetry: true,
            }),
          );
        }
      });
    },
  });

  const scheduleAppointment = llm.tool({
    name: "schedule_appointment",
    description:
      "Book the appointment at slot_id after the caller picks a time. " +
      "Returns TOOL_FEEDBACK recoverable_failure when email or other fields are missing — collect and retry.",
    parameters: z.object({
      slot_id: z.string().describe("Slot id from list_available_slots"),
      email: z
        .string()
        .optional()
        .describe("Caller email if already collected in conversation"),
    }),
    execute: async ({ slot_id, email: inlineEmail }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const userData = session.userData;

      const calendarBlocked = calendarToolGuardFeedback(userData, "schedule_appointment");
      if (calendarBlocked) return formatToolFeedbackForModel(calendarBlocked);

      const alreadyBooked = alreadyBookedToolMessage(userData);
      if (alreadyBooked) {
        return formatToolFeedbackForModel(
          toolFeedbackSuccess(alreadyBooked, {
            tool: "schedule_appointment",
            recovery_class: "DUPLICATE_OPERATION",
            reason: "already_completed",
            next_action: "end_call",
            caller_already_heard_success: true,
          }),
        );
      }

      if (!canStartScheduleAppointment(userData)) {
        return formatToolFeedbackForModel(toolFeedbackBookingInProgress("schedule_appointment"));
      }

      const slot = slotsMap.get(slot_id);
      if (!slot) {
        return formatToolFeedbackForModel(toolFeedbackInvalidSlot("schedule_appointment", slot_id));
      }

      userData.pendingSlotId = slot_id;

      prefillReceptionistFieldsForBooking(session);

      const prerequisiteGaps = findBookingPrerequisiteGaps(userData, inlineEmail);
      if (prerequisiteGaps.length > 0) {
        const first = prerequisiteGaps[0];
        if (first.kind === "email") {
          return formatToolFeedbackForModel(
            toolFeedbackMissingEmail({ tool: "schedule_appointment", slotId: slot_id }),
          );
        }
        return formatToolFeedbackForModel(
          toolFeedbackMissingField({
            tool: "schedule_appointment",
            slotId: slot_id,
            fieldId: first.fieldId,
            fieldLabel: first.label,
            hint:
              `Ask for their ${first.label} in one short question — runtime will save from the caller transcript.`,
          }),
        );
      }

      const resolvedEmail = resolveConfirmedEmail(userData, inlineEmail);
      if (resolvedEmail) {
        userData.confirmedEmail = resolvedEmail;
      }

      return await executeScheduleAppointmentForSession(session, slotsMap, slot_id, inlineEmail);
    },
  });

  const recordBookingEmail = buildRecordBookingEmailTool();
  const declineBookingEmail = buildDeclineBookingEmailTool();

  const endCallTools = buildFrontDeskEndCallToolset(
    "End when the caller is done after booking or if they say goodbye.",
  );

  return {
    slotsMap,
    toolDefs: [
      getCurrentTime,
      recordBookingEmail,
      declineBookingEmail,
      ...(includeBooking
        ? [
            listAvailableSlots,
            scheduleAppointment,
            buildFrontDeskCancelAppointmentTool(),
            buildFrontDeskRescheduleAppointmentTool(slotsMap),
            buildFrontDeskCheckBookingStatusTool(),
          ]
        : []),
      buildFrontDeskBusinessAnswerTool(),
      buildFrontDeskTransferTool(),
      ...endCallTools.tools,
    ],
  };
}
