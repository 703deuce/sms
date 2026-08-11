import { llm, voice } from "@livekit/agents";
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
import {
  NEEDS_EMAIL_TOOL_RESULT,
  buildFrontDeskEmailTools,
  resolveConfirmedEmail,
} from "./email-collection-tools";
import { buildFrontDeskRescheduleAppointmentTool } from "./reschedule-appointment-tool";
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
import { buildFrontDeskBusinessAnswerTool } from "./knowledge-tool";
import { buildFrontDeskCancelAppointmentTool } from "./cancel-appointment-tool";
import { buildFrontDeskTransferTool } from "./transfer-tool";
import { buildFrontDeskCheckBookingStatusTool } from "./check-booking-status-tool";
import { speakBookingLine } from "./booking-speech";
import { markBookingConfirmed, type FrontDeskUserData } from "./userdata";
import { sendBookingSmsAsync } from "./booking-sms";

function buildFrontDeskInstructions(businessLabel: string): string {
  return [
    `You are Front-Desk for ${businessLabel}, a helpful and efficient voice assistant. `,
    "A great interaction ends with the caller booked into an appointment slot that works ",
    "for them, reached through a warm, flowing conversation with as little ",
    "back-and-forth as possible. ",
    "You do not inherently know the current date or time — call get_current_time ",
    "whenever you need to reason about dates, such as interpreting a request like ",
    "'next Tuesday' or checking whether a date the caller mentions has already passed. ",
    "Your output is synthesized directly to speech, so produce a natural verbatim ",
    "transcript, not polished text. Start responses with real reactions (oh, hmm, ah) ",
    'and fillers (um, uh, like) rather than "Absolutely" or "Certainly", with ',
    "mid-sentence fillers (like, you know, I mean) where they'd naturally fall. Mirror ",
    "the caller's formality: if they're casual, use informal phrasing (gotcha, alright, ",
    "gonna, kinda, lemme, yeah); if they're more formal, keep your speech cleaner. Vary ",
    "your openers across turns — if you opened the last turn with 'gotcha', pick ",
    "'alright' or 'okay' this turn; don't repeat the same opener back-to-back. ",
    "Never speak internal reasoning or planning aloud — do not say things like ",
    "'I need to specify the range', 'I need to collect the email', 'let me ask for it', ",
    "'I realize I should have', or 'I need to determine'. Only say what you would say ",
    "directly to the caller. ",
    "Be proactive: when the caller greets you, use it to move things forward (e.g. ",
    "'Would you like to book a time?') rather than just greeting back. ",
    "Commitment rule: if you tell the caller you will check the calendar, look up times, ",
    "book, or do anything else — start that action with the matching tool call in the ",
    "same turn. Never announce a next step and then stop. ",
    "When talking about availability, call list_available_slots and offer a few clear ",
    "options at a time. Say times like 'Monday at 2' — avoid timezones and AM/PM labels. ",
    "Only offer times that list_available_slots returned — never invent slots. ",
    "Call get_business_answer for hours, pricing, services, policies, or FAQs — including during booking. ",
    "To cancel an appointment, confirm with the caller then call cancel_appointment with confirmed true. ",
    "If cancel_appointment says no booking completed on this call, do not claim a cancellation succeeded. ",
    "To reach a human, confirm with the caller then call transfer_to_human. ",
    "Booking workflow: after the caller picks a slot, call schedule_appointment with that ",
    "slot_id. If it returns NEEDS_EMAIL, ask for their email, call update_email_address and ",
    "confirm_email_address, then schedule_appointment again with the same slot_id. ",
    "To reschedule, call list_available_slots, confirm the new time, then reschedule_appointment. ",
    "Never call schedule_appointment before the caller confirms a time. ",
    "If schedule_appointment reports already_completed, tell the caller they're confirmed — ",
    "do not book again or re-ask for email. ",
    "Never claim a booking succeeded unless schedule_appointment returns BOOKING_COMPLETE_ALREADY_SPOKEN. ",
    "If the caller asks whether booking went through, call check_booking_status. ",
    "If schedule_appointment returns BOOKING_FAILED_ALREADY_SPOKEN, the caller already heard that booking failed — ",
    "do NOT say they are confirmed or that a text was sent. ",
    "After a successful booking the runtime speaks one confirmation — do not repeat it or give ",
    "multiple goodbyes. When the caller is done, call end_call once with a brief farewell. ",
    "A confirmation text is sent automatically to the caller's phone after booking — ",
    "never ask for their number or offer to send texts manually.",
  ].join("");
}

export function createFrontDeskBookingAgent(input: {
  businessName: string;
  timezone: string;
}) {
  const slotsMap = new Map<string, AvailableSlot>();
  const label = input.businessName.trim() || "our office";
  const emailTools = buildFrontDeskEmailTools();

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
      "Book the appointment at slot_id after the caller picks a time. Returns NEEDS_EMAIL if email is not confirmed yet.",
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
        return NEEDS_EMAIL_TOOL_RESULT;
      }
      userData.confirmedEmail = email;

      await speakBookingLine(session, POST_EMAIL_BOOKING_FILLER);

      return withLiveKitToolTelemetry(
        userData,
        "schedule_appointment",
        { slot_id },
        async () => {
          try {
            const booked = await scheduleAppointmentResilient({
              session,
              slot,
              attendeeEmail: email,
            });
            const local = formatBookedTimeLabel(booked.slot.startTime, userData.timezone);
            markBookingConfirmed(userData, {
              slotId: slot_id,
              providerEventId: booked.eventUri,
              bookedTimeLabel: local,
            });

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
                email,
                businessName: userData.businessName,
              }).catch((err) => {
                console.warn(
                  JSON.stringify({
                    source: "frontdesk-booking-agent",
                    event: "crm_sync_failed",
                    callId: userData.callId,
                    error: err instanceof Error ? err.message : String(err),
                  }),
                );
              });
            }

            sendBookingSmsAsync(session, booked.slot.startTime);

            await speakBookingLine(session, buildBookingSuccessLine(local));

            return BOOKING_COMPLETE_TOOL_RESULT;
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
                source: "frontdesk-booking-agent",
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
    },
  });

  const endCall = llm.tool({
    name: "end_call",
    description:
      "End the call when the conversation is complete — use after booking when the caller is done.",
    parameters: z.object({
      reason: z.string().optional(),
    }),
    execute: async ({ reason }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      session.shutdown({ reason: reason || "caller_done" });
      return "Call ended.";
    },
  });

  return voice.Agent.create<FrontDeskUserData>({
    instructions: buildFrontDeskInstructions(label),
    tools: llm.toToolContext([
      getCurrentTime,
      listAvailableSlots,
      scheduleAppointment,
      ...emailTools,
      buildFrontDeskBusinessAnswerTool(),
      buildFrontDeskCancelAppointmentTool(),
      buildFrontDeskRescheduleAppointmentTool(slotsMap),
      buildFrontDeskCheckBookingStatusTool(),
      buildFrontDeskTransferTool(),
      endCall,
    ]),
    onEnter: async (agentCtx) => {
      const session = agentCtx.session as AgentSession<FrontDeskUserData>;
      const hour = session.userData.cal.now().getHours();
      const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
      await session.generateReply({
        instructions:
          `Say hello and welcome the caller — it's currently ${timeOfDay} their time. ` +
          `You're the front desk for ${label} and you're here to help them schedule a visit. ` +
          "Invite them to book an appointment and ask what time works. Keep it warm and brief.",
        toolChoice: "none",
        allowInterruptions: false,
      });
    },
  });
}
