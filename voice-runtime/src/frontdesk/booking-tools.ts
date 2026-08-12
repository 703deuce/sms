import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { AvailableSlot } from "./calendly-calendar";
import { SlotUnavailableError } from "./calendly-calendar";
import {
  alreadyBookedToolMessage,
  formatBookedTimeLabel,
  lookupAppointmentIdForCallWithRetry,
  scheduleAppointmentResilient,
} from "./booking-recovery";
import { resolveConfirmedEmail } from "./email-collection-tools";
import { runEmailCollectionTask } from "./email-collection-task";
import { buildFrontDeskEndCallToolset } from "./end-frontdesk-call";
import { buildFrontDeskRescheduleAppointmentTool } from "./reschedule-appointment-tool";
import { syncFrontDeskBookingToCrm } from "@/lib/voice/crm/frontdesk-crm-sync";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import {
  BOOKING_COMPLETE_TOOL_RESULT,
  BOOKING_FAILED_TOOL_RESULT,
  buildBookingCompleteToolResultFallback,
  buildBookingFailureLine,
  buildBookingSuccessLine,
} from "../booking-completion-messages";
import { bookingFailureReason } from "../booking-error";
import { buildFrontDeskBusinessAnswerTool } from "./knowledge-tool";
import { buildFrontDeskCancelAppointmentTool } from "./cancel-appointment-tool";
import { buildFrontDeskTransferTool } from "./transfer-tool";
import { buildFrontDeskCheckBookingStatusTool } from "./check-booking-status-tool";
import { speakBookingLine } from "./booking-speech";
import { markBookingConfirmed, type FrontDeskUserData } from "./userdata";
import { sendBookingSmsAsync } from "./booking-sms";
import { markAppointmentBooked, persistCallState } from "@/lib/voice/real-estate/state";
import { notifyRealEstateStaff } from "@/lib/voice/real-estate/notifications";
import { syncRealEstateLeadToCrm } from "@/lib/voice/real-estate/crm-sync";

async function onRealEstateBookingConfirmed(userData: FrontDeskUserData): Promise<void> {
  if (!userData.callState) return;
  userData.callState = markAppointmentBooked(userData.callState);
  await persistCallState({
    workspaceId: userData.workspaceId,
    callId: userData.callId,
    callState: userData.callState,
  }).catch(() => undefined);
  void syncRealEstateLeadToCrm({
    workspaceId: userData.workspaceId,
    callId: userData.callId,
    callState: userData.callState,
    callerE164: userData.callerE164,
    businessName: userData.businessName,
    trigger: "intake_complete",
  }).catch(() => undefined);
  void notifyRealEstateStaff({
    workspaceId: userData.workspaceId,
    callId: userData.callId,
    callState: userData.callState,
    businessName: userData.businessName,
    event: "appointment_booked",
    callerE164: userData.callerE164,
    notifications: userData.realEstateCompiled?.notifications,
  }).catch(() => undefined);
}

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
        return `The current date and time is ${formatted}.`;
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
          return lines || "No slots available at the moment.";
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new llm.ToolError(
            `Could not load calendar availability: ${message}. Do not invent times — tell the caller the calendar is temporarily unavailable.`,
          );
        }
      });
    },
  });

  const scheduleAppointment = llm.tool({
    name: "schedule_appointment",
    description:
      "Book the appointment at slot_id after the caller picks a time. Collects email via AgentTask when needed.",
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

      const alreadyBooked = alreadyBookedToolMessage(userData);
      if (alreadyBooked) return alreadyBooked;

      const slot = slotsMap.get(slot_id);
      if (!slot) {
        throw new llm.ToolError(`Slot ${slot_id} was not found — call list_available_slots again.`);
      }

      userData.pendingSlotId = slot_id;

      const email = resolveConfirmedEmail(userData, inlineEmail);
      if (!email) {
        const collected = await runEmailCollectionTask(session);
        if (collected.declined || !collected.email) {
          return (
            "Email is required for the calendar invite. Explain that and offer to call back later."
          );
        }
        userData.confirmedEmail = collected.email;
      } else {
        userData.confirmedEmail = email;
      }

      const confirmedEmail = userData.confirmedEmail!;

      userData.bookingInProgress = true;
      try {
        return await withLiveKitToolTelemetry(
          userData,
          "schedule_appointment",
          { slot_id },
          async () => {
            try {
              const booked = await scheduleAppointmentResilient({
                session,
                slot,
                attendeeEmail: confirmedEmail,
              });
              const local = formatBookedTimeLabel(booked.slot.startTime, userData.timezone);
              markBookingConfirmed(userData, {
                slotId: slot_id,
                providerEventId: booked.eventUri,
                bookedTimeLabel: local,
              });
              void onRealEstateBookingConfirmed(userData);

              const appointmentId = await lookupAppointmentIdForCallWithRetry({
                workspaceId: userData.workspaceId,
                callId: userData.callId,
                eventUri: booked.eventUri,
              });
              if (appointmentId) {
                userData.booking = {
                  ...userData.booking!,
                  appointmentId,
                };
                void syncFrontDeskBookingToCrm({
                  workspaceId: userData.workspaceId,
                  callId: userData.callId,
                  appointmentId,
                  callerE164: userData.callerE164,
                  email: confirmedEmail,
                  businessName: userData.businessName,
                }).catch((err) => {
                  console.warn(
                    JSON.stringify({
                      source: "frontdesk-booking-tools",
                      event: "crm_sync_failed",
                      callId: userData.callId,
                      error: err instanceof Error ? err.message : String(err),
                    }),
                  );
                });
              }

              sendBookingSmsAsync(session, booked.slot.startTime);

              const spoken = await speakBookingLine(session, buildBookingSuccessLine(local));

              if (spoken) {
                return BOOKING_COMPLETE_TOOL_RESULT;
              }
              return buildBookingCompleteToolResultFallback(local);
            } catch (err) {
              if (err instanceof SlotUnavailableError) {
                userData.slotUnavailableCount += 1;
                await speakBookingLine(
                  session,
                  buildBookingFailureLine(
                    "That time slot isn't available anymore — I can check what else is open.",
                  ),
                );
                return BOOKING_FAILED_TOOL_RESULT;
              }
              const recovered = alreadyBookedToolMessage(userData);
              if (recovered) return recovered;

              console.warn(
                JSON.stringify({
                  source: "frontdesk-booking-tools",
                  event: "schedule_appointment_failed",
                  callId: userData.callId,
                  error: err instanceof Error ? err.message : String(err),
                }),
              );
              await speakBookingLine(session, buildBookingFailureLine(bookingFailureReason(err)));
              return BOOKING_FAILED_TOOL_RESULT;
            }
          },
        );
      } finally {
        userData.bookingInProgress = false;
      }
    },
  });

  const endCallTools = buildFrontDeskEndCallToolset(
    "End when the caller is done after booking or if they say goodbye.",
  );

  return {
    slotsMap,
    toolDefs: [
      getCurrentTime,
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
